import type { DeviceType, PlayMode } from '../lib/types';

const BASE_URL = 'https://s009-gel.test-flex.us/gamelaunch/api/v2.0/game-launchers/gul/v2/load/';

const LOBBY_BASE = 'https://s009-gel.test-flex.us/gamelaunch/test/gul';

export function buildSingleUrl(gameID: string, channel: DeviceType, mode: PlayMode): string {
  const url = new URL(BASE_URL);

  url.searchParams.set('casinoid', 'S009-IFO-20');
  url.searchParams.set('sessiontoken', '');
  url.searchParams.set('languagecode', 'en');
  url.searchParams.set('gameid', gameID);
  url.searchParams.set('tableid', 'undefined');
  url.searchParams.set('playmode', mode);
  url.searchParams.set('channelid', channel);
  url.searchParams.set('devicechannel', 'web');

  const lobby = new URL(LOBBY_BASE);

  lobby.searchParams.set('operatorcode', 'IFO');
  lobby.searchParams.set('brandid', '20');
  lobby.searchParams.set('platformkey', 'S009');
  lobby.searchParams.set('integrationproviderid', '9');
  lobby.searchParams.set('channelid', channel);
  lobby.searchParams.set('search', 'masks');
  lobby.searchParams.set('launchtype', 'operator');

  url.searchParams.set('lobbyurl', lobby.toString());
  url.searchParams.set('currencycode', 'EUR');
  url.searchParams.set('operatorconnector', 'default');
  url.searchParams.set('regulationsenabled', 'false');

  return url.toString();
}
