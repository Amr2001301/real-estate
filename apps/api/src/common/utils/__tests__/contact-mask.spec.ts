import { isMasked, maskEmail, maskPhone } from '../contact-mask';

describe('contact mask', () => {
  it('keeps the start and the last four digits of a phone', () => {
    expect(maskPhone('+201001234567')).toBe('+2010••••4567');
    expect(maskPhone('01001234567')).toBe('01001•••4567');
    expect(maskPhone('12345')).toBe('•••••');
    expect(maskPhone(null)).toBeNull();
  });

  it('keeps the first letter and the domain of an e-mail', () => {
    expect(maskEmail('ahmed@site.com')).toBe('a•••@site.com');
    expect(maskEmail('bad')).toBe('•••');
    expect(maskEmail(undefined)).toBeUndefined();
  });

  it('tells a masked value', () => {
    expect(isMasked(maskPhone('+201001234567'))).toBe(true);
    expect(isMasked('+201001234567')).toBe(false);
  });
});
