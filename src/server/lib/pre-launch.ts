import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Page } from '@playwright/test';
import { DEVICE_TYPE, type DeviceType, PLAY_MODE, type PlayMode } from '../../shared/types';
import type { GameEntry } from './games';

type LaunchConfig = {
  harnessBaseUrl: string;
  operatorcode: string;
  brandid: string;
  platformkey: string;
  launchtype: string;
  loaderType: string;
  casinoId: string;
  operatorAccountId: string;
  regulationsEnabled: boolean;
};

async function launch(
  page: Page,
  game: GameEntry,
  deviceType: DeviceType,
  playMode: PlayMode,
): Promise<void> {
  if (!game.gameProviderID) {
    throw new Error(`Game '${game.name}' has no gameProviderID — add one via the web UI`);
  }

  const config = loadConfig();
  const gameID =
    deviceType === DEVICE_TYPE.MOBILE
      ? (game.mobileGameID ?? game.desktopGameID)
      : game.desktopGameID;

  const url = new URL(config.harnessBaseUrl);

  url.searchParams.set('operatorcode', config.operatorcode);
  url.searchParams.set('brandid', config.brandid);
  url.searchParams.set('platformkey', config.platformkey);
  url.searchParams.set('integrationproviderid', game.gameProviderID);
  url.searchParams.set('channelid', deviceType);
  url.searchParams.set('search', gameID);
  url.searchParams.set('launchtype', config.launchtype);

  await page.goto(url.toString());
  await page.locator('#gameLaunchLoader').waitFor({ state: 'visible' });

  await page.locator('#gameLaunchLoader').evaluate((select, loaderType) => {
    const opt = Array.from((select as HTMLSelectElement).options).find(
      (option: HTMLOptionElement) => {
        return option.text.includes(loaderType);
      },
    );

    if (!opt) {
      throw new Error(`No loader option containing '${loaderType}'`);
    }

    (select as HTMLSelectElement).value = opt.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }, config.loaderType);

  await page.locator('#casinoID').fill(config.casinoId);
  await page.locator('#operatorAccountID').fill(config.operatorAccountId);

  if (!config.regulationsEnabled) {
    const checkbox = page.locator('#regulationsEnabled');

    if (await checkbox.isChecked()) {
      await checkbox.uncheck();
    }
  }

  const buttonText = playMode === PLAY_MODE.REAL ? 'Real' : 'Demo';

  await page.getByRole('button', { name: buttonText }).first().click();
}

function loadConfig(): LaunchConfig {
  const configPath = path.resolve('src', 'server', 'config', 'launch-config.json');

  return JSON.parse(fs.readFileSync(configPath, 'utf8')) as LaunchConfig;
}

export { launch };
