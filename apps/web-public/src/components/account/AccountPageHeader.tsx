interface AccountPageHeaderProps {
  title: string;
  description?: React.ReactNode;
  /** Optional actions (buttons) aligned to the end of the header row. */
  actions?: React.ReactNode;
}

/**
 * Shared editorial header for every inner account page — a bold title +
 * one-line description, so the whole portal reads as one site instead of a set
 * of plain CRUD screens. Renders the title as the page's single h1 (matches the
 * e2e level-1 assertions). The header block is isolated from the content below
 * with mb-10, and the title→subtitle gap is a clean gap-2.
 */
export function AccountPageHeader({ title, description, actions }: AccountPageHeaderProps) {
  return (
    <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex max-w-2xl flex-col gap-2">
        <h1 className="text-2xl font-black tracking-tight text-ink-strong md:text-3xl">{title}</h1>
        {description && <p className="text-xs font-medium leading-relaxed text-ink-muted md:text-sm">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}
