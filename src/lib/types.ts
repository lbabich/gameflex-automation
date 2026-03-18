export type DeviceType = 'desktop' | 'mobile';

export type PlayMode = 'demo' | 'real';

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
