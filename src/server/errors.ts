import { Data } from 'effect';

export class GameNotFoundError extends Data.TaggedError('GameNotFoundError')<{
  id: string;
}> {}

export class DuplicateGameIdError extends Data.TaggedError('DuplicateGameIdError')<{
  desktopGameID: string;
}> {}

export class RunNotFoundError extends Data.TaggedError('RunNotFoundError')<{
  runID: string;
}> {}

export class RunAlreadyActiveError extends Data.TaggedError('RunAlreadyActiveError')<{
  gameID: string;
}> {}

export class ParseError extends Data.TaggedError('ParseError')<{
  message: string;
}> {}

export class FileReadError extends Data.TaggedError('FileReadError')<{
  path: string;
  message: string;
}> {}

export class FileWriteError extends Data.TaggedError('FileWriteError')<{
  path: string;
  message: string;
}> {}
