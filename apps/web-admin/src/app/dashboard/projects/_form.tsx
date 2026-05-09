'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { TranslatableInput } from '@/components/form/translatable-input';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { FormSection } from '@/components/ui/form-section';
import { FormFooter } from '@/components/ui/form-footer';
import { ServiceTilePicker } from '@/components/projects/service-tile-picker';
import { MapPreview } from '@/components/projects/map-preview';
import type { Project } from '@/lib/types';
import {
  createProjectAction,
  updateProjectAction,
  type ProjectFormState,
} from './actions';

interface Props {
  project?: Project;
}

export default function ProjectForm({ project }: Props) {
  const action = project
    ? updateProjectAction.bind(null, project.id)
    : createProjectAction;
  const [state, formAction] = useActionState<ProjectFormState, FormData>(action, {});

  const isEdit = Boolean(project);
  const cancelHref = isEdit
    ? `/dashboard/projects/${project!.id}`
    : '/dashboard/projects';

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
        title="المعلومات الأساسية"
        description="الاسم التجاري والتعريف العام للمشروع العقاري."
      >
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="حالة المشروع" name="status">
            <Select
              id="status"
              name="status"
              defaultValue={project?.status ?? 'DRAFT'}
            >
              <option value="DRAFT">مسودة</option>
              <option value="PUBLISHED">منشور</option>
              <option value="ARCHIVED">مؤرشف</option>
            </Select>
          </Field>

          <Field label="مشروع مميز" name="featured" hint="يظهر في القائمة المميزة">
            <label className="flex items-center gap-2.5 h-10 cursor-pointer select-none">
              <Checkbox
                id="featured"
                name="featured"
                defaultChecked={project?.featured}
              />
              <span className="text-sm text-slate-700">
                إبراز المشروع في الواجهات الرئيسية
              </span>
            </label>
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="الموقع الجغرافي"
        description="تحديد إحداثيات المشروع والعنوان التفصيلي."
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="المدينة" name="city" required>
            <Input
              id="city"
              name="city"
              required
              defaultValue={project?.city}
            />
          </Field>
          <Field label="خط العرض (Lat)" name="lat" hint="-90 → 90" required>
            <Input
              id="lat"
              name="lat"
              type="number"
              step="any"
              required
              defaultValue={project?.lat}
            />
          </Field>
          <Field label="خط الطول (Lng)" name="lng" hint="-180 → 180" required>
            <Input
              id="lng"
              name="lng"
              type="number"
              step="any"
              required
              defaultValue={project?.lng}
            />
          </Field>
        </div>
        {project && (
          <MapPreview
            lat={project.lat}
            lng={project.lng}
            city={project.city}
            height="md"
          />
        )}
      </FormSection>

      <FormSection
        title="المرافق والخدمات"
        description="اختر المزايا التي تجعل المشروع استثنائياً. يمكنك إضافة خدمة مخصصة في الأسفل."
      >
        <ServiceTilePicker name="services" defaultValue={project?.services ?? []} />
      </FormSection>

      <FormSection
        title="الوسائط المتعددة"
        description="إرفاق الصور والمخططات الهندسية وجولات افتراضية."
      >
        {isEdit ? (
          <p className="text-xs text-slate-500">
            يمكنك إدارة الوسائط من صفحة تفاصيل المشروع.{' '}
            <Link
              href={`/dashboard/projects/${project!.id}` as never}
              className="font-semibold text-brand-700 hover:text-brand-800"
            >
              فتح مكتبة الوسائط
            </Link>
          </p>
        ) : (
          <div className="rounded-2xl border border-dashed border-hairline bg-info-50/40 px-4 py-8 text-center">
            <p className="text-sm font-medium text-slate-700">
              ستتمكن من إرفاق الصور والمخططات بعد إنشاء المشروع
            </p>
            <p className="mt-1 text-xs text-slate-500">
              سيتم توجيهك مباشرة إلى صفحة المشروع لرفع الوسائط.
            </p>
          </div>
        )}
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
            <SubmitButton>
              {isEdit ? 'حفظ التغييرات' : 'حفظ ونشر المشروع'}
            </SubmitButton>
          </>
        }
        helper={isEdit ? 'سيتم تحديث البيانات فور الحفظ.' : 'سيتم إنشاء المشروع كمسودة بشكل افتراضي.'}
      />
    </form>
  );
}
