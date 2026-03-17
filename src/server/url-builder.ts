import type { PlayMode } from '../lib/games';

export type { PlayMode };

const BASE_URL = 'https://s009-gel.test-flex.us/gamelaunch/api/v2.0/game-launchers/gul/v2/load';

const DEBUG_ACCESS_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJpZm9yaXVtLmNvbSIsImF1ZCI6IkdhbWVGbGV4IiwianRpIjoiMDg3Yjg0ZDItNWNiZi00ODE3LTliZDUtY2NiMTI1MGFhZDg4IiwiaWZfcGsiOiJTMDA5IiwiaWZfdHBpc3UiOnRydWUsImlmX3RwcCI6WzEsMiwzLDQsNSw3LDYsOCwxMV0sImlmX2hkYSI6eyJoYXNBY2Nlc3MiOnRydWUsImFjY2Vzc0xldmVscyI6eyJ0ZXN0SGFybmVzc1RhYiI6dHJ1ZX19LCJpYXQiOjE3NzI3MDE4Njd9.-oc3Y68V7-TPOagnztPEn2i-EGE6GhHCoKjflGmJNps';

const LOBBY_BASE = 'https://s009-gel.test-flex.us/gamelaunch/test/gul';

export function buildSingleUrl(
  gameId: string,
  channel: 'desktop' | 'mobile',
  mode: PlayMode,
): string {
  const u = new URL(BASE_URL);

  u.searchParams.set('casinoid', 'S009-IFO-20');
  u.searchParams.set('sessiontoken', '');
  u.searchParams.set('languagecode', 'en');
  u.searchParams.set('gameid', gameId);
  u.searchParams.set('tableid', 'undefined');
  u.searchParams.set('playmode', mode);
  u.searchParams.set('channelid', channel);
  u.searchParams.set('devicechannel', 'web');

  const lobby = new URL(LOBBY_BASE);

  lobby.searchParams.set('operatorcode', 'IFO');
  lobby.searchParams.set('brandid', '20');
  lobby.searchParams.set('platformkey', 'S009');
  lobby.searchParams.set('integrationproviderid', '9');
  lobby.searchParams.set('channelid', channel);
  lobby.searchParams.set('search', 'masks');
  lobby.searchParams.set('launchtype', 'operator');

  u.searchParams.set('lobbyurl', lobby.toString());
  u.searchParams.set('currencycode', 'EUR');
  u.searchParams.set('operatorconnector', 'default');
  u.searchParams.set('regulationsenabled', 'false');
  u.searchParams.set('reg_gamehistoryurl', 'undefined');
  u.searchParams.set('reg_bonusurl', 'undefined');
  u.searchParams.set('reg_responsibleurl', 'undefined');
  u.searchParams.set('debugaccesstoken', DEBUG_ACCESS_TOKEN);

  return u.toString();
}
