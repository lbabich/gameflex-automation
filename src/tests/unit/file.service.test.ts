import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Effect, ManagedRuntime } from 'effect';
import { afterEach, describe, expect, it } from 'vitest';
import { FileReadError } from '../../server/errors';
import { FileService, NodeFileService } from '../../server/services/file.service';

const runtime = ManagedRuntime.make(NodeFileService);

let tempPath: string | undefined;

afterEach(() => {
  if (tempPath && fs.existsSync(tempPath)) {
    fs.unlinkSync(tempPath);
  }

  tempPath = undefined;
});

describe('FileService', () => {
  it('read returns file contents', async () => {
    tempPath = path.join(os.tmpdir(), randomUUID());

    fs.writeFileSync(tempPath, 'hello world');

    const result = await runtime.runPromise(
      Effect.gen(function* () {
        const service = yield* FileService;

        return yield* service.read(tempPath as string);
      }),
    );

    expect(result).toBe('hello world');
  });

  it('read fails with FileReadError for a nonexistent file', async () => {
    const error = await runtime.runPromise(
      Effect.gen(function* () {
        const service = yield* FileService;

        return yield* Effect.flip(service.read('/nonexistent/path/that/does/not/exist'));
      }),
    );

    expect(error).toBeInstanceOf(FileReadError);
  });

  it('write creates a file with the given content', async () => {
    tempPath = path.join(os.tmpdir(), randomUUID());

    const content = 'test content';

    await runtime.runPromise(
      Effect.gen(function* () {
        const service = yield* FileService;

        yield* service.write(tempPath as string, content);
      }),
    );

    expect(fs.readFileSync(tempPath, 'utf8')).toBe(content);
  });

  it('exists returns true for an existing file', async () => {
    tempPath = path.join(os.tmpdir(), randomUUID());

    fs.writeFileSync(tempPath, '');

    const result = await runtime.runPromise(
      Effect.gen(function* () {
        const service = yield* FileService;

        return yield* service.exists(tempPath as string);
      }),
    );

    expect(result).toBe(true);
  });

  it('exists returns false for a nonexistent path', async () => {
    const result = await runtime.runPromise(
      Effect.gen(function* () {
        const service = yield* FileService;

        return yield* service.exists('/nonexistent/path/that/does/not/exist');
      }),
    );

    expect(result).toBe(false);
  });
});
