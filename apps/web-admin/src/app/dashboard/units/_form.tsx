'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { FormSection } from '@/components/ui/form-section';
import { FormFooter } from '@/components/ui/form-footer';
import { BuildingPicker } from './_building-picker';
import type { Project, Unit } from '@/lib/types';
import { createUnitAction, updateUnitAction, type UnitFormState } from './actions';

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
    <form action={formAction} className="flex flex-col gap-6 lg:gap-8">
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

      <FormSection
        title="الموقع داخل المشروع"
        description="حدّد المشروع، ثم المرحلة، ثم المبنى الذي تنتمي إليه الوحدة."
      >
        <BuildingPicker projects={projects} initialBuildingId={unit?.buildingId} />
      </FormSection>

      <FormSection
        title="المعلومات الأساسية"
        description="رمز التعريف ونوع الوحدة والطابق."
      >
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
      </FormSection>

      <FormSection
        title="المواصفات الفنية"
        description="المساحة وتوزيع الغرف ودورات المياه."
      >
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
      </FormSection>

      <FormSection
        title="التفاصيل المالية والحالة"
        description="السعر الإجمالي وحالة الوحدة الحالية في النظام."
      >
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
      </FormSection>

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
