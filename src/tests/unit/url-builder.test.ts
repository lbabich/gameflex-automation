import { describe, expect, it } from 'vitest';
import { buildSingleUrl } from '../../server/url-builder';

describe('buildSingleUrl', () => {
  it('sets gameid and channelid=desktop for desktop channel', () => {
    const SUT = buildSingleUrl;
    const result = new URL(SUT('13724', 'desktop', 'demo'));

    expect(result.searchParams.get('gameid')).toBe('13724');
    expect(result.searchParams.get('channelid')).toBe('desktop');
  });

  it('sets channelid=mobile for mobile channel', () => {
    const SUT = buildSingleUrl;
    const result = new URL(SUT('13725', 'mobile', 'demo'));

    expect(result.searchParams.get('gameid')).toBe('13725');
    expect(result.searchParams.get('channelid')).toBe('mobile');
  });

  it('sets playmode', () => {
    const SUT = buildSingleUrl;
    const result = new URL(SUT('13724', 'desktop', 'real'));

    expect(result.searchParams.get('playmode')).toBe('real');
  });

  it('includes channelid inside nested lobbyurl', () => {
    const SUT = buildSingleUrl;
    const result = new URL(SUT('13724', 'mobile', 'demo'));
    const lobbyUrl = result.searchParams.get('lobbyurl') ?? '';

    expect(lobbyUrl).toContain('channelid=mobile');
  });

  it('uses the v2/load endpoint', () => {
    const SUT = buildSingleUrl;
    const result = new URL(SUT('13724', 'desktop', 'demo'));

    expect(result.pathname).toContain('v2/load');
  });
});
