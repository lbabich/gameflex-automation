import type { DeviceType, PlayMode } from '../lib/types';

const BASE_URL = 'https://s009-gel.test-flex.us/gamelaunch/api/v2.0/game-launchers/gul/v2/load';

const DEBUG_ACCESS_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJpZm9yaXVtLmNvbSIsImF1ZCI6IkdhbWVGbGV4IiwianRpIjoiMDg3Yjg0ZDItNWNiZi00ODE3LTliZDUtY2NiMTI1MGFhZDg4IiwiaWZfcGsiOiJTMDA5IiwiaWZfdHBpc3UiOnRydWUsImlmX3RwcCI6WzEsMiwzLDQsNSw3LDYsOCwxMV0sImlmX2hkYSI6eyJoYXNBY2Nlc3MiOnRydWUsImFjY2Vzc0xldmVscyI6eyJ0ZXN0SGFybmVzc1RhYiI6dHJ1ZX19LCJpYXQiOjE3NzI3MDE4Njd9.-oc3Y68V7-TPOagnztPEn2i-EGE6GhHCoKjflGmJNps';

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
  url.searchParams.set('reg_gamehistoryurl', 'undefined');
  url.searchParams.set('reg_bonusurl', 'undefined');
  url.searchParams.set('reg_responsibleurl', 'undefined');
  url.searchParams.set('debugaccesstoken', DEBUG_ACCESS_TOKEN);

  return url.toString();
}
