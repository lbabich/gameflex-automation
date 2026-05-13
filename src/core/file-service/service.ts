import * as fs from 'node:fs';
import { Effect, Layer } from 'effect';
import { FileReadError, FileWriteError } from '../errors';

export class FileService extends Effect.Tag('FileService')<
  FileService,
  {
    read: (path: string) => Effect.Effect<string, FileReadError>;
    write: (path: string, content: string) => Effect.Effect<void, FileWriteError>;
    exists: (path: string) => Effect.Effect<boolean>;
    deleteFile: (path: string) => Effect.Effect<void>;
    deleteDir: (path: string) => Effect.Effect<void>;
  }
>() {}

export const NodeFileService = Layer.succeed(FileService, {
  read: (path: string) => {
    return Effect.try({
      try: () => {
        return fs.readFileSync(path, 'utf8');
      },
      catch: (err: unknown) => {
        return new FileReadError({ path, message: String(err) });
      },
    });
  },

  write: (path: string, content: string) => {
    return Effect.try({
      try: () => {
        return fs.writeFileSync(path, content);
      },
      catch: (err: unknown) => {
        return new FileWriteError({ path, message: String(err) });
      },
    });
  },

  exists: (path: string) => {
    return Effect.succeed(fs.existsSync(path));
  },

  deleteFile: (path: string) => {
    return Effect.sync(() => {
      fs.rmSync(path, { force: true });
    });
  },

  deleteDir: (path: string) => {
    return Effect.sync(() => {
      fs.rmSync(path, { recursive: true, force: true });
    });
  },
});
