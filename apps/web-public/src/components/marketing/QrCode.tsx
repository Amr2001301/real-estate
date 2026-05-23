import qrcode from 'qrcode-generator';

interface QrCodeProps {
  /** The value to encode — use an absolute URL for a scannable code. */
  value: string;
  /** Rendered pixel size (square). */
  size?: number;
  className?: string;
  /** Dark-module color. */
  color?: string;
  /** Quiet-zone width in modules. The QR spec recommends 4 for reliable scans. */
  margin?: number;
}

/**
 * A real, scannable QR code rendered as a crisp SVG.
 *
 * The matrix is computed at render time with the zero-dependency
 * `qrcode-generator` encoder (no canvas / browser APIs), so this works as a
 * plain server component.
 */
export function QrCode({ value, size = 96, className, color = '#0F1E33', margin = 4 }: QrCodeProps) {
  const qr = qrcode(0, 'M');
  qr.addData(value);
  qr.make();

  const count = qr.getModuleCount();
  const dim = count + margin * 2;

  let path = '';
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) {
        path += `M${col + margin} ${row + margin}h1v1h-1z`;
      }
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${dim} ${dim}`}
      className={className}
      shapeRendering="crispEdges"
      role="img"
      aria-label="رمز QR للوصول إلى التجربة الرقمية"
    >
      <rect width={dim} height={dim} fill="#ffffff" />
      <path d={path} fill={color} />
    </svg>
  );
}
