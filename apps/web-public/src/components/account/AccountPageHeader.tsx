import { SectionHeading } from '@/components/ui/Section';

interface AccountPageHeaderProps {
  /** Small gold kicker that ties the page to its dashboard group. */
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  /** Optional actions (buttons) aligned to the end of the header row. */
  actions?: React.ReactNode;
}

/**
 * Shared editorial header for every inner account page — the gold-eyebrow +
 * bold title language of the dashboard, so the whole portal reads as one site
 * instead of a set of plain CRUD screens. Renders the title as the page's
 * single h1 (matches the e2e level-1 assertions).
 */
export function AccountPageHeader({ eyebrow, title, description, actions }: AccountPageHeaderProps) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <SectionHeading as="h1" eyebrow={eyebrow} title={title} description={description} />
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}
