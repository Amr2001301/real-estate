/**
 * The company's logo comes from object storage (any host) — never through the
 * image optimizer, which rejects hosts that are not configured and made every
 * page of a company that had uploaded a logo fail (QA run 1, F-008).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');

describe('brand logo <Image>', () => {
  // Both the header and the footer draw the mark through CompanyMark.
  it('every <Image> of the company mark uses unoptimized', () => {
    const src = read('components/layout/CompanyMark.tsx');
    const blocks = src.match(/<Image[\s\S]*?\/>/g) ?? [];
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) expect(block).toMatch(/unoptimized/);
  });

  it.each(['components/layout/Navbar.tsx', 'components/layout/Footer.tsx'])('%s draws the mark with CompanyMark, not its own <Image>', (file) => {
    const src = read(file);
    expect(src).toContain('<CompanyMark');
    expect(src).not.toMatch(/<Image/);
  });
});
