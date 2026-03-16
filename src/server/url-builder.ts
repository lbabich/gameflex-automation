import { readGames } from './games';

export type Channel = 'desktop' | 'mobile' | 'both';
export type PlayMode = 'demo' | 'real';

export function buildSingleUrl(
  template: string,
  gameId: string,
  channel: 'desktop' | 'mobile',
  mode: PlayMode,
): string {
  const u = new URL(template);

  u.searchParams.set('gameid', gameId);
  u.searchParams.set('playmode', mode);
  u.searchParams.set('channelid', channel);

  // lobbyurl is a nested URL — update its channelid too
  const lobbyUrl = u.searchParams.get('lobbyurl');

  if (lobbyUrl) {
    u.searchParams.set(
      'lobbyurl',
      lobbyUrl.replace(/channelid=(desktop|mobile)/g, `channelid=${channel}`),
    );
  }

  return u.toString();
}

export function buildGameUrls(
  desktopGameId: string,
  mobileGameId: string | undefined,
  channel: Channel,
  mode: PlayMode,
): { url: string; mobileUrl?: string } {
  const games = readGames();
  const template = games[0]?.url;

  if (!template) {
    throw new Error('No template URL available — add at least one game first');
  }

  if (channel === 'desktop') {
    return { url: buildSingleUrl(template, desktopGameId, 'desktop', mode) };
  }

  if (channel === 'mobile') {
    if (!mobileGameId) {
      throw new Error('mobileGameId is required when channel is "mobile"');
    }

    return { url: buildSingleUrl(template, mobileGameId, 'mobile', mode) };
  }

  if (!mobileGameId) {
    throw new Error('mobileGameId is required when channel is "both"');
  }

  return {
    url: buildSingleUrl(template, desktopGameId, 'desktop', mode),
    mobileUrl: buildSingleUrl(template, mobileGameId, 'mobile', mode),
  };
}
