/**
 * Code stages: the learner writes JavaScript and hidden tests check it. Tests run the same way in
 * Node (content tests check every reference solution) and in the browser (inside a throwaway Web
 * Worker with a time limit, so an infinite loop can't freeze the page).
 */

export interface CodeTest {
  name: string;
  /** Statements that call assert(cond, msg) or assertEqual(actual, expected, msg). */
  code: string;
}

export interface CodeTestResult {
  name: string;
  passed: boolean;
  message: string;
}

/**
 * Runs each test in a fresh scope: given code, then the learner's code, then the test.
 * Self-contained on purpose: it is serialised with toString() into the worker, so it must not
 * reference anything outside its own body.
 */
export function runCodeTests(given: string, source: string, tests: CodeTest[]): CodeTestResult[] {
  /** Objects compare by content, whatever order their keys were added in. */
  function normalise(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(normalise);
    if (value instanceof Map) return normalise(Object.fromEntries(value));
    if (value instanceof Set) return Array.from(value).map(normalise);
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(value).sort()) out[key] = normalise((value as Record<string, unknown>)[key]);
      return out;
    }
    return value;
  }
  function show(value: unknown): string {
    try {
      const text = JSON.stringify(normalise(value));
      return text === undefined ? String(value) : text;
    } catch {
      return String(value);
    }
  }
  function assert(condition: unknown, message?: string) {
    if (!condition) throw new Error(message || "Assertion failed");
  }
  function assertEqual(actual: unknown, expected: unknown, message?: string) {
    if (show(actual) !== show(expected)) {
      throw new Error((message ? message + ": " : "") + "expected " + show(expected) + ", got " + show(actual));
    }
  }
  const results: CodeTestResult[] = [];
  for (let i = 0; i < tests.length; i += 1) {
    const test = tests[i];
    try {
      const run = new Function("assert", "assertEqual", '"use strict";\n' + given + "\n" + source + "\n;\n" + test.code);
      run(assert, assertEqual);
      results.push({ name: test.name, passed: true, message: "Passed" });
    } catch (error) {
      const message = error instanceof Error ? error.name + ": " + error.message : String(error);
      results.push({ name: test.name, passed: false, message: message.replace(/^Error: /, "") });
    }
  }
  return results;
}

/** Runs the tests in a disposable Web Worker, giving up after `timeoutMs`. */
export function runCodeTestsInWorker(given: string, source: string, tests: CodeTest[], timeoutMs = 3000): Promise<CodeTestResult[]> {
  const script = `self.onmessage = function (e) { var d = e.data; self.postMessage((${runCodeTests.toString()})(d.given, d.source, d.tests)); };`;
  const url = URL.createObjectURL(new Blob([script], { type: "text/javascript" }));
  const worker = new Worker(url);
  return new Promise((resolve) => {
    const finish = (results: CodeTestResult[]) => {
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve(results);
    };
    const timer = setTimeout(
      () => finish(tests.map((t) => ({ name: t.name, passed: false, message: `Stopped after ${timeoutMs / 1000}s. Is there an infinite loop?` }))),
      timeoutMs,
    );
    worker.onmessage = (e: MessageEvent<CodeTestResult[]>) => finish(e.data);
    worker.onerror = (e) => {
      e.preventDefault();
      finish(tests.map((t) => ({ name: t.name, passed: false, message: e.message || "The code could not run." })));
    };
    worker.postMessage({ given, source, tests });
  });
}
