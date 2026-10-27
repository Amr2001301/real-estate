import { adPlatform } from '../campaign-attribution';

describe('adPlatform', () => {
  it('reads what Meta fills in {{site_source_name}} and what lead forms send', () => {
    expect(adPlatform('fb')).toBe('FACEBOOK');
    expect(adPlatform('Facebook')).toBe('FACEBOOK');
    expect(adPlatform('m.facebook.com')).toBe('FACEBOOK');
    expect(adPlatform('ig')).toBe('INSTAGRAM');
    expect(adPlatform(' instagram ')).toBe('INSTAGRAM');
    expect(adPlatform('msg')).toBe('MESSENGER');
    expect(adPlatform('an')).toBe('AUDIENCE_NETWORK');
  });

  it('keeps other sources apart, and says nothing when nothing is known', () => {
    expect(adPlatform('tiktok')).toBe('OTHER');
    expect(adPlatform('facebookads-x')).toBe('OTHER');
    expect(adPlatform(null)).toBeNull();
    expect(adPlatform('  ')).toBeNull();
    // The link opened outside an ad: the placeholder was never filled.
    expect(adPlatform('{{site_source_name}}')).toBeNull();
  });
});
