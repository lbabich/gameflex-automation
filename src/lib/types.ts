export type DeviceType = 'desktop' | 'mobile';

export type PlayMode = 'demo' | 'real';

export const DEVICE_TYPES = ['desktop', 'mobile'] as const satisfies readonly DeviceType[];

export const PLAY_MODES = ['demo', 'real'] as const satisfies readonly PlayMode[];

export type Viewport = {
  width: number;
  height: number;
};

export type CachedStep = {
  waitMs: number;
  x: number;
  y: number;
  label: string;
};

export type GameSteps = {
  discoveredAt: string;
  steps: CachedStep[];
  partial?: boolean;
};
