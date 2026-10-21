/**
 * seed-full-demo.ts — fills EVERY admin dashboard page with realistic demo data.
 *
 * Drives the real API over HTTP (so installment schedules, unit statuses,
 * commissions, bonuses, notifications and audit logs are produced by the
 * product itself) and uses Prisma only to place records in the past
 * (createdAt / scheduledAt / paidAt back-dating) so charts span six months.
 *
 * SAFETY
 *   • Aborts when NODE_ENV === "production".
 *   • Everything it creates is tagged so a re-run skips it and --cleanup
 *     removes exactly it:
 *       - project / broker codes and contract-free numbers: "DEMO-FULL-"
 *       - people: e-mail "@demo-full.devora" and phone "+20100990xxxx"
 *       - CMS slugs "demo-full-<company>-…", document URLs "?src=DEMO-FULL"
 *       - audit-log rows (before._seed) and notifications (payload._seed)
 *         written while the seed ran
 *       - rows that cannot carry a tag (sales targets of existing users, CMS
 *         banners, reference data it had to create) are listed in the
 *         company setting "demo_full.manifest".
 *   • Every Prisma query on a tenanted model is scoped by companyId.
 *
 * PREREQUISITES
 *   The API must be running (it does the real work) and the admin account
 *   must exist. Nothing else is assumed: projects, units, staff, brokers,
 *   plans and categories are created when missing.
 *
 * PLAN LIMITS
 *   The API enforces the company's plan (staff seats, projects, units). When
 *   the plan is full the seed adapts instead of bypassing it: demo deals are
 *   credited to the company's existing sales team, the demo inventory goes
 *   into a "DEMO-FULL-…" phase of an existing project, and broker leads are
 *   written the way the broker portal writes them when no agent seat is free.
 *
 * USAGE
 *   pnpm db:seed:full-demo                              (repo root)
 *   API_URL=http://localhost:4000 pnpm prisma:seed:full-demo   (apps/api)
 *   pnpm prisma:seed:full-demo:cleanup                  (apps/api)
 *
 * ENV
 *   API_URL               default http://localhost:4000
 *   SEED_COMPANY_SLUG     default "default"
 *   SEED_ADMIN_EMAIL      default admin@example.com
 *   SEED_ADMIN_PASSWORD   default ChangeMe123!
 *   DATABASE_URL          the same database the API uses
 */

import { Prisma, PrismaClient } from '@prisma/client';

if (process.env.NODE_ENV === 'production') {
  console.error('❌  seed-full-demo must NOT run in production. Aborting.');
  process.exit(1);
}

const API_URL = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/+$/, '');
const SLUG = process.env.SEED_COMPANY_SLUG ?? 'default';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

const TAG = 'DEMO-FULL';
const SEED_MARK = { _seed: TAG };
const EMAIL_DOMAIN = 'demo-full.devora';
const PHONE_PREFIX = '+20100990';
const STAFF_PASSWORD = 'DemoFull@2026!';
const MANIFEST_KEY = 'demo_full.manifest';
const FILE_TAG = `src=${TAG}`;

const prisma = new PrismaClient();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DAY = 86_400_000;
const NOW = new Date();

function phone(n: number): string {
  return `${PHONE_PREFIX}${String(n).padStart(4, '0')}`;
}
function demoEmail(local: string): string {
  return `${local}@${EMAIL_DOMAIN}`;
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY);
}
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function period(d: Date): string {
  return d.toISOString().slice(0, 7);
}
/** A day `monthsAgo` months back (UTC), at 08:00 UTC (10:00 Cairo). Never after today. */
function dayInMonth(monthsAgo: number, day: number, hourUtc = 8): Date {
  const y = NOW.getUTCFullYear();
  const m = NOW.getUTCMonth() - monthsAgo;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  let d = Math.min(day, last);
  if (monthsAgo === 0) d = Math.min(d, NOW.getUTCDate());
  const out = new Date(Date.UTC(y, m, d, hourUtc, 0, 0));
  return out > NOW ? new Date(NOW.getTime() - 3_600_000) : out;
}
/** UTC midnight of a calendar day `monthsAhead` months from the month of `base`, on `day`. */
function monthDay(base: Date, monthsAhead: number, day: number): Date {
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth() + monthsAhead;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(day, last)));
}
/** Stable pseudo-random in [0,1) from a string (deterministic re-runs). */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}
function money(n: number): number {
  return Math.round(n * 100) / 100;
}

const counters: Record<string, number> = {};
function count(key: string, n = 1) {
  counters[key] = (counters[key] ?? 0) + n;
}
const warnings: string[] = [];
function warn(msg: string) {
  warnings.push(msg);
  console.warn(`   ⚠️  ${msg}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP client (one login per user, refresh on 401, wait on 429)
// ─────────────────────────────────────────────────────────────────────────────

class ApiError extends Error {
  constructor(
    public status: number,
    public body: Json,
    message: string,
  ) {
    super(message);
  }
}

class ApiClient {
  private access = '';
  private refreshToken = '';
  userId = '';

  constructor(private readonly label: string) {}

  async login(email: string, password: string): Promise<void> {
    const res = await this.raw('POST', '/auth/login-staff', { slug: SLUG, email, password }, false);
    this.access = res.tokens.accessToken;
    this.refreshToken = res.tokens.refreshToken;
    this.userId = res.user.id;
  }

  async refresh(): Promise<void> {
    const res = await this.raw('POST', '/auth/refresh', { refreshToken: this.refreshToken }, false);
    const tokens = res.tokens ?? res;
    this.access = tokens.accessToken;
    this.refreshToken = tokens.refreshToken ?? this.refreshToken;
  }

  get<T = Json>(path: string): Promise<T> {
    return this.req('GET', path);
  }
  post<T = Json>(path: string, body: Json = {}): Promise<T> {
    return this.req('POST', path, body);
  }
  patch<T = Json>(path: string, body: Json = {}): Promise<T> {
    return this.req('PATCH', path, body);
  }
  del<T = Json>(path: string): Promise<T> {
    return this.req('DELETE', path);
  }

  private async req(method: string, path: string, body?: Json): Promise<Json> {
    try {
      return await this.raw(method, path, body, true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401 && this.refreshToken) {
        await this.refresh();
        return this.raw(method, path, body, true);
      }
      throw e;
    }
  }

  private async raw(method: string, path: string, body: Json, auth: boolean): Promise<Json> {
    for (let attempt = 0; attempt < 6; attempt++) {
      const headers: Record<string, string> = { 'X-Tenant-Slug': SLUG, Accept: 'application/json' };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (auth && this.access) headers.Authorization = `Bearer ${this.access}`;
      const res = await fetch(`${API_URL}/v1${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      if (res.status === 429) {
        const wait = Number(res.headers.get('retry-after') ?? '') || 30;
        console.log(`   …rate-limited on ${method} ${path} (${this.label}); waiting ${wait}s`);
        await sleep((wait + 1) * 1000);
        continue;
      }
      const text = await res.text();
      let parsed: Json = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = text;
      }
      if (!res.ok) {
        const msg = typeof parsed === 'object' && parsed ? JSON.stringify(parsed.message ?? parsed) : String(parsed);
        throw new ApiError(res.status, parsed, `${method} ${path} → ${res.status}: ${msg.slice(0, 400)}`);
      }
      return parsed;
    }
    throw new Error(`${method} ${path}: still rate-limited after retries`);
  }
}

/** Unwraps `{data: [...]}` or a bare array. */
function rows<T = Json>(res: Json): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && Array.isArray(res.data)) return res.data as T[];
  return [];
}

async function attempt<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    warn(`${label}: ${(e as Error).message}`);
    return null;
  }
}

/** The API refused because the company's plan has no room left (seats, projects, units). */
function isPlanLimit(e: unknown): boolean {
  return e instanceof ApiError && e.status === 403 && JSON.stringify(e.body ?? '').includes('PLAN_LIMIT');
}

// ─────────────────────────────────────────────────────────────────────────────
// Manifest (rows that cannot carry a tag)
// ─────────────────────────────────────────────────────────────────────────────

interface Manifest {
  targetIds: string[];
  bannerIds: string[];
  categoryIds: string[];
  bonusRuleIds: string[];
  unitTypeIds: string[];
  leadSourceIds: string[];
}
const emptyManifest = (): Manifest => ({
  targetIds: [],
  bannerIds: [],
  categoryIds: [],
  bonusRuleIds: [],
  unitTypeIds: [],
  leadSourceIds: [],
});

async function loadManifest(companyId: string): Promise<Manifest> {
  const row = await prisma.setting.findFirst({ where: { companyId, key: MANIFEST_KEY } });
  return { ...emptyManifest(), ...((row?.value as Partial<Manifest> | null) ?? {}) };
}
async function saveManifest(companyId: string, m: Manifest): Promise<void> {
  const value = m as unknown as Prisma.InputJsonValue;
  await prisma.setting.upsert({
    where: { companyId_key: { companyId, key: MANIFEST_KEY } },
    create: { companyId, key: MANIFEST_KEY, value },
    update: { value },
  });
}
function remember(list: string[], id: string) {
  if (!list.includes(id)) list.push(id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Content
// ─────────────────────────────────────────────────────────────────────────────

const FIRST_M = ['أحمد', 'محمد', 'مصطفى', 'كريم', 'طارق', 'خالد', 'شريف', 'هشام', 'وليد', 'عمرو', 'إسلام', 'حسام', 'باسم', 'ياسر', 'عادل', 'تامر', 'أيمن', 'رامي', 'مينا', 'بيتر'];
const FIRST_F = ['منى', 'سارة', 'نهى', 'دينا', 'ريهام', 'هبة', 'إيمان', 'مروة', 'نادية', 'شيماء', 'رانيا', 'غادة', 'مريم', 'أمل', 'ياسمين'];
const LAST = ['عبد الحميد', 'السيد', 'الشريف', 'منصور', 'فهمي', 'إبراهيم', 'عبد الله', 'النجار', 'سليمان', 'حسن', 'الجمال', 'رزق', 'عطية', 'زكي', 'شاكر', 'الدسوقي', 'بدوي', 'عثمان', 'غالي', 'حنا'];

function personName(i: number): string {
  const female = i % 3 === 1;
  const first = female ? FIRST_F[i % FIRST_F.length]! : FIRST_M[i % FIRST_M.length]!;
  const last = LAST[(i * 7 + 3) % LAST.length]!;
  return `${first} ${last}`;
}

interface Person {
  n: number;
  name: string;
  phone: string;
  email: string;
}
function person(n: number): Person {
  return { n, name: personName(n), phone: phone(n), email: demoEmail(`client${n}`) };
}

const STAFF = {
  manager: { key: 'manager', fullName: 'هالة عبد الرحمن', email: demoEmail('hala.manager'), phone: phone(9001), role: 'SALES_MANAGER' },
  rep1: { key: 'rep1', fullName: 'عمر الشناوي', email: demoEmail('omar.sales'), phone: phone(9002), role: 'SALES' },
  rep2: { key: 'rep2', fullName: 'ياسمين فاروق', email: demoEmail('yasmin.sales'), phone: phone(9003), role: 'SALES' },
  rep3: { key: 'rep3', fullName: 'محمود البنا', email: demoEmail('mahmoud.sales'), phone: phone(9004), role: 'SALES' },
  maint: { key: 'maint', fullName: 'سيد عبد العظيم', email: demoEmail('sayed.maintenance'), phone: phone(9005), role: 'MAINTENANCE_SUPERVISOR' },
} as const;
type StaffKey = keyof typeof STAFF;
type SellerKey = 'manager' | 'rep1' | 'rep2' | 'rep3' | 'admin';

const PROJECTS = [
  {
    key: 'NG',
    code: `${TAG}-NILE-GARDENS`,
    name: { ar: 'نايل جاردنز ريزيدنس', en: 'Nile Gardens Residence' },
    description: {
      ar: 'كمبوند سكني متكامل في قلب التجمع الخامس على مساحة 42 فدان — مساحات خضراء 70٪، نادي اجتماعي، وأمن على مدار الساعة.',
      en: 'A gated residential compound in the heart of New Cairo on 42 acres — 70% green space, a clubhouse and 24/7 security.',
    },
    city: 'القاهرة الجديدة',
    district: 'التجمع الخامس',
    lat: 30.0074,
    lng: 31.4913,
    type: 'RESIDENTIAL',
    delivery: '2028-06-30',
    buildings: [
      { code: 'B-01', name: 'عمارة 1', floors: 6 },
      { code: 'B-02', name: 'عمارة 2', floors: 6 },
      { code: 'B-03', name: 'عمارة 3', floors: 6 },
    ],
    unitsPerBuilding: 10,
    pricePerM2: 32_000,
    prefix: 'NG',
  },
  {
    key: 'LB',
    code: `${TAG}-LAGUNA-BAY`,
    name: { ar: 'لاجونا باي — الساحل الشمالي', en: 'Laguna Bay — North Coast' },
    description: {
      ar: 'قرية ساحلية على شاطئ رملي بطول 900 متر في سيدي عبد الرحمن — شاليهات وتوين هاوس بإطلالات مباشرة على البحر واللاجون.',
      en: 'A beach resort on a 900 m sandy shore in Sidi Abdel Rahman — chalets and twin houses with direct sea and lagoon views.',
    },
    city: 'الساحل الشمالي',
    district: 'سيدي عبد الرحمن',
    lat: 30.9637,
    lng: 28.7406,
    type: 'COASTAL',
    delivery: '2027-07-01',
    buildings: [
      { code: 'Z-01', name: 'زون الشاليهات', floors: 3 },
      { code: 'Z-02', name: 'زون اللاجون', floors: 3 },
    ],
    unitsPerBuilding: 8,
    pricePerM2: 41_000,
    prefix: 'LB',
  },
] as const;

type PayPolicy = 'full' | 'late' | 'cheque' | 'bounce' | 'none';
interface DealSpec {
  key: string;
  client: number;
  seller: SellerKey;
  project: 'NG' | 'LB';
  unit: number;
  monthsAgo: number;
  day: number;
  months: 36 | 60;
  pay: PayPolicy;
  sign: boolean;
  broker?: 'BR1' | 'BR2';
  method: 'CASH' | 'BANK_TRANSFER';
}

// 26 deals: five signed this month (one via a broker), two awaiting signature,
// and two to four in each of the last six months — every seller closes a deal
// in each of the three months that carry sales targets. Three customers fall behind, three pay
// by cheque, one cheque bounces.
const DEALS: DealSpec[] = [
  { key: 'D01', client: 1, seller: 'rep1', project: 'NG', unit: 0, monthsAgo: 0, day: 3, months: 60, pay: 'full', sign: true, method: 'BANK_TRANSFER' },
  { key: 'D02', client: 2, seller: 'rep2', project: 'NG', unit: 1, monthsAgo: 0, day: 8, months: 36, pay: 'full', sign: true, method: 'CASH' },
  { key: 'D03', client: 3, seller: 'admin', project: 'LB', unit: 0, monthsAgo: 0, day: 12, months: 60, pay: 'full', sign: true, method: 'BANK_TRANSFER' },
  { key: 'D04', client: 4, seller: 'manager', project: 'NG', unit: 2, monthsAgo: 0, day: 15, months: 60, pay: 'full', sign: true, method: 'BANK_TRANSFER' },
  { key: 'D05', client: 5, seller: 'rep3', project: 'NG', unit: 3, monthsAgo: 0, day: 18, months: 36, pay: 'none', sign: false, method: 'CASH' },
  { key: 'D06', client: 6, seller: 'rep1', project: 'LB', unit: 1, monthsAgo: 0, day: 19, months: 60, pay: 'none', sign: false, method: 'CASH' },
  { key: 'D07', client: 7, seller: 'rep2', project: 'NG', unit: 4, monthsAgo: 1, day: 6, months: 60, pay: 'full', sign: true, method: 'BANK_TRANSFER' },
  { key: 'D08', client: 8, seller: 'rep3', project: 'NG', unit: 5, monthsAgo: 1, day: 21, months: 36, pay: 'cheque', sign: true, method: 'BANK_TRANSFER' },
  { key: 'D09', client: 9, seller: 'rep3', project: 'LB', unit: 2, monthsAgo: 2, day: 4, months: 60, pay: 'late', sign: true, method: 'CASH' },
  { key: 'D10', client: 10, seller: 'rep1', project: 'NG', unit: 6, monthsAgo: 2, day: 17, months: 60, pay: 'full', sign: true, method: 'BANK_TRANSFER' },
  { key: 'D11', client: 11, seller: 'manager', project: 'NG', unit: 7, monthsAgo: 3, day: 9, months: 36, pay: 'cheque', sign: true, method: 'BANK_TRANSFER' },
  { key: 'D12', client: 12, seller: 'rep2', project: 'LB', unit: 3, monthsAgo: 3, day: 24, months: 60, pay: 'full', sign: true, method: 'CASH' },
  { key: 'D13', client: 13, seller: 'rep1', project: 'NG', unit: 8, monthsAgo: 4, day: 5, months: 60, pay: 'late', sign: true, method: 'BANK_TRANSFER' },
  { key: 'D14', client: 14, seller: 'admin', project: 'NG', unit: 9, monthsAgo: 4, day: 20, months: 60, pay: 'full', sign: true, method: 'BANK_TRANSFER' },
  { key: 'D15', client: 15, seller: 'rep3', project: 'NG', unit: 10, monthsAgo: 5, day: 11, months: 36, pay: 'bounce', sign: true, method: 'BANK_TRANSFER' },
  { key: 'D16', client: 16, seller: 'rep2', project: 'LB', unit: 4, monthsAgo: 5, day: 26, months: 60, pay: 'full', sign: true, method: 'CASH' },
  { key: 'D17', client: 17, seller: 'manager', project: 'NG', unit: 11, monthsAgo: 6, day: 7, months: 60, pay: 'full', sign: true, method: 'BANK_TRANSFER' },
  { key: 'D18', client: 18, seller: 'rep1', project: 'NG', unit: 12, monthsAgo: 6, day: 22, months: 60, pay: 'late', sign: true, method: 'BANK_TRANSFER' },
  { key: 'D19', client: 33, seller: 'manager', project: 'NG', unit: 21, monthsAgo: 1, day: 25, months: 36, pay: 'full', sign: true, method: 'BANK_TRANSFER' },
  { key: 'D20', client: 34, seller: 'manager', project: 'LB', unit: 8, monthsAgo: 2, day: 27, months: 60, pay: 'full', sign: true, method: 'CASH' },
  { key: 'D21', client: 35, seller: 'admin', project: 'NG', unit: 22, monthsAgo: 2, day: 14, months: 60, pay: 'full', sign: true, method: 'BANK_TRANSFER' },
  // Broker deals (portal leads → admin books on the broker's behalf).
  { key: 'B01', client: 19, seller: 'rep1', project: 'NG', unit: 13, monthsAgo: 1, day: 13, months: 60, pay: 'full', sign: true, broker: 'BR1', method: 'BANK_TRANSFER' },
  { key: 'B02', client: 20, seller: 'rep2', project: 'LB', unit: 5, monthsAgo: 2, day: 10, months: 60, pay: 'full', sign: true, broker: 'BR2', method: 'BANK_TRANSFER' },
  { key: 'B03', client: 21, seller: 'rep1', project: 'NG', unit: 14, monthsAgo: 3, day: 16, months: 36, pay: 'full', sign: true, broker: 'BR1', method: 'CASH' },
  { key: 'B04', client: 22, seller: 'rep2', project: 'NG', unit: 15, monthsAgo: 5, day: 2, months: 60, pay: 'full', sign: true, broker: 'BR1', method: 'BANK_TRANSFER' },
  { key: 'B05', client: 32, seller: 'rep3', project: 'NG', unit: 20, monthsAgo: 0, day: 5, months: 60, pay: 'full', sign: true, broker: 'BR2', method: 'BANK_TRANSFER' },
];

// Reservations that stay open (or were turned down) — one per status.
interface OpenResSpec {
  key: string;
  client: number;
  seller: SellerKey;
  project: 'NG' | 'LB';
  unit: number;
  outcome: 'PENDING' | 'APPROVED' | 'APPROVED_PAID' | 'REJECTED' | 'CANCELLED';
  daysAgo: number;
}
const OPEN_RESERVATIONS: OpenResSpec[] = [
  { key: 'R01', client: 23, seller: 'rep1', project: 'NG', unit: 16, outcome: 'PENDING', daysAgo: 1 },
  { key: 'R02', client: 24, seller: 'rep2', project: 'NG', unit: 17, outcome: 'PENDING', daysAgo: 0 },
  { key: 'R03', client: 25, seller: 'rep3', project: 'LB', unit: 6, outcome: 'APPROVED_PAID', daysAgo: 4 },
  { key: 'R04', client: 26, seller: 'manager', project: 'NG', unit: 18, outcome: 'APPROVED', daysAgo: 3 },
  { key: 'R05', client: 27, seller: 'rep1', project: 'NG', unit: 19, outcome: 'REJECTED', daysAgo: 9 },
  { key: 'R06', client: 28, seller: 'rep2', project: 'LB', unit: 7, outcome: 'CANCELLED', daysAgo: 14 },
];

// Pipeline-only leads (no reservation), across every open stage plus LOST.
const PIPELINE_STAGES: Array<{ stage: 'NEW' | 'INTERESTED' | 'VISIT' | 'NEGOTIATION' | 'LOST'; n: number }> = [
  { stage: 'NEW', n: 7 },
  { stage: 'INTERESTED', n: 6 },
  { stage: 'VISIT', n: 5 },
  { stage: 'NEGOTIATION', n: 4 },
  { stage: 'LOST', n: 4 },
];
const LEAD_NOTES = [
  'العميل مهتم بوحدة في الدور الأرضي بحديقة — طلب عرض سعر مفصل.',
  'تم التواصل عبر الواتساب وإرسال البروشور وخطة السداد.',
  'يفضل نظام سداد على 7 سنوات، وميزانيته في حدود 5 مليون جنيه.',
  'طلب زيارة الموقع يوم الجمعة مع العائلة.',
  'يقارن بين مشروعنا ومشروع آخر في الشيخ زايد — نحتاج متابعة سريعة.',
  'العميل مقيم بالخارج (السعودية) ويرغب في التعاقد أونلاين.',
];
const LOST_REASONS = ['اشترى في مشروع آخر', 'الميزانية غير كافية حالياً', 'أجّل قرار الشراء للعام القادم', 'لم يعد يرد على المكالمات'];

const BROKERS = {
  BR1: {
    code: `${TAG}-BR1`,
    companyName: 'بيت الخبرة للتسويق العقاري',
    commercialName: 'Beit El Khebra Realty',
    email: demoEmail('info.beitelkhebra'),
    phone: phone(9101),
    city: 'القاهرة',
    pct: 2.5,
    agent: { fullName: 'كريم حلمي', email: demoEmail('karim.broker'), phone: phone(9102), jobTitle: 'مستشار مبيعات أول' },
    leads: [19, 21, 22, 29, 30],
  },
  BR2: {
    code: `${TAG}-BR2`,
    companyName: 'مكتب النخبة العقاري',
    commercialName: 'El Nokhba Properties',
    email: demoEmail('info.elnokhba'),
    phone: phone(9201),
    city: 'الإسكندرية',
    pct: 3,
    agent: { fullName: 'رانيا سعيد', email: demoEmail('rania.broker'), phone: phone(9202), jobTitle: 'مديرة حسابات' },
    leads: [20, 31, 32],
  },
} as const;
type BrokerKey = keyof typeof BROKERS;

const PDF_URL = `https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf?${FILE_TAG}`;
const IMG = (id: string) => `https://images.unsplash.com/${id}?w=1600&${FILE_TAG}`;

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

interface Ctx {
  companyId: string;
  admin: ApiClient;
  adminId: string;
  manifest: Manifest;
  staff: Record<StaffKey, string>;
  /** Staff keys that are demo accounts (the rest are the company's own people). */
  demoStaff: Set<StaffKey>;
  projects: Record<'NG' | 'LB', { id: string; units: string[] }>;
  sources: string[];
  brokers: Partial<Record<BrokerKey, { id: string; agentUserId: string; brokerUserId: string }>>;
  createdIds: Map<string, Date>;
}

function sellerId(ctx: Ctx, s: SellerKey): string {
  return s === 'admin' ? ctx.adminId : ctx.staff[s];
}
/** Who runs a visit: a visit is assigned to a sales person, never the admin. */
function visitSeller(ctx: Ctx, s: SellerKey): string {
  return s === 'admin' ? ctx.staff.rep1 : ctx.staff[s];
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Staff, sources, unit types, categories
// ─────────────────────────────────────────────────────────────────────────────

async function ensureStaff(ctx: Ctx): Promise<void> {
  console.log('👥  Staff…');
  const order: StaffKey[] = ['manager', 'rep1', 'rep2', 'rep3', 'maint'];
  let seatsFull = false;
  for (const key of order) {
    const s = STAFF[key];
    const existing = await prisma.user.findFirst({ where: { companyId: ctx.companyId, email: s.email }, select: { id: true } });
    if (existing) {
      ctx.staff[key] = existing.id;
      ctx.demoStaff.add(key);
      continue;
    }
    if (!seatsFull) {
      const body: Json = { role: s.role, fullName: s.fullName, email: s.email, phone: s.phone, password: STAFF_PASSWORD, locale: 'ar' };
      if (s.role === 'SALES' && ctx.demoStaff.has('manager')) body.managerId = ctx.staff.manager;
      try {
        const u = await ctx.admin.post('/users', body);
        ctx.staff[key] = u.id;
        ctx.demoStaff.add(key);
        count('staff');
        continue;
      } catch (e) {
        if (!isPlanLimit(e)) throw e;
        seatsFull = true;
        warn('the plan has no free staff seats — demo deals are credited to the existing team instead');
      }
    }
    // No seat: credit the company's own people with that role.
    const findRole = (role: string) =>
      prisma.user.findMany({
        where: { companyId: ctx.companyId, role: role as never, active: true, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
    let pool = await findRole(s.role);
    if (!pool.length && s.role === 'SALES') pool = await findRole('SALES_MANAGER');
    const idx = key === 'rep2' ? 1 : key === 'rep3' ? 2 : 0;
    const pick = pool.length ? pool[idx % pool.length]!.id : s.role === 'MAINTENANCE_SUPERVISOR' ? '' : ctx.adminId;
    ctx.staff[key] = pick;
  }
  // A permission change on a demo rep — shows on the audit "sensitive" panels.
  if (ctx.demoStaff.has('rep1')) {
    await attempt('grant permission', () =>
      ctx.admin.patch(`/users/${ctx.staff.rep1}/permissions`, { addPermissionCodes: ['reports:read'] }),
    );
  }
}

async function ensureLeadSources(ctx: Ctx): Promise<void> {
  const list = rows<{ id: string; active: boolean }>(await ctx.admin.get('/lead-sources')).filter((s) => s.active);
  ctx.sources = list.map((s) => s.id);
  if (ctx.sources.length >= 3) return;
  const wanted = [
    { ar: 'فيسبوك', en: 'Facebook' },
    { ar: 'موقع الويب', en: 'Website' },
    { ar: 'ترشيح من عميل', en: 'Referral' },
    { ar: 'معرض سيتي سكيب', en: 'Cityscape Expo' },
  ];
  for (const w of wanted.slice(0, 4 - ctx.sources.length)) {
    const s = await ctx.admin.post('/lead-sources', w);
    remember(ctx.manifest.leadSourceIds, s.id);
    ctx.sources.push(s.id);
  }
}

async function unitTypeCodes(ctx: Ctx): Promise<string[]> {
  const list = rows<{ id: string; code: string; usage: string; active: boolean }>(await ctx.admin.get('/unit-types')).filter(
    (t) => t.active && t.usage === 'RESIDENTIAL',
  );
  if (list.length >= 2) {
    const prefer = ['2BR', '3BR', 'Villa', 'Townhouse', 'Chalet', 'Duplex'];
    const picked = prefer.filter((p) => list.some((t) => t.code === p));
    const codes = picked.length >= 2 ? picked : list.map((t) => t.code);
    return codes.slice(0, 3);
  }
  const created: string[] = [];
  for (const t of [
    { ar: 'شقة', en: 'Apartment', code: 'DF-APT' },
    { ar: 'شاليه', en: 'Chalet', code: 'DF-CHALET' },
  ]) {
    const r = await ctx.admin.post('/unit-types', { ...t, usage: 'RESIDENTIAL' });
    remember(ctx.manifest.unitTypeIds, r.id);
    created.push(r.code ?? t.code);
  }
  return created;
}

async function ensureCategories(ctx: Ctx): Promise<string[]> {
  const list = rows<{ id: string; active: boolean }>(await ctx.admin.get('/maintenance-categories')).filter((c) => c.active);
  if (list.length >= 3) return list.map((c) => c.id);
  const wanted = [
    { ar: 'سباكة', en: 'Plumbing', priority: 'HIGH', slaValue: 2, slaUnit: 'DAYS', warrantyValue: 12, warrantyUnit: 'MONTHS' },
    { ar: 'كهرباء', en: 'Electrical', priority: 'HIGH', slaValue: 1, slaUnit: 'DAYS', warrantyValue: 12, warrantyUnit: 'MONTHS' },
    { ar: 'تكييف', en: 'HVAC', priority: 'MEDIUM', slaValue: 3, slaUnit: 'DAYS', warrantyValue: 24, warrantyUnit: 'MONTHS' },
    { ar: 'نجارة وأبواب', en: 'Carpentry', priority: 'LOW', slaValue: 5, slaUnit: 'DAYS', warrantyValue: 12, warrantyUnit: 'MONTHS' },
  ];
  const ids = list.map((c) => c.id);
  for (const w of wanted) {
    if (ids.length >= 4) break;
    const c = await attempt(`category ${w.en}`, () => ctx.admin.post('/maintenance-categories', w));
    if (c) {
      remember(ctx.manifest.categoryIds, c.id);
      ids.push(c.id);
    }
  }
  return ids;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Projects → phases → buildings → units
// ─────────────────────────────────────────────────────────────────────────────

/** The demo phase code inside a project — what identifies the demo inventory. */
const phaseCode = (key: string) => `${TAG}-${key}`;

async function ensureProjects(ctx: Ctx): Promise<void> {
  console.log('🏗️   Projects and units…');
  const types = await unitTypeCodes(ctx);
  const hostsUsed = new Set<string>();
  for (const p of PROJECTS) {
    // 1. The demo project — or, when the plan has no room for another project,
    //    an existing project of the company that the demo phase is added to.
    let projectId: string | null = null;
    const ownPhase = await prisma.phase.findFirst({
      where: { companyId: ctx.companyId, code: phaseCode(p.key) },
      select: { projectId: true },
    });
    if (ownPhase) projectId = ownPhase.projectId;
    if (!projectId) {
      const own = await prisma.project.findFirst({ where: { companyId: ctx.companyId, code: p.code }, select: { id: true } });
      projectId = own?.id ?? null;
    }
    if (!projectId) {
      try {
        const created = await ctx.admin.post('/projects', {
          code: p.code,
          name: p.name,
          description: p.description,
          city: p.city,
          district: p.district,
          lat: p.lat,
          lng: p.lng,
          status: 'PUBLISHED',
          featured: true,
          type: p.type,
          totalArea: p.key === 'NG' ? 176_000 : 240_000,
          licenseNumber: `${TAG}-LIC-${p.key}-2024`,
          services: [
            { ar: 'نادي اجتماعي وحمامات سباحة', en: 'Clubhouse and pools' },
            { ar: 'أمن وبوابات ذكية 24/7', en: '24/7 security and smart gates' },
            { ar: 'مول تجاري ومنطقة مطاعم', en: 'Retail and dining strip' },
          ],
        });
        projectId = created.id as string;
        count('projects');
      } catch (e) {
        if (!isPlanLimit(e)) throw e;
        const hosts = await prisma.project.findMany({
          where: { companyId: ctx.companyId, status: { not: 'ARCHIVED' }, code: { not: { startsWith: `${TAG}-` } } },
          orderBy: [{ status: 'desc' }, { createdAt: 'asc' }],
          select: { id: true },
        });
        const host = hosts.find((h) => !hostsUsed.has(h.id)) ?? hosts[0];
        if (!host) throw e;
        projectId = host.id;
        warn(`the plan has no room for another project — the "${p.name.en}" demo phase is added to an existing project`);
      }
    }
    hostsUsed.add(projectId);

    // 2. The demo phase (tagged code) and its buildings and units.
    let phase = await prisma.phase.findFirst({ where: { companyId: ctx.companyId, projectId, code: phaseCode(p.key) }, select: { id: true } });
    if (!phase) {
      phase = await ctx.admin.post('/phases', {
        projectId,
        code: phaseCode(p.key),
        name: { ar: `المرحلة الأولى — ${p.name.ar}`, en: `Phase 1 — ${p.name.en}` },
        order: 1,
        deliveryDate: p.delivery,
      });
    }
    const units: string[] = [];
    let unitsFull = false;
    for (const [bi, b] of p.buildings.entries()) {
      let building = await prisma.building.findFirst({
        where: { companyId: ctx.companyId, phaseId: phase!.id, code: b.code },
        select: { id: true },
      });
      if (!building) {
        building = await ctx.admin.post('/buildings', { phaseId: phase!.id, code: b.code, name: b.name, totalFloors: b.floors, order: bi + 1 });
      }
      for (let i = 0; i < p.unitsPerBuilding; i++) {
        const floor = Math.floor(i / 2) + (p.key === 'NG' ? 1 : 0);
        const code = `DF-${p.prefix}-${b.code.replace('-', '')}-${floor}${String((i % 2) + 1).padStart(2, '0')}`;
        const existing = await prisma.unit.findFirst({
          where: { companyId: ctx.companyId, buildingId: building!.id, code },
          select: { id: true },
        });
        if (existing) {
          units.push(existing.id);
          continue;
        }
        if (unitsFull) continue;
        const big = (i + bi) % 3 === 0;
        const area = p.key === 'NG' ? (big ? 185 : 135) + (i % 4) * 10 : (big ? 140 : 95) + (i % 3) * 8;
        const price = Math.round((area * p.pricePerM2) / 1000) * 1000;
        const typeCode = types[(i + bi) % types.length]!;
        try {
          const u = await ctx.admin.post('/units', {
            buildingId: building!.id,
            code,
            type: typeCode,
            area,
            netArea: Math.round(area * 0.82),
            bedrooms: big ? 3 : 2,
            bathrooms: big ? 3 : 2,
            floor,
            price,
            finishing: p.key === 'NG' ? 'SEMI_FINISHED' : 'FULLY_FINISHED',
            view: p.key === 'NG' ? (i % 2 ? 'GARDEN' : 'LANDSCAPE') : i % 2 ? 'SEA' : 'LAGOON',
          });
          units.push(u.id);
          count('units');
        } catch (e) {
          if (!isPlanLimit(e)) throw e;
          unitsFull = true;
          warn('the plan has no room for more units — the deals that need the missing units are skipped');
        }
      }
    }
    ctx.projects[p.key] = { id: projectId, units };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Brokers (firms, agents, project access, portal leads)
// ─────────────────────────────────────────────────────────────────────────────

async function ensureBrokers(ctx: Ctx): Promise<void> {
  console.log('🤝  Brokers…');
  for (const key of Object.keys(BROKERS) as BrokerKey[]) {
    const b = BROKERS[key];
    let broker = await prisma.broker.findFirst({ where: { companyId: ctx.companyId, code: b.code }, select: { id: true } });
    if (!broker) {
      broker = await ctx.admin.post('/brokers', {
        companyName: b.companyName,
        commercialName: b.commercialName,
        code: b.code,
        email: b.email,
        phone: b.phone,
        city: b.city,
        address: key === 'BR1' ? '15 شارع التسعين الشمالي، التجمع الخامس' : '22 طريق الجيش، رشدي',
        commercialRegistration: key === 'BR1' ? '128843' : '99712',
        taxId: key === 'BR1' ? '512-447-301' : '448-210-993',
        bankName: key === 'BR1' ? 'البنك الأهلي المصري' : 'بنك مصر',
        bankAccountName: b.companyName,
        bankIban: key === 'BR1' ? 'EG380003000123456789012345678' : 'EG120002000987654321098765432',
        defaultCommissionPct: b.pct,
        commissionModel: 'PERCENT_OF_SALE',
        contractStartAt: ymd(addDays(NOW, -240)),
        contractEndAt: ymd(addDays(NOW, 490)),
        notes: `شريك تسويق معتمد`,
      });
      count('brokers');
    }
    const brokerId = broker!.id;
    // A new firm starts PENDING; the developer activates it (portal access).
    const status = await prisma.broker.findFirst({ where: { companyId: ctx.companyId, id: brokerId }, select: { status: true } });
    if (status?.status === 'PENDING') {
      await ctx.admin.patch(`/brokers/${brokerId}/status`, { status: 'ACTIVE', reason: 'تم استلام المستندات وتوقيع اتفاقية التسويق' });
    }
    // Agent account (BROKER role user + BrokerUser link) — it takes a staff seat.
    let agentUser = await prisma.user.findFirst({ where: { companyId: ctx.companyId, email: b.agent.email }, select: { id: true } });
    if (!agentUser) {
      try {
        await ctx.admin.post(`/brokers/${brokerId}/users`, {
          fullName: b.agent.fullName,
          email: b.agent.email,
          phone: b.agent.phone,
          password: STAFF_PASSWORD,
          locale: 'ar',
          jobTitle: b.agent.jobTitle,
          isPrimaryContact: true,
          canManageBrokerUsers: true,
          canViewCommissions: true,
        });
        agentUser = await prisma.user.findFirst({ where: { companyId: ctx.companyId, email: b.agent.email }, select: { id: true } });
      } catch (e) {
        if (!isPlanLimit(e)) throw e;
        warn(`no free staff seat for the ${key} broker agent — the firm's leads are entered without an agent`);
      }
    }
    const link = agentUser
      ? await prisma.brokerUser.findFirst({ where: { companyId: ctx.companyId, brokerId, userId: agentUser.id }, select: { id: true } })
      : null;
    for (const pk of ['NG', 'LB'] as const) {
      const has = await prisma.brokerProjectAccess.findFirst({
        where: { companyId: ctx.companyId, brokerId, projectId: ctx.projects[pk].id },
        select: { id: true },
      });
      if (!has) await attempt('broker project access', () => ctx.admin.post(`/brokers/${brokerId}/access/projects`, { projectId: ctx.projects[pk].id }));
    }
    ctx.brokers[key] = { id: brokerId, agentUserId: agentUser?.id ?? '', brokerUserId: link?.id ?? '' };
  }
}

/**
 * Broker agents submit leads through the portal; admin approves or rejects
 * them. Without an agent account (no free seat) the lead is written the way
 * the portal writes it — the one place this seed creates a lead with Prisma.
 */
async function ensureBrokerLeads(ctx: Ctx): Promise<void> {
  for (const key of Object.keys(BROKERS) as BrokerKey[]) {
    const b = BROKERS[key];
    const br = ctx.brokers[key];
    if (!br) continue;
    const missing: number[] = [];
    for (const n of b.leads) {
      const lead = await prisma.lead.findFirst({ where: { companyId: ctx.companyId, phone: phone(n) }, select: { id: true } });
      if (!lead) missing.push(n);
    }
    let agent: ApiClient | null = null;
    if (missing.length && br.agentUserId) {
      agent = new ApiClient(`broker ${key}`);
      await agent.login(b.agent.email, STAFF_PASSWORD);
    }
    for (const n of missing) {
      const p = person(n);
      const deal = DEALS.find((d) => d.client === n);
      const projectKey = deal?.project ?? 'NG';
      const unitId = deal ? ctx.projects[projectKey].units[deal.unit] : undefined;
      const note = 'عميل مهتم بالشراء — تم التواصل معه عبر مكتبنا وحضر عرض المشروع.';
      if (agent) {
        await agent.post('/portal/leads', {
          fullName: p.name,
          phone: p.phone,
          email: p.email,
          projectInterestId: ctx.projects[projectKey].id,
          ...(unitId ? { unitInterestId: unitId } : {}),
          note,
        });
      } else {
        await prisma.$transaction(async (tx) => {
          const client =
            (await tx.user.findFirst({ where: { companyId: ctx.companyId, phone: p.phone }, select: { id: true } })) ??
            (await tx.user.create({
              data: { companyId: ctx.companyId, role: 'CLIENT', fullName: p.name, phone: p.phone, email: p.email, locale: 'ar' },
              select: { id: true },
            }));
          const lead = await tx.lead.create({
            data: {
              companyId: ctx.companyId,
              clientId: client.id,
              fullName: p.name,
              phone: p.phone,
              email: p.email,
              projectInterestId: ctx.projects[projectKey].id,
              unitInterestId: unitId ?? null,
              stage: 'NEW',
              brokerId: br.id,
              brokerSubmittedAt: new Date(),
              brokerApprovalStatus: 'PENDING',
            },
            select: { id: true },
          });
          await tx.leadActivity.createMany({
            data: [
              { companyId: ctx.companyId, leadId: lead.id, type: 'broker_submitted', payload: { brokerId: br.id, brokerAgentId: null, isDuplicate: false, duplicateOfId: null } },
              { companyId: ctx.companyId, leadId: lead.id, type: 'broker_note', payload: { authorBrokerAgentId: null, body: note } },
            ],
          });
        });
      }
      count('brokerLeads');
    }
    // Moderate: approve the ones that become deals, reject one, leave the rest pending.
    for (const n of b.leads) {
      const lead = await prisma.lead.findFirst({
        where: { companyId: ctx.companyId, phone: phone(n), brokerId: br.id },
        select: { id: true, brokerApprovalStatus: true },
      });
      if (!lead || lead.brokerApprovalStatus !== 'PENDING') continue;
      const deal = DEALS.find((d) => d.client === n);
      if (deal) {
        await ctx.admin.patch(`/broker-leads/${lead.id}/approve`, { assignedSalesId: sellerId(ctx, deal.seller), note: 'تم التحقق من بيانات العميل' });
      } else if (n === 30) {
        await ctx.admin.patch(`/broker-leads/${lead.id}/reject`, { reason: 'العميل مسجل لدينا مسبقاً عن طريق فريق المبيعات المباشر' });
      }
      // n === 29 / 31 stay PENDING for the review queue.
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Bonus rules
// ─────────────────────────────────────────────────────────────────────────────

async function ensureBonusRules(ctx: Ctx): Promise<{ autoRuleId: string | null; manualRuleId: string | null }> {
  console.log('🏅  Bonus rules…');
  const rules = rows<{ id: string; name: string; active: boolean; autoApplyOnSignedContract: boolean }>(await ctx.admin.get('/bonus-rules'));
  const autoActive = rules.filter((r) => r.active && r.autoApplyOnSignedContract);
  let autoRuleId: string | null = autoActive.length === 1 ? autoActive[0]!.id : null;
  if (autoActive.length === 0) {
    const r = await ctx.admin.post('/bonus-rules', { name: 'عمولة مبيعات 1٪ — تُحتسب عند توقيع العقد', percentage: 1, active: true, autoApplyOnSignedContract: true });
    remember(ctx.manifest.bonusRuleIds, r.id);
    autoRuleId = r.id;
  } else if (autoActive.length > 1) {
    warn('more than one active auto-apply bonus rule — sales commissions will not be generated on signing');
  }
  const manualName = 'حافز تحقيق التارجت الشهري';
  let manual = rules.find((r) => r.name === manualName && r.active);
  if (!manual) {
    manual = await ctx.admin.post('/bonus-rules', { name: manualName, percentage: 0.5, active: true, autoApplyOnSignedContract: false });
    remember(ctx.manifest.bonusRuleIds, manual!.id);
  }
  return { autoRuleId, manualRuleId: manual?.id ?? null };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Deals: lead → visit → template → reservation → contract → payments
// ─────────────────────────────────────────────────────────────────────────────

/** The day of the month the customer's instalments fall on: within the coming week or later this month. */
function dueDayFor(spec: DealSpec): number {
  const soon = addDays(NOW, 2 + (spec.client % 4)); // 2..5 days ahead
  const later = addDays(NOW, 8 + (spec.client % 3)); // 8..10 days ahead
  const pick = spec.client % 2 === 0 && later.getUTCMonth() === NOW.getUTCMonth() ? later : soon;
  return Math.min(pick.getUTCDate(), 28);
}

async function ensureLead(
  ctx: Ctx,
  p: Person,
  opts: { projectId: string; unitId?: string; assignedSalesId?: string; sourceIdx: number; notes: string },
): Promise<{ id: string; clientId: string; stage: string; created: boolean }> {
  const existing = await prisma.lead.findFirst({
    where: { companyId: ctx.companyId, phone: p.phone },
    orderBy: { createdAt: 'asc' },
    select: { id: true, clientId: true, stage: true },
  });
  if (existing) return { ...existing, created: false };
  const lead = await ctx.admin.post('/leads', {
    fullName: p.name,
    phone: p.phone,
    email: p.email,
    sourceId: ctx.sources[opts.sourceIdx % ctx.sources.length],
    projectInterestId: opts.projectId,
    ...(opts.unitId ? { unitInterestId: opts.unitId } : {}),
    ...(opts.assignedSalesId ? { assignedSalesId: opts.assignedSalesId } : {}),
    notes: opts.notes,
  });
  count('leads');
  return { id: lead.id, clientId: lead.clientId, stage: lead.stage, created: true };
}

async function ensureTemplate(ctx: Ctx, projectId: string, unitId: string, label: string, status = 'ACTIVE'): Promise<{ id: string; options: Array<{ id: string; durationMonths: number }> }> {
  const existing = await prisma.installmentPlanTemplate.findFirst({
    where: { companyId: ctx.companyId, projectId, unitId },
    select: { id: true, status: true, durationOptions: { select: { id: true, durationMonths: true } } },
  });
  if (existing) return { id: existing.id, options: existing.durationOptions };
  const unit = await prisma.unit.findFirst({ where: { companyId: ctx.companyId, id: unitId }, select: { price: true, code: true } });
  const t = await ctx.admin.post('/installment-plan-templates', {
    name: `${label} — ${unit!.code}`,
    description: 'حجز 100 ألف جنيه، مقدم 10٪، والباقي أقساط شهرية متساوية',
    projectId,
    unitId,
    totalPrice: Number(unit!.price),
    reservationAmountType: 'FIXED',
    reservationAmountValue: 100_000,
    downPaymentType: 'PERCENTAGE',
    downPaymentValue: 10,
    startDateRule: 'AFTER_CONTRACT',
    status,
    durationOptions: [
      { durationMonths: 36, increasePercentage: 0 },
      { durationMonths: 60, increasePercentage: 12 },
      { durationMonths: 84, increasePercentage: 22 },
    ],
  });
  count('planTemplates');
  const full = await prisma.installmentPlanTemplate.findFirst({
    where: { companyId: ctx.companyId, id: t.id },
    select: { id: true, durationOptions: { select: { id: true, durationMonths: true } } },
  });
  return { id: full!.id, options: full!.durationOptions };
}

interface DealResult {
  spec: DealSpec;
  leadId: string;
  reservationId: string;
  contractId: string | null;
  customerId: string;
  unitId: string;
  signedAt: Date;
}

async function runDeal(ctx: Ctx, spec: DealSpec): Promise<DealResult | null> {
  const p = person(spec.client);
  const project = ctx.projects[spec.project];
  const unitId = project.units[spec.unit];
  if (!unitId) {
    warn(`${spec.key}: unit not available (plan unit limit)`);
    return null;
  }
  const signedAt = dayInMonth(spec.monthsAgo, spec.day);
  const seller = spec.seller === 'admin' ? undefined : sellerId(ctx, spec.seller);

  // Lead (broker deals come from the portal; the rest are entered by staff).
  let lead: { id: string; clientId: string; stage: string };
  if (spec.broker) {
    const l = await prisma.lead.findFirst({
      where: { companyId: ctx.companyId, phone: p.phone },
      select: { id: true, clientId: true, stage: true },
    });
    if (!l) {
      warn(`${spec.key}: broker lead missing`);
      return null;
    }
    lead = l;
  } else {
    lead = await ensureLead(ctx, p, {
      projectId: project.id,
      unitId,
      assignedSalesId: seller,
      sourceIdx: spec.client,
      notes: LEAD_NOTES[spec.client % LEAD_NOTES.length]!,
    });
  }

  // Reservation (resume when it already exists).
  let reservation = await prisma.reservation.findFirst({
    where: { companyId: ctx.companyId, leadId: lead.id, unitId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, bookingPaymentStatus: true },
  });
  if (!reservation) {
    if (['NEW', 'INTERESTED', 'VISIT'].includes(lead.stage)) {
      await attempt(`${spec.key} stage`, () => ctx.admin.patch(`/leads/${lead.id}/stage`, { stage: 'NEGOTIATION' }));
    }
    await attempt(`${spec.key} note`, () =>
      ctx.admin.post(`/leads/${lead.id}/notes`, { body: 'تم الاتفاق على الوحدة وخطة السداد، والعميل جاهز لدفع مبلغ الحجز.' }),
    );
    const tpl = await ensureTemplate(ctx, project.id, unitId, spec.months === 36 ? 'خطة 3 سنوات' : 'خطة 5 سنوات');
    const option = tpl.options.find((o) => o.durationMonths === spec.months) ?? tpl.options[0]!;
    if (spec.broker) {
      const br = ctx.brokers[spec.broker]!;
      const agentActive = br.brokerUserId
        ? await prisma.brokerUser.findFirst({ where: { companyId: ctx.companyId, id: br.brokerUserId, status: 'ACTIVE' }, select: { id: true } })
        : null;
      reservation = await ctx.admin.post('/broker-reservations', {
        brokerId: br.id,
        ...(agentActive ? { brokerAgentId: br.brokerUserId } : {}),
        leadId: lead.id,
        unitId,
        installmentPlanTemplateId: tpl.id,
        selectedDurationOptionId: option.id,
        notes: 'حجز عن طريق الوسيط',
        expiresInHours: 168,
      });
    } else {
      reservation = await ctx.admin.post('/reservations', {
        unitId,
        leadId: lead.id,
        installmentPlanTemplateId: tpl.id,
        installmentPlanDurationOptionId: option.id,
        expiresInHours: 168,
        notes: `حجز وحدة ${spec.project === 'NG' ? 'سكنية' : 'ساحلية'}`,
      });
    }
    count('reservations');
    reservation = await prisma.reservation.findFirst({
      where: { companyId: ctx.companyId, id: reservation!.id },
      select: { id: true, status: true, bookingPaymentStatus: true },
    });
  }
  const resId = reservation!.id;
  if (reservation!.status === 'PENDING') {
    await ctx.admin.post(`/reservations/${resId}/approve`);
    reservation!.status = 'APPROVED';
  }
  if (reservation!.status === 'APPROVED' && reservation!.bookingPaymentStatus !== 'PAID') {
    await ctx.admin.post(`/reservations/${resId}/booking-payment/confirm`, {
      paidAt: addDays(signedAt, -10).toISOString(),
      paymentMethod: spec.method,
      note: 'سداد مبلغ الحجز',
    });
  }
  // Convert to a contract — instalments start one month after signing, on the customer's due day.
  let contract = await prisma.contract.findFirst({
    where: { companyId: ctx.companyId, reservationId: resId },
    select: { id: true, signedAt: true, customerId: true },
  });
  if (!contract && reservation!.status === 'APPROVED') {
    const startsAt = monthDay(signedAt, 1, dueDayFor(spec));
    await ctx.admin.post(`/reservations/${resId}/convert`, { startsAt: ymd(startsAt) });
    count('contracts');
    contract = await prisma.contract.findFirst({
      where: { companyId: ctx.companyId, reservationId: resId },
      select: { id: true, signedAt: true, customerId: true },
    });
  }
  if (!contract) {
    warn(`${spec.key}: no contract`);
    return null;
  }
  if (spec.sign && !contract.signedAt) {
    await ctx.admin.post(`/contracts/${contract.id}/sign`, { signedAt: signedAt.toISOString() });
    count('signed');
  }
  if (spec.sign) await payDeal(ctx, spec, contract.id, signedAt);

  return { spec, leadId: lead.id, reservationId: resId, contractId: contract.id, customerId: contract.customerId, unitId, signedAt };
}

/** Records the deal's payments the way the policy says. */
async function payDeal(ctx: Ctx, spec: DealSpec, contractId: string, signedAt: Date): Promise<void> {
  const plan = await ctx.admin.get(`/contracts/${contractId}/installment-plan`);
  const insts = (plan?.installments ?? []) as Array<{ id: string; dueDate: string; amount: string | number; status: string; type: string }>;
  const today = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), NOW.getUTCDate()));
  const withDeposit = new Set(
    (
      await prisma.deposit.findMany({
        where: { companyId: ctx.companyId, contractId, installmentId: { not: null } },
        select: { installmentId: true },
      })
    ).map((d) => d.installmentId!),
  );
  const past = insts
    .filter((i) => i.status !== 'PAID' && i.status !== 'CANCELLED' && new Date(i.dueDate) < today && ['DOWN_PAYMENT', 'INSTALLMENT'].includes(i.type))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const upcoming = insts
    .filter((i) => i.status === 'PENDING' && new Date(i.dueDate) >= today && i.type === 'INSTALLMENT')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  // DOWN_PAYMENT is due on the start date or today — pay it at signing.
  const down = insts.find((i) => i.type === 'DOWN_PAYMENT' && i.status !== 'PAID');

  const leaveUnpaid = new Set<string>();
  if (spec.pay === 'late') {
    // The last one or two past instalments stay unpaid → overdue.
    past.filter((i) => i.type === 'INSTALLMENT').slice(-(spec.client % 2 === 0 ? 2 : 1)).forEach((i) => leaveUnpaid.add(i.id));
  }

  const recordCash = async (inst: { id: string; amount: string | number }, paidAt: Date, method: string) => {
    if (withDeposit.has(inst.id)) return;
    await ctx.admin.post('/deposits', {
      contractId,
      installmentId: inst.id,
      amount: money(Number(inst.amount)),
      paidAt: paidAt.toISOString(),
      paymentMethod: method,
      ...(method === 'BANK_TRANSFER'
        ? { transfer: { bankName: 'البنك الأهلي المصري', referenceNumber: `TRX-${spec.key}-${inst.id.slice(0, 6).toUpperCase()}` } }
        : {}),
    });
    withDeposit.add(inst.id);
    count('deposits');
  };
  const recordCheque = async (inst: { id: string; amount: string | number; dueDate: string }, n: number) => {
    if (withDeposit.has(inst.id)) return null;
    const dep = await ctx.admin.post('/deposits', {
      contractId,
      installmentId: inst.id,
      amount: money(Number(inst.amount)),
      // Received on its date (post-dated cheques: handed over now).
      paidAt: new Date(Math.min(new Date(inst.dueDate).getTime() + 9 * 3_600_000, NOW.getTime() - 3_600_000)).toISOString(),
      paymentMethod: 'CHEQUE',
      cheque: {
        chequeNumber: `${100200 + spec.client * 100 + n}`,
        drawerBankName: ['بنك مصر', 'البنك التجاري الدولي CIB', 'بنك القاهرة', 'بنك الإسكندرية'][spec.client % 4],
        chequeDueDate: ymd(new Date(inst.dueDate)),
      },
    });
    withDeposit.add(inst.id);
    count('cheques');
    return dep;
  };

  if (down && !withDeposit.has(down.id)) await recordCash(down, signedAt, spec.method);

  for (const [idx, inst] of past.entries()) {
    if (inst.type === 'DOWN_PAYMENT' || leaveUnpaid.has(inst.id)) continue;
    const due = new Date(inst.dueDate);
    const lateDays = Math.floor(hash01(inst.id) * 4); // paid on time or a few days late
    const paidAt = new Date(Math.min(addDays(due, lateDays).getTime() + 9 * 3_600_000, NOW.getTime() - 3_600_000));
    if (spec.pay === 'cheque' || spec.pay === 'bounce') {
      const dep = await recordCheque(inst, idx);
      const instrumentId = dep?.paymentInstrumentId ?? dep?.paymentInstrument?.id;
      if (!instrumentId) continue;
      const isLast = idx === past.length - 1;
      await attempt('cheque deposit', () => ctx.admin.post(`/payment-instruments/${instrumentId}/deposit`, {}));
      if (spec.pay === 'bounce' && isLast) {
        await attempt('cheque bounce', () =>
          ctx.admin.post(`/payment-instruments/${instrumentId}/bounce`, {
            bounceReason: 'رصيد غير كافٍ',
            bounceDate: ymd(addDays(due, 3) > NOW ? NOW : addDays(due, 3)),
            penaltyAmount: 1500,
            penaltyDueDate: ymd(addDays(NOW, 7)),
          }),
        );
      } else if (!(spec.pay === 'cheque' && isLast && spec.client % 2 === 1)) {
        // The newest cheque of one customer is still at the bank (DEPOSITED).
        await attempt('cheque clear', () =>
          ctx.admin.post(`/payment-instruments/${instrumentId}/clear`, { clearingDate: ymd(addDays(due, 2) > NOW ? NOW : addDays(due, 2)) }),
        );
      }
    } else {
      await recordCash(inst, paidAt, spec.method);
    }
  }
  // The bounced-cheque penalty is paid in cash this month (fees collected).
  if (spec.pay === 'bounce') {
    const fresh = await ctx.admin.get(`/contracts/${contractId}/installment-plan`);
    const fees = ((fresh?.installments ?? []) as Array<{ id: string; amount: string | number; status: string; type: string }>).filter(
      (i) => i.type === 'BOUNCE_PENALTY' && i.status !== 'PAID',
    );
    for (const fee of fees) await attempt('penalty payment', () => recordCash(fee, new Date(NOW.getTime() - 2 * 3_600_000), 'CASH'));
  }
  // Post-dated cheques for the next instalments.
  if (spec.pay === 'cheque') {
    for (const [i, inst] of upcoming.slice(0, 3).entries()) await recordCheque(inst, 50 + i);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Open reservations (pending / approved / rejected / cancelled)
// ─────────────────────────────────────────────────────────────────────────────

async function runOpenReservation(ctx: Ctx, spec: OpenResSpec): Promise<{ leadId: string; reservationId: string; createdAt: Date } | null> {
  const p = person(spec.client);
  const project = ctx.projects[spec.project];
  const unitId = project.units[spec.unit];
  if (!unitId) return null;
  const seller = spec.seller === 'admin' ? undefined : sellerId(ctx, spec.seller);
  const lead = await ensureLead(ctx, p, {
    projectId: project.id,
    unitId,
    assignedSalesId: seller,
    sourceIdx: spec.client,
    notes: LEAD_NOTES[spec.client % LEAD_NOTES.length]!,
  });
  let res = await prisma.reservation.findFirst({
    where: { companyId: ctx.companyId, leadId: lead.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true },
  });
  if (!res) {
    if (lead.stage === 'NEW' || lead.stage === 'INTERESTED') {
      await attempt(`${spec.key} stage`, () => ctx.admin.patch(`/leads/${lead.id}/stage`, { stage: 'NEGOTIATION' }));
    }
    const tpl = await ensureTemplate(ctx, project.id, unitId, 'خطة 5 سنوات');
    const option = tpl.options.find((o) => o.durationMonths === 60) ?? tpl.options[0]!;
    const created = await ctx.admin.post('/reservations', {
      unitId,
      leadId: lead.id,
      installmentPlanTemplateId: tpl.id,
      installmentPlanDurationOptionId: option.id,
      expiresInHours: 240,
      notes: `العميل طلب مهلة لتجهيز مبلغ الحجز`,
    });
    count('reservations');
    res = { id: created.id, status: 'PENDING' };
    if (spec.outcome === 'APPROVED' || spec.outcome === 'APPROVED_PAID') {
      await ctx.admin.post(`/reservations/${res.id}/approve`);
      if (spec.outcome === 'APPROVED_PAID') {
        await ctx.admin.post(`/reservations/${res.id}/booking-payment/confirm`, {
          paidAt: addDays(NOW, -spec.daysAgo + 1).toISOString(),
          paymentMethod: 'BANK_TRANSFER',
          note: 'تحويل بنكي لمبلغ الحجز',
        });
      }
    } else if (spec.outcome === 'REJECTED') {
      await ctx.admin.post(`/reservations/${res.id}/reject`, { reason: 'العميل لم يقدم المستندات المطلوبة في الموعد' });
    } else if (spec.outcome === 'CANCELLED') {
      await ctx.admin.post(`/reservations/${res.id}/cancel`, { reason: 'العميل اعتذر عن استكمال الحجز لظروف شخصية' });
    }
    await attempt('reservation note', () =>
      ctx.admin.post(`/reservations/${res!.id}/notes`, { body: 'تم التواصل مع العميل وتأكيد بيانات الحجز.' }),
    );
  }
  return { leadId: lead.id, reservationId: res.id, createdAt: addDays(NOW, -spec.daysAgo) };
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Pipeline leads, visits, inquiries
// ─────────────────────────────────────────────────────────────────────────────

interface PipelineLead {
  id: string;
  n: number;
  stage: string;
  createdAt: Date;
  sellerId: string;
}

async function ensurePipeline(ctx: Ctx): Promise<PipelineLead[]> {
  console.log('📇  Pipeline leads…');
  const out: PipelineLead[] = [];
  const reps: SellerKey[] = ['rep1', 'rep2', 'rep3', 'manager'];
  let n = 40;
  for (const group of PIPELINE_STAGES) {
    for (let i = 0; i < group.n; i++, n++) {
      const p = person(n);
      const projectKey = n % 3 === 0 ? 'LB' : 'NG';
      const unassigned = group.stage === 'NEW' && i >= 5;
      const seller = sellerId(ctx, reps[n % reps.length]!);
      const lead = await ensureLead(ctx, p, {
        projectId: ctx.projects[projectKey].id,
        assignedSalesId: unassigned ? undefined : seller,
        sourceIdx: n,
        notes: LEAD_NOTES[n % LEAD_NOTES.length]!,
      });
      if (lead.created && group.stage !== 'NEW') {
        const path: string[] = ['INTERESTED', 'VISIT', 'NEGOTIATION'];
        const target = group.stage === 'LOST' ? 'INTERESTED' : group.stage;
        for (const st of path) {
          await attempt(`lead ${n} → ${st}`, () => ctx.admin.patch(`/leads/${lead.id}/stage`, { stage: st }));
          if (st === target) break;
        }
        if (group.stage === 'LOST') {
          await attempt(`lead ${n} → LOST`, () =>
            ctx.admin.patch(`/leads/${lead.id}/stage`, { stage: 'LOST', reason: LOST_REASONS[i % LOST_REASONS.length] }),
          );
        }
        await attempt('lead note', () => ctx.admin.post(`/leads/${lead.id}/notes`, { body: LEAD_NOTES[(n + 2) % LEAD_NOTES.length]! }));
      }
      // NEW leads are recent, later stages are older.
      const ageDays = group.stage === 'NEW' ? i * 2 : group.stage === 'LOST' ? 40 + i * 30 : 10 + ((n * 13) % 150);
      out.push({ id: lead.id, n, stage: group.stage, createdAt: addDays(NOW, -ageDays), sellerId: seller });
    }
  }
  return out;
}

async function ensureVisits(ctx: Ctx, pipeline: PipelineLead[], deals: DealResult[]): Promise<Array<{ id: string; createdAt: Date }>> {
  console.log('📅  Visits…');
  const created: Array<{ id: string; createdAt: Date }> = [];
  const existing = await prisma.visitAppointment.count({
    where: { companyId: ctx.companyId, lead: { phone: { startsWith: PHONE_PREFIX } } },
  });
  if (existing >= 10) return created;

  const book = async (leadId: string, projectKey: 'NG' | 'LB', at: Date, salesId: string, status?: string, notes?: string) => {
    const r = await attempt('appointment', () =>
      ctx.admin.post('/visits/appointments', {
        leadId,
        projectId: ctx.projects[projectKey].id,
        assignedSalesId: salesId,
        scheduledAt: at.toISOString(),
        durationMinutes: 60,
        location: projectKey === 'NG' ? 'مركز المبيعات — التجمع الخامس' : 'مكتب المبيعات بالقرية — الكيلو 128',
        meetingPoint: 'البوابة الرئيسية',
        salesNotes: notes ?? 'جولة في الوحدة النموذجية وشرح خطط السداد',
        ...(status ? { status } : {}),
      }),
    );
    if (r) {
      created.push({ id: r.id, createdAt: addDays(at < NOW ? at : NOW, -3) });
      count('visits');
    }
    return r;
  };
  const at = (days: number, hourUtc: number) => {
    const d = addDays(NOW, days);
    d.setUTCHours(hourUtc, 0, 0, 0);
    return d;
  };

  // Completed visits behind each signed deal (a week before signing).
  for (const d of deals.slice(0, 10)) {
    const when = addDays(d.signedAt, -14);
    when.setUTCHours(9 + (d.spec.client % 5), 0, 0, 0);
    if (when < NOW) {
      const r = await book(d.leadId, d.spec.project, when, visitSeller(ctx, d.spec.seller), 'COMPLETED', 'العميل أبدى إعجابه بالوحدة وطلب عرض سعر');
      if (r) await attempt('visit feedback', () => ctx.admin.post(`/visits/appointments/${r.id}/sales-feedback`, { rating: 4 + (d.spec.client % 2), notes: 'زيارة ممتازة — العميل جاد' }));
    }
  }
  // Booking a visit moves an early lead to VISIT, so every visit goes to leads
  // already at VISIT / NEGOTIATION (INTERESTED and NEW stay where they are).
  const visitLeads = pipeline.filter((l) => l.stage === 'VISIT' || l.stage === 'NEGOTIATION');
  const projectOf = (l: PipelineLead): 'NG' | 'LB' => (l.n % 3 === 0 ? 'LB' : 'NG');
  // Past completed visits.
  for (const [i, l] of visitLeads.entries()) {
    await book(l.id, projectOf(l), at(-(3 + i * 4), 8 + (i % 6)), l.sellerId, 'COMPLETED');
  }
  // Today: one done this morning (when the day allows), two still to come.
  const hourNow = NOW.getUTCHours();
  const [t0, t1, t2] = visitLeads;
  if (hourNow >= 7 && t0) await book(t0.id, projectOf(t0), at(0, Math.max(5, hourNow - 2)), t0.sellerId, 'COMPLETED');
  for (const [i, l] of [t1, t2].entries()) {
    if (!l) continue;
    const h = hourNow + 1 + i * 2;
    await book(l.id, projectOf(l), h <= 20 ? at(0, h) : at(1, 8 + i * 2), l.sellerId);
  }
  // Upcoming: second visits over the next two weeks, some confirmed.
  for (const [i, l] of visitLeads.slice(3).entries()) {
    const r = await book(l.id, projectOf(l), at(2 + i * 2, 8 + (i % 7)), l.sellerId);
    if (r && i % 2 === 0) await attempt('confirm visit', () => ctx.admin.post(`/visits/appointments/${r.id}/confirm`, {}));
  }
  // A no-show (booked, then the day passed) and a cancellation.
  const lost = pipeline.filter((l) => l.stage === 'LOST');
  if (lost[0]) {
    const r = await book(lost[0].id, 'NG', at(2, 10), lost[0].sellerId);
    if (r) {
      await prisma.visitAppointment.updateMany({ where: { companyId: ctx.companyId, id: r.id }, data: { scheduledAt: at(-6, 10) } });
      await attempt('no-show', () => ctx.admin.post(`/visits/appointments/${r.id}/no-show`, { noShowReason: 'العميل لم يحضر ولم يرد على الهاتف' }));
    }
  }
  if (lost[1]) {
    const r = await book(lost[1].id, 'LB', at(4, 11), lost[1].sellerId);
    if (r) await attempt('cancel visit', () => ctx.admin.post(`/visits/appointments/${r.id}/cancel`, { cancellationReason: 'العميل سافر خارج مصر' }));
  }
  return created;
}

/** Website visit requests and inquiries go through the public endpoints (they open leads too). */
async function ensurePublicRequests(ctx: Ctx): Promise<void> {
  console.log('🌐  Website inquiries and visit requests…');
  const anon = new ApiClient('public');
  const infoMsgs = [
    'السلام عليكم، أرجو إرسال أسعار الشقق 3 غرف وأنظمة السداد المتاحة.',
    'هل يوجد وحدات بحديقة خاصة؟ وما هو موعد الاستلام؟',
    'أريد معرفة تفاصيل خطة التقسيط على 7 سنوات بدون مقدم كبير.',
    'هل المشروع مرخص؟ وما هي مساحات الشاليهات المتاحة في الساحل؟',
    'أنا مقيم في الكويت — هل يمكن الحجز والتعاقد أونلاين؟',
    'برجاء التواصل معي بخصوص وحدات إدارية أو تجارية في نفس الكمبوند.',
    'ما هي قيمة الصيانة السنوية والوديعة؟',
  ];
  for (const [i, message] of infoMsgs.entries()) {
    const n = 70 + i;
    const p = person(n);
    const has = await prisma.infoRequest.findFirst({
      where: { companyId: ctx.companyId, OR: [{ lead: { phone: p.phone } }, { user: { phone: p.phone } }] },
      select: { id: true },
    });
    if (has) continue;
    const r = await attempt('info request', () =>
      anon.post('/public/info-request', {
        message,
        projectId: ctx.projects[i % 3 === 0 ? 'LB' : 'NG'].id,
        name: p.name,
        phone: p.phone,
        email: p.email,
        utmSource: ['facebook', 'google', 'instagram'][i % 3],
        utmCampaign: 'autumn-launch',
      }),
    );
    if (!r) continue;
    count('infoRequests');
    if (i < 3) await attempt('info status', () => ctx.admin.patch(`/info-requests/${r.id}`, { status: 'RESPONDED' }));
    if (i === 3) {
      await attempt('info status', () => ctx.admin.patch(`/info-requests/${r.id}`, { status: 'RESPONDED' }));
      await attempt('info status', () => ctx.admin.patch(`/info-requests/${r.id}`, { status: 'CLOSED' }));
    }
  }

  const vrNotes = ['أفضل الزيارة بعد العصر', 'سأحضر مع زوجتي', 'أرغب في رؤية الشاليه المطل على اللاجون', 'برجاء التأكيد قبل الموعد بيوم', 'مهتم بالتوين هاوس', 'الزيارة يوم الجمعة إن أمكن'];
  for (const [i, notes] of vrNotes.entries()) {
    const n = 80 + i;
    const p = person(n);
    const has = await prisma.visitRequest.findFirst({ where: { companyId: ctx.companyId, customerPhone: p.phone }, select: { id: true } });
    if (has) continue;
    const projectKey = i % 2 === 0 ? 'NG' : 'LB';
    const pref = addDays(NOW, 2 + i);
    pref.setUTCHours(10 + (i % 4), 0, 0, 0);
    const r = await attempt('visit request', () =>
      anon.post('/public/visit-request', {
        projectId: ctx.projects[projectKey].id,
        preferredDate: pref.toISOString(),
        notes,
        name: p.name,
        phone: p.phone,
        email: p.email,
        utmSource: i % 2 ? 'google' : 'facebook',
      }),
    );
    if (!r) continue;
    count('visitRequests');
    const reqId: string = r.id ?? r.visitRequest?.id;
    if (!reqId) continue;
    const salesId = sellerId(ctx, (['rep1', 'rep2', 'rep3'] as const)[i % 3]!);
    if (i < 2) {
      await attempt('schedule visit request', () =>
        ctx.admin.post(`/visits/requests/${reqId}/schedule`, {
          scheduledAt: pref.toISOString(),
          assignedSalesId: salesId,
          durationMinutes: 60,
          location: projectKey === 'NG' ? 'مركز المبيعات — التجمع الخامس' : 'مكتب المبيعات بالقرية',
        }),
      );
    } else if (i === 2) {
      await attempt('reject visit request', () => ctx.admin.patch(`/visits/requests/${reqId}`, { status: 'REJECTED', adminNotes: 'رقم الهاتف غير صحيح' }));
    } else if (i === 3) {
      await attempt('review visit request', () => ctx.admin.patch(`/visits/requests/${reqId}`, { status: 'UNDER_REVIEW', adminNotes: 'جاري التنسيق مع العميل' }));
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Broker commissions and payouts
// ─────────────────────────────────────────────────────────────────────────────

async function ensureBrokerMoney(ctx: Ctx, deals: DealResult[]): Promise<void> {
  console.log('💼  Broker commissions and payouts…');
  const brokerDeals = deals.filter((d) => d.spec.broker && d.contractId);
  for (const d of brokerDeals) {
    const c = await prisma.brokerCommission.findFirst({
      where: { companyId: ctx.companyId, contractId: d.contractId! },
      select: { id: true, status: true },
    });
    if (!c) {
      warn(`${d.spec.key}: no broker commission was generated`);
      continue;
    }
    // One commission (B01) stays PENDING for the review queue.
    if (c.status === 'PENDING' && d.spec.key !== 'B01') {
      await attempt('approve commission', () => ctx.admin.patch(`/broker-commissions/${c.id}/approve`, { notes: 'تمت مراجعة العقد والسداد' }));
    }
  }
  for (const key of Object.keys(BROKERS) as BrokerKey[]) {
    const br = ctx.brokers[key];
    if (!br) continue;
    const hasPayout = await prisma.brokerPayout.findFirst({ where: { companyId: ctx.companyId, brokerId: br.id }, select: { id: true } });
    if (hasPayout) continue;
    const eligible = await prisma.brokerCommission.findMany({
      where: { companyId: ctx.companyId, brokerId: br.id, status: 'APPROVED', payoutId: null },
      select: { id: true },
    });
    if (!eligible.length) continue;
    const payout = await attempt('payout', () =>
      ctx.admin.post('/broker-payouts', {
        brokerId: br.id,
        period: period(addDays(NOW, -30)),
        notes: `دفعة عمولات ${key === 'BR1' ? 'الربع الحالي' : 'الشهر الماضي'}`,
        commissionIds: eligible.map((e) => e.id),
      }),
    );
    if (!payout) continue;
    count('payouts');
    await attempt('approve payout', () => ctx.admin.patch(`/broker-payouts/${payout.id}/approve`, { notes: 'معتمد من الإدارة المالية' }));
    if (key === 'BR1') {
      await attempt('process payout', () => ctx.admin.patch(`/broker-payouts/${payout.id}/process`, { paymentMethod: 'BANK_TRANSFER', notes: 'تحويل بنكي' }));
      await attempt('pay payout', () =>
        ctx.admin.patch(`/broker-payouts/${payout.id}/mark-paid`, {
          paymentMethod: 'BANK_TRANSFER',
          paymentReference: `${TAG}-PAY-${key}`,
          paidAt: addDays(NOW, -6).toISOString(),
          notes: 'تم التحويل إلى حساب الوسيط',
        }),
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Bonuses and targets
// ─────────────────────────────────────────────────────────────────────────────

async function ensureBonusesAndTargets(ctx: Ctx, deals: DealResult[], manualRuleId: string | null): Promise<void> {
  console.log('🎯  Bonuses and targets…');
  // Commissions created on signing: approve the older ones, pay the oldest.
  for (const d of deals) {
    if (!d.contractId) continue;
    const e = await prisma.bonusEntry.findFirst({ where: { companyId: ctx.companyId, contractId: d.contractId }, select: { id: true, status: true } });
    if (!e) continue;
    if (e.status === 'PENDING' && d.spec.monthsAgo >= 1) {
      await attempt('approve bonus', () => ctx.admin.post(`/bonus-entries/${e.id}/approve`));
      e.status = 'APPROVED';
    }
    if (e.status === 'APPROVED' && d.spec.monthsAgo >= 3) {
      await attempt('pay bonus', () => ctx.admin.post(`/bonus-entries/${e.id}/pay`));
    }
  }
  // Monthly target bonuses for the team (manual entries).
  if (manualRuleId) {
    const team: Array<[StaffKey, number]> = [
      ['rep1', 7500],
      ['rep2', 6000],
      ['rep3', 4500],
      ['manager', 9000],
    ];
    for (const m of [1, 2, 3]) {
      const per = period(dayInMonth(m, 1));
      for (const [k, amount] of team) {
        const salesId = ctx.staff[k];
        const has = await prisma.bonusEntry.findFirst({ where: { companyId: ctx.companyId, salesId, period: per, source: 'MANUAL' }, select: { id: true } });
        if (has) continue;
        const e = await attempt('manual bonus', () => ctx.admin.post('/bonus-entries', { salesId, ruleId: manualRuleId, amount: amount + m * 500, period: per }));
        if (!e) continue;
        count('bonusEntries');
        if (m >= 2) await attempt('approve bonus', () => ctx.admin.post(`/bonus-entries/${e.id}/approve`));
        if (m === 3) await attempt('pay bonus', () => ctx.admin.post(`/bonus-entries/${e.id}/pay`));
      }
    }
  }
  // Targets: the team and the admin, this month and the two before.
  const who: Array<[string, number, number]> = [
    [ctx.staff.rep1, 12_000_000, 3],
    [ctx.staff.rep2, 10_000_000, 3],
    [ctx.staff.rep3, 8_000_000, 2],
    [ctx.staff.manager, 15_000_000, 4],
  ];
  for (const m of [0, 1, 2]) {
    const per = period(dayInMonth(m, 1));
    for (const [salesId, amount, units] of who) {
      const has = await prisma.salesTarget.findFirst({ where: { companyId: ctx.companyId, salesId, period: per }, select: { id: true } });
      if (has) continue;
      const t = await attempt('target', () => ctx.admin.post('/sales-targets', { salesId, period: per, amountTarget: amount, unitsTarget: units }));
      if (!t) continue;
      count('targets');
      // Targets of the company's own people (admin, or the team when no seat was free) are listed for cleanup.
      const isDemo = (Object.keys(ctx.staff) as StaffKey[]).some((k) => ctx.staff[k] === salesId && ctx.demoStaff.has(k));
      if (!isDemo) remember(ctx.manifest.targetIds, t.id);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Maintenance, documents, CMS, notifications
// ─────────────────────────────────────────────────────────────────────────────

async function ensureMaintenance(ctx: Ctx, deals: DealResult[], categories: string[]): Promise<void> {
  console.log('🔧  Maintenance…');
  // Maintenance opens after the buyer receives the unit: hand over the oldest deals.
  const signed = deals
    .filter((d) => d.spec.sign && d.contractId && d.spec.monthsAgo >= 3)
    .sort((a, b) => a.signedAt.getTime() - b.signedAt.getTime())
    .slice(0, 5);
  for (const d of signed) {
    const done = await prisma.unitHandover.findFirst({ where: { companyId: ctx.companyId, contractId: d.contractId! }, select: { id: true } });
    if (done) continue;
    await attempt('handover', () =>
      ctx.admin.post(`/contracts/${d.contractId}/handover`, {
        handedOverAt: ymd(addDays(d.signedAt, 20)),
        notes: 'تم تسليم الوحدة والمفاتيح للعميل وتوقيع محضر الاستلام',
      }),
    );
    count('handovers');
  }
  const units = signed.map((d) => d.unitId);
  const existing = await prisma.maintenanceRequest.count({ where: { companyId: ctx.companyId, unitId: { in: units } } });
  if (existing >= 6) return;
  const flows: Array<{ desc: string; cats: number[]; to: string[] }> = [
    { desc: 'تسريب مياه أسفل حوض المطبخ وانتفاخ في الخشب', cats: [0, 3], to: [] },
    { desc: 'انقطاع الكهرباء عن غرفة النوم الرئيسية والمقابس لا تعمل', cats: [1], to: [] },
    { desc: 'التكييف المركزي لا يبرد بشكل كافٍ في الصالة', cats: [2], to: ['assign'] },
    { desc: 'باب البلكونة لا يغلق بإحكام ودخول أتربة', cats: [3, 0], to: ['assign', 'IN_PROGRESS'] },
    { desc: 'سخان المياه يفصل باستمرار وضعف ضغط المياه في الحمام', cats: [0, 1], to: ['assign', 'IN_PROGRESS', 'RESOLVED'] },
    { desc: 'شرخ في بلاط أرضية المطبخ وتشقق في الجدار المجاور', cats: [3], to: ['assign', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] },
    { desc: 'وحدة التكييف الخارجية تصدر صوتاً مرتفعاً', cats: [2, 1], to: ['assign', 'IN_PROGRESS', 'RESOLVED'] },
    { desc: 'طلب تركيب إضاءة إضافية في الحديقة', cats: [1], to: ['assign'] },
  ];
  for (const [i, f] of flows.entries()) {
    const d = signed[i % signed.length];
    if (!d) break;
    const r = await attempt('maintenance request', () =>
      ctx.admin.post('/maintenance-requests', {
        customerId: d.customerId,
        unitId: d.unitId,
        categoryIds: f.cats.map((c) => categories[c % categories.length]!),
        description: f.desc,
      }),
    );
    if (!r) continue;
    count('maintenance');
    for (const step of f.to) {
      // Requests the admin opens are approved on creation (no review step).
      if (step === 'assign') await attempt('maint assign', () => ctx.admin.post(`/maintenance-requests/${r.id}/assign`, { assignedAdminId: ctx.staff.maint }));
      else await attempt(`maint ${step}`, () => ctx.admin.post(`/maintenance-requests/${r.id}/status`, { status: step }));
    }
    ctx.createdIds.set(r.id, addDays(NOW, -(2 + i * 5)));
  }
}

async function ensureDocuments(ctx: Ctx, deals: DealResult[]): Promise<void> {
  console.log('📄  Documents…');
  const has = await prisma.document.count({ where: { companyId: ctx.companyId, fileUrl: { contains: FILE_TAG }, deletedAt: null } });
  if (has >= 8) return;
  for (const d of deals.filter((x) => x.spec.sign && x.contractId).slice(0, 8)) {
    await attempt('contract document', () =>
      ctx.admin.post(`/contracts/${d.contractId}/document`, {
        fileUrl: `${PDF_URL}&c=${d.spec.key}`,
        fileName: `عقد-بيع-${d.spec.key}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 248_000 + d.spec.client * 1000,
        title: `عقد بيع ابتدائي — ${person(d.spec.client).name}`,
      }),
    );
    count('documents');
  }
  const docs: Array<{ ownerType: string; ownerId: string; category: string; title: string; url: string; mime: string; visibility?: string }> = [
    { ownerType: 'PROJECT', ownerId: ctx.projects.NG.id, category: 'LEGAL', title: 'رخصة البناء — نايل جاردنز', url: `${PDF_URL}&d=lic-ng`, mime: 'application/pdf' },
    { ownerType: 'PROJECT', ownerId: ctx.projects.NG.id, category: 'OTHER', title: 'بروشور المشروع 2026', url: `${PDF_URL}&d=brochure-ng`, mime: 'application/pdf', visibility: 'CUSTOMER_VISIBLE' },
    { ownerType: 'PROJECT', ownerId: ctx.projects.LB.id, category: 'IMAGE', title: 'المخطط العام — لاجونا باي', url: IMG('photo-1507525428034-b723cf961d3e'), mime: 'image/jpeg', visibility: 'CUSTOMER_VISIBLE' },
    { ownerType: 'UNIT', ownerId: ctx.projects.NG.units[25]!, category: 'IMAGE', title: 'مسقط أفقي للوحدة', url: IMG('photo-1600585154340-be6161a56a0c'), mime: 'image/jpeg' },
  ];
  const br = ctx.brokers.BR1;
  if (br) docs.push({ ownerType: 'BROKER', ownerId: br.id, category: 'BROKER_AGREEMENT', title: 'اتفاقية تسويق — بيت الخبرة', url: `${PDF_URL}&d=agreement-br1`, mime: 'application/pdf' });
  for (const doc of docs) {
    const exists = await prisma.document.findFirst({ where: { companyId: ctx.companyId, fileUrl: doc.url, deletedAt: null }, select: { id: true } });
    if (exists) continue;
    await attempt('document', () =>
      ctx.admin.post('/documents', {
        ownerType: doc.ownerType,
        ownerId: doc.ownerId,
        category: doc.category,
        title: doc.title,
        fileUrl: doc.url,
        fileName: doc.title.replace(/\s+/g, '-') + (doc.mime === 'application/pdf' ? '.pdf' : '.jpg'),
        mimeType: doc.mime,
        sizeBytes: 512_000,
        ...(doc.visibility ? { visibility: doc.visibility } : {}),
      }),
    );
    count('documents');
  }
  // One superseded document is removed (a DELETE in the audit trail).
  const temp = await attempt('temp document', () =>
    ctx.admin.post('/documents', {
      ownerType: 'PROJECT',
      ownerId: ctx.projects.NG.id,
      category: 'OTHER',
      title: 'نسخة قديمة من البروشور',
      fileUrl: `${PDF_URL}&d=old-${Date.now()}`,
      mimeType: 'application/pdf',
    }),
  );
  if (temp) await attempt('delete temp document', () => ctx.admin.del(`/documents/${temp.id}`));
}

async function ensureCms(ctx: Ctx): Promise<void> {
  console.log('📰  CMS…');
  const s = SLUG.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const pages = [
    { slug: `demo-full-${s}-about`, ar_title: 'من نحن', en_title: 'About us', ar_body: 'شركة تطوير عقاري مصرية تأسست عام 2012، سلّمت أكثر من 3,500 وحدة سكنية وساحلية في القاهرة الجديدة والساحل الشمالي، وتلتزم بمواعيد التسليم وجودة التشطيب.', en_body: 'An Egyptian real-estate developer founded in 2012 that has delivered 3,500+ homes in New Cairo and the North Coast, committed to on-time delivery and quality finishing.' },
    { slug: `demo-full-${s}-payment-plans`, ar_title: 'أنظمة السداد', en_title: 'Payment plans', ar_body: 'حجز يبدأ من 100 ألف جنيه، مقدم 10٪، وتقسيط حتى 7 سنوات بدون فوائد على بعض الوحدات. يمكن السداد نقداً أو بتحويل بنكي أو بشيكات مؤجلة.', en_body: 'Book from EGP 100,000, 10% down and up to 7 years of instalments, interest-free on selected units. Pay in cash, by bank transfer or with post-dated cheques.' },
    { slug: `demo-full-${s}-privacy`, ar_title: 'سياسة الخصوصية', en_title: 'Privacy policy', ar_body: 'نلتزم بحماية بياناتك الشخصية وفق قانون حماية البيانات الشخصية المصري رقم 151 لسنة 2020، ولا نشارك بياناتك مع أي طرف ثالث دون موافقتك.', en_body: 'We protect your personal data under Egyptian Personal Data Protection Law No. 151 of 2020 and never share it with third parties without your consent.' },
  ];
  const existingPages = new Set(rows<{ slug: string }>(await ctx.admin.get('/cms/pages')).map((p) => p.slug));
  for (const p of pages) {
    if (existingPages.has(p.slug)) continue;
    await ctx.admin.post('/cms/pages', { ...p, published: true });
    count('cmsPages');
  }
  const articles = [
    { slug: `demo-full-${s}-new-cairo-guide`, ar_title: 'دليلك لشراء شقة في التجمع الخامس 2026', en_title: 'Your 2026 guide to buying in New Cairo', ar_excerpt: 'كل ما تحتاج معرفته عن الأسعار وأنظمة السداد والمناطق الأكثر طلباً.', en_excerpt: 'Prices, payment plans and the most sought-after districts.', ar_body: 'يظل التجمع الخامس الوجهة الأولى للباحثين عن السكن الراقي في القاهرة. في هذا الدليل نستعرض متوسط سعر المتر، وأفضل أنظمة التقسيط، ونصائح قبل التعاقد.', en_body: 'New Cairo remains the first choice for upscale living in Cairo. This guide covers price per metre, the best instalment plans and what to check before you sign.', coverUrl: IMG('photo-1600596542815-ffad4c1539a9') },
    { slug: `demo-full-${s}-north-coast`, ar_title: 'الساحل الشمالي: استثمار يتجاوز الصيف', en_title: 'North Coast: an investment beyond summer', ar_excerpt: 'لماذا أصبح الساحل الشمالي وجهة للسكن طوال العام؟', en_excerpt: 'Why the North Coast is becoming a year-round destination.', ar_body: 'مع اكتمال البنية التحتية ومدينة العلمين الجديدة، تحوّل الساحل الشمالي إلى وجهة سكنية واستثمارية طوال العام بعوائد إيجارية مرتفعة.', en_body: 'With new infrastructure and New Alamein City, the North Coast has turned into a year-round residential and investment destination with strong rental yields.', coverUrl: IMG('photo-1507525428034-b723cf961d3e') },
    { slug: `demo-full-${s}-instalments`, ar_title: '5 نصائح قبل اختيار خطة التقسيط', en_title: '5 tips before choosing an instalment plan', ar_excerpt: 'كيف تختار المدة والمقدم المناسبين لميزانيتك.', en_excerpt: 'How to pick the right term and down payment for your budget.', ar_body: 'قارن بين إجمالي السعر في كل مدة، وانتبه لنسبة الزيادة، وتأكد من مواعيد الاستلام وغرامات التأخير قبل التوقيع.', en_body: 'Compare the total price of each term, watch the increase rate, and check delivery dates and late-fee terms before signing.', coverUrl: IMG('photo-1560518883-ce09059eeffa') },
  ];
  const existingArticles = new Set(rows<{ slug: string }>(await ctx.admin.get('/cms/articles')).map((a) => a.slug));
  for (const a of articles) {
    if (existingArticles.has(a.slug)) continue;
    await ctx.admin.post('/cms/articles', { ...a, published: true });
    count('cmsArticles');
  }
  const banners = rows<{ id: string }>(await ctx.admin.get('/cms/banners'));
  const ours = ctx.manifest.bannerIds.filter((id) => banners.some((b) => b.id === id));
  if (ours.length === 0) {
    const list = [
      { imageUrl: IMG('photo-1600585154340-be6161a56a0c'), ar_title: 'إطلاق المرحلة الأولى — نايل جاردنز', en_title: 'Phase 1 launch — Nile Gardens', link: '/projects', order: 0 },
      { imageUrl: IMG('photo-1507525428034-b723cf961d3e'), ar_title: 'شاليهات لاجونا باي — استلام صيف 2027', en_title: 'Laguna Bay chalets — summer 2027 delivery', link: '/projects', order: 1 },
      { imageUrl: IMG('photo-1560518883-ce09059eeffa'), ar_title: 'تقسيط حتى 7 سنوات بدون فوائد', en_title: 'Up to 7 years interest-free', link: '/contact', order: 2 },
    ];
    for (const b of list) {
      const r = await ctx.admin.post('/cms/banners', { ...b, active: true });
      remember(ctx.manifest.bannerIds, r.id);
      count('cmsBanners');
    }
    // An expired campaign banner is taken down (a DELETE in the audit trail).
    const old = await attempt('old banner', () =>
      ctx.admin.post('/cms/banners', { imageUrl: IMG('photo-1512917774080-9991f1c4c750'), ar_title: 'عرض الصيف المنتهي', en_title: 'Ended summer offer', active: false, order: 9 }),
    );
    if (old) await attempt('delete banner', () => ctx.admin.del(`/cms/banners/${old.id}`));
  }
}

async function ensureNotifications(ctx: Ctx): Promise<void> {
  console.log('🔔  Notifications…');
  const has = await prisma.notification.count({
    where: { companyId: ctx.companyId, userId: ctx.adminId, payload: { path: ['_seed'], equals: TAG } },
  });
  if (has >= 3) return;
  const msgs = [
    { title_ar: 'تقرير المبيعات الشهري جاهز', title_en: 'Monthly sales report is ready', body_ar: 'تم تجهيز تقرير المبيعات والتحصيل للشهر الماضي — راجع الأرقام قبل اجتماع الإدارة.', body_en: 'Last month’s sales and collections report is ready — review it before the board meeting.' },
    { title_ar: 'تذكير: أقساط مستحقة هذا الأسبوع', title_en: 'Reminder: instalments due this week', body_ar: 'يوجد عملاء لديهم أقساط مستحقة خلال 7 أيام — يرجى المتابعة مع فريق التحصيل.', body_en: 'Several customers have instalments due within 7 days — please follow up with collections.' },
    { title_ar: 'شيك مرتد يحتاج إجراء', title_en: 'A bounced cheque needs action', body_ar: 'تم ارتداد شيك لأحد العملاء لعدم كفاية الرصيد — راجع صفحة الشيكات.', body_en: 'A customer cheque bounced for insufficient funds — see the Cheques page.' },
    { title_ar: 'طلبات وسطاء بانتظار المراجعة', title_en: 'Broker leads awaiting review', body_ar: 'هناك عملاء جدد مرسلون من الوسطاء بانتظار الاعتماد.', body_en: 'New broker-submitted leads are waiting for approval.' },
  ];
  for (const m of msgs) {
    await attempt('broadcast', () => ctx.admin.post('/notifications/broadcast', { ...m, target: 'ROLE', targetRole: 'ADMIN', channel: 'IN_APP' }));
    await attempt('broadcast sales', () => ctx.admin.post('/notifications/broadcast', { ...m, target: 'ALL_SALES', channel: 'IN_APP' }));
    count('notifications');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. Back-dating (Prisma) — places what the API just created in the past
// ─────────────────────────────────────────────────────────────────────────────

async function backdate(
  ctx: Ctx,
  deals: DealResult[],
  openRes: Array<{ leadId: string; reservationId: string; createdAt: Date }>,
  pipeline: PipelineLead[],
  visits: Array<{ id: string; createdAt: Date }>,
  runStart: Date,
): Promise<void> {
  console.log('🕰️   Back-dating to spread the history over six months…');
  const companyId = ctx.companyId;
  const at = ctx.createdIds;

  const setLead = async (leadId: string, createdAt: Date) => {
    const lead = await prisma.lead.findFirst({ where: { companyId, id: leadId }, select: { clientId: true } });
    if (!lead) return;
    await prisma.lead.updateMany({ where: { companyId, id: leadId }, data: { createdAt } });
    await prisma.leadActivity.updateMany({ where: { companyId, leadId, type: 'created' }, data: { createdAt } });
    await prisma.leadActivity.updateMany({
      where: { companyId, leadId, type: { not: 'created' }, createdAt: { gte: runStart } },
      data: { createdAt: new Date(Math.min(createdAt.getTime() + 2 * DAY, NOW.getTime())) },
    });
    await prisma.leadNote.updateMany({ where: { companyId, leadId, createdAt: { gte: runStart } }, data: { createdAt: new Date(Math.min(createdAt.getTime() + DAY, NOW.getTime())) } });
    await prisma.user.updateMany({ where: { companyId, id: lead.clientId, createdAt: { gte: runStart } }, data: { createdAt } });
    at.set(leadId, createdAt);
  };

  for (const d of deals) {
    const s = d.signedAt;
    await setLead(d.leadId, addDays(s, -30 - (d.spec.client % 10)));
    const resAt = addDays(s, -12);
    await prisma.reservation.updateMany({ where: { companyId, id: d.reservationId }, data: { createdAt: resAt, convertedAt: addDays(s, -1) } });
    await prisma.reservationActivity.updateMany({ where: { companyId, reservationId: d.reservationId }, data: { createdAt: addDays(s, -11) } });
    at.set(d.reservationId, resAt);
    if (d.contractId) {
      const cAt = addDays(s, -1);
      await prisma.contract.updateMany({ where: { companyId, id: d.contractId }, data: { createdAt: cAt } });
      at.set(d.contractId, d.spec.sign ? s : cAt);
      await prisma.installmentPlan.updateMany({ where: { companyId, contractId: d.contractId }, data: { createdAt: cAt } });
      await prisma.unitStatusHistory.updateMany({ where: { companyId, unitId: d.unitId, changedAt: { gte: runStart } }, data: { changedAt: cAt } });
      // Deposits: created when they were paid.
      const deps = await prisma.deposit.findMany({ where: { companyId, OR: [{ contractId: d.contractId }, { reservationId: d.reservationId }] }, select: { id: true, paidAt: true } });
      for (const dep of deps) {
        if (!dep.paidAt) continue;
        await prisma.deposit.updateMany({ where: { companyId, id: dep.id }, data: { createdAt: dep.paidAt } });
        at.set(dep.id, dep.paidAt);
      }
      const instruments = await prisma.deposit.findMany({
        where: { companyId, contractId: d.contractId, paymentInstrumentId: { not: null } },
        select: { paymentInstrumentId: true, paidAt: true },
      });
      for (const ins of instruments) {
        if (ins.paidAt) await prisma.paymentInstrument.updateMany({ where: { companyId, id: ins.paymentInstrumentId! }, data: { createdAt: ins.paidAt } });
      }
      // Sales commission and broker commission: dated at signing; paid ones a month later.
      if (d.spec.sign) {
        const e = await prisma.bonusEntry.findFirst({ where: { companyId, contractId: d.contractId }, select: { id: true, status: true } });
        if (e) {
          await prisma.bonusEntry.updateMany({
            where: { companyId, id: e.id },
            data: { createdAt: s, ...(e.status === 'PAID' ? { paidAt: new Date(Math.min(addDays(s, 35).getTime(), NOW.getTime())) } : {}) },
          });
          at.set(e.id, s);
        }
        const c = await prisma.brokerCommission.findFirst({ where: { companyId, contractId: d.contractId }, select: { id: true } });
        if (c) {
          await prisma.brokerCommission.updateMany({ where: { companyId, id: c.id }, data: { createdAt: s } });
          at.set(c.id, s);
        }
      }
    }
  }
  for (const r of openRes) {
    await setLead(r.leadId, addDays(r.createdAt, -12));
    await prisma.reservation.updateMany({ where: { companyId, id: r.reservationId }, data: { createdAt: r.createdAt } });
    at.set(r.reservationId, r.createdAt);
  }
  for (const l of pipeline) await setLead(l.id, l.createdAt);
  for (const v of visits) {
    await prisma.visitAppointment.updateMany({ where: { companyId, id: v.id, createdAt: { gte: runStart } }, data: { createdAt: v.createdAt } });
    at.set(v.id, v.createdAt);
  }
  for (const [id, when] of at) {
    await prisma.maintenanceRequest.updateMany({ where: { companyId, id, createdAt: { gte: runStart } }, data: { createdAt: when } });
  }
  // Manual bonuses: dated in their period.
  const manual = await prisma.bonusEntry.findMany({
    where: { companyId, source: 'MANUAL', salesId: { in: Object.values(ctx.staff) }, createdAt: { gte: runStart } },
    select: { id: true, period: true, status: true },
  });
  for (const e of manual) {
    const [y, m] = e.period.split('-').map(Number);
    const created = new Date(Date.UTC(y!, m!, 2, 9));
    const when = created > NOW ? NOW : created;
    await prisma.bonusEntry.updateMany({ where: { companyId, id: e.id }, data: { createdAt: when, ...(e.status === 'PAID' ? { paidAt: addDays(when, 5) } : {}) } });
  }
  // Payouts: approved/paid in the last weeks.
  await prisma.brokerPayout.updateMany({
    where: { companyId, brokerId: { in: Object.values(ctx.brokers).map((b) => b!.id) }, createdAt: { gte: runStart } },
    data: { createdAt: addDays(NOW, -12) },
  });

  // Audit trail and notifications written by this run: tag them (cleanup) and
  // spread the audit rows over the days of the records they describe.
  await prisma.$executeRaw`
    UPDATE "AuditLog" SET "before" = ${JSON.stringify(SEED_MARK)}::jsonb
    WHERE "companyId" = ${companyId}::uuid AND "createdAt" >= ${runStart} AND "before" IS NULL`;
  await prisma.$executeRaw`
    UPDATE "Notification" SET "payload" = COALESCE("payload", '{}'::jsonb) || ${JSON.stringify(SEED_MARK)}::jsonb
    WHERE "companyId" = ${companyId}::uuid AND "createdAt" >= ${runStart}`;
  const audits = await prisma.auditLog.findMany({
    where: { companyId, createdAt: { gte: runStart } },
    select: { id: true, entityId: true, createdAt: true, action: true, entityType: true },
  });
  let spread = 0;
  for (const a of audits) {
    // Deletions and sign-in events stay where they are (today): the audit page's
    // "needs review" panel reads the newest page.
    if (a.action === 'DELETE' || a.entityType.toLowerCase().includes('auth')) continue;
    let when = a.entityId ? at.get(a.entityId) : undefined;
    if (!when) {
      // Unknown entity: spread over the last two weeks, a little more each day toward today.
      const days = Math.floor(hash01(a.id) * 14);
      when = addDays(NOW, -days);
      when.setUTCHours(7 + Math.floor(hash01(a.id + 'h') * 10), Math.floor(hash01(a.id + 'm') * 60), 0, 0);
      if (when > NOW) when = new Date(NOW.getTime() - 60_000);
    }
    await prisma.auditLog.updateMany({ where: { companyId, id: a.id }, data: { createdAt: when } });
    spread++;
  }
  console.log(`   ${spread} audit events placed over their records' dates`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Cleanup
// ─────────────────────────────────────────────────────────────────────────────

async function cleanup(companyId: string): Promise<void> {
  console.log('🗑️   Removing the full demo data…');
  const manifest = await loadManifest(companyId);
  const ids = <T extends { id: string }>(xs: T[]) => xs.map((x) => x.id);

  const projects = ids(await prisma.project.findMany({ where: { companyId, code: { startsWith: `${TAG}-` } }, select: { id: true } }));
  // Demo inventory lives in phases coded DEMO-FULL-… (inside a demo project, or
  // inside one of the company's projects when its plan had no room for more).
  const phases = ids(
    await prisma.phase.findMany({ where: { companyId, OR: [{ code: { startsWith: `${TAG}-` } }, { projectId: { in: projects } }] }, select: { id: true } }),
  );
  const units = ids(await prisma.unit.findMany({ where: { companyId, building: { phaseId: { in: phases } } }, select: { id: true } }));
  const users = ids(
    await prisma.user.findMany({
      where: { companyId, OR: [{ email: { endsWith: `@${EMAIL_DOMAIN}` } }, { phone: { startsWith: PHONE_PREFIX } }] },
      select: { id: true },
    }),
  );
  const brokers = ids(await prisma.broker.findMany({ where: { companyId, code: { startsWith: `${TAG}-` } }, select: { id: true } }));
  const leads = ids(
    await prisma.lead.findMany({
      where: {
        companyId,
        OR: [{ clientId: { in: users } }, { projectInterestId: { in: projects } }, { unitInterestId: { in: units } }, { brokerId: { in: brokers } }, { phone: { startsWith: PHONE_PREFIX } }],
      },
      select: { id: true },
    }),
  );
  const reservations = ids(
    await prisma.reservation.findMany({
      where: { companyId, OR: [{ unitId: { in: units } }, { leadId: { in: leads } }, { brokerId: { in: brokers } }, { clientId: { in: users } }] },
      select: { id: true },
    }),
  );
  const contracts = ids(
    await prisma.contract.findMany({
      where: { companyId, OR: [{ unitId: { in: units } }, { reservationId: { in: reservations } }, { customerId: { in: users } }] },
      select: { id: true },
    }),
  );
  const plans = ids(await prisma.installmentPlan.findMany({ where: { companyId, contractId: { in: contracts } }, select: { id: true } }));
  const installments = ids(await prisma.installment.findMany({ where: { companyId, planId: { in: plans } }, select: { id: true } }));
  const deposits = await prisma.deposit.findMany({
    where: { companyId, OR: [{ contractId: { in: contracts } }, { reservationId: { in: reservations } }, { installmentId: { in: installments } }] },
    select: { id: true, paymentInstrumentId: true, proofDocumentId: true },
  });
  const depositIds = ids(deposits);
  const instruments = [...new Set(deposits.map((d) => d.paymentInstrumentId).filter((x): x is string => !!x))];
  const commissions = await prisma.brokerCommission.findMany({
    where: { companyId, OR: [{ contractId: { in: contracts } }, { brokerId: { in: brokers } }] },
    select: { id: true, payoutId: true },
  });
  const payouts = [
    ...new Set([
      ...commissions.map((c) => c.payoutId).filter((x): x is string => !!x),
      ...ids(await prisma.brokerPayout.findMany({ where: { companyId, brokerId: { in: brokers } }, select: { id: true } })),
    ]),
  ];
  const visitRequests = ids(
    await prisma.visitRequest.findMany({
      where: { companyId, OR: [{ projectId: { in: projects } }, { leadId: { in: leads } }, { userId: { in: users } }, { customerPhone: { startsWith: PHONE_PREFIX } }] },
      select: { id: true },
    }),
  );
  const appointments = ids(
    await prisma.visitAppointment.findMany({
      where: { companyId, OR: [{ projectId: { in: projects } }, { leadId: { in: leads } }, { visitRequestId: { in: visitRequests } }, { clientId: { in: users } }] },
      select: { id: true },
    }),
  );
  const maintenance = ids(
    await prisma.maintenanceRequest.findMany({ where: { companyId, OR: [{ unitId: { in: units } }, { customerId: { in: users } }] }, select: { id: true } }),
  );
  const cancellations = ids(await prisma.contractCancellation.findMany({ where: { companyId, contractId: { in: contracts } }, select: { id: true } }));
  const entityIds = [...projects, ...units, ...leads, ...reservations, ...contracts, ...depositIds, ...instruments, ...ids(commissions), ...payouts, ...appointments, ...visitRequests, ...maintenance, ...brokers, ...users];

  const step = async (label: string, fn: () => Promise<{ count: number }>) => {
    const r = await fn();
    if (r.count) console.log(`   ${label}: ${r.count}`);
  };

  await step('bonus entries', () =>
    prisma.bonusEntry.deleteMany({ where: { companyId, OR: [{ contractId: { in: contracts } }, { salesId: { in: users } }, { ruleId: { in: manifest.bonusRuleIds } }] } }),
  );
  await step('commission adjustments', () => prisma.brokerCommissionAdjustment.deleteMany({ where: { companyId, commissionId: { in: ids(commissions) } } }));
  await step('broker commissions', () => prisma.brokerCommission.deleteMany({ where: { companyId, id: { in: ids(commissions) } } }));
  await step('broker payouts', () => prisma.brokerPayout.deleteMany({ where: { companyId, id: { in: payouts } } }));
  await prisma.installment.updateMany({ where: { companyId, id: { in: installments } }, data: { lastCorrectionId: null } });
  await step('payment corrections', () => prisma.paymentCorrection.deleteMany({ where: { companyId, depositId: { in: depositIds } } }));
  await step('deposits', () => prisma.deposit.deleteMany({ where: { companyId, id: { in: depositIds } } }));
  await prisma.paymentInstrument.updateMany({ where: { companyId, id: { in: instruments } }, data: { replacedById: null } });
  await step('payment instruments', () => prisma.paymentInstrument.deleteMany({ where: { companyId, id: { in: instruments } } }));
  await step('refunds', () => prisma.refund.deleteMany({ where: { companyId, contractCancellationId: { in: cancellations } } }));
  await step('contract cancellations', () => prisma.contractCancellation.deleteMany({ where: { companyId, id: { in: cancellations } } }));
  await step('contract amendments', () => prisma.contractAmendment.deleteMany({ where: { companyId, contractId: { in: contracts } } }));
  await step('unit handovers', () => prisma.unitHandover.deleteMany({ where: { companyId, contractId: { in: contracts } } }));
  await step('installment plans', () => prisma.installmentPlan.deleteMany({ where: { companyId, id: { in: plans } } }));
  await step('contracts', () => prisma.contract.deleteMany({ where: { companyId, id: { in: contracts } } }));
  await step('reservation activity', () => prisma.reservationActivity.deleteMany({ where: { companyId, reservationId: { in: reservations } } }));
  await step('reservation notes', () => prisma.reservationNote.deleteMany({ where: { companyId, reservationId: { in: reservations } } }));
  await step('reservations', () => prisma.reservation.deleteMany({ where: { companyId, id: { in: reservations } } }));
  await step('plan templates', () => prisma.installmentPlanTemplate.deleteMany({ where: { companyId, OR: [{ projectId: { in: projects } }, { unitId: { in: units } }] } }));
  await step('visit activity', () =>
    prisma.visitActivity.deleteMany({ where: { companyId, OR: [{ visitId: { in: appointments } }, { visitRequestId: { in: visitRequests } }, { leadId: { in: leads } }, { clientId: { in: users } }] } }),
  );
  await step('visit appointments', () => prisma.visitAppointment.deleteMany({ where: { companyId, id: { in: appointments } } }));
  await step('visit requests', () => prisma.visitRequest.deleteMany({ where: { companyId, id: { in: visitRequests } } }));
  await step('info requests', () =>
    prisma.infoRequest.deleteMany({ where: { companyId, OR: [{ projectId: { in: projects } }, { leadId: { in: leads } }, { userId: { in: users } }, { unitId: { in: units } }] } }),
  );
  await step('maintenance requests', () => prisma.maintenanceRequest.deleteMany({ where: { companyId, id: { in: maintenance } } }));
  await step('leads', () => prisma.lead.deleteMany({ where: { companyId, id: { in: leads } } }));
  await step('documents', () =>
    prisma.document.deleteMany({ where: { companyId, OR: [{ fileUrl: { contains: FILE_TAG } }, { ownerId: { in: entityIds } }] } }),
  );
  await step('broker activity', () => prisma.brokerActivityLog.deleteMany({ where: { companyId, brokerId: { in: brokers } } }));
  await step('broker users', () => prisma.brokerUser.deleteMany({ where: { companyId, OR: [{ brokerId: { in: brokers } }, { userId: { in: users } }] } }));
  await step('broker access', () => prisma.brokerProjectAccess.deleteMany({ where: { companyId, brokerId: { in: brokers } } }));
  await step('broker unit access', () => prisma.brokerUnitAccess.deleteMany({ where: { companyId, brokerId: { in: brokers } } }));
  await step('brokers', () => prisma.broker.deleteMany({ where: { companyId, id: { in: brokers } } }));
  // Favorite and UserPermission have no companyId: they are scoped through the demo units / projects / users.
  await step('favorites', () => prisma.favorite.deleteMany({ where: { OR: [{ unitId: { in: units } }, { projectId: { in: projects } }, { userId: { in: users } }] } }));
  await step('unit maintenance items', () => prisma.unitMaintenanceItem.deleteMany({ where: { companyId, unitId: { in: units } } }));
  await step('unit status history', () => prisma.unitStatusHistory.deleteMany({ where: { companyId, unitId: { in: units } } }));
  await step('units', () => prisma.unit.deleteMany({ where: { companyId, id: { in: units } } }));
  await step('buildings', () => prisma.building.deleteMany({ where: { companyId, phaseId: { in: phases } } }));
  await step('phases', () => prisma.phase.deleteMany({ where: { companyId, id: { in: phases } } }));
  await step('projects', () => prisma.project.deleteMany({ where: { companyId, id: { in: projects } } }));
  await step('sales targets', () => prisma.salesTarget.deleteMany({ where: { companyId, OR: [{ salesId: { in: users } }, { id: { in: manifest.targetIds } }] } }));
  await step('audit log', () =>
    prisma.auditLog.deleteMany({
      where: { companyId, OR: [{ before: { path: ['_seed'], equals: TAG } }, { entityId: { in: entityIds } }, { actorId: { in: users } }] },
    }),
  );
  await step('notifications', () => prisma.notification.deleteMany({ where: { companyId, OR: [{ payload: { path: ['_seed'], equals: TAG } }, { userId: { in: users } }] } }));
  // Leads or records of the owner's that point at a demo rep keep their row, without the rep.
  await prisma.lead.updateMany({ where: { companyId, assignedSalesId: { in: users } }, data: { assignedSalesId: null } });
  await prisma.user.updateMany({ where: { companyId, managerId: { in: users } }, data: { managerId: null } });
  await step('user permissions', () => prisma.userPermission.deleteMany({ where: { userId: { in: users } } }));
  try {
    await step('people (staff, clients, customers, broker agents)', () => prisma.user.deleteMany({ where: { companyId, id: { in: users } } }));
  } catch (e) {
    warn(`some demo users are still referenced and were kept: ${(e as Error).message.split('\n').slice(-1)[0]}`);
  }
  await step('bonus rules', () =>
    prisma.bonusRule.deleteMany({ where: { companyId, id: { in: manifest.bonusRuleIds }, entries: { none: {} } } }),
  );
  await step('maintenance categories', () =>
    prisma.maintenanceCategory.deleteMany({ where: { companyId, id: { in: manifest.categoryIds }, requests: { none: {} }, requestItems: { none: {} }, maintenanceItems: { none: {} } } }),
  );
  await step('lead sources', () => prisma.leadSource.deleteMany({ where: { companyId, id: { in: manifest.leadSourceIds }, leads: { none: {} } } }));
  await step('unit types', () => prisma.unitType.deleteMany({ where: { companyId, id: { in: manifest.unitTypeIds } } }));
  const s = SLUG.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  await step('cms pages', () => prisma.cmsPage.deleteMany({ where: { companyId, slug: { startsWith: `demo-full-${s}-` } } }));
  await step('cms articles', () => prisma.article.deleteMany({ where: { companyId, slug: { startsWith: `demo-full-${s}-` } } }));
  await step('cms banners', () => prisma.banner.deleteMany({ where: { companyId, id: { in: manifest.bannerIds } } }));
  await prisma.setting.deleteMany({ where: { companyId, key: MANIFEST_KEY } });
  console.log('✅  Cleanup done.');
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const company = await prisma.company.findFirst({ where: { slug: SLUG }, select: { id: true, slug: true } });
  if (!company) throw new Error(`Company with slug "${SLUG}" not found in DATABASE_URL`);

  if (process.argv.includes('--cleanup')) {
    await cleanup(company.id);
    return;
  }

  const runStart = new Date(Date.now() - 1000);
  console.log(`🌱  Full demo seed → company "${SLUG}" (${company.id}) via ${API_URL}`);
  const admin = new ApiClient('admin');
  await admin.login(ADMIN_EMAIL, ADMIN_PASSWORD);

  const ctx: Ctx = {
    companyId: company.id,
    admin,
    adminId: admin.userId,
    manifest: await loadManifest(company.id),
    staff: {} as Record<StaffKey, string>,
    demoStaff: new Set(),
    projects: {} as Ctx['projects'],
    sources: [],
    brokers: {},
    createdIds: new Map(),
  };

  try {
    await ensureStaff(ctx);
    await ensureLeadSources(ctx);
    await ensureProjects(ctx);
    await saveManifest(ctx.companyId, ctx.manifest);
    const categories = await ensureCategories(ctx);
    const { manualRuleId } = await ensureBonusRules(ctx);
    await saveManifest(ctx.companyId, ctx.manifest);
    await ensureBrokers(ctx);
    await ensureBrokerLeads(ctx);

    console.log('📝  Deals (lead → reservation → contract → payments)…');
    const deals: DealResult[] = [];
    for (const spec of DEALS) {
      const r = await attempt(`deal ${spec.key}`, () => runDeal(ctx, spec));
      if (r) deals.push(r);
      process.stdout.write('.');
    }
    process.stdout.write('\n');
    console.log('🧾  Open reservations…');
    const openRes: Array<{ leadId: string; reservationId: string; createdAt: Date }> = [];
    for (const spec of OPEN_RESERVATIONS) {
      const r = await attempt(`reservation ${spec.key}`, () => runOpenReservation(ctx, spec));
      if (r) openRes.push(r);
    }
    const pipeline = await ensurePipeline(ctx);
    const visits = await ensureVisits(ctx, pipeline, deals);
    await ensurePublicRequests(ctx);
    await ensureBrokerMoney(ctx, deals);
    await ensureBonusesAndTargets(ctx, deals, manualRuleId);
    await saveManifest(ctx.companyId, ctx.manifest);
    await ensureMaintenance(ctx, deals, categories);
    await ensureDocuments(ctx, deals);
    await ensureCms(ctx);
    await saveManifest(ctx.companyId, ctx.manifest);
    await ensureNotifications(ctx);
    // One token refresh on record (an "auth" event in the audit trail).
    await attempt('refresh', () => ctx.admin.refresh());
    await backdate(ctx, deals, openRes, pipeline, visits, runStart);
  } finally {
    await saveManifest(ctx.companyId, ctx.manifest);
  }

  await summary(ctx.companyId);
}

async function summary(companyId: string): Promise<void> {
  const projects = (await prisma.project.findMany({ where: { companyId, code: { startsWith: `${TAG}-` } }, select: { id: true } })).map((p) => p.id);
  const units = await prisma.unit.findMany({ where: { companyId, building: { phase: { code: { startsWith: `${TAG}-` } } } }, select: { id: true, status: true } });
  const unitIds = units.map((u) => u.id);
  const people = (await prisma.user.findMany({ where: { companyId, OR: [{ email: { endsWith: `@${EMAIL_DOMAIN}` } }, { phone: { startsWith: PHONE_PREFIX } }] }, select: { id: true } })).map((u) => u.id);
  const leads = await prisma.lead.groupBy({ by: ['stage'], where: { companyId, phone: { startsWith: PHONE_PREFIX } }, _count: { _all: true } });
  const res = await prisma.reservation.groupBy({ by: ['status'], where: { companyId, unitId: { in: unitIds } }, _count: { _all: true } });
  const contracts = await prisma.contract.findMany({ where: { companyId, unitId: { in: unitIds } }, select: { id: true, signedAt: true } });
  const contractIds = contracts.map((c) => c.id);
  const today = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), NOW.getUTCDate()));
  const [paid, overdue, dueWeek, deposits, cheques, visits, vreq, info, maint, docs, comm, payouts, bonus, targets, notes, audit, templates] = await Promise.all([
    prisma.installment.count({ where: { companyId, status: 'PAID', plan: { contractId: { in: contractIds } } } }),
    prisma.installment.count({ where: { companyId, status: { in: ['PENDING', 'OVERDUE'] }, dueDate: { lt: today }, plan: { contractId: { in: contractIds } } } }),
    prisma.installment.count({ where: { companyId, status: { in: ['PENDING'] }, dueDate: { gte: today, lt: addDays(today, 7) }, plan: { contractId: { in: contractIds } } } }),
    prisma.deposit.count({ where: { companyId, contractId: { in: contractIds } } }),
    prisma.paymentInstrument.groupBy({ by: ['status'], where: { companyId, type: 'CHEQUE', deposits: { some: { contractId: { in: contractIds } } } }, _count: { _all: true } }),
    prisma.visitAppointment.groupBy({ by: ['status'], where: { companyId, lead: { phone: { startsWith: PHONE_PREFIX } } }, _count: { _all: true } }),
    prisma.visitRequest.count({ where: { companyId, customerPhone: { startsWith: PHONE_PREFIX } } }),
    prisma.infoRequest.count({ where: { companyId, lead: { phone: { startsWith: PHONE_PREFIX } } } }),
    prisma.maintenanceRequest.count({ where: { companyId, unitId: { in: unitIds } } }),
    prisma.document.count({ where: { companyId, fileUrl: { contains: FILE_TAG }, deletedAt: null } }),
    prisma.brokerCommission.groupBy({ by: ['status'], where: { companyId, contractId: { in: contractIds } }, _count: { _all: true } }),
    prisma.brokerPayout.groupBy({ by: ['status'], where: { companyId, broker: { code: { startsWith: `${TAG}-` } } }, _count: { _all: true } }),
    prisma.bonusEntry.groupBy({ by: ['status'], where: { companyId, OR: [{ contractId: { in: contractIds } }, { salesId: { in: people } }] }, _count: { _all: true } }),
    prisma.salesTarget.count({ where: { companyId, OR: [{ salesId: { in: people } }, { id: { in: (await loadManifest(companyId)).targetIds } }] } }),
    prisma.notification.count({ where: { companyId, payload: { path: ['_seed'], equals: TAG } } }),
    prisma.auditLog.count({ where: { companyId, before: { path: ['_seed'], equals: TAG } } }),
    prisma.installmentPlanTemplate.count({ where: { companyId, unitId: { in: unitIds } } }),
  ]);
  const fmt = (g: Json[], k: string) => g.map((x) => `${String(x[k])} ${x._count._all}`).join(', ') || '—';
  const unitStatus = await prisma.unit.groupBy({ by: ['status'], where: { companyId, id: { in: unitIds } }, _count: { _all: true } });
  const signedThisMonth = contracts.filter((c) => c.signedAt && c.signedAt >= new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), 1))).length;
  console.log('\n──────────── Summary (demo rows in this company) ────────────');
  console.log(`Projects / units ........ ${projects.length} own projects, ${units.length} demo units (${fmt(unitStatus, 'status')})`);
  console.log(`Leads ................... ${fmt(leads, 'stage')}`);
  console.log(`Reservations ............ ${fmt(res, 'status')}`);
  console.log(`Contracts ............... ${contracts.length} (${contracts.filter((c) => c.signedAt).length} signed, ${signedThisMonth} this month)`);
  console.log(`Plan templates .......... ${templates}`);
  console.log(`Instalments ............. ${paid} paid, ${overdue} overdue, ${dueWeek} due within 7 days`);
  console.log(`Deposits ................ ${deposits}; cheques: ${fmt(cheques, 'status')}`);
  console.log(`Visits .................. ${fmt(visits, 'status')}; visit requests ${vreq}; inquiries ${info}`);
  console.log(`Broker commissions ...... ${fmt(comm, 'status')}; payouts: ${fmt(payouts, 'status')}`);
  console.log(`Bonus entries ........... ${fmt(bonus, 'status')}; sales targets ${targets}`);
  console.log(`Maintenance requests .... ${maint}; documents ${docs}`);
  console.log(`Notifications ........... ${notes}; audit events ${audit}`);
  console.log(`Created this run ........ ${JSON.stringify(counters)}`);
  if (warnings.length) console.log(`Warnings ................ ${warnings.length} (see ⚠️ lines above)`);
  const accounts = await prisma.user.findMany({
    where: { companyId, email: { endsWith: `@${EMAIL_DOMAIN}` }, role: { notIn: ['CLIENT', 'CUSTOMER'] } },
    orderBy: { role: 'asc' },
    select: { role: true, email: true },
  });
  if (accounts.length) {
    console.log(`\nDemo staff logins (password ${STAFF_PASSWORD}):`);
    for (const a of accounts) console.log(`   ${a.role.padEnd(22)} ${a.email}`);
  }
  console.log('\nRemove it all with:  pnpm --filter @rep/api prisma:seed:full-demo:cleanup');
}

main()
  .catch((e) => {
    console.error('❌ ', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
