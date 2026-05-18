'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FormSection } from '@/components/ui/form-section';
import { FormFooter } from '@/components/ui/form-footer';
import type { Broker } from '@/lib/types';
import {
  createBrokerAction,
  updateBrokerAction,
  type BrokerFormState,
} from './actions';

interface Props {
  broker?: Broker;
}

function dateInputValue(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  // ISO -> YYYY-MM-DD for <input type="date">
  return value.slice(0, 10);
}

function pctValue(value: string | number | null | undefined): string | number | undefined {
  if (value === null || value === undefined) return undefined;
  return typeof value === 'string' ? value : value;
}

export default function BrokerForm({ broker }: Props) {
  const action = broker
    ? updateBrokerAction.bind(null, broker.id)
    : createBrokerAction;
  const [state, formAction] = useActionState<BrokerFormState, FormData>(action, {});

  const isEdit = Boolean(broker);
  const cancelHref = isEdit ? `/dashboard/brokers/${broker!.id}` : '/dashboard/brokers';

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
        description="اسم الشركة التجاري ورمز التعريف الفريد."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="الاسم القانوني للشركة" name="companyName" required>
            <Input
              id="companyName"
              name="companyName"
              required
              defaultValue={broker?.companyName}
            />
          </Field>
          <Field label="الاسم التجاري" name="commercialName" hint="اختياري">
            <Input
              id="commercialName"
              name="commercialName"
              defaultValue={broker?.commercialName ?? ''}
            />
          </Field>
        </div>
        <Field
          label="رمز الوسيط"
          name="code"
          hint={
            isEdit
              ? 'يجب أن يكون فريداً. أحرف كبيرة وأرقام وشرطات فقط.'
              : 'اختياري — سيتم توليده تلقائياً من اسم الشركة إذا تُرك فارغاً.'
          }
        >
          <Input
            id="code"
            name="code"
            placeholder="مثال: RIYADH-REALTY"
            dir="ltr"
            defaultValue={broker?.code ?? ''}
          />
        </Field>
      </FormSection>

      <FormSection title="بيانات التواصل" description="معلومات الاتصال الرئيسية للوسيط.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="البريد الإلكتروني" name="email">
            <Input
              id="email"
              name="email"
              type="email"
              dir="ltr"
              defaultValue={broker?.email ?? ''}
            />
          </Field>
          <Field label="رقم الجوال" name="phone">
            <Input
              id="phone"
              name="phone"
              dir="ltr"
              defaultValue={broker?.phone ?? ''}
            />
          </Field>
          <Field label="المدينة" name="city">
            <Input id="city" name="city" defaultValue={broker?.city ?? ''} />
          </Field>
          <Field label="العنوان" name="address">
            <Input id="address" name="address" defaultValue={broker?.address ?? ''} />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="البيانات القانونية والمصرفية"
        description="ضرورية لمعالجة العقود وصرف العمولات لاحقاً."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="الرقم الضريبي" name="taxId" hint="يجب أن يكون فريداً">
            <Input
              id="taxId"
              name="taxId"
              dir="ltr"
              defaultValue={broker?.taxId ?? ''}
            />
          </Field>
          <Field label="رقم السجل التجاري" name="commercialRegistration">
            <Input
              id="commercialRegistration"
              name="commercialRegistration"
              dir="ltr"
              defaultValue={broker?.commercialRegistration ?? ''}
            />
          </Field>
          <Field label="اسم البنك" name="bankName">
            <Input
              id="bankName"
              name="bankName"
              defaultValue={broker?.bankName ?? ''}
            />
          </Field>
          <Field label="اسم صاحب الحساب" name="bankAccountName">
            <Input
              id="bankAccountName"
              name="bankAccountName"
              defaultValue={broker?.bankAccountName ?? ''}
            />
          </Field>
          <Field label="رقم الآيبان (IBAN)" name="bankIban">
            <Input
              id="bankIban"
              name="bankIban"
              dir="ltr"
              defaultValue={broker?.bankIban ?? ''}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="شروط العمولة والعقد"
        description="القيم الافتراضية للعمولات وفترة سريان عقد الوساطة."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="نسبة العمولة الافتراضية (%)"
            name="defaultCommissionPct"
            hint="0 إلى 100"
          >
            <Input
              id="defaultCommissionPct"
              name="defaultCommissionPct"
              type="number"
              min={0}
              max={100}
              step="0.01"
              defaultValue={pctValue(broker?.defaultCommissionPct)}
            />
          </Field>
          <Field label="نموذج العمولة" name="commissionModel">
            <Select
              id="commissionModel"
              name="commissionModel"
              defaultValue={broker?.commissionModel ?? 'PERCENT_OF_SALE'}
            >
              <option value="PERCENT_OF_SALE">نسبة مئوية من قيمة البيع</option>
              <option value="FIXED_PER_UNIT">مبلغ ثابت لكل وحدة</option>
              <option value="TIERED">شرائح متعددة</option>
            </Select>
          </Field>
          <Field label="تاريخ بدء العقد" name="contractStartAt">
            <Input
              id="contractStartAt"
              name="contractStartAt"
              type="date"
              defaultValue={dateInputValue(broker?.contractStartAt)}
            />
          </Field>
          <Field label="تاريخ انتهاء العقد" name="contractEndAt">
            <Input
              id="contractEndAt"
              name="contractEndAt"
              type="date"
              defaultValue={dateInputValue(broker?.contractEndAt)}
            />
          </Field>
        </div>
        <Field label="رابط ملف العقد (PDF)" name="contractPdfUrl">
          <Input
            id="contractPdfUrl"
            name="contractPdfUrl"
            type="url"
            dir="ltr"
            placeholder="https://…"
            defaultValue={broker?.contractPdfUrl ?? ''}
          />
        </Field>
      </FormSection>

      <FormSection title="ملاحظات داخلية" description="ظاهرة للإدارة فقط.">
        <Field label="ملاحظات" name="notes">
          <Textarea
            id="notes"
            name="notes"
            rows={4}
            defaultValue={broker?.notes ?? ''}
          />
        </Field>
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
            <SubmitButton>{isEdit ? 'حفظ التغييرات' : 'إضافة الوسيط'}</SubmitButton>
          </>
        }
        helper={
          isEdit
            ? 'سيتم تحديث البيانات فور الحفظ.'
            : 'سيتم إنشاء الوسيط بحالة "قيد الانضمام" بشكل افتراضي.'
        }
      />
    </form>
  );
}
