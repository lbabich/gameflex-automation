import type { DeviceType } from './types';

export type OperatorWalletModule = {
  getGameLaunchUrl: (gameId: string, channel: DeviceType) => Promise<string>;
};

const OPERATOR_WALLET_URL = 'https://operatorwallet.azurewebsites.net/api/launch/s009';
const OPERATOR_ACCOUNT_ID = 'autotest';

export async function getGameLaunchUrl(gameId: string, channel: DeviceType): Promise<string> {
  const url = new URL(OPERATOR_WALLET_URL);

  url.searchParams.set('gameid', gameId);
  url.searchParams.set('operatoraccountid', `${OPERATOR_ACCOUNT_ID}${channel}`);
  url.searchParams.set('channel', channel);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Operator wallet returned ${response.status} for game ${gameId}`);
  }

  const body = (await response.json()) as { LaunchURL: string };

  return body.LaunchURL;
}
