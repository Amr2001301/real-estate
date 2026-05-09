import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  name: string;
  label: string;
  defaultValueAr?: string;
  defaultValueEn?: string;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
}

/**
 * Pair of inputs for a Translatable field. The form action receives
 * `${name}_ar` and `${name}_en` and assembles `{ ar, en }` server-side.
 */
export function TranslatableInput({
  name,
  label,
  defaultValueAr,
  defaultValueEn,
  required,
  multiline,
  rows = 3,
}: Props) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-slate-700 mb-1">
        {label}
        {required && <span className="text-danger-600 ms-0.5">*</span>}
      </legend>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-2xs font-medium uppercase tracking-wide text-slate-500" htmlFor={`${name}_ar`}>
            بالعربية
          </label>
          {multiline ? (
            <Textarea
              id={`${name}_ar`}
              name={`${name}_ar`}
              dir="rtl"
              defaultValue={defaultValueAr}
              required={required}
              rows={rows}
            />
          ) : (
            <Input
              id={`${name}_ar`}
              name={`${name}_ar`}
              dir="rtl"
              defaultValue={defaultValueAr}
              required={required}
            />
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-2xs font-medium uppercase tracking-wide text-slate-500" htmlFor={`${name}_en`}>
            English
          </label>
          {multiline ? (
            <Textarea
              id={`${name}_en`}
              name={`${name}_en`}
              dir="ltr"
              defaultValue={defaultValueEn}
              required={required}
              rows={rows}
            />
          ) : (
            <Input
              id={`${name}_en`}
              name={`${name}_en`}
              dir="ltr"
              defaultValue={defaultValueEn}
              required={required}
            />
          )}
        </div>
      </div>
    </fieldset>
  );
}
