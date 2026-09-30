import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:4000';

/**
 * Authenticated proxy for the data-import endpoints (multipart/form-data POST).
 * Only two targets are allowed: 'preview' and 'import'.
 *
 * The export route (/api/export) handles GET binary responses. This route handles
 * POST multipart uploads and returns JSON — kept separate so the two concerns
 * don't share a handler.
 *
 * Auth: reads the httpOnly access_token cookie (same pattern as /api/export).
 * SSRF defence: target is constrained to a two-item allowlist; never interpolated
 * from user-supplied arbitrary strings.
 */
const ALLOWED_TARGETS = new Set(['preview', 'import'] as const);
type AllowedTarget = 'preview' | 'import';

export async function POST(req: NextRequest) {
  const target = req.nextUrl.searchParams.get('target');
  if (!target || !ALLOWED_TARGETS.has(target as AllowedTarget)) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const c = await cookies();
  const token = c.get('access_token')?.value;
  if (!token) return new NextResponse('Unauthorized', { status: 401 });

  // Forward the multipart body verbatim; fetch sets Content-Type + boundary automatically
  // when given a FormData object — do NOT set Content-Type manually or the boundary is lost.
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return new NextResponse('Bad Request: expected multipart/form-data', { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE}/v1/data-import/${target}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    } as RequestInit);
  } catch (e) {
    const msg = (e as Error).message ?? '';
    return new NextResponse(
      JSON.stringify({ message: `لا يمكن الوصول إلى الـ API — ${msg}` }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Surface the upstream JSON (plan summary on 200, error detail on 4xx/5xx)
  let json: unknown;
  try {
    json = await upstream.json();
  } catch {
    return new NextResponse('Bad Gateway: upstream returned non-JSON', { status: 502 });
  }

  return NextResponse.json(json, { status: upstream.status });
}
