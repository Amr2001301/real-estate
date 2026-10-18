import { Field, inputClass } from '@/components/form/field';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';

/**
 * Whether the contract has a late-fee clause. Left on "company setting", the
 * API takes the company's late-fee setting at this moment.
 */
export function LateFeeClauseField({ locale = 'ar' }: { locale?: Locale }) {
  const m = uiT(locale).common.lateFeeClause;
  return (
    <Field label={m.label} name="lateFeesApply" hint={m.hint}>
      <select id="lateFeesApply" name="lateFeesApply" defaultValue="" className={inputClass}>
        <option value="">{m.optionCompany}</option>
        <option value="true">{m.optionYes}</option>
        <option value="false">{m.optionNo}</option>
      </select>
    </Field>
  );
}

/** The form's choice as the API field: undefined leaves it to the company setting. */
export function lateFeesApplyFrom(formData: FormData): boolean | undefined {
  const v = String(formData.get('lateFeesApply') ?? '');
  return v === 'true' ? true : v === 'false' ? false : undefined;
}
