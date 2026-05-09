'use client';

import { useActionState } from 'react';
import { TranslatableInput } from '@/components/form/translatable-input';
import { Field, inputClass } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import type { Project } from '@/lib/types';
import { createProjectAction, updateProjectAction, type ProjectFormState } from './actions';

interface Props {
  project?: Project;
}

export default function ProjectForm({ project }: Props) {
  const action = project
    ? updateProjectAction.bind(null, project.id)
    : createProjectAction;
  const [state, formAction] = useActionState<ProjectFormState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-5 max-w-3xl">
      <TranslatableInput
        name="name"
        label="اسم المشروع"
        required
        defaultValueAr={project?.name?.ar}
        defaultValueEn={project?.name?.en}
      />

      <TranslatableInput
        name="description"
        label="وصف المشروع"
        multiline
        rows={4}
        defaultValueAr={project?.description?.ar}
        defaultValueEn={project?.description?.en}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="المدينة" name="city">
          <input
            id="city"
            name="city"
            required
            defaultValue={project?.city}
            className={inputClass}
          />
        </Field>
        <Field label="خط العرض (Lat)" name="lat" hint="-90 → 90">
          <input
            id="lat"
            name="lat"
            type="number"
            step="any"
            required
            defaultValue={project?.lat}
            className={inputClass}
          />
        </Field>
        <Field label="خط الطول (Lng)" name="lng" hint="-180 → 180">
          <input
            id="lng"
            name="lng"
            type="number"
            step="any"
            required
            defaultValue={project?.lng}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="الحالة" name="status">
        <select
          id="status"
          name="status"
          defaultValue={project?.status ?? 'DRAFT'}
          className={inputClass}
        >
          <option value="DRAFT">مسودة</option>
          <option value="PUBLISHED">منشور</option>
          <option value="ARCHIVED">مؤرشف</option>
        </select>
      </Field>

      <div className="flex items-center gap-2">
        <input
          id="featured"
          name="featured"
          type="checkbox"
          defaultChecked={project?.featured}
          className="h-4 w-4"
        />
        <label htmlFor="featured" className="text-sm">مشروع مميز</label>
      </div>

      <Field
        label="الخدمات والمرافق (JSON)"
        name="services"
        hint='مثال: [{"ar":"حمام سباحة","en":"Swimming Pool"}]'
      >
        <textarea
          id="services"
          name="services"
          rows={3}
          dir="ltr"
          defaultValue={
            project?.services && project.services.length > 0
              ? JSON.stringify(project.services, null, 2)
              : ''
          }
          className={`${inputClass} font-mono text-xs`}
        />
      </Field>

      {state.error && (
        <div className="rounded-lg bg-red-50 text-red-700 p-3 text-sm">{state.error}</div>
      )}
      {state.ok && (
        <div className="rounded-lg bg-green-50 text-green-700 p-3 text-sm">تم الحفظ بنجاح</div>
      )}

      <div className="flex gap-2">
        <SubmitButton>{project ? 'حفظ التغييرات' : 'إنشاء المشروع'}</SubmitButton>
      </div>
    </form>
  );
}
