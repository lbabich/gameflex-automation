import { describe, expect, it } from 'vitest';
import { buildSingleUrl } from '../../server/url-builder.ts';

// buildSingleUrl is a pure function — no file I/O, no mocking needed.

describe('buildSingleUrl', () => {
  it('sets gameid and channelid=desktop for desktop channel', () => {
    const url = new URL(buildSingleUrl('13724', 'desktop', 'demo'));

    expect(url.searchParams.get('gameid')).toBe('13724');
    expect(url.searchParams.get('channelid')).toBe('desktop');
  });

  it('sets channelid=mobile for mobile channel', () => {
    const url = new URL(buildSingleUrl('13725', 'mobile', 'demo'));

    expect(url.searchParams.get('gameid')).toBe('13725');
    expect(url.searchParams.get('channelid')).toBe('mobile');
  });

  it('sets playmode', () => {
    const url = new URL(buildSingleUrl('13724', 'desktop', 'real'));

    expect(url.searchParams.get('playmode')).toBe('real');
  });

  it('includes channelid inside nested lobbyurl', () => {
    const url = new URL(buildSingleUrl('13724', 'mobile', 'demo'));
    const lobbyUrl = url.searchParams.get('lobbyurl') ?? '';

    expect(lobbyUrl).toContain('channelid=mobile');
  });

  it('uses the v2/load endpoint', () => {
    const url = new URL(buildSingleUrl('13724', 'desktop', 'demo'));

    expect(url.pathname).toContain('v2/load');
  });
});
