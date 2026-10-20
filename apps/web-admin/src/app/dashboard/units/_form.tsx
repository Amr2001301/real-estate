'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { AlertCircle, CheckCircle2, X, MapPin, Tag, Ruler, DollarSign, Info } from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';
import { BuildingPicker } from './_building-picker';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import type { Project, Unit, UnitTypeOption, UnitUsage } from '@/lib/types';
import { tx } from '@/lib/format';
import { createUnitAction, updateUnitAction, type UnitFormState } from './actions';

function PanelHeader({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="border-b border-hairline bg-surface-muted/20">
      <div className="px-7 sm:px-8 py-6 flex items-start gap-5">
        <span className="h-11 w-11 shrink-0 rounded-2xl bg-gradient-to-br from-brand-100 to-brand-50 border border-brand-200 text-brand-700 text-[15px] font-bold flex items-center justify-center leading-none">
          {number}
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-navy">{title}</h2>
          <div className="mt-2 mb-2.5 w-8 h-[2px] rounded-full bg-gradient-to-r from-brand-400 to-brand-200" />
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </div>
    </div>
  );
}

interface Props {
  unit?: Unit;
  // Dropdown rows (/projects/options): only these fields are read.
  projects: Pick<Project, 'id' | 'name' | 'city'>[];
  /** The company's unit types (F10). */
  types: UnitTypeOption[];
  locale?: Locale;
}

const AREA_SPECS = ['netArea', 'gardenArea', 'roofArea', 'terraceArea', 'landArea'] as const;

const USAGE_ORDER: UnitUsage[] = ['RESIDENTIAL', 'COMMERCIAL', 'ADMINISTRATIVE', 'MEDICAL', 'PARKING'];

export default function UnitForm({ unit, projects, types, locale = 'ar' }: Props) {
  const m = uiT(locale).pages.unitsForm;
  const unitsM = uiT(locale).pages.units;
  const usageLabels = unitsM.usageLabels;
  const specLabels = unitsM.specLabels;
  const ENUM_SPECS = [
    ['finishing', unitsM.finishingLabels],
    ['view', unitsM.viewLabels],
    ['orientation', unitsM.orientationLabels],
  ] as const;
  // Switched-off types are not offered, except the one the unit already has.
  const offered = types.filter((t) => t.active || t.code === unit?.type);
  const [typeCode, setTypeCode] = useState(unit?.type ?? offered[0]?.code ?? '');
  const usage: UnitUsage = offered.find((t) => t.code === typeCode)?.usage ?? 'RESIDENTIAL';
  const action = unit ? updateUnitAction.bind(null, unit.id) : createUnitAction;
  const [state, formAction] = useActionState<UnitFormState, FormData>(action, {});

  const isEdit = Boolean(unit);
  const cancelHref = isEdit ? `/dashboard/units/${unit!.id}` : '/dashboard/units';

  const navSections = [
    { id: 'section-location',  num: '01', label: m.navLocation.label,  sub: m.navLocation.sub,  Icon: MapPin },
    { id: 'section-basic',     num: '02', label: m.navBasic.label,     sub: m.navBasic.sub,     Icon: Tag },
    { id: 'section-specs',     num: '03', label: m.navSpecs.label,     sub: m.navSpecs.sub,     Icon: Ruler },
    { id: 'section-financial', num: '04', label: m.navFinancial.label, sub: m.navFinancial.sub, Icon: DollarSign },
  ];

  return (
    <form action={formAction}>

      {/* ── Alerts ── */}
      {(state.error || state.ok) && (
        <div className="mb-5 lg:mb-6">
          {state.error && (
            <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <p className="font-medium">{state.error}</p>
            </div>
          )}
          {state.ok && (
            <div className="flex items-start gap-3 rounded-2xl bg-success-50 border border-success-100 text-success-700 p-4 text-sm">
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              <p className="font-medium">{m.saveOk}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Mobile section chips ── */}
      <nav className="lg:hidden -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto scrollbar-none pb-1 mb-4">
        <div className="flex gap-2 min-w-max">
          {navSections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-surface border border-hairline px-3 py-1.5 text-xs font-medium text-navy hover:border-brand-200 hover:text-brand-700 transition-colors whitespace-nowrap"
            >
              <span className="h-4 w-4 rounded-md bg-brand-50 flex items-center justify-center text-[9px] font-bold text-brand-600 leading-none">
                {s.num}
              </span>
              {s.label}
            </a>
          ))}
        </div>
      </nav>

      {/* ── Two-column layout ── */}
      <div className="flex flex-col lg:flex-row gap-5 lg:gap-6 items-start">

        {/* ── Sidebar nav (right in RTL) ── */}
        <aside className="hidden lg:flex flex-col gap-3 w-[272px] shrink-0 sticky top-6 self-start">
          <div className="bg-surface border border-hairline rounded-2xl shadow-soft overflow-hidden">
            {/* Gold accent stripe */}

            {/* Sidebar header */}
            <div className="px-5 py-4 border-b border-hairline flex items-center justify-between gap-2">
              <span className="text-[13px] font-bold text-navy">
                {isEdit ? m.sidebarTitleEdit : m.sidebarTitleNew}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 border border-brand-200 px-2.5 py-1 text-[11px] font-bold text-brand-700 leading-none">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-400 shrink-0" />
                {isEdit ? m.badgeEdit : m.badgeNew}
              </span>
            </div>

            {/* Section nav links */}
            <div className="px-3 py-3 flex flex-col gap-0.5">
              {navSections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="group flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-brand-50/50 transition-colors duration-150"
                >
                  <span className="h-6 w-6 shrink-0 rounded-lg bg-gradient-to-br from-brand-100 to-brand-50 border border-brand-200 flex items-center justify-center text-[10px] font-bold text-brand-700 leading-none">
                    {s.num}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-semibold text-navy truncate leading-tight">{s.label}</p>
                    <p className="text-[11px] text-slate-400 truncate leading-tight mt-0.5">{s.sub}</p>
                  </div>
                </a>
              ))}
            </div>

            {/* Info box */}
            <div className="mx-3 mb-3 rounded-xl bg-brand-50/60 border border-brand-100 p-3.5 flex gap-2.5">
              <Info className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
              <p className="text-[11.5px] text-slate-500 leading-relaxed">
                {isEdit ? m.sidebarInfoEdit : m.sidebarInfoNew}
              </p>
            </div>
          </div>
        </aside>

        {/* ── Form panels (left in RTL) ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4 lg:gap-5 pb-24">

          {/* 01 */}
          <section
            id="section-location"
            className="bg-surface border border-hairline rounded-[20px] overflow-hidden shadow-[0_1px_4px_rgb(0_0_0/_0.06)]"
          >
            <PanelHeader
              number="01"
              title={m.panelLocationTitle}
              description={m.panelLocationDesc}
            />
            <div className="px-7 sm:px-8 py-7">
              <BuildingPicker
                projects={projects}
                initialProjectId={unit?.building?.phase?.projectId}
                initialPhaseId={unit?.building?.phaseId}
                initialBuildingId={unit?.buildingId}
                locale={locale}
              />
            </div>
          </section>

          {/* 02 */}
          <section
            id="section-basic"
            className="bg-surface border border-hairline rounded-[20px] overflow-hidden shadow-[0_1px_4px_rgb(0_0_0/_0.06)]"
          >
            <PanelHeader
              number="02"
              title={m.panelBasicTitle}
              description={m.panelBasicDesc}
            />
            <div className="px-7 sm:px-8 py-7">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label={m.labelCode} name="code" hint={m.hintCode} required>
                  <Input
                    id="code"
                    name="code"
                    required
                    placeholder="A-101"
                    defaultValue={unit?.code}
                  />
                </Field>

                <Field label={m.labelType} name="type">
                  <Select id="type" name="type" value={typeCode} onChange={(e) => setTypeCode(e.target.value)}>
                    {USAGE_ORDER.filter((u) => offered.some((t) => t.usage === u)).map((u) => (
                      <optgroup key={u} label={usageLabels[u]}>
                        {offered
                          .filter((t) => t.usage === u)
                          .map((t) => (
                            <option key={t.code} value={t.code}>
                              {tx(t.name, locale) || t.code}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </Select>
                </Field>

                <Field label={m.labelFloor} name="floor" hint={m.hintFloor}>
                  <Input
                    id="floor"
                    name="floor"
                    type="number"
                    min={0}
                    defaultValue={unit?.floor ?? 0}
                  />
                </Field>
              </div>
            </div>
          </section>

          {/* 03 */}
          <section
            id="section-specs"
            className="bg-surface border border-hairline rounded-[20px] overflow-hidden shadow-[0_1px_4px_rgb(0_0_0/_0.06)]"
          >
            <PanelHeader
              number="03"
              title={m.panelSpecsTitle}
              description={m.panelSpecsDesc}
            />
            <div className="px-7 sm:px-8 py-7">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label={m.labelArea} name="area" required>
                  <Input
                    id="area"
                    name="area"
                    type="number"
                    step="any"
                    min={0}
                    required
                    placeholder="0.00"
                    defaultValue={unit?.area}
                  />
                </Field>
                {/* Only a residential unit has bedrooms. */}
                {usage === 'RESIDENTIAL' ? (
                  <Field label={m.labelBedrooms} name="bedrooms">
                    <Input
                      id="bedrooms"
                      name="bedrooms"
                      type="number"
                      min={0}
                      defaultValue={unit?.bedrooms ?? 1}
                    />
                  </Field>
                ) : (
                  <input type="hidden" name="bedrooms" value="0" />
                )}
                <Field label={m.labelBathrooms} name="bathrooms">
                  <Input
                    id="bathrooms"
                    name="bathrooms"
                    type="number"
                    min={0}
                    defaultValue={unit?.bathrooms ?? 1}
                  />
                </Field>
                {AREA_SPECS.map((f) => (
                  <Field key={f} label={`${specLabels[f] ?? f} (${m.areaUnit})`} name={f} hint={m.hintOptionalArea}>
                    <Input
                      id={f}
                      name={f}
                      type="number"
                      step="any"
                      min={0}
                      defaultValue={unit?.[f] ?? undefined}
                    />
                  </Field>
                ))}
                {ENUM_SPECS.map(([f, options]) => (
                  <Field key={f} label={specLabels[f] ?? f} name={f}>
                    <Select id={f} name={f} defaultValue={unit?.[f] ?? ''}>
                      <option value="">{m.notSet}</option>
                      {Object.entries(options).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </Select>
                  </Field>
                ))}
              </div>
            </div>
          </section>

          {/* 04 */}
          <section
            id="section-financial"
            className="bg-surface border border-hairline rounded-[20px] overflow-hidden shadow-[0_1px_4px_rgb(0_0_0/_0.06)]"
          >
            <PanelHeader
              number="04"
              title={m.panelFinancialTitle}
              description={m.panelFinancialDesc}
            />
            <div className="px-7 sm:px-8 py-7">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label={m.labelPrice} name="price" hint={m.hintPrice} required>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    step="any"
                    min={0}
                    required
                    placeholder="0"
                    defaultValue={unit?.price as number | undefined}
                  />
                </Field>
                {/* A unit is sold by a contract and reserved by a reservation,
                    never by hand: a new unit is for sale, and an existing one
                    can only be put back on sale (when no deal holds it). */}
                {unit ? (
                  <>
                    <Field label={m.labelStatus} name="status" hint={m.hintStatusFromDeals}>
                      <Select id="status" name="status" defaultValue={unit.status}>
                        <option value="AVAILABLE">{m.optionAvailable}</option>
                        {unit.status === 'RESERVED' && <option value="RESERVED">{m.optionReserved}</option>}
                        {unit.status === 'SOLD' && <option value="SOLD">{m.optionSold}</option>}
                      </Select>
                    </Field>
                    <Field label={m.labelStatusReason} name="statusReason">
                      <Input id="statusReason" name="statusReason" placeholder={m.placeholderStatusReason} />
                    </Field>
                  </>
                ) : (
                  <input type="hidden" name="status" value="AVAILABLE" />
                )}
              </div>
            </div>
          </section>

        </div>
      </div>

      <FormFooter
        sticky
        primary={
          <>
            <Link href={cancelHref as never}>
              <Button type="button" variant="ghost" leftIcon={<X className="h-4 w-4" />}>
                {m.cancelBtn}
              </Button>
            </Link>
            <SubmitButton>{isEdit ? m.submitEdit : m.submitNew}</SubmitButton>
          </>
        }
        helper={isEdit ? m.footerHelperEdit : m.footerHelperNew}
      />
    </form>
  );
}
