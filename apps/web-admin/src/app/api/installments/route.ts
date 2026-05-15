import { NextRequest, NextResponse } from 'next/server';
import { api, safe } from '@/lib/api';
import type { ContractInstallmentPlan } from '@/lib/types';

export async function GET(req: NextRequest) {
  const contractId = req.nextUrl.searchParams.get('contractId');
  if (!contractId) return NextResponse.json({ data: [] });

  const r = await safe(
    api.get<ContractInstallmentPlan>(`/contracts/${contractId}/installment-plan`),
  );
  if (r.error) return NextResponse.json({ error: r.error }, { status: 502 });

  // Return only PENDING and OVERDUE installments
  const installments = (r.data?.installments ?? []).filter(
    (i) => i.status === 'PENDING' || i.status === 'OVERDUE',
  );
  return NextResponse.json({ data: installments });
}
