'use client';

import { useActionState } from 'react';
import { Field, inputClass } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
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

  return (
    <form action={formAction} className="space-y-5 max-w-3xl">
      <BuildingPicker projects={projects} initialBuildingId={unit?.buildingId} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="رمز الوحدة" name="code" hint="مثال: A-101">
          <input
            id="code"
            name="code"
            required
            defaultValue={unit?.code}
            className={inputClass}
          />
        </Field>

        <Field label="النوع" name="type">
          <select
            id="type"
            name="type"
            defaultValue={unit?.type ?? '1BR'}
            className={inputClass}
          >
            {UNIT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>

        <Field label="الطابق" name="floor">
          <input
            id="floor"
            name="floor"
            type="number"
            min={0}
            defaultValue={unit?.floor ?? 0}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Field label="المساحة (م²)" name="area">
          <input
            id="area"
            name="area"
            type="number"
            step="any"
            min={0}
            required
            defaultValue={unit?.area}
            className={inputClass}
          />
        </Field>
        <Field label="غرف النوم" name="bedrooms">
          <input
            id="bedrooms"
            name="bedrooms"
            type="number"
            min={0}
            defaultValue={unit?.bedrooms ?? 1}
            className={inputClass}
          />
        </Field>
        <Field label="الحمامات" name="bathrooms">
          <input
            id="bathrooms"
            name="bathrooms"
            type="number"
            min={0}
            defaultValue={unit?.bathrooms ?? 1}
            className={inputClass}
          />
        </Field>
        <Field label="السعر" name="price">
          <input
            id="price"
            name="price"
            type="number"
            step="any"
            min={0}
            required
            defaultValue={unit?.price as number | undefined}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="الحالة" name="status">
        <select
          id="status"
          name="status"
          defaultValue={unit?.status ?? 'AVAILABLE'}
          className={inputClass}
        >
          <option value="AVAILABLE">متاحة</option>
          <option value="RESERVED">محجوزة</option>
          <option value="SOLD">مباعة</option>
        </select>
      </Field>

      {state.error && (
        <div className="rounded-lg bg-red-50 text-red-700 p-3 text-sm">{state.error}</div>
      )}
      {state.ok && (
        <div className="rounded-lg bg-green-50 text-green-700 p-3 text-sm">تم الحفظ بنجاح</div>
      )}

      <SubmitButton>{unit ? 'حفظ التغييرات' : 'إنشاء الوحدة'}</SubmitButton>
    </form>
  );
}
