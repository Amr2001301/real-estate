import { assetLinks, storeLinks, APP_STORE_URL, GOOGLE_PLAY_URL } from '@/lib/app-links';

const FP = Array.from({ length: 32 }, () => 'AB').join(':');

describe('storeLinks', () => {
  it("uses the company's own app when it has a store link", () => {
    expect(storeLinks({ playStoreUrl: 'https://play.google.com/store/apps/details?id=com.acme.app' })).toEqual({
      appStore: null,
      googlePlay: 'https://play.google.com/store/apps/details?id=com.acme.app',
    });
  });

  it("falls back to the shared app's links otherwise", () => {
    expect(storeLinks(undefined)).toEqual({ appStore: APP_STORE_URL, googlePlay: GOOGLE_PLAY_URL });
    expect(storeLinks({})).toEqual({ appStore: APP_STORE_URL, googlePlay: GOOGLE_PLAY_URL });
  });
});

describe('assetLinks', () => {
  it('declares the company app with its signing-key fingerprints', () => {
    expect(assetLinks({ packageId: 'com.acme.app', androidSha256: [FP] })).toEqual([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: { namespace: 'android_app', package_name: 'com.acme.app', sha256_cert_fingerprints: [FP] },
      },
    ]);
  });

  it('is empty without a published app or a fingerprint', () => {
    expect(assetLinks(undefined)).toEqual([]);
    expect(assetLinks({ packageId: 'com.acme.app', androidSha256: [] })).toEqual([]);
  });
});
