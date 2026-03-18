import { describe, expect, it } from 'vitest';
import { extractReportJson, parseJsonReport } from '../../server/report-parser';

// Minimal Playwright JSON report shapes used as fixtures.

function makeReport(overrides: object = {}): string {
  return JSON.stringify({
    config: {},
    suites: [
      {
        title: 'game-spin.spec.ts',
        suites: [],
        specs: [
          {
            title: 'spin: Test Game',
            tests: [
              {
                title: 'spin: Test Game',
                projectName: 'chromium',
                results: [
                  {
                    status: 'passed',
                    duration: 12345,
                    stdout: [{ text: 'some output\n' }],
                    steps: [{ title: 'Navigate to game', duration: 500 }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    errors: [],
    ...overrides,
  });
}

describe('extractReportJson', () => {
  it('extracts JSON from a pretty-printed output (newline before {)', () => {
    const raw = 'some playwright preamble\n' + makeReport();
    const result = extractReportJson(raw);

    expect(result).not.toBeNull();
    expect(result?.suites).toHaveLength(1);
  });

  it('extracts JSON from compact output without leading newline', () => {
    const raw = makeReport();
    const result = extractReportJson(raw);

    expect(result).not.toBeNull();
    expect(result?.suites).toHaveLength(1);
  });

  it('returns null when there is no JSON in the string', () => {
    const result = extractReportJson('no json here at all');

    expect(result).toBeNull();
  });
});

describe('parseJsonReport', () => {
  it('parses a passing test result correctly', () => {
    const raw = 'preamble\n' + makeReport();
    const { results, playwrightErrors } = parseJsonReport(raw);

    expect(playwrightErrors).toHaveLength(0);
    expect(results).toHaveLength(1);

    const r = results[0];

    expect(r.title).toBe('spin: Test Game');
    expect(r.project).toBe('chromium');
    expect(r.status).toBe('passed');
    expect(r.duration).toBe(12345);
    expect(r.stdout).toEqual(['some output']);
    expect(r.steps).toHaveLength(1);
    expect(r.steps?.[0].title).toBe('Navigate to game');
  });

  it('parses a failed test result and surfaces the error message', () => {
    const raw =
      'preamble\n' +
      makeReport({
        suites: [
          {
            title: 'game-spin.spec.ts',
            suites: [],
            specs: [
              {
                title: 'spin: Failing Game',
                tests: [
                  {
                    title: 'spin: Failing Game',
                    projectName: 'chromium',
                    results: [
                      {
                        status: 'failed',
                        duration: 5000,
                        error: { message: 'Discovery timed out' },
                        stdout: [],
                        steps: [],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });

    const { results } = parseJsonReport(raw);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('failed');
    expect(results[0].error).toBe('Discovery timed out');
  });

  it('surfaces top-level Playwright errors', () => {
    const raw =
      'preamble\n' +
      makeReport({
        suites: [],
        errors: [{ message: 'Global setup failed' }],
      });

    const { results, playwrightErrors } = parseJsonReport(raw);

    expect(results).toHaveLength(0);
    expect(playwrightErrors).toEqual(['Global setup failed']);
  });

  it('returns empty results when the raw string has no JSON', () => {
    const { results, playwrightErrors } = parseJsonReport('no json');

    expect(results).toHaveLength(0);
    expect(playwrightErrors).toHaveLength(0);
  });

  it('flattens specs from nested suites', () => {
    const raw =
      'preamble\n' +
      makeReport({
        suites: [
          {
            title: 'outer',
            specs: [],
            suites: [
              {
                title: 'inner',
                specs: [
                  {
                    title: 'spin: Nested Game',
                    tests: [
                      {
                        title: 'spin: Nested Game',
                        projectName: 'chromium',
                        results: [{ status: 'passed', duration: 1, stdout: [], steps: [] }],
                      },
                    ],
                  },
                ],
                suites: [],
              },
            ],
          },
        ],
      });

    const { results } = parseJsonReport(raw);

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('spin: Nested Game');
  });
});
