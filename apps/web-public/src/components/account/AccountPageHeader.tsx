import { SectionHeading } from '@/components/ui/Section';

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
 * e2e level-1 assertions). No eyebrow kicker (deliberately removed for a
 * cleaner two-line header).
 */
export function AccountPageHeader({ title, description, actions }: AccountPageHeaderProps) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <SectionHeading as="h1" title={title} description={description} />
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}
