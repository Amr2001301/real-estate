/** The steps of an editor, numbered, so the admin knows what to do in what order. */
export function EditorGuide({ steps, testId }: { steps: readonly string[]; testId?: string }) {
  return (
    <ol data-testid={testId} className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {steps.map((s, i) => (
        <li
          key={s}
          className="flex items-start gap-2.5 rounded-2xl border border-hairline bg-surface px-4 py-3 text-[12.5px] leading-relaxed text-slate-600"
        >
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-band text-[11px] font-bold text-[#D8B66A]">
            {i + 1}
          </span>
          {s}
        </li>
      ))}
    </ol>
  );
}
