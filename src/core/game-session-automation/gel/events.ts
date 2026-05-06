const GEL_EVENT = {
  // Optional
  LOAD_PROGRESS: 'gel.load.progress',
  // Required
  READY: 'gel.ready',
  // Required
  SPIN_START: 'gel.spin.start',
  // Required
  SPIN_END: 'gel.spin.end',
  // Required
  GAME_CLOSE: 'gel.close',
  // Optional
  AUDIO_ENABLE: 'gel.audio.enable',
  // Optional
  AUDIO_DISABLE: 'gel.audio.disable',
} as const;

const GEL_READY_TIMEOUT_MS = 90_000;

export type GelEvent = (typeof GEL_EVENT)[keyof typeof GEL_EVENT];

export const gelEvents = { GEL_EVENT, GEL_READY_TIMEOUT_MS };
