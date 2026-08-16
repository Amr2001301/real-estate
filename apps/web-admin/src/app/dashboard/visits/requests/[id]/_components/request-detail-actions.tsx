'use client';

import { useState } from 'react';
import { CalendarPlus, X, Ban } from 'lucide-react';
import type { VisitRequest, VisitRequestStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ScheduleModal } from '../../../_components/schedule-modal';
import { updateRequestStatusAction } from '../actions';
import { uiT } from '@/messages/ui';
import type { Locale } from '@/lib/locale';

const FINAL: VisitRequestStatus[] = ['CONVERTED', 'REJECTED', 'CANCELLED'];

interface Props {
  request: VisitRequest;
  salesOptions: { id: string; fullName: string }[];
  locale?: Locale;
}

export function RequestDetailActions({ request, salesOptions, locale = 'ar' }: Props) {
  const m = uiT(locale).pages.visitComponents;
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const status = request.requestStatus ?? null;
  const isFinal = status !== null && FINAL.includes(status);

  if (isFinal) return null;

  return (
    <>
      <Button
        variant="primary"
        size="md"
        leftIcon={<CalendarPlus className="h-4 w-4" />}
        onClick={() => setScheduleOpen(true)}
      >
        {m.scheduleVisitBtn}
      </Button>

      <form action={updateRequestStatusAction.bind(null, request.id)} className="contents">
        <input type="hidden" name="status" value="REJECTED" />
        <Button
          type="submit"
          variant="outline"
          size="md"
          leftIcon={<X className="h-4 w-4" />}
          className="text-danger-600 border-danger-200 hover:bg-danger-50"
        >
          {m.rejectBtn}
        </Button>
      </form>

      <form action={updateRequestStatusAction.bind(null, request.id)} className="contents">
        <input type="hidden" name="status" value="CANCELLED" />
        <Button
          type="submit"
          variant="outline"
          size="md"
          leftIcon={<Ban className="h-4 w-4" />}
        >
          {m.cancelBtn}
        </Button>
      </form>

      <ScheduleModal
        requestId={request.id}
        salesOptions={salesOptions}
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        project={request.project}
        unit={request.unit}
        customerName={request.customerName ?? request.user?.fullName ?? request.lead?.fullName}
        defaultSalesId={request.assignedSalesId}
        preferredDate={request.preferredDate}
        preferredTime={request.preferredTime}
        customerMessage={request.requestNotes ?? request.notes ?? null}
        locale={locale}
      />
    </>
  );
}
