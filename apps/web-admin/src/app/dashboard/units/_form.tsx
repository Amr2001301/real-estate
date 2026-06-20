'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { AlertCircle, CheckCircle2, X, MapPin, Tag, Ruler, DollarSign, Info } from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';
import { BuildingPicker } from './_building-picker';
import type { Project, Unit } from '@/lib/types';
import { createUnitAction, updateUnitAction, type UnitFormState } from './actions';

const NAV_SECTIONS = [
  { id: 'section-location', num: '01', label: 'الموقع داخل المشروع', sub: 'المشروع والمرحلة والمبنى', Icon: MapPin },
  { id: 'section-basic', num: '02', label: 'المعلومات الأساسية', sub: 'الكود والنوع والطابق', Icon: Tag },
  { id: 'section-specs', num: '03', label: 'المواصفات الفنية', sub: 'المساحة والغرف ودورات المياه', Icon: Ruler },
  { id: 'section-financial', num: '04', label: 'التفاصيل المالية والحالة', sub: 'السعر والحالة', Icon: DollarSign },
];

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
  projects: Project[];
}

const UNIT_TYPES = ['Studio', '1BR', '2BR', '3BR', '4BR', 'Villa', 'Duplex', 'Penthouse'];

export default function UnitForm({ unit, projects }: Props) {
  const action = unit ? updateUnitAction.bind(null, unit.id) : createUnitAction;
  const [state, formAction] = useActionState<UnitFormState, FormData>(action, {});

  const isEdit = Boolean(unit);
  const cancelHref = isEdit ? `/dashboard/units/${unit!.id}` : '/dashboard/units';

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
              <p className="font-medium">تم حفظ التغييرات بنجاح</p>
            </div>
          )}
        </div>
      )}

      {/* ── Mobile section chips ── */}
      <nav className="lg:hidden -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto scrollbar-none pb-1 mb-4">
        <div className="flex gap-2 min-w-max">
          {NAV_SECTIONS.map((s) => (
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
            <div className="h-[2px] bg-gradient-to-r from-brand-200 via-brand-500 to-brand-200" />

            {/* Sidebar header */}
            <div className="px-5 py-4 border-b border-hairline flex items-center justify-between gap-2">
              <span className="text-[13px] font-bold text-navy">
                {isEdit ? 'تعديل الوحدة' : 'ملخص الإنشاء'}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 border border-brand-200 px-2.5 py-1 text-[11px] font-bold text-brand-700 leading-none">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-400 shrink-0" />
                {isEdit ? 'تعديل' : 'جديد'}
              </span>
            </div>

            {/* Section nav links */}
            <div className="px-3 py-3 flex flex-col gap-0.5">
              {NAV_SECTIONS.map((s) => (
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
                {isEdit
                  ? 'سيتم تحديث بيانات الوحدة فور الحفظ.'
                  : 'بعد الإنشاء سيتم توجيهك إلى صفحة الوحدة لإضافة الوسائط.'}
              </p>
            </div>
          </div>
        </aside>

        {/* ── Form panels (left in RTL) ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4 lg:gap-5 pb-24">

          {/* 01 — الموقع داخل المشروع */}
          <section
            id="section-location"
            className="bg-surface border border-hairline rounded-[20px] overflow-hidden shadow-[0_1px_4px_rgb(0_0_0/_0.06)]"
          >
            <PanelHeader
              number="01"
              title="الموقع داخل المشروع"
              description="حدّد المشروع، ثم المرحلة، ثم المبنى الذي تنتمي إليه الوحدة."
            />
            <div className="px-7 sm:px-8 py-7">
              <BuildingPicker
                projects={projects}
                initialProjectId={unit?.building?.phase?.projectId}
                initialPhaseId={unit?.building?.phaseId}
                initialBuildingId={unit?.buildingId}
              />
            </div>
          </section>

          {/* 02 — المعلومات الأساسية */}
          <section
            id="section-basic"
            className="bg-surface border border-hairline rounded-[20px] overflow-hidden shadow-[0_1px_4px_rgb(0_0_0/_0.06)]"
          >
            <PanelHeader
              number="02"
              title="المعلومات الأساسية"
              description="رمز التعريف ونوع الوحدة والطابق."
            />
            <div className="px-7 sm:px-8 py-7">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="كود الوحدة" name="code" hint="مثال: A-101" required>
                  <Input
                    id="code"
                    name="code"
                    required
                    placeholder="A-101"
                    defaultValue={unit?.code}
                  />
                </Field>

                <Field label="نوع الوحدة" name="type">
                  <Select id="type" name="type" defaultValue={unit?.type ?? '1BR'}>
                    {UNIT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="الطابق" name="floor" hint="0 يعني الطابق الأرضي">
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

          {/* 03 — المواصفات الفنية */}
          <section
            id="section-specs"
            className="bg-surface border border-hairline rounded-[20px] overflow-hidden shadow-[0_1px_4px_rgb(0_0_0/_0.06)]"
          >
            <PanelHeader
              number="03"
              title="المواصفات الفنية"
              description="المساحة وتوزيع الغرف ودورات المياه."
            />
            <div className="px-7 sm:px-8 py-7">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="المساحة (م²)" name="area" required>
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
                <Field label="غرف النوم" name="bedrooms">
                  <Input
                    id="bedrooms"
                    name="bedrooms"
                    type="number"
                    min={0}
                    defaultValue={unit?.bedrooms ?? 1}
                  />
                </Field>
                <Field label="دورات المياه" name="bathrooms">
                  <Input
                    id="bathrooms"
                    name="bathrooms"
                    type="number"
                    min={0}
                    defaultValue={unit?.bathrooms ?? 1}
                  />
                </Field>
              </div>
            </div>
          </section>

          {/* 04 — التفاصيل المالية والحالة */}
          <section
            id="section-financial"
            className="bg-surface border border-hairline rounded-[20px] overflow-hidden shadow-[0_1px_4px_rgb(0_0_0/_0.06)]"
          >
            <PanelHeader
              number="04"
              title="التفاصيل المالية والحالة"
              description="السعر الإجمالي وحالة الوحدة الحالية في النظام."
            />
            <div className="px-7 sm:px-8 py-7">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="السعر الإجمالي" name="price" hint="بالعملة الافتراضية للنظام" required>
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
                <Field label="حالة الوحدة" name="status">
                  <Select id="status" name="status" defaultValue={unit?.status ?? 'AVAILABLE'}>
                    <option value="AVAILABLE">متاحة</option>
                    <option value="RESERVED">محجوزة</option>
                    <option value="SOLD">مباعة</option>
                  </Select>
                </Field>
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
                إلغاء
              </Button>
            </Link>
            <SubmitButton>{isEdit ? 'حفظ التغييرات' : 'إنشاء الوحدة'}</SubmitButton>
          </>
        }
        helper={
          isEdit
            ? 'سيتم تحديث بيانات الوحدة فور الحفظ.'
            : 'بعد الإنشاء سيتم توجيهك إلى صفحة الوحدة لإضافة الوسائط.'
        }
      />
    </form>
  );
}
