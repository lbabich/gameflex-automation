import { describe, expect, it } from 'vitest';
import { buildGameUrls, buildSingleUrl } from '../../server/url-builder.ts';

// buildSingleUrl is a pure function — no file I/O, no mocking needed.

const TEMPLATE =
  'https://example.com/launch/?casinoid=TEST&lobbyurl=https%3A%2F%2Fexample.com%2Flobby%3Fchannelid%3Ddesktop&playmode=demo&channelid=desktop&gameid=00000';

describe('buildSingleUrl', () => {
  it('sets gameid and channelid=desktop for desktop channel', () => {
    const url = new URL(buildSingleUrl(TEMPLATE, '13724', 'desktop', 'demo'));

    expect(url.searchParams.get('gameid')).toBe('13724');
    expect(url.searchParams.get('channelid')).toBe('desktop');
  });

  it('sets playmode', () => {
    const url = new URL(buildSingleUrl(TEMPLATE, '13724', 'desktop', 'real'));

    expect(url.searchParams.get('playmode')).toBe('real');
  });

  it('updates channelid inside nested lobbyurl', () => {
    const url = new URL(buildSingleUrl(TEMPLATE, '13724', 'mobile', 'demo'));
    const lobbyUrl = url.searchParams.get('lobbyurl') ?? '';

    expect(lobbyUrl).toContain('channelid=mobile');
  });
});

describe('buildGameUrls', () => {
  it('throws when channel is mobile and mobileGameId is absent', () => {
    expect(() => {
      return buildGameUrls('13724', undefined, 'mobile', 'demo');
    }).toThrow(/mobileGameId is required/);
  });

  it('throws when channel is both and mobileGameId is absent', () => {
    expect(() => {
      return buildGameUrls('13724', undefined, 'both', 'demo');
    }).toThrow(/mobileGameId is required/);
  });
});
