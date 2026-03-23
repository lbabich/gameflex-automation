import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { parseJsonReport } from '../../server/report-parser';

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

describe('parseJsonReport', () => {
  it('parses a passing test result correctly', async () => {
    const SUT = parseJsonReport;
    const raw = `preamble\n${makeReport()}`;
    const result = await Effect.runPromise(SUT(raw));

    expect(result.playwrightErrors).toHaveLength(0);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].title).toBe('spin: Test Game');
    expect(result.results[0].project).toBe('chromium');
    expect(result.results[0].status).toBe('passed');
    expect(result.results[0].duration).toBe(12345);
    expect(result.results[0].stdout).toEqual(['some output']);
    expect(result.results[0].steps).toHaveLength(1);
    expect(result.results[0].steps?.[0].title).toBe('Navigate to game');
  });

  it('parses a failed test result and surfaces the error message', async () => {
    const SUT = parseJsonReport;
    const raw = `preamble\n${makeReport({
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
    })}`;

    const result = await Effect.runPromise(SUT(raw));

    expect(result.results).toHaveLength(1);
    expect(result.results[0].status).toBe('failed');
    expect(result.results[0].error).toBe('Discovery timed out');
  });

  it('surfaces top-level Playwright errors', async () => {
    const SUT = parseJsonReport;
    const raw = `preamble\n${makeReport({
      suites: [],
      errors: [{ message: 'Global setup failed' }],
    })}`;

    const result = await Effect.runPromise(SUT(raw));

    expect(result.results).toHaveLength(0);
    expect(result.playwrightErrors).toEqual(['Global setup failed']);
  });

  it('returns empty results when the raw string has no JSON', async () => {
    const SUT = parseJsonReport;
    const result = await Effect.runPromise(SUT('no json'));

    expect(result.results).toHaveLength(0);
    expect(result.playwrightErrors).toHaveLength(0);
  });

  it('extracts JSON from a pretty-printed output (newline before {)', async () => {
    const SUT = parseJsonReport;
    const raw = `some playwright preamble\n${makeReport()}`;
    const result = await Effect.runPromise(SUT(raw));

    expect(result.results).toHaveLength(1);
  });

  it('extracts JSON from compact output without leading newline', async () => {
    const SUT = parseJsonReport;
    const raw = makeReport();
    const result = await Effect.runPromise(SUT(raw));

    expect(result.results).toHaveLength(1);
  });

  it('sets failedStep to the title of the first step with an error', async () => {
    const SUT = parseJsonReport;
    const raw = `preamble\n${makeReport({
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
                      error: { message: 'Step timed out' },
                      stdout: [],
                      steps: [
                        { title: 'Navigate to game', duration: 100 },
                        {
                          title: 'Discover steps',
                          duration: 4800,
                          error: { message: 'Step timed out' },
                        },
                        { title: 'Click spin button', duration: 100 },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })}`;

    const result = await Effect.runPromise(SUT(raw));

    expect(result.results).toHaveLength(1);
    expect(result.results[0].failedStep).toBe('Discover steps');
  });

  it('leaves failedStep undefined when no step has an error', async () => {
    const SUT = parseJsonReport;
    const result = await Effect.runPromise(SUT(`preamble\n${makeReport()}`));

    expect(result.results[0].failedStep).toBeUndefined();
  });

  it('extracts screenshot paths from png attachments', async () => {
    const SUT = parseJsonReport;
    const raw = `preamble\n${makeReport({
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
                      error: { message: 'Timed out' },
                      stdout: [],
                      steps: [],
                      attachments: [
                        {
                          name: 'screenshot',
                          path: '/tmp/test-failed-1.png',
                          contentType: 'image/png',
                        },
                        { name: 'trace', path: '/tmp/trace.zip', contentType: 'application/zip' },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })}`;

    const result = await Effect.runPromise(SUT(raw));

    expect(result.results[0].screenshotPaths).toEqual(['/tmp/test-failed-1.png']);
  });

  it('flattens specs from nested suites', async () => {
    const SUT = parseJsonReport;
    const raw = `preamble\n${makeReport({
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
    })}`;

    const result = await Effect.runPromise(SUT(raw));

    expect(result.results).toHaveLength(1);
    expect(result.results[0].title).toBe('spin: Nested Game');
  });
});
