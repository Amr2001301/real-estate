'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { AlertCircle, CheckCircle2, Images, X } from 'lucide-react';
import { TranslatableInput } from '@/components/form/translatable-input';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';
import { ServiceTilePicker } from '@/components/projects/service-tile-picker';
import { ProjectMap } from '@/components/maps/project-map';
import type { Project } from '@/lib/types';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import {
  createProjectAction,
  updateProjectAction,
  type ProjectFormState,
} from './actions';

interface Props {
  project?: Project;
  locale?: Locale;
}

function parseCoord(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null;
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}

function isValidLat(n: number | null): boolean {
  return n !== null && n >= -90 && n <= 90;
}
function isValidLng(n: number | null): boolean {
  return n !== null && n >= -180 && n <= 180;
}

export default function ProjectForm({ project, locale = 'ar' }: Props) {
  const m = uiT(locale).pages.projectsForm;

  const action = project
    ? updateProjectAction.bind(null, project.id)
    : createProjectAction;
  const [state, formAction] = useActionState<ProjectFormState, FormData>(action, {});

  const isEdit = Boolean(project);
  const cancelHref = isEdit
    ? `/dashboard/projects/${project!.id}`
    : '/dashboard/projects';

  const [lat, setLat] = useState<number | null>(parseCoord(project?.lat));
  const [lng, setLng] = useState<number | null>(parseCoord(project?.lng));
  const latValid = lat === null || isValidLat(lat);
  const lngValid = lng === null || isValidLng(lng);

  const NAV_SECTIONS = [
    { id: 'section-basic',     number: '01', title: m.nav01Title, desc: m.nav01Desc },
    { id: 'section-location',  number: '02', title: m.nav02Title, desc: m.nav02Desc },
    { id: 'section-amenities', number: '03', title: m.nav03Title, desc: m.nav03Desc },
    { id: 'section-media',     number: '04', title: m.nav04Title, desc: m.nav04Desc },
  ];

  return (
    <form action={formAction} className="flex flex-col gap-4 lg:gap-5">

      {/* ── Alert banners ── */}
      {state.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 px-5 py-4 text-sm shadow-soft">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-semibold leading-relaxed">{state.error}</p>
        </div>
      )}
      {state.ok && (
        <div className="flex items-start gap-3 rounded-2xl bg-success-50 border border-success-100 text-success-700 px-5 py-4 text-sm shadow-soft">
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-semibold leading-relaxed">{m.successMessage}</p>
        </div>
      )}

      {/* ── Mobile: horizontal scrollable section chips ── */}
      <nav
        className="lg:hidden flex gap-2 overflow-x-auto pb-0.5 scrollbar-thin"
        aria-label={m.navAriaLabel}
      >
        {NAV_SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-surface border border-hairline shadow-xs text-xs font-semibold text-slate-700 hover:border-brand-200 hover:bg-brand-50/60 hover:text-brand-700 transition-colors"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-brand-50 border border-brand-200 text-brand-700 text-2xs font-bold leading-none shrink-0">
              {s.number}
            </span>
            {s.title}
          </a>
        ))}
      </nav>

      {/* ── Workspace: summary panel (right in RTL) + form panels (left) ── */}
      <div className="flex flex-col lg:flex-row gap-5 lg:gap-6 items-start">

        {/* Project Setup Summary — first in DOM = right side in RTL flex-row */}
        <aside className="hidden lg:flex flex-col gap-3 w-[272px] shrink-0 sticky top-6 self-start">
          <div className="bg-surface border border-hairline rounded-2xl shadow-soft overflow-hidden">
            {/* Gold accent strip */}
            <div className="h-[2px] bg-gradient-to-r from-brand-200 via-brand-500 to-brand-200" />

            {/* Panel header */}
            <div className="px-5 py-4 border-b border-hairline flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-navy">{m.sidebarTitle}</p>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-2.5 py-1 text-2xs font-bold text-brand-700 select-none">
                <span className="h-1 w-1 rounded-full bg-brand-400 shrink-0" />
                {m.sidebarBadge}
              </span>
            </div>

            {/* Steps */}
            <div className="p-3">
              <p className="text-2xs font-bold uppercase tracking-widest text-slate-400 px-2 pb-2 select-none">
                {m.sidebarStepsHeading}
              </p>
              <nav className="flex flex-col gap-0.5">
                {NAV_SECTIONS.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="group flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-brand-50/70 transition-colors"
                  >
                    <span className="mt-px inline-flex h-6 w-6 items-center justify-center rounded-lg bg-brand-50 border border-brand-200 text-brand-700 text-2xs font-bold shrink-0 leading-none group-hover:bg-brand-100 group-hover:border-brand-300 transition-colors">
                      {s.number}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-navy group-hover:text-brand-700 transition-colors leading-snug">
                        {s.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-snug">{s.desc}</p>
                    </div>
                  </a>
                ))}
              </nav>
            </div>

            {/* Info box */}
            <div className="px-4 pb-4">
              <div className="rounded-xl bg-brand-50 border border-brand-100 px-4 py-3.5">
                <p className="text-xs text-brand-800 leading-relaxed font-medium">
                  {isEdit ? m.sidebarInfoEdit : m.sidebarInfoCreate}
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Stacked form panels — flex-1, left side in RTL ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4 lg:gap-5 pb-24">

          {/* ── Panel 1: Basic Information ── */}
          <section
            id="section-basic"
            className="bg-surface border border-hairline rounded-[20px] overflow-hidden shadow-[0_1px_4px_0_rgb(15_30_51_/_0.05),0_6px_28px_-6px_rgb(15_30_51_/_0.09)]"
          >
            <PanelHeader
              number="01"
              title={m.p1Title}
              description={m.p1Desc}
            />
            <div className="px-7 sm:px-8 py-7 flex flex-col gap-6">
              <TranslatableInput
                name="name"
                label={m.labelName}
                required
                defaultValueAr={project?.name?.ar}
                defaultValueEn={project?.name?.en}
              />
              <TranslatableInput
                name="description"
                label={m.labelDescription}
                multiline
                rows={4}
                defaultValueAr={project?.description?.ar}
                defaultValueEn={project?.description?.en}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label={m.labelStatus} name="status">
                  <Select
                    id="status"
                    name="status"
                    defaultValue={project?.status ?? 'DRAFT'}
                  >
                    <option value="DRAFT">{m.statusDraft}</option>
                    <option value="PUBLISHED">{m.statusPublished}</option>
                    <option value="ARCHIVED">{m.statusArchived}</option>
                  </Select>
                </Field>
                <Field label={m.labelFeatured} name="featured" hint={m.hintFeatured}>
                  <label className="flex items-center gap-2.5 h-10 cursor-pointer select-none">
                    <Checkbox
                      id="featured"
                      name="featured"
                      defaultChecked={project?.featured}
                    />
                    <span className="text-sm text-slate-700">
                      {m.featuredCheckLabel}
                    </span>
                  </label>
                </Field>
              </div>
            </div>
          </section>

          {/* ── Panel 2: Location ── */}
          <section
            id="section-location"
            className="bg-surface border border-hairline rounded-[20px] overflow-hidden shadow-[0_1px_4px_0_rgb(15_30_51_/_0.05),0_6px_28px_-6px_rgb(15_30_51_/_0.09)]"
          >
            <PanelHeader
              number="02"
              title={m.p2Title}
              description={m.p2Desc}
            />
            <div className="px-7 sm:px-8 py-7 flex flex-col gap-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label={m.labelCity} name="city" required>
                  <Input
                    id="city"
                    name="city"
                    required
                    defaultValue={project?.city}
                  />
                </Field>
                <Field label={m.labelLat} name="lat" hint={m.hintLat} required>
                  <Input
                    id="lat"
                    name="lat"
                    type="number"
                    step="any"
                    min={-90}
                    max={90}
                    required
                    value={lat ?? ''}
                    onChange={(e) => setLat(parseCoord(e.target.value))}
                  />
                </Field>
                <Field label={m.labelLng} name="lng" hint={m.hintLng} required>
                  <Input
                    id="lng"
                    name="lng"
                    type="number"
                    step="any"
                    min={-180}
                    max={180}
                    required
                    value={lng ?? ''}
                    onChange={(e) => setLng(parseCoord(e.target.value))}
                  />
                </Field>
              </div>

              {(!latValid || !lngValid) && (
                <div className="flex items-start gap-2 rounded-xl bg-warning-50 border border-warning-100 text-warning-700 p-3 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p className="font-medium">
                    {!latValid ? m.errorLat : m.errorLng}
                  </p>
                </div>
              )}

              <ProjectMap
                mode="editable"
                lat={latValid ? lat : null}
                lng={lngValid ? lng : null}
                city={project?.city ?? null}
                height="md"
                onChange={(nextLat, nextLng) => {
                  setLat(Number(nextLat.toFixed(6)));
                  setLng(Number(nextLng.toFixed(6)));
                }}
              />
            </div>
          </section>

          {/* ── Panel 3: Amenities ── */}
          <section
            id="section-amenities"
            className="bg-surface border border-hairline rounded-[20px] overflow-hidden shadow-[0_1px_4px_0_rgb(15_30_51_/_0.05),0_6px_28px_-6px_rgb(15_30_51_/_0.09)]"
          >
            <PanelHeader
              number="03"
              title={m.p3Title}
              description={m.p3Desc}
            />
            <div className="px-7 sm:px-8 py-7">
              <ServiceTilePicker
                name="services"
                defaultValue={project?.services ?? []}
              />
            </div>
          </section>

          {/* ── Panel 4: Media ── */}
          <section
            id="section-media"
            className="bg-surface border border-hairline rounded-[20px] overflow-hidden shadow-[0_1px_4px_0_rgb(15_30_51_/_0.05),0_6px_28px_-6px_rgb(15_30_51_/_0.09)]"
          >
            <PanelHeader
              number="04"
              title={m.p4Title}
              description={m.p4Desc}
            />
            <div className="px-7 sm:px-8 py-7">
              {isEdit ? (
                <p className="text-xs text-slate-500">
                  {m.mediaEditHint}{' '}
                  <Link
                    href={`/dashboard/projects/${project!.id}` as never}
                    className="font-semibold text-brand-700 hover:text-brand-800"
                  >
                    {m.mediaEditLink}
                  </Link>
                </p>
              ) : (
                <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50/20 py-12 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100/80 text-brand-500 shadow-soft">
                    <Images className="h-7 w-7" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">
                    {m.mediaCreateTitle}
                  </p>
                  <p className="mt-2 text-xs text-slate-500 max-w-[260px] mx-auto leading-relaxed">
                    {m.mediaCreateDesc}
                  </p>
                </div>
              )}
            </div>
          </section>

        </div>
      </div>

      {/* ── Sticky action bar ── */}
      <FormFooter
        sticky
        primary={
          <>
            <Link href={cancelHref as never}>
              <Button type="button" variant="ghost" leftIcon={<X className="h-4 w-4" />}>
                {m.cancelBtn}
              </Button>
            </Link>
            <SubmitButton>
              {isEdit ? m.submitEdit : m.submitCreate}
            </SubmitButton>
          </>
        }
        helper={isEdit ? m.helperEdit : m.helperCreate}
      />
    </form>
  );
}

function PanelHeader({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="border-b border-hairline bg-surface-muted/20">
      <div className="px-7 sm:px-8 py-6 flex items-start gap-5">
        {/* Large gold number badge */}
        <span className="mt-0.5 shrink-0 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-100 to-brand-50 border border-brand-200 text-brand-700 text-[15px] font-bold leading-none shadow-xs">
          {number}
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-navy tracking-tight leading-snug">
            {title}
          </h2>
          {/* Gold decorative separator */}
          <div className="mt-2 mb-2.5 w-8 h-[2px] rounded-full bg-gradient-to-r from-brand-400 to-brand-200" />
          <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  );
}
