import { cn } from '@/lib/cn';

/**
 * A company's plain-text body (a CMS page) as an editorial column: the first
 * paragraph as a lead, a short line on its own with no closing punctuation
 * read as a heading, the rest as paragraphs.
 */
export function RichText({ body, className }: { body: string; className?: string }) {
  const blocks = (body ?? '').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className={cn('space-y-5 text-[17px] leading-[2] text-ink', className)} data-testid="cms-page-body">
      {blocks.map((block, i) => {
        const [first, ...rest] = block.split('\n');
        const isHeading = first!.length <= 48 && !/[.،؟?!:؛]$/.test(first!.trim()) && (rest.length > 0 || i > 0);
        if (i === 0 && !isHeading) {
          return <p key={i} className="font-display text-[1.3rem] font-medium leading-[1.9] text-ink-strong">{block}</p>;
        }
        if (isHeading) {
          return (
            <div key={i} className="pt-4">
              <h2 className="flex items-center gap-3 font-display text-[1.5rem] font-semibold text-ink-strong">
                <span className="h-0.5 w-6 rounded-full bg-gold-400" aria-hidden />
                {first}
              </h2>
              {rest.length > 0 && <p className="mt-3 whitespace-pre-line text-ink-muted">{rest.join('\n')}</p>}
            </div>
          );
        }
        return <p key={i} className="whitespace-pre-line text-ink-muted">{block}</p>;
      })}
    </div>
  );
}
