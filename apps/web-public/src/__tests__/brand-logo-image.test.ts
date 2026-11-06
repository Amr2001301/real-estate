/**
 * The company's logo comes from object storage (any host) — never through the
 * image optimizer, which rejects hosts that are not configured and made every
 * page of a company that had uploaded a logo fail (QA run 1, F-008).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');

describe('brand logo <Image>', () => {
  it.each(['components/layout/Navbar.tsx', 'components/layout/Footer.tsx'])('%s uses unoptimized', (file) => {
    const src = read(file);
    const block = /<Image[\s\S]*?\/>/.exec(src)?.[0] ?? '';
    expect(block).toMatch(/unoptimized/);
  });
});
