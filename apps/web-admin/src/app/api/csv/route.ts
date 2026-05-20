import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:4000';

// Whitelist the CSV endpoints we proxy. The path is the API path minus /v1;
// brokerId is inlined via the [a-f0-9-]{36} pattern so the regex still rejects
// arbitrary path segments.
const ALLOWED = [
  /^\/broker-reports\/export\/summary\.csv$/,
  /^\/broker-reports\/export\/top-brokers\.csv$/,
  /^\/broker-reports\/export\/broker\/[a-f0-9-]{36}\.csv$/,
  /^\/portal\/performance\/export\.csv$/,
  /^\/reports\/sales\/export\.csv$/,
  /^\/reports\/financial\/export\.csv$/,
  /^\/reports\/operational\/export\.csv$/,
  /^\/reports\/financial-dashboard\/export\.csv$/,
];

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path');
  if (!path || !ALLOWED.some((re) => re.test(path))) {
    return new NextResponse('Not Found', { status: 404 });
  }
  // Forward all other search params as the upstream query string.
  const upstreamQs = new URLSearchParams(req.nextUrl.searchParams);
  upstreamQs.delete('path');
  upstreamQs.delete('filename');

  const c = await cookies();
  const token = c.get('access_token')?.value;
  if (!token) return new NextResponse('Unauthorized', { status: 401 });

  const upstream = await fetch(
    `${API_BASE}/v1${path}${upstreamQs.toString() ? `?${upstreamQs.toString()}` : ''}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    },
  );

  if (!upstream.ok) {
    const text = await upstream.text();
    return new NextResponse(text || 'Export failed', { status: upstream.status });
  }

  const body = await upstream.text();
  const filename = req.nextUrl.searchParams.get('filename') ?? 'export.csv';
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename.replace(/[^\w.-]+/g, '_')}"`,
      'Cache-Control': 'no-store',
    },
  });
}
