/**
 * The company's own paper form, filled in (a copy of the dashboard's renderer:
 * the two apps share no components). Sizes are relative to the page, so it
 * reads the same on a phone as on A4. The customer's signature box is marked
 * for them to see where their signature goes.
 */

export interface SignFormField {
  id: string;
  key: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  size: number;
  align: 'start' | 'center' | 'end';
  bold?: boolean;
  text?: string;
  image?: string | null;
}

const PT_CQW = (0.3528 / 210) * 100;
const PAGE = { w: 210, h: 297 };

/** As the dashboard's fitFontSize: smaller when the text is too long for its box. */
function fitFontSize(f: Pick<SignFormField, 'w' | 'h' | 'size'>, text: string): number {
  const PT_PER_MM = 72 / 25.4;
  const byWidth = (f.w * PAGE.w * PT_PER_MM) / Math.max(1, text.length * 0.55);
  const byHeight = (f.h * PAGE.h * PT_PER_MM) / 1.2;
  return Math.max(5, Math.min(f.size, byWidth, byHeight));
}

export function FormOverlay({
  pages,
  fields,
  signHereLabel,
  signature,
}: {
  pages: { imageUrl: string }[];
  fields: SignFormField[];
  signHereLabel: string;
  /** The customer's signature once drawn, shown in its box. */
  signature?: string | null;
}) {
  return (
    <div className="flex flex-col gap-4" data-testid="sign-form">
      {pages.map((p, i) => (
        <div
          key={i}
          className="relative w-full overflow-hidden rounded-lg bg-white shadow ring-1 ring-hairline [container-type:inline-size]"
          style={{ aspectRatio: '210 / 297' }}
          dir="rtl"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.imageUrl} alt="" className="absolute inset-0 h-full w-full object-fill" />
          {fields
            .filter((f) => f.page === i)
            .map((f) => (
              <div
                key={f.id}
                className="absolute flex overflow-hidden"
                style={{
                  left: `${f.x * 100}%`,
                  top: `${f.y * 100}%`,
                  width: `${f.w * 100}%`,
                  height: `${f.h * 100}%`,
                  alignItems: 'center',
                  justifyContent: f.align === 'center' ? 'center' : f.align === 'end' ? 'flex-end' : 'flex-start',
                }}
              >
                {f.key === 'sign.customer' ? (
                  signature ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={signature} alt="" className="h-full w-full object-contain mix-blend-multiply" />
                  ) : (
                    <span
                      className="flex h-full w-full items-center justify-center rounded border-2 border-dashed border-gold-500 bg-gold-50/70 font-bold text-gold-600"
                      style={{ fontSize: `${9 * PT_CQW}cqw` }}
                    >
                      {signHereLabel}
                    </span>
                  )
                ) : f.image !== undefined ? null : (
                  <span
                    dir="auto"
                    className="w-full whitespace-nowrap leading-[1.2] text-[#111827]"
                    style={{ fontSize: `${fitFontSize(f, f.text ?? '') * PT_CQW}cqw`, fontWeight: f.bold ? 700 : 500, textAlign: f.align }}
                  >
                    {f.text}
                  </span>
                )}
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}
