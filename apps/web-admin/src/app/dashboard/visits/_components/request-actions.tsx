'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, CalendarPlus, X, Ban } from 'lucide-react';
import type { VisitRequest, VisitRequestStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ScheduleModal } from './schedule-modal';
import { updateRequestStatusAction } from '../actions';

const FINAL: VisitRequestStatus[] = ['CONVERTED', 'REJECTED', 'CANCELLED'];

interface Props {
  request: VisitRequest;
  salesOptions: { id: string; fullName: string }[];
}

export function RequestActions({ request, salesOptions }: Props) {
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const status = request.requestStatus ?? null;
  const isFinal = status !== null && FINAL.includes(status);

  return (
    <div className="flex items-center gap-1.5">
      <Link href={`/dashboard/visits/requests/${request.id}` as never}>
        <Button variant="outline" size="sm" leftIcon={<Eye className="h-3.5 w-3.5" />}>
          عرض
        </Button>
      </Link>

      {!isFinal && (
        <>
          <Button
            variant="subtle"
            size="sm"
            leftIcon={<CalendarPlus className="h-3.5 w-3.5" />}
            onClick={() => setScheduleOpen(true)}
          >
            جدولة
          </Button>

          <form
            action={updateRequestStatusAction.bind(null, request.id)}
            className="contents"
          >
            <input type="hidden" name="status" value="REJECTED" />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              leftIcon={<X className="h-3.5 w-3.5" />}
              className="text-danger-600 hover:text-danger-700 hover:bg-danger-50"
            >
              رفض
            </Button>
          </form>

          <form
            action={updateRequestStatusAction.bind(null, request.id)}
            className="contents"
          >
            <input type="hidden" name="status" value="CANCELLED" />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              leftIcon={<Ban className="h-3.5 w-3.5" />}
              className="text-slate-500 hover:text-slate-700"
            >
              إلغاء
            </Button>
          </form>
        </>
      )}

      <ScheduleModal
        requestId={request.id}
        salesOptions={salesOptions}
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        project={request.project}
        unit={request.unit}
        customerName={request.customerName ?? request.user?.fullName ?? request.lead?.fullName}
        defaultSalesId={request.assignedSalesId}
      />
    </div>
  );
}
