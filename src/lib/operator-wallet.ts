import type { DeviceType } from './types';

export type OperatorWalletModule = {
  getGameLaunchUrl: (gameId: string, channel: DeviceType) => Promise<string>;
};

const OPERATOR_WALLET_URL = 'https://operatorwallet.azurewebsites.net/api/launch/s009';
const OPERATOR_ACCOUNT_ID = 'autotest';

export async function getGameLaunchUrl(gameId: string, channel: DeviceType): Promise<string> {
  const u = new URL(OPERATOR_WALLET_URL);

  u.searchParams.set('gameid', gameId);
  u.searchParams.set('operatoraccountid', `${OPERATOR_ACCOUNT_ID}${channel}`);
  u.searchParams.set('channel', channel);

  const res = await fetch(u.toString());

  if (!res.ok) {
    throw new Error(`Operator wallet returned ${res.status} for game ${gameId}`);
  }

  const body = (await res.json()) as { LaunchURL: string };

  return body.LaunchURL;
}
