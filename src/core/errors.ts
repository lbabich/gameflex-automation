import { Data } from 'effect';

class GameNotFoundError extends Data.TaggedError('GameNotFoundError')<{
  id: string;
}> {}

class DuplicateGameIDError extends Data.TaggedError('DuplicateGameIDError')<{
  desktopGameID: string;
}> {}

class RunNotFoundError extends Data.TaggedError('RunNotFoundError')<{
  runID: string;
}> {}

class RunAlreadyActiveError extends Data.TaggedError('RunAlreadyActiveError')<{
  gameID: string;
}> {}

class ParseError extends Data.TaggedError('ParseError')<{
  message: string;
}> {}

class FileReadError extends Data.TaggedError('FileReadError')<{
  path: string;
  message: string;
}> {}

class FileWriteError extends Data.TaggedError('FileWriteError')<{
  path: string;
  message: string;
}> {}

export {
  GameNotFoundError,
  DuplicateGameIDError,
  RunNotFoundError,
  RunAlreadyActiveError,
  ParseError,
  FileReadError,
  FileWriteError,
};
