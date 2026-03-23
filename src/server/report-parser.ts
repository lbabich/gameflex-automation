import { Effect } from 'effect';
import { ParseError } from './errors';
import type { TestResult, TestStep } from './services/runner/types';

type StepNode = {
  title?: string;
  duration?: number;
  error?: { message?: string };
  steps?: StepNode[];
};

type SuiteNode = {
  title?: string;
  suites?: SuiteNode[];
  specs?: SpecNode[];
};

type SpecNode = {
  title?: string;
  tests?: TestNode[];
};

type TestNode = {
  title?: string;
  projectName?: string;
  results?: Array<{
    status?: string;
    duration?: number;
    error?: { message?: string };
    stdout?: Array<{ text?: string }>;
    steps?: StepNode[];
    attachments?: Array<{ name?: string; path?: string; contentType?: string }>;
    annotations?: Array<{ type?: string; description?: string }>;
  }>;
};

type ReportJson = {
  suites?: SuiteNode[];
  errors?: Array<{ message?: string }>;
};

function flattenSpecs(suite: SuiteNode): SpecNode[] {
  const specs: SpecNode[] = [...(suite.specs ?? [])];

  for (const child of suite.suites ?? []) {
    specs.push(...flattenSpecs(child));
  }

  return specs;
}

function toTestResult(spec: SpecNode, test: TestNode): TestResult | null {
  const result = test.results?.[0];

  if (!result) {
    return null;
  }

  const steps = (result.steps ?? [])
    .map((step): TestStep => {
      return {
        title: step.title ?? '',
        duration: step.duration ?? 0,
        error: step.error?.message,
      };
    })
    .filter((step) => {
      return step.title;
    });

  const screenshotPaths = (result.attachments ?? [])
    .filter((a) => {
      return a.contentType === 'image/png' && a.path;
    })
    .map((a) => {
      return a.path as string;
    });

  const annotations: Record<string, string> = {};

  for (const annotation of result.annotations ?? []) {
    if (annotation.type) {
      annotations[annotation.type] = annotation.description ?? '';
    }
  }

  return {
    title: spec.title ?? test.title ?? '(unknown)',
    project: test.projectName ?? '',
    status: result.status as TestResult['status'],
    duration: result.duration ?? 0,
    error: result.error?.message,
    failedStep: steps.find((step) => {
      return step.error;
    })?.title,
    stdout: (result.stdout ?? [])
      .map((entry) => {
        return entry.text ?? '';
      })
      .filter(Boolean)
      .map((line) => {
        return line.trimEnd();
      }),
    steps,
    screenshotPaths,
    annotations: Object.keys(annotations).length > 0 ? annotations : undefined,
  };
}

function extractReportJson(raw: string): Effect.Effect<ReportJson, ParseError> {
  // Playwright pretty-prints its JSON output so the report object opens on its
  // own line: "\n{\n  \"config\":...". Search for a '{' at the start of a line.
  // Fall back to a compact-JSON search, then to the first '{' as a last resort.
  const newlineIdx = raw.indexOf('\n{');
  let jsonStart: number;

  if (newlineIdx !== -1) {
    jsonStart = newlineIdx + 1;
  } else if (raw.includes('{"config":')) {
    jsonStart = raw.indexOf('{"config":');
  } else {
    jsonStart = raw.indexOf('{');
  }

  if (jsonStart === -1) {
    console.error('[runner] Could not find JSON in stdout. First 300 chars:', raw.slice(0, 300));

    return Effect.fail(new ParseError({ message: 'No JSON found in playwright output' }));
  }

  console.log(
    `[runner] JSON start at index ${jsonStart}, first 60 chars: ${JSON.stringify(raw.slice(jsonStart, jsonStart + 60))}`,
  );

  return Effect.try({
    try: () => {
      return JSON.parse(raw.slice(jsonStart)) as ReportJson;
    },
    catch: (error) => {
      console.error('[runner] Failed to parse JSON report:', error);
      console.error('[runner] Content at parse start:', raw.slice(jsonStart, jsonStart + 200));

      return new ParseError({ message: `Failed to parse playwright JSON: ${String(error)}` });
    },
  });
}

export function parseJsonReport(raw: string) {
  return Effect.gen(function* () {
    const report = yield* extractReportJson(raw);

    const playwrightErrors = (report.errors ?? [])
      .map((error) => {
        return error.message ?? '';
      })
      .filter(Boolean);

    if (playwrightErrors.length > 0) {
      console.error('[runner] Playwright top-level errors:', playwrightErrors);
    }

    console.log(`[runner] Suites found: ${report.suites?.length ?? 0}`);

    const results: TestResult[] = [];

    for (const suite of report.suites ?? []) {
      const specs = flattenSpecs(suite);

      console.log(`[runner] Suite "${suite.title}" → ${specs.length} spec(s)`);

      for (const spec of specs) {
        for (const test of spec.tests ?? []) {
          const result = toTestResult(spec, test);

          if (result) {
            results.push(result);
          }
        }
      }
    }

    console.log(
      `[runner] Parsed ${results.length} test result(s), ${playwrightErrors.length} top-level error(s)`,
    );

    return { results, playwrightErrors };
  }).pipe(
    Effect.catchAll(() => {
      return Effect.succeed({ results: [] as TestResult[], playwrightErrors: [] as string[] });
    }),
  );
}
