import { createHmac } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { openSecret, sealSecret } from '../../../common/security/totp';
import { mapGraphLead } from '../meta-lead-fields';
import { metaConfig, readState, signState, verifyWebhookSignature } from '../meta-config';
import { MetaLeadsService } from '../meta-leads.service';

const ENV = { META_APP_ID: 'app', META_APP_SECRET: 'shh-secret', META_WEBHOOK_VERIFY_TOKEN: 'vt', JWT_REFRESH_SECRET: 'x'.repeat(32), API_BASE_URL: 'https://api.test' };
const COMPANY = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const USER = '33333333-3333-4333-8333-333333333333';

beforeEach(() => Object.assign(process.env, ENV));
afterEach(() => { for (const k of Object.keys(ENV)) delete process.env[k]; });

const sign = (body: object) => {
  const raw = Buffer.from(JSON.stringify(body));
  return { raw, sig: `sha256=${createHmac('sha256', ENV.META_APP_SECRET).update(raw).digest('hex')}` };
};

describe('webhook signature and OAuth state', () => {
  it('accepts a body signed with the app secret and refuses anything else', () => {
    const { raw, sig } = sign({ a: 1 });
    expect(verifyWebhookSignature(raw, sig, ENV.META_APP_SECRET)).toBe(true);
    expect(verifyWebhookSignature(Buffer.from('{"a":2}'), sig, ENV.META_APP_SECRET)).toBe(false);
    expect(verifyWebhookSignature(raw, 'sha256=abc', ENV.META_APP_SECRET)).toBe(false);
    expect(verifyWebhookSignature(raw, undefined, ENV.META_APP_SECRET)).toBe(false);
    expect(verifyWebhookSignature(undefined, sig, ENV.META_APP_SECRET)).toBe(false);
  });

  it('the state carries who started the connection, and cannot be forged or reused late', () => {
    const state = signState(COMPANY, USER, 's', 1_000);
    expect(readState(state, 's', 2_000)).toEqual({ companyId: COMPANY, userId: USER });
    expect(readState(state, 'other-secret', 2_000)).toBeNull();
    expect(readState(`${state}x`, 's', 2_000)).toBeNull();
    expect(readState(state, 's', 1_000 + 16 * 60 * 1000)).toBeNull();
    expect(readState(undefined, 's')).toBeNull();
  });

  it('the feature is off until the Meta app settings are all present', () => {
    expect(metaConfig({})).toBeNull();
    expect(metaConfig({ META_APP_ID: 'a', META_APP_SECRET: 'b' })).toBeNull();
    expect(metaConfig(ENV)?.redirectUri).toBe('https://api.test/v1/meta/callback');
  });
});

describe('mapGraphLead', () => {
  it('maps the standard fields and keeps the other answers in the message', () => {
    const l = mapGraphLead({
      id: '1',
      field_data: [
        { name: 'full_name', values: ['Mona Ali'] },
        { name: 'phone_number', values: ['+201001234567'] },
        { name: 'email', values: ['mona@x.com'] },
        { name: 'budget', values: ['3 million'] },
      ],
    });
    expect(l).toEqual({ name: 'Mona Ali', phone: '+201001234567', email: 'mona@x.com', message: 'budget: 3 million' });
  });

  it('builds the name from first and last, and refuses a form with no phone', () => {
    expect(mapGraphLead({ id: '1', field_data: [{ name: 'first_name', values: ['A'] }, { name: 'last_name', values: ['B'] }, { name: 'phone', values: ['0100'] }] })?.name).toBe('A B');
    expect(mapGraphLead({ id: '1', field_data: [{ name: 'full_name', values: ['No Phone'] }] })).toBeNull();
  });
});

function make(opts: { conn?: unknown; graphLead?: unknown; graphError?: Error; receiptError?: unknown } = {}) {
  const sealed = sealSecret('PAGE-TOKEN', ENV.JWT_REFRESH_SECRET);
  const conn = opts.conn === undefined
    ? { id: 'c1', companyId: COMPANY, pageId: 'p1', pageName: 'Elite Page', tokenEnc: sealed, status: 'ACTIVE', campaignId: 'camp1', projectId: null }
    : opts.conn;
  const prisma = {
    metaConnection: { findUnique: jest.fn().mockResolvedValue(conn), update: jest.fn().mockResolvedValue({}), upsert: jest.fn().mockResolvedValue({}) },
    metaLeadReceipt: {
      create: jest.fn().mockImplementation(() => (opts.receiptError ? Promise.reject(opts.receiptError) : Promise.resolve({}))),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
  };
  const graph = {
    lead: jest.fn().mockImplementation(() =>
      opts.graphError ? Promise.reject(opts.graphError) : Promise.resolve(opts.graphLead ?? { id: 'L1', platform: 'ig', field_data: [{ name: 'full_name', values: ['Mona Ali'] }, { name: 'phone_number', values: ['01001234567'] }] })),
    pages: jest.fn(), userToken: jest.fn(), subscribePage: jest.fn(),
  };
  const intake = { ingest: jest.fn().mockResolvedValue({ status: 'created', leadId: 'lead-1' }) };
  const service = new MetaLeadsService(prisma as never, graph as never, intake as never);
  return { service, prisma, graph, intake, sealed };
}

const event = (over: Record<string, unknown> = {}) => ({ object: 'page', entry: [{ id: 'p1', changes: [{ field: 'leadgen', value: { leadgen_id: 'LG1', page_id: 'p1', form_id: 'f1', ...over } }] }] });
const receive = (m: ReturnType<typeof make>, body = event()) => {
  const { raw, sig } = sign(body);
  return m.service.receive(raw, sig, body);
};

describe('receiving a lead from Facebook', () => {
  it('refuses a body that Facebook did not sign', async () => {
    const m = make();
    const body = event();
    await expect(m.service.receive(Buffer.from(JSON.stringify(body)), 'sha256=bad', body)).rejects.toBeInstanceOf(ForbiddenException);
    expect(m.intake.ingest).not.toHaveBeenCalled();
  });

  it('fetches the lead with the Page token and files it under the Page company, campaign and Instagram source', async () => {
    const m = make();
    await expect(receive(m)).resolves.toEqual({ received: 1 });
    expect(m.graph.lead).toHaveBeenCalledWith('LG1', 'PAGE-TOKEN');
    const [via, dto] = m.intake.ingest.mock.calls[0];
    expect(via).toMatchObject({ campaignId: 'camp1' });
    expect(dto).toMatchObject({ name: 'Mona Ali', phone: '01001234567', utmSource: 'ig', utmMedium: 'paid_social' });
    expect(m.prisma.metaLeadReceipt.update).toHaveBeenCalledWith({ where: { leadgenId: 'LG1' }, data: { leadId: 'lead-1' } });
    expect(m.prisma.metaConnection.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'c1' } }));
  });

  it('ignores a Page that is unknown or not linked yet', async () => {
    for (const conn of [null, { id: 'c', companyId: COMPANY, pageId: 'p1', pageName: 'x', tokenEnc: 'x', status: 'PENDING' }]) {
      const m = make({ conn });
      await receive(m);
      expect(m.intake.ingest).not.toHaveBeenCalled();
    }
  });

  it('takes a lead only once when Facebook delivers it twice', async () => {
    const dup = new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' });
    const m = make({ receiptError: dup });
    await expect(receive(m)).resolves.toEqual({ received: 1 });
    expect(m.graph.lead).not.toHaveBeenCalled();
    expect(m.intake.ingest).not.toHaveBeenCalled();
  });

  it('frees the lead id and fails loudly when it could not be recorded, so Facebook retries', async () => {
    const m = make({ graphError: new Error('graph down') });
    await expect(receive(m)).rejects.toThrow('graph down');
    expect(m.prisma.metaLeadReceipt.delete).toHaveBeenCalledWith({ where: { leadgenId: 'LG1' } });
  });

  it('does not record a lead whose form had no phone number', async () => {
    const m = make({ graphLead: { id: 'L1', field_data: [{ name: 'full_name', values: ['No Phone'] }] } });
    await receive(m);
    expect(m.intake.ingest).not.toHaveBeenCalled();
  });
});

describe('connecting Pages', () => {
  it('keeps each Page token sealed, and leaves a Page that is live for another company alone', async () => {
    const m = make();
    const graph = m.graph as unknown as { pages: jest.Mock; userToken: jest.Mock };
    graph.userToken.mockResolvedValue('USER');
    graph.pages.mockResolvedValue([{ id: 'p1', name: 'Mine', access_token: 'TOK1' }, { id: 'p2', name: 'Taken', access_token: 'TOK2' }]);
    m.prisma.metaConnection.findUnique.mockImplementation(({ where }: { where: { pageId: string } }) =>
      Promise.resolve(where.pageId === 'p2' ? { companyId: OTHER, status: 'ACTIVE' } : null));
    const url = await m.service.callback({ code: 'c', state: signState(COMPANY, USER, ENV.META_APP_SECRET) });
    expect(url).toContain('meta=connected');
    expect(m.prisma.metaConnection.upsert).toHaveBeenCalledTimes(1);
    const created = m.prisma.metaConnection.upsert.mock.calls[0][0].create;
    expect(created.pageId).toBe('p1');
    expect(created.companyId).toBe(COMPANY);
    expect(created.tokenEnc).not.toContain('TOK1');
    expect(openSecret(created.tokenEnc, ENV.JWT_REFRESH_SECRET)).toBe('TOK1');
  });

  it('sends a forged or missing state back as invalid without touching Facebook', async () => {
    const m = make();
    expect(await m.service.callback({ code: 'c', state: 'forged.state' })).toContain('meta=invalid');
    expect((m.graph as unknown as { userToken: jest.Mock }).userToken).not.toHaveBeenCalled();
  });
});
