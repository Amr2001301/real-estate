import qrcode from 'qrcode-generator';

/** A scannable QR code as SVG (server or client); TFA1 — the authenticator app's setup link. */
export function QrCode({ value, size = 176, label }: { value: string; size?: number; label: string }) {
  const qr = qrcode(0, 'M');
  qr.addData(value);
  qr.make();
  const count = qr.getModuleCount();
  const margin = 4;
  const dim = count + margin * 2;
  let path = '';
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) path += `M${col + margin} ${row + margin}h1v1h-1z`;
    }
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${dim} ${dim}`} shapeRendering="crispEdges" role="img" aria-label={label} className="rounded-lg">
      <rect width={dim} height={dim} fill="#ffffff" />
      <path d={path} fill="#0F1E33" />
    </svg>
  );
}
