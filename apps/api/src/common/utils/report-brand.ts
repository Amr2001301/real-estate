/**
 * The company identity printed on generated report files (PDF / XLSX): the
 * tenant's name, logo and colours — not the platform's. Built by
 * ReportBrandService (company-branding module); the pure PDF/XLSX helpers
 * only read this shape.
 */
export interface ReportBrand {
  /** Display name (falls back to the legal name). */
  name: string;
  /** #RRGGBB — header band / headings. */
  primary: string;
  /** #RRGGBB — rules and highlights. */
  accent: string;
  /** PNG/JPEG only (what PDFKit and ExcelJS embed); null → monogram. */
  logo: { buffer: Buffer; extension: 'png' | 'jpeg' } | null;
  registrationNumber?: string;
  contactPhone?: string;
  contactEmail?: string;
  /** ISO 4217 — every amount in the file is in it. */
  currency: string;
  /** IANA zone — every date/time in the file is in it (server-local without one). */
  timezone?: string;
}

export const DEFAULT_PRIMARY = '#0F1E33';
export const DEFAULT_ACCENT = '#C8A24B';

/** A neutral identity for files generated outside a company context. */
export function fallbackBrand(currency = 'EGP'): ReportBrand {
  return { name: '', primary: DEFAULT_PRIMARY, accent: DEFAULT_ACCENT, logo: null, currency };
}

/** PNG / JPEG by magic bytes; anything else (SVG, WebP…) is not embeddable. */
export function imageExtension(buf: Buffer): 'png' | 'jpeg' | null {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  return null;
}

/** Up to two initials for the monogram shown when there is no usable logo. */
export function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const [first = '', second = ''] = words;
  return (second ? first.charAt(0) + second.charAt(0) : first.slice(0, 2)).toUpperCase();
}

/** "#0F1E33" → "FF0F1E33" (ExcelJS ARGB). Invalid input → the default navy. */
export function argb(hex: string | undefined): string {
  const h = (hex ?? '').replace('#', '');
  return /^[0-9a-fA-F]{6}$/.test(h) ? `FF${h.toUpperCase()}` : `FF${DEFAULT_PRIMARY.slice(1)}`;
}

/** Pixel size of a PNG / JPEG from its header (no decoding); null if unknown. */
export function imageSize(buf: Buffer): { width: number; height: number } | null {
  if (imageExtension(buf) === 'png' && buf.length >= 24) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (imageExtension(buf) === 'jpeg') {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1]!;
      const len = buf.readUInt16BE(i + 2);
      // SOF0..SOF15 except DHT (C4), JPG (C8), DAC (CC) carry the frame size.
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
      }
      i += 2 + len;
    }
  }
  return null;
}

/** Fit an image into a box, keeping its aspect ratio. */
export function fitInto(
  size: { width: number; height: number } | null,
  box: { width: number; height: number },
): { width: number; height: number } {
  if (!size || !size.width || !size.height) return box;
  const scale = Math.min(box.width / size.width, box.height / size.height);
  return { width: Math.round(size.width * scale), height: Math.round(size.height * scale) };
}
