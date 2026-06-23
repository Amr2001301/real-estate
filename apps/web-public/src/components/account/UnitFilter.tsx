'use client';

import { useRouter } from 'next/navigation';

export interface UnitOption {
  contractId: string;
  label: string;
}

interface Props {
  options: UnitOption[];
  activeContractId?: string;
  activeStatus?: string;
}

export function UnitFilter({ options, activeContractId, activeStatus }: Props) {
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const contractId = e.target.value;
    const params = new URLSearchParams();
    if (activeStatus) params.set('status', activeStatus);
    if (contractId) params.set('contractId', contractId);
    const q = params.toString();
    router.push(q ? `/account/installments?${q}` : '/account/installments');
  }

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="unit-filter"
        className="shrink-0 text-xs font-bold text-ink-muted"
      >
        الوحدة:
      </label>
      <select
        id="unit-filter"
        value={activeContractId ?? ''}
        onChange={handleChange}
        dir="rtl"
        className="h-9 w-full rounded-xl border border-hairline bg-surface px-3 text-sm font-semibold text-ink-strong shadow-sm transition-colors hover:border-gold-300/80 focus:border-gold-300 focus:outline-none focus:ring-2 focus:ring-gold-200/50 lg:w-[340px]"
        aria-label="تصفية حسب الوحدة"
      >
        <option value="">كل الوحدات</option>
        {options.map((opt) => (
          <option key={opt.contractId} value={opt.contractId}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
