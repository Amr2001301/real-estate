/**
 * Page titles and descriptions (the browser tab, search results) in both
 * languages: same pages, no Arabic in the English ones, and no platform brand.
 */
import { metaEntry } from '../messages/meta';
import type { MetaKey } from '../messages/meta';

const KEYS: MetaKey[] = ['home', 'projects', 'units', 'compare', 'contact', 'articles', 'login', 'register', 'forgotPassword', 'resetPassword', 'verifyEmail', 'privacy', 'terms', 'account', 'contracts', 'deposits', 'installments', 'maintenance', 'maintenanceNew', 'maintenanceDetail', 'property', 'documents', 'favorites', 'notifications', 'profile', 'requests', 'reservations', 'visits', 'app', 'notFound'];

describe('page metadata messages', () => {
  it('every page has an English and an Arabic entry', () => {
    for (const k of KEYS) {
      expect(metaEntry(k, 'ar')).toBeDefined();
      expect(metaEntry(k, 'en')).toBeDefined();
      expect(Boolean(metaEntry(k, 'ar').title)).toBe(Boolean(metaEntry(k, 'en').title));
    }
  });

  it('English entries have no Arabic letters, and no entry names the platform', () => {
    for (const k of KEYS) {
      const en = metaEntry(k, 'en');
      expect(`${en.title ?? ''} ${en.description}`).not.toMatch(/[؀-ۿ]/);
      for (const loc of ['ar', 'en'] as const) {
        const e = metaEntry(k, loc);
        expect(`${e.title ?? ''} ${e.description}`).not.toMatch(/ديفورا|Devora/);
      }
    }
  });
});
