import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:4000';

/**
 * P15.2 — authenticated proxy for BINARY exports (styled XLSX, and PDF later).
 *
 * Unlike /api/csv (which is text-only and forces text/csv), this route reads the
 * upstream body as an ArrayBuffer and streams the raw bytes back untouched — it
 * never calls .json()/.text(), so a StreamableFile XLSX is delivered intact and
 * never serialized into a JSON cell. Content-Type is taken from the upstream
 * response; the download filename is controlled here.
 *
 * Paths are whitelisted (defence-in-depth on top of the backend's own role +
 * permission guards). Add a regex here as each phase ships its .xlsx endpoint.
 */
const ALLOWED = [
  /^\/reports\/admin-summary\/export\.xlsx$/,
  // P15.3 — simple-table XLSX twins
  /^\/reports\/operational\/export\.xlsx$/,
  /^\/bonus-entries\/export\.xlsx$/,
  /^\/broker-reports\/export\/top-brokers\.xlsx$/,
  /^\/broker-reports\/export\/broker\/[a-f0-9-]{36}\.xlsx$/,
  /^\/maintenance-requests\/reports\/summary\.xlsx$/,
  // P15.4 — board-style report XLSX
  /^\/reports\/sales\/export\.xlsx$/,
  /^\/reports\/financial\/export\.xlsx$/,
  /^\/reports\/financial-dashboard\/export\.xlsx$/,
  /^\/broker-reports\/export\/summary\.xlsx$/,
  // P15.5 — broker-portal performance (broker-scoped; firm comes from the token)
  /^\/portal\/performance\/export\.xlsx$/,
  // PDF exports — sales, financial, broker leaderboard
  /^\/reports\/sales\/export\.pdf$/,
  /^\/reports\/financial\/export\.pdf$/,
  /^\/reports\/broker-leaderboard\/export\.pdf$/,
];

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path');
  if (!path || !ALLOWED.some((re) => re.test(path))) {
    return new NextResponse('Not Found', { status: 404 });
  }

  // Forward any remaining params (filters) as the upstream query string.
  const upstreamQs = new URLSearchParams(req.nextUrl.searchParams);
  upstreamQs.delete('path');
  upstreamQs.delete('filename');

  const c = await cookies();
  const token = c.get('access_token')?.value;
  if (!token) return new NextResponse('Unauthorized', { status: 401 });

  const upstream = await fetch(
    `${API_BASE}/v1${path}${upstreamQs.toString() ? `?${upstreamQs.toString()}` : ''}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
  );

  if (!upstream.ok) {
    // Never surface the raw upstream body — a short generic message + status.
    return new NextResponse('Export failed', { status: upstream.status });
  }

  // BINARY: read raw bytes, never .json()/.text().
  const bytes = await upstream.arrayBuffer();
  const filename = (req.nextUrl.searchParams.get('filename') ?? 'export.xlsx').replace(
    /[^\w.-]+/g,
    '_',
  );
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? XLSX_MIME,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
