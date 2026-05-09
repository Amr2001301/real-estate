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
  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-gray-700">{label}</legend>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1" htmlFor={`${name}_ar`}>
            بالعربية
          </label>
          {multiline ? (
            <textarea
              id={`${name}_ar`}
              name={`${name}_ar`}
              dir="rtl"
              defaultValue={defaultValueAr}
              required={required}
              rows={rows}
              className={inputClass}
            />
          ) : (
            <input
              id={`${name}_ar`}
              name={`${name}_ar`}
              dir="rtl"
              defaultValue={defaultValueAr}
              required={required}
              className={inputClass}
            />
          )}
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1" htmlFor={`${name}_en`}>
            English
          </label>
          {multiline ? (
            <textarea
              id={`${name}_en`}
              name={`${name}_en`}
              dir="ltr"
              defaultValue={defaultValueEn}
              required={required}
              rows={rows}
              className={inputClass}
            />
          ) : (
            <input
              id={`${name}_en`}
              name={`${name}_en`}
              dir="ltr"
              defaultValue={defaultValueEn}
              required={required}
              className={inputClass}
            />
          )}
        </div>
      </div>
    </fieldset>
  );
}
