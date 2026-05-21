import { NextRequest, NextResponse } from 'next/server';
import { api, safe } from '@/lib/api';

export interface PlanOption {
  id: string;
  name: string;
  reservationAmount: string;
  downPaymentAmount: string;
  durationOptions: Array<{
    id: string;
    durationMonths: number;
    increasePercentage: string;
  }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Broker reservation form helper: returns the active booking plans for a unit
 * (scoped to the authenticated broker by the API's BrokerScopeGuard) so the
 * form can show the booking amount before submitting. Auth flows through the
 * server-side `api` helper, which attaches the broker's bearer token.
 */
export async function GET(req: NextRequest) {
  const unitId = req.nextUrl.searchParams.get('unitId');
  if (!unitId || !UUID_RE.test(unitId)) {
    return NextResponse.json({ data: [] });
  }

  const r = await safe(
    api.get<PlanOption[]>(`/portal/reservations/plan-options?unitId=${unitId}`),
  );
  if (r.error) {
    return NextResponse.json({ error: r.error }, { status: 502 });
  }
  return NextResponse.json({ data: r.data ?? [] });
}
