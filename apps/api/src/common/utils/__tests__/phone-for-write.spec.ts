import { BadRequestException } from '@nestjs/common';
import { phoneForWrite } from '../phone-for-write';

// FG-21 — the shared rule behind every non-auth write of User.phone.
describe('phoneForWrite', () => {
  const dbFor = (country: string | null) => {
    const findUnique = jest.fn().mockResolvedValue({ country });
    return { db: { company: { findUnique } }, findUnique };
  };

  it('leaves an untouched field untouched (update semantics)', async () => {
    const { db, findUnique } = dbFor('EG');
    await expect(phoneForWrite(db, undefined, 'c1')).resolves.toBeUndefined();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('turns null and blank into an explicit null', async () => {
    const { db } = dbFor('EG');
    await expect(phoneForWrite(db, null, 'c1')).resolves.toBeNull();
    await expect(phoneForWrite(db, '   ', 'c1')).resolves.toBeNull();
  });

  it('accepts E.164 without a company lookup', async () => {
    const { db, findUnique } = dbFor('EG');
    await expect(phoneForWrite(db, '+20 106 280 0394', 'c1')).resolves.toBe('+201062800394');
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('normalises a local number with the company country', async () => {
    const { db, findUnique } = dbFor('EG');
    await expect(phoneForWrite(db, '01062800394', 'c1')).resolves.toBe('+201062800394');
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'c1' }, select: { country: true } });
  });

  it('uses the company country to resolve numbers that are local elsewhere too', async () => {
    // 05XXXXXXXX is a valid mobile in both SA and AE; the hint decides.
    const sa = dbFor('SA');
    await expect(phoneForWrite(sa.db, '0500000000', 'c1')).resolves.toBe('+966500000000');
    const ae = dbFor('AE');
    await expect(phoneForWrite(ae.db, '0500000000', 'c1')).resolves.toBe('+971500000000');
  });

  it('falls back to EG when the company has no country, like TenantResolverService', async () => {
    const { db } = dbFor(null);
    await expect(phoneForWrite(db, '01062800394', 'c1')).resolves.toBe('+201062800394');
  });

  it('rejects what it cannot parse instead of storing it verbatim', async () => {
    const { db } = dbFor('EG');
    await expect(phoneForWrite(db, 'call me maybe', 'c1')).rejects.toBeInstanceOf(BadRequestException);
    await expect(phoneForWrite(db, '123', 'c1')).rejects.toBeInstanceOf(BadRequestException);
  });
});
