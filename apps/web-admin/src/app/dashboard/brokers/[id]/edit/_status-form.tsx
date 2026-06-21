'use client';

import { useActionState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { BrokerStatusBadge } from '@/components/badges';
import type { Broker } from '@/lib/types';
import { updateBrokerStatusAction, type BrokerFormState } from '../../actions';

interface Props {
  broker: Broker;
}

export default function BrokerStatusForm({ broker }: Props) {
  const action = updateBrokerStatusAction.bind(null, broker.id);
  const [state, formAction] = useActionState<BrokerFormState, FormData>(action, {});

  return (
    <div className="bg-surface border border-hairline rounded-[20px] overflow-hidden shadow-[0_1px_4px_rgb(0_0_0/_0.06)]">
      <div className="flex items-center justify-between gap-4 border-b border-hairline bg-surface-muted/20 px-7 sm:px-8 py-5">
        <div>
          <p className="text-[14px] font-bold text-navy leading-tight">حالة الوسيط</p>
          <p className="text-[12px] text-slate-400 mt-0.5 leading-tight">
            استخدم تغيير الحالة بدلاً من الحذف. سيُسجَّل السبب في الملاحظات.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-500">الحالة الحالية:</span>
          <BrokerStatusBadge status={broker.status} />
        </div>
      </div>

      <div className="px-7 sm:px-8 py-7">
        <form action={formAction} className="flex flex-col gap-4">
          {state.error && (
            <div className="flex items-start gap-3 rounded-xl bg-danger-50 border border-danger-100 text-danger-700 p-3 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="font-medium">{state.error}</p>
            </div>
          )}
          {state.ok && (
            <div className="flex items-start gap-3 rounded-xl bg-success-50 border border-success-100 text-success-700 p-3 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="font-medium">تم تحديث الحالة</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="الحالة الجديدة" name="status" required>
              <Select id="status" name="status" defaultValue={broker.status} required>
                <option value="PENDING">قيد الانضمام</option>
                <option value="ACTIVE">نشط</option>
                <option value="SUSPENDED">موقوف</option>
                <option value="TERMINATED">منتهي</option>
              </Select>
            </Field>
          </div>
          <Field label="سبب التغيير" name="reason" hint="اختياري — سيُضاف إلى الملاحظات الداخلية مع طابع زمني">
            <Textarea id="reason" name="reason" rows={3} />
          </Field>

          <div className="flex justify-end">
            <SubmitButton>تحديث الحالة</SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}
