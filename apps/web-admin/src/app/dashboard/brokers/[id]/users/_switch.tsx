import { cn } from '@/lib/cn';

/** A checkbox drawn as a switch: posts `name=on` when on, like a plain checkbox. */
export function Switch({
  name,
  label,
  desc,
  defaultChecked,
  className,
}: {
  name: string;
  label: string;
  desc?: string;
  defaultChecked?: boolean;
  className?: string;
}) {
  return (
    <label className={cn('flex cursor-pointer select-none items-center justify-between gap-4 rounded-2xl border border-hairline px-4 py-3 transition-colors hover:border-[#C9A24E]/40', className)}>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-slate-800">{label}</span>
        {desc && <span className="mt-0.5 block text-[11.5px] text-slate-500">{desc}</span>}
      </span>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="relative h-6 w-11 shrink-0 rounded-full bg-slate-500/25 transition-colors after:absolute after:start-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-[#C9A24E] peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-[#C9A24E]/40 rtl:peer-checked:after:-translate-x-5" />
    </label>
  );
}
