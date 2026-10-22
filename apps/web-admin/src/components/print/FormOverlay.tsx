import { PAPER, type FilledField, type PaperSize } from '@/lib/form-layout';

/**
 * The company's own form: each page with its values written where the
 * company placed them. Sizes are relative to the page, so it reads the same
 * on paper, a screen or a phone.
 */
export function FormOverlay({
  pages,
  fields,
  paperSize = 'A4',
  className,
  style,
  pageClassName,
}: {
  pages: { imageUrl: string }[];
  fields: FilledField[];
  paperSize?: PaperSize;
  className?: string;
  style?: React.CSSProperties;
  pageClassName?: string;
}) {
  const paper = PAPER[paperSize] ?? PAPER.A4;
  // 1 pt as a share of the page's width, in container-width units.
  const ptCqw = (0.3528 / paper.w) * 100;
  return (
    <div className={className} style={style} data-testid="form-overlay">
      {pages.map((p, i) => (
        <div
          key={i}
          className={`relative w-full overflow-hidden bg-white [container-type:inline-size] ${pageClassName ?? ''}`}
          style={{ aspectRatio: `${paper.w} / ${paper.h}` }}
          dir="rtl"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.imageUrl} alt="" className="absolute inset-0 h-full w-full object-fill" />
          {fields
            .filter((f) => f.page === i)
            .map((f) => (
              <div
                key={f.id}
                data-field={f.key}
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
                {f.image !== undefined ? (
                  f.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.image} alt="" className="h-full w-full object-contain mix-blend-multiply" />
                  ) : null
                ) : (
                  <span
                    dir="auto"
                    className="w-full leading-[1.25] text-[#111827]"
                    style={{
                      fontSize: `${f.size * ptCqw}cqw`,
                      fontWeight: f.bold ? 700 : 500,
                      textAlign: f.align,
                    }}
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
