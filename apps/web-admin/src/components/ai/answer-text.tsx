import { Fragment, type ReactNode } from 'react';

/**
 * The assistant's answer, rendered from the small subset of Markdown it
 * writes: paragraphs, bullet and numbered lists, pipe tables and **bold**.
 * Built as React elements — the text is never injected as HTML.
 */
export function AnswerText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!.trim();
    if (!line) {
      i++;
      continue;
    }
    if (line.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.trim().startsWith('|')) {
        const cells = lines[i]!.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      blocks.push(
        <div key={blocks.length} className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            {head && (
              <thead>
                <tr>
                  {head.map((c, k) => (
                    <th key={k} className="border-b border-hairline px-2 py-1.5 text-start font-semibold text-slate-700">
                      {inline(c)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {body.map((r, k) => (
                <tr key={k} className="border-b border-hairline last:border-0">
                  {r.map((c, j) => (
                    <td key={j} className="px-2 py-1.5 tabular-nums text-slate-800">
                      {inline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const bullet = /^([-*•]|\d+[.)])\s+/;
    if (bullet.test(line)) {
      const ordered = /^\d/.test(line);
      const items: string[] = [];
      while (i < lines.length && bullet.test(lines[i]!.trim())) {
        items.push(lines[i]!.trim().replace(bullet, ''));
        i++;
      }
      const List = ordered ? 'ol' : 'ul';
      blocks.push(
        <List key={blocks.length} className={`${ordered ? 'list-decimal' : 'list-disc'} space-y-1 ps-5`}>
          {items.map((t, k) => (
            <li key={k}>{inline(t)}</li>
          ))}
        </List>,
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !lines[i]!.trim().startsWith('|') && !bullet.test(lines[i]!.trim())) {
      para.push(lines[i]!.trim().replace(/^#{1,6}\s+/, ''));
      i++;
    }
    blocks.push(
      <p key={blocks.length}>
        {para.map((t, k) => (
          <Fragment key={k}>
            {k > 0 && <br />}
            {inline(t)}
          </Fragment>
        ))}
      </p>,
    );
  }
  return <div className="space-y-2 leading-relaxed">{blocks}</div>;
}

function inline(t: string): ReactNode {
  return t.split(/(\*\*[^*]+\*\*)/g).map((part, k) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={k} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={k}>{part}</Fragment>
    ),
  );
}
