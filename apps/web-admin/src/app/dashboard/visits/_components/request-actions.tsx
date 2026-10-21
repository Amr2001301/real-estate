'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, CalendarPlus, X, Ban } from 'lucide-react';
import type { VisitRequest, VisitRequestStatus } from '@/lib/types';
import { ScheduleModal } from './schedule-modal';
import { RowMenu, MenuItem, PrimaryAction } from '@/components/premium/row-menu';
import { updateRequestStatusAction } from '../actions';
import { uiT } from '@/messages/ui';
import type { Locale } from '@/lib/locale';

const FINAL: VisitRequestStatus[] = ['CONVERTED', 'REJECTED', 'CANCELLED'];

interface Props {
  request: VisitRequest;
  salesOptions: { id: string; fullName: string }[];
  locale?: Locale;
}

export function RequestActions({ request, salesOptions, locale = 'ar' }: Props) {
  const m = uiT(locale).pages.visitComponents;
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const status = request.requestStatus ?? null;
  const isFinal = status !== null && FINAL.includes(status);

  return (
    <div className="flex items-center justify-end gap-2">
      {!isFinal && (
        <>
          <PrimaryAction icon={<CalendarPlus />} onClick={() => setScheduleOpen(true)}>
            {m.scheduleBtn}
          </PrimaryAction>
          <RowMenu label={m.moreActions}>
            <form action={updateRequestStatusAction.bind(null, request.id)}>
              <input type="hidden" name="status" value="REJECTED" />
              <MenuItem type="submit" icon={<X />} tone="danger">{m.rejectBtn}</MenuItem>
            </form>
            <form action={updateRequestStatusAction.bind(null, request.id)}>
              <input type="hidden" name="status" value="CANCELLED" />
              <MenuItem type="submit" icon={<Ban />}>{m.cancelBtn}</MenuItem>
            </form>
          </RowMenu>
        </>
      )}

      <Link
        href={`/dashboard/visits/requests/${request.id}` as never}
        aria-label={m.ariaViewVisit}
        title={m.ariaViewVisit}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-slate-500 transition-colors hover:border-[#C9A24E]/60 hover:text-slate-900"
      >
        <Eye className="h-4 w-4" />
      </Link>

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
    </div>
  );
}
