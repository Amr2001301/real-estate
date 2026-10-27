import { captureUtm } from '@/lib/utm';

const DAY = 24 * 60 * 60 * 1000;
const visit = (path: string) => window.history.pushState({}, '', path);

describe('captureUtm', () => {
  beforeEach(() => {
    localStorage.clear();
    visit('/');
  });

  it('keeps the ad click from the landing page for a form on another page', () => {
    visit('/projects/p1?utm_source=ig&utm_medium=paid&utm_campaign=summer');
    captureUtm(1_000);
    visit('/contact?projectId=p1');
    expect(captureUtm(1_000 + DAY)).toEqual({ utmSource: 'ig', utmMedium: 'paid', utmCampaign: 'summer' });
  });

  it('forgets it after 30 days', () => {
    visit('/?utm_campaign=summer');
    captureUtm(0);
    visit('/contact');
    expect(captureUtm(31 * DAY)).toEqual({});
    expect(localStorage.getItem('utm_attribution')).toBeNull();
  });

  it('a newer ad click replaces the older one', () => {
    visit('/?utm_campaign=summer');
    captureUtm(0);
    visit('/?utm_campaign=winter&utm_source=fb');
    captureUtm(DAY);
    visit('/contact');
    expect(captureUtm(2 * DAY)).toEqual({ utmCampaign: 'winter', utmSource: 'fb' });
  });
});
