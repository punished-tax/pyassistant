// Offline challenge generator: generates challenges, EXECUTES each reference solution against its
// own example/test cases with real Python, and only keeps ones that pass. Dry-run by default.
//
//   node --env-file=.env.local scripts/generate-challenges.mjs --start 2026-10-01 --days 5
//   node --env-file=.env.local scripts/generate-challenges.mjs --dates 2026-10-01,2026-10-04 --difficulty hard
//   ... --write            store passing challenges in Upstash (skips dates that already have one)
//   ... --write --force    also overwrite dates that already have a challenge
//
// Needs Node 24+ (imports lib/challenges.ts directly) and Python on PATH as python/python3/py.
// WARNING: this runs model-generated Python on your machine (10s timeout, no other sandboxing).
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cosineSimilarity } from 'ai';
import { Redis } from '@upstash/redis';
import { generateUniqueChallenge, storeChallenge, SIMILARITY_THRESHOLD } from '../lib/challenges.ts';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };

const RUNNER = fileURLToPath(new URL('./verify_solution.py', import.meta.url));
const OUT = opt('out') ?? 'generated-challenges.json';

// Harder problems get a stronger model and more reasoning; reasoning tokens share the output budget.
const CONFIG = {
  easy:   { model: process.env.CHALLENGE_MODEL_EASY   ?? 'gpt-5-mini', reasoningEffort: 'medium', maxOutputTokens: 12000 },
  medium: { model: process.env.CHALLENGE_MODEL_MEDIUM ?? 'gpt-5-mini', reasoningEffort: 'medium', maxOutputTokens: 12000 },
  hard:   { model: process.env.CHALLENGE_MODEL_HARD   ?? 'gpt-5',      reasoningEffort: 'medium', maxOutputTokens: 24000 },
};

function findPython() {
  for (const cmd of ['python', 'python3', 'py']) {
    if (spawnSync(cmd, ['--version']).status === 0) return cmd;
  }
  throw new Error('No Python interpreter found (tried python, python3, py).');
}
const PYTHON = findPython();

async function verify(challenge) {
  const tests = [challenge.inputOutput, ...challenge.testCases];
  const run = spawnSync(PYTHON, ['-I', RUNNER], {
    input: JSON.stringify({ solution: challenge.solution, tests }),
    encoding: 'utf8', timeout: 10_000,
  });
  if (run.error) return { error: `runner failed: ${run.error.code === 'ETIMEDOUT' ? 'timed out after 10s' : run.error.message}` };
  let result;
  try { result = JSON.parse(run.stdout.trim().split('\n').pop()); }
  catch { return { error: `runner produced no result: ${(run.stderr || run.stdout).slice(0, 300)}` }; }
  if (!result.ok) return { error: result.error };
  // Keep expected outputs in canonical repr() form, which is how the app compares them.
  const [example, ...rest] = result.outputs;
  return {
    challenge: {
      ...challenge,
      inputOutput: { ...challenge.inputOutput, output: example },
      testCases: challenge.testCases.map((t, i) => ({ ...t, output: rest[i] })),
    },
  };
}

function datesToGenerate() {
  const explicit = opt('dates');
  if (explicit) return explicit.split(',');
  const start = opt('start');
  if (!start) throw new Error('Pass --dates a,b,c or --start YYYY-MM-DD [--days N].');
  const days = Number(opt('days') ?? 1);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(`${start}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

const kv = Redis.fromEnv();

// lib/challenges.ts skips its duplicate checks when Redis is unreachable (right for the website,
// wrong here), so refuse to run without them.
try {
  await kv.exists('meta:available_challenge_dates');
} catch (e) {
  console.error(`Cannot reach Upstash (${e.cause?.code ?? e.message}), so duplicate detection would be skipped. Aborting.`);
  if (e.cause?.code === 'UNABLE_TO_GET_ISSUER_CERT') {
    console.error('A proxy/antivirus is probably intercepting TLS. Export its root CA as a .pem and rerun with NODE_EXTRA_CA_CERTS=path\\to\\ca.pem (do not disable certificate verification).');
  }
  process.exit(2);
}
const forcedDifficulty = opt('difficulty');
const results = [];
const batchEmbeddings = []; // so a dry run also catches duplicates *within* this batch

for (const date of datesToGenerate()) {
  if (flag('write') && !flag('force') && await kv.exists(`challenge:${date}`)) {
    console.log(`${date}: already has a challenge, skipping (use --force to overwrite)`);
    continue;
  }
  const difficulty = forcedDifficulty ?? ['easy', 'medium', 'hard'][Math.floor(Math.random() * 3)];
  let accepted = null;
  for (let pass = 1; pass <= 3 && !accepted; pass++) {
    const generated = await generateUniqueChallenge(date, { difficulty, ...CONFIG[difficulty], verify });
    if (!generated) break;
    const clash = generated.embedding && batchEmbeddings.find((b) => cosineSimilarity(generated.embedding, b.embedding) >= SIMILARITY_THRESHOLD);
    if (clash) { console.warn(`${date}: too similar to ${clash.date} in this batch ("${generated.challenge.questionTitle}"), regenerating`); continue; }
    accepted = generated;
  }
  if (!accepted) { console.error(`${date}: FAILED to produce a verified, unique ${difficulty} challenge`); results.push({ date, difficulty, failed: true }); continue; }
  if (accepted.embedding) batchEmbeddings.push({ date, embedding: accepted.embedding });
  if (flag('write')) await storeChallenge(accepted.challenge, accepted.embedding);
  console.log(`${date}: OK ${difficulty} "${accepted.challenge.questionTitle}"${flag('write') ? ' (stored)' : ''}`);
  results.push(accepted.challenge);
}

writeFileSync(OUT, JSON.stringify(results, null, 2));
console.log(`\nWrote ${results.filter((r) => !r.failed).length}/${results.length} challenges to ${OUT}${flag('write') ? '' : ' (dry run: nothing stored in Upstash)'}`);
process.exit(results.some((r) => r.failed) ? 1 : 0);
