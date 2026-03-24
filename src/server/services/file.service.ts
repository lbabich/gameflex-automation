import * as fs from 'node:fs';
import { Effect, Layer } from 'effect';
import { FileReadError, FileWriteError } from '../errors';

class FileService extends Effect.Tag('FileService')<
  FileService,
  {
    read: (path: string) => Effect.Effect<string, FileReadError>;
    write: (path: string, content: string) => Effect.Effect<void, FileWriteError>;
    exists: (path: string) => Effect.Effect<boolean>;
  }
>() {}

export const NodeFileService = Layer.succeed(FileService, {
  read: (path) => {
    return Effect.try({
      try: () => {
        return fs.readFileSync(path, 'utf8');
      },
      catch: (err) => {
        return new FileReadError({ path, message: String(err) });
      },
    });
  },

  write: (path, content) => {
    return Effect.try({
      try: () => {
        return fs.writeFileSync(path, content);
      },
      catch: (err) => {
        return new FileWriteError({ path, message: String(err) });
      },
    });
  },

  exists: (path) => {
    return Effect.succeed(fs.existsSync(path));
  },
});

export { FileService };
