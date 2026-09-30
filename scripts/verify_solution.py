"""Executes a generated challenge's reference solution against its example and test cases.

Reads {"solution": str, "tests": [{"input": str, "output": str}, ...]} as JSON on stdin and
prints one JSON line: {"ok": true, "outputs": [repr, ...]} or {"ok": false, "error": str}.

Mirrors how the app calls the solution (lib/pyodide-service.ts): the input literal is
ast.literal_eval'd and a tuple is unpacked as positional arguments.
"""
import ast
import json
import sys
import traceback


def fail(msg):
    print(json.dumps({"ok": False, "error": msg}))
    sys.exit(0)


def main():
    payload = json.load(sys.stdin)
    ns = {"__name__": "__pyassistant_reference__"}  # so a stray __main__ guard doesn't fire
    try:
        exec(payload["solution"], ns)
    except BaseException:
        fail("solution failed to load: " + traceback.format_exc(limit=3))
    solve = ns.get("solve")
    if not callable(solve):
        fail("solution does not define a callable 'solve'")

    outputs = []
    for i, t in enumerate(payload["tests"]):
        label = f"test {i + 1} (input {t['input']!r})"
        try:
            args = ast.literal_eval(t["input"])
            expected = ast.literal_eval(t["output"])
        except Exception as e:
            fail(f"{label}: input/output is not a valid Python literal: {e}")
        try:
            actual = solve(*args) if isinstance(args, tuple) else solve(args)
        except BaseException:
            fail(f"{label}: solution raised: " + traceback.format_exc(limit=3))
        if actual != expected or type(actual) is not type(expected):
            fail(f"{label}: expected {t['output']} but solution returned {actual!r}")
        outputs.append(repr(actual))
    print(json.dumps({"ok": True, "outputs": outputs}))


main()
