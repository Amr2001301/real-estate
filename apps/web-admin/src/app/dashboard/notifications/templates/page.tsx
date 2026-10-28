import Link from 'next/link';
import type { ReactNode } from 'react';
import { revalidatePath } from 'next/cache';
import { notFound } from 'next/navigation';
import { Plus, FileEdit, ArrowRight, Bell, Mail, Search, Smartphone } from 'lucide-react';
import { requireAdmin } from '@/lib/session';
import { can } from '@/lib/permissions';
import { cn } from '@/lib/cn';
import { api, safe } from '@/lib/api';
import type { Translatable } from '@/lib/types';
import { tx, formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { PremiumPageHero, PremiumPanel } from '@/components/premium';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Template {
  id: string;
  code: string;
  channel: 'PUSH' | 'EMAIL' | 'IN_APP';
  subject: Translatable;
  body: Translatable;
  active: boolean;
  emailEnabled: boolean;
  updatedAt: string;
}

// ── Server actions (names/fields unchanged) ───────────────────────────────────

async function upsertTemplateAction(formData: FormData) {
  'use server';
  await api.post('/notification-templates', {
    code: String(formData.get('code') ?? ''),
    channel: String(formData.get('channel') ?? 'PUSH'),
    ar_subject: String(formData.get('ar_subject') ?? ''),
    en_subject: String(formData.get('en_subject') ?? ''),
    ar_body: String(formData.get('ar_body') ?? ''),
    en_body: String(formData.get('en_body') ?? ''),
    emailEnabled: formData.get('emailEnabled') === 'true',
  });
  revalidatePath('/dashboard/notifications/templates');
}

// ── Channel look ──────────────────────────────────────────────────────────────

const CHANNEL_ICON: Record<Template['channel'], ReactNode> = {
  PUSH:   <Smartphone className="h-4 w-4" />,
  EMAIL:  <Mail className="h-4 w-4" />,
  IN_APP: <Bell className="h-4 w-4" />,
};
const CHANNEL_CLS: Record<Template['channel'], string> = {
  PUSH:   'bg-sky-500/12 text-sky-600',
  EMAIL:  'bg-brand-500/12 text-brand-700',
  IN_APP: 'bg-emerald-500/12 text-emerald-600',
};

/** A template text with its {{placeholders}} set apart as small chips. */
function WithPlaceholders({ text }: { text: string }) {
  const parts = text.split(/(\{\{\s*\w+\s*\}\})/g);
  return (
    <>
      {parts.map((part, i) =>
        /^\{\{\s*\w+\s*\}\}$/.test(part) ? (
          <span key={i} className="mx-0.5 rounded bg-brand-500/12 px-1 font-mono text-[10.5px] text-brand-700" dir="ltr">
            {part.replace(/[{}\s]/g, '')}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

interface Search { q?: string; channel?: string; edit?: string; new?: string }

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function NotificationTemplatesPage({ searchParams }: { searchParams: Promise<Search> }) {
  // The templates are the admin's (the API refuses other roles).
  const session = await requireAdmin();
  if (session.role !== 'ADMIN' && !(await can('notifications:templates:manage'))) notFound();

  const [r, locale, sp] = await Promise.all([
    safe(api.get<Template[]>('/notification-templates')),
    getLocale(),
    searchParams,
  ]);
  // The manual send's own passthrough template is filled from the form, not edited here.
  const templates = (r.data ?? []).filter((t) => t.code !== 'admin_broadcast');
  const m = uiT(locale).notifTemplatesPage;

  const q = sp.q?.trim().toLowerCase() ?? '';
  const shown = templates.filter(
    (t) =>
      (!sp.channel || t.channel === sp.channel) &&
      (!q || [t.code, tx(t.subject), tx(t.body), t.subject.ar, t.subject.en].some((v) => v?.toLowerCase().includes(q))),
  );
  const editing = sp.edit ? templates.find((t) => t.code === sp.edit) ?? null : null;
  const formOpen = !!editing || sp.new === '1';
  const link = (params: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: sp.q, channel: sp.channel, ...params })) if (v) p.set(k, v);
    const s = p.toString();
    return `/dashboard/notifications/templates${s ? `?${s}` : ''}`;
  };

  return (
    <div className="flex flex-col gap-5 pb-2 lg:gap-6">
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[
          { label: m.breadcrumbDashboard, href: '/dashboard' },
          { label: m.breadcrumbNotifs, href: '/dashboard/notifications' },
          { label: m.breadcrumbTemplates },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`${link({ new: '1' })}#editor` as never}>
              <Button variant="primary" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}>{m.newBtn}</Button>
            </Link>
            <Link href="/dashboard/notifications">
              <Button variant="outline" size="sm" leftIcon={<ArrowRight className="h-3.5 w-3.5" />}>{m.backButton}</Button>
            </Link>
          </div>
        }
      />

      {r.error && (
        <div className="rounded-2xl border border-danger-100 bg-danger-50 p-4 text-sm text-danger-700">
          {m.loadError} {r.error}
        </div>
      )}

      {/* ── Editor (opened by "edit" or "new") ──────────────────────────── */}
      {formOpen && (
        <PremiumPanel
          title={editing ? `${m.editing}: ${tx(editing.subject)}` : m.newBtn}
          sub={m.placeholdersHint}
          link={{ href: link({}), label: m.backButton }}
        >
          <form id="editor" action={upsertTemplateAction} className="scroll-mt-24 space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {editing ? (
                <input type="hidden" name="code" value={editing.code} />
              ) : (
                <Input name="code" required dir="ltr" placeholder={m.codeLabel} inputSize="sm" className="font-mono" />
              )}
              <Select name="channel" defaultValue={editing?.channel ?? 'PUSH'} inputSize="sm">
                <option value="PUSH">{m.channelPush}</option>
                <option value="EMAIL">{m.channelEmail}</option>
                <option value="IN_APP">{m.channelInApp}</option>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input name="ar_subject" required dir="rtl" placeholder={m.arSubjectPlaceholder} defaultValue={editing?.subject.ar} inputSize="sm" />
              <Input name="en_subject" required dir="ltr" placeholder="Subject (English)" defaultValue={editing?.subject.en} inputSize="sm" />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Textarea name="ar_body" required dir="rtl" rows={4} placeholder={m.arBodyPlaceholder} defaultValue={editing?.body.ar} className="text-sm" />
              <Textarea name="en_body" required dir="ltr" rows={4} placeholder="Notification body (English)" defaultValue={editing?.body.en} className="text-sm" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="emailEnabled" value="true" defaultChecked={editing?.emailEnabled} className="h-4 w-4 rounded border-hairline text-brand-600" />
                {m.emailEnabledLabel}
              </label>
              <Button type="submit" size="sm">{m.saveButton}</Button>
            </div>
          </form>
        </PremiumPanel>
      )}

      {/* ── The templates ───────────────────────────────────────────────── */}
      <PremiumPanel title={m.sectionTitle} sub={m.count(shown.length, templates.length)} padding="none">
        <div className="flex flex-wrap items-center gap-2 border-t border-hairline px-5 py-3">
          <form method="get" action="/dashboard/notifications/templates" className="min-w-[220px] flex-1">
            {sp.channel && <input type="hidden" name="channel" value={sp.channel} />}
            <Input name="q" inputSize="sm" defaultValue={sp.q ?? ''} placeholder={m.searchPlaceholder} leftAddon={<Search className="h-3.5 w-3.5" />} />
          </form>
          {([undefined, 'IN_APP', 'PUSH', 'EMAIL'] as const).map((ch) => (
            <Link
              key={ch ?? 'all'}
              href={link({ channel: ch }) as never}
              className={cn(
                'rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors',
                (sp.channel ?? undefined) === ch
                  ? 'border-brand-500/50 bg-brand-500/12 text-brand-700'
                  : 'border-hairline text-slate-600 hover:border-brand-500/30',
              )}
            >
              {ch ? m.channelLabel[ch] : m.allChannels}
            </Link>
          ))}
        </div>

        {shown.length === 0 ? (
          <div className="border-t border-hairline px-6 py-10 text-center text-[13px] text-slate-500">
            {templates.length === 0 ? m.emptyTitle : m.noMatch}
          </div>
        ) : (
          <ul className="divide-y divide-hairline border-t border-hairline" data-testid="templates-list">
            {shown.map((t) => (
              <li key={t.id} title={t.code} className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-surface-muted/40">
                <span className={cn('mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full', CHANNEL_CLS[t.channel])}>
                  {CHANNEL_ICON[t.channel]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14px] font-semibold text-slate-900">{tx(t.subject)}</p>
                    <span className={cn('rounded-full px-2 py-0.5 text-[10.5px] font-semibold', CHANNEL_CLS[t.channel])}>{m.channelLabel[t.channel]}</span>
                    {t.emailEnabled && (
                      <span className="rounded-full bg-brand-500/12 px-2 py-0.5 text-[10.5px] font-semibold text-brand-700">{m.colEmail}</span>
                    )}
                    {!t.active && (
                      <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-slate-500">{m.statusInactive}</span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-slate-500">
                    <WithPlaceholders text={tx(t.body)} />
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Link
                    href={`${link({ edit: t.code })}#editor` as never}
                    className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1 text-[12px] font-semibold text-slate-700 transition-colors hover:border-brand-500/40 hover:text-brand-700"
                  >
                    <FileEdit className="h-3.5 w-3.5" />
                    {m.editBtn}
                  </Link>
                  <span className="text-[11px] text-slate-400 tabular-nums">{formatDate(t.updatedAt, locale)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PremiumPanel>
    </div>
  );
}
