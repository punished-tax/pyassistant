// src/types/test-result.ts

export interface TestCase {
    input: string;
    output: string; // Expected output (as a Python literal string)
  }
  
  export type TestExecutionResult =
    | {
        status: 'success';
        passedCount: number; // How many tests passed (should be all)
        stdout?: string; // Optional: Combined stdout from all runs (might be noisy)
      }
    | {
        status: 'failed';
        testCaseNumber: number; // Index + 1 of the failing test
        input: string;
        expectedOutput: string;
        actualOutput: string; // The repr() of the actual result
        error?: string | null; // Runtime error message, if any during this test
        stdout?: string; // stdout/stderr from the failing test run
      }
    | {
        status: 'error'; // Setup error (syntax, solve not defined, etc.)
        message: string;
        stdout?: string; // stdout/stderr captured before the error occurred
      };