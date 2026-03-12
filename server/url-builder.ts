import { readGames } from './games';

export type Channel = 'desktop' | 'mobile' | 'both';
export type PlayMode = 'demo' | 'real';

function buildUrl(
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
  gameId: string,
  channel: Channel,
  mode: PlayMode,
): { url: string; mobileUrl?: string } {
  const games = readGames();
  const template = games[0]?.url;
  if (!template) throw new Error('No template URL available — add at least one game first');

  if (channel === 'desktop') {
    return { url: buildUrl(template, gameId, 'desktop', mode) };
  }
  if (channel === 'mobile') {
    return { url: buildUrl(template, gameId, 'mobile', mode) };
  }
  return {
    url: buildUrl(template, gameId, 'desktop', mode),
    mobileUrl: buildUrl(template, gameId, 'mobile', mode),
  };
}
