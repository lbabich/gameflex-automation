import type { DeviceType, GameEntry, RunHints, RunRecord } from '@shared/types';

export type NewGame = {
  desktopGameID: string;
  mobileGameID?: string;
  name: string;
  gameProviderID: string;
};

export type GameUpdates = {
  name?: string;
  desktopGameID?: string;
  mobileGameID?: string;
  gameProviderID?: string;
};

export const DEFAULT_STEPS = ['gameLoad', 'spinCycle', 'audioToggle', 'gameClose'] as const;

export type NewRun = {
  gameIDs: string[];
  deviceTypes: DeviceType[];
  steps: string[];
  hints?: RunHints;
};

export async function getGames() {
  const response = await fetch('/api/games');

  if (!response.ok) {
    throw new Error('Failed to fetch games');
  }

  return response.json() as Promise<GameEntry[]>;
}

export async function getRuns() {
  const response = await fetch('/api/runs');

  if (!response.ok) {
    throw new Error('Failed to fetch runs');
  }

  return response.json() as Promise<RunRecord[]>;
}

export async function getRun(runID: string) {
  const response = await fetch(`/api/runs/${runID}`);

  if (!response.ok) {
    throw new Error('Failed to fetch run');
  }

  return response.json() as Promise<RunRecord>;
}

export async function createGame(game: NewGame) {
  const response = await fetch('/api/games', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(game),
  });

  if (!response.ok) {
    const body = (await response.json()) as { error?: string };
    throw new Error(body.error ?? 'Failed to add game');
  }

  return response.json() as Promise<GameEntry>;
}

export async function updateGame(id: string, updates: GameUpdates) {
  const response = await fetch(`/api/games/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const body = (await response.json()) as { error?: string };
    throw new Error(body.error ?? 'Failed to update game');
  }
}

export async function clearSteps(id: string) {
  const response = await fetch(`/api/games/${id}/steps`, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error('Failed to clear steps');
  }
}

export async function clearChannelSteps(id: string, deviceType: DeviceType) {
  const response = await fetch(`/api/games/${id}/steps/${deviceType}`, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error('Failed to clear steps');
  }
}

export async function createRun(run: NewRun) {
  const response = await fetch('/api/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(run),
  });

  if (!response.ok) {
    throw new Error('Failed to create run');
  }

  return response.json() as Promise<{ runID: string }>;
}

export async function deleteRun(runID: string) {
  await fetch(`/api/runs/${runID}`, { method: 'DELETE' });
}

export async function clearGameRuns(gameID: string) {
  const response = await fetch(`/api/games/${gameID}/runs`, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error('Failed to clear runs');
  }
}
