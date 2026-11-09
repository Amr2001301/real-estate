import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpsertTemplateDto } from '../notifications.module';

/** F-071: a company could save a template with a blank subject/body (an empty message to its customers) or a blank code. */
const ok = { code: 'broker_payout_paid', channel: 'IN_APP', ar_subject: 'أ', en_subject: 'a', ar_body: 'ب', en_body: 'b' };
const bad = async (patch: Record<string, unknown>) =>
  (await validate(plainToInstance(UpsertTemplateDto, { ...ok, ...patch }))).map((e) => e.property);

describe('UpsertTemplateDto', () => {
  it('accepts a normal template', async () => {
    expect(await bad({})).toEqual([]);
  });
  it.each(['ar_subject', 'en_subject', 'ar_body', 'en_body'])('rejects an empty %s', async (f) => {
    expect(await bad({ [f]: '' })).toContain(f);
  });
  it('rejects overlong text', async () => {
    expect(await bad({ ar_subject: 'x'.repeat(201) })).toContain('ar_subject');
    expect(await bad({ en_body: 'x'.repeat(2001) })).toContain('en_body');
  });
  it.each(['', 'A', 'Has Space', '1abc', 'x'.repeat(81)])('rejects the code "%s"', async (code) => {
    expect(await bad({ code })).toContain('code');
  });
});
