'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { Lead, LeadStage } from '@/lib/types';
import { useToast } from '@/components/ui/toast';
import { updateStageAction } from '@/app/dashboard/leads/actions';
import { StageColumn } from './stage-column';
import { LeadCardDraggableBody, LeadCardOverlay } from './lead-card';

type Tone = 'gray' | 'info' | 'purple' | 'warning' | 'success' | 'danger';

const STAGES: Array<{ stage: LeadStage; label: string; tone: Tone }> = [
  { stage: 'NEW', label: 'عملاء جدد', tone: 'gray' },
  { stage: 'INTERESTED', label: 'مهتمين', tone: 'info' },
  { stage: 'VISIT', label: 'زيارة مجدولة', tone: 'purple' },
  { stage: 'NEGOTIATION', label: 'تفاوض', tone: 'warning' },
  { stage: 'WON', label: 'فوز', tone: 'success' },
  { stage: 'LOST', label: 'خسارة', tone: 'danger' },
];

interface Props {
  initialLeads: Lead[];
  /** Authoritative pipeline counts from /leads/pipeline. */
  counts: Partial<Record<LeadStage, number>>;
}

type Grouped = Record<LeadStage, Lead[]>;

function groupLeads(leads: Lead[]): Grouped {
  const g: Grouped = { NEW: [], INTERESTED: [], VISIT: [], NEGOTIATION: [], WON: [], LOST: [] };
  for (const l of leads) g[l.stage]?.push(l);
  return g;
}

function leadsKey(leads: Lead[]): string {
  return leads.map((l) => `${l.id}:${l.stage}`).join('|');
}

export function LeadPipelineBoard({ initialLeads, counts }: Props) {
  const router = useRouter();
  const toast = useToast();

  const [grouped, setGrouped] = useState<Grouped>(() => groupLeads(initialLeads));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  // Re-seed local state when the server data set actually changes (after refresh).
  // Only re-seeds when the lead-id+stage signature differs, so optimistic updates
  // mid-flight don't snap back.
  const lastKey = useRef<string>(leadsKey(initialLeads));
  useEffect(() => {
    const next = leadsKey(initialLeads);
    if (next !== lastKey.current) {
      lastKey.current = next;
      setGrouped(groupLeads(initialLeads));
    }
  }, [initialLeads]);

  // Quick lookup: leadId → current stage (in our local optimistic state).
  const stageOfLead = useMemo(() => {
    const m = new Map<string, LeadStage>();
    for (const stage of Object.keys(grouped) as LeadStage[]) {
      for (const l of grouped[stage]) m.set(l.id, stage);
    }
    return m;
  }, [grouped]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }, // small distance lets clicks still work
    }),
    useSensor(KeyboardSensor),
  );

  const activeLead = useMemo(() => {
    if (!activeId) return null;
    for (const stage of Object.keys(grouped) as LeadStage[]) {
      const found = grouped[stage].find((l) => l.id === activeId);
      if (found) return found;
    }
    return null;
  }, [activeId, grouped]);

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function handleDragEnd(e: DragEndEvent) {
    const leadId = String(e.active.id);
    const droppedOn = e.over?.id != null ? String(e.over.id) : null;
    setActiveId(null);

    if (!droppedOn) return;
    const targetStage = STAGES.find((s) => s.stage === droppedOn)?.stage;
    if (!targetStage) return;

    const sourceStage = stageOfLead.get(leadId);
    if (!sourceStage || sourceStage === targetStage) return;

    // Snapshot for revert.
    const snapshot = grouped;

    // Optimistic move.
    setGrouped((prev) => {
      const lead = prev[sourceStage].find((l) => l.id === leadId);
      if (!lead) return prev;
      return {
        ...prev,
        [sourceStage]: prev[sourceStage].filter((l) => l.id !== leadId),
        [targetStage]: [{ ...lead, stage: targetStage }, ...prev[targetStage]],
      };
    });

    // Mark pending.
    setPendingIds((prev) => new Set(prev).add(leadId));

    try {
      await updateStageAction(leadId, targetStage);
      router.refresh();
    } catch (err) {
      // Revert.
      setGrouped(snapshot);
      toast.show({
        tone: 'danger',
        title: 'تعذّر تحديث المرحلة',
        description: (err as Error).message || 'حدث خطأ غير متوقع',
      });
    } finally {
      setPendingIds((prev) => {
        const n = new Set(prev);
        n.delete(leadId);
        return n;
      });
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 overflow-x-auto scrollbar-thin">
        <div className="flex gap-5 pb-4 min-w-max">
          {STAGES.map((s) => {
            const items = grouped[s.stage];
            const total = counts[s.stage] ?? items.length;
            return (
              <DroppableStageColumn
                key={s.stage}
                stage={s.stage}
                label={s.label}
                tone={s.tone}
                count={total}
              >
                {items.map((lead) => (
                  <DraggableLeadCard
                    key={lead.id}
                    lead={lead}
                    isPending={pendingIds.has(lead.id)}
                  />
                ))}
                {items.length > 0 && total > items.length && (
                  <p className="text-center text-2xs text-slate-400 pt-2">
                    + {total - items.length} عميل إضافي
                  </p>
                )}
              </DroppableStageColumn>
            );
          })}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeLead ? (
          <div className="w-[320px] sm:w-[340px] lg:w-[360px] cursor-grabbing">
            <LeadCardOverlay lead={activeLead} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/* ---------- Droppable column ---------- */

function DroppableStageColumn({
  stage,
  label,
  tone,
  count,
  children,
}: {
  stage: LeadStage;
  label: string;
  tone: Tone;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const childArray = Array.isArray(children) ? children : [children];
  const isEmpty =
    childArray.filter(Boolean).length === 0 ||
    (childArray.length === 1 && childArray[0] === undefined);

  return (
    <div ref={setNodeRef}>
      <StageColumn label={label} count={count} tone={tone} isOver={isOver} isEmpty={isEmpty}>
        {children}
      </StageColumn>
    </div>
  );
}

/* ---------- Draggable card ----------
 * The full card is a Link to the detail page (click to navigate).
 * The drag handle lives in the bottom-end grip area of the card body.
 * The drag listeners attach to the whole card via setNodeRef so that
 * dnd-kit measures it correctly, but the activator (handle) is the grip.
 */

function DraggableLeadCard({ lead, isPending }: { lead: Lead; isPending: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } =
    useDraggable({ id: lead.id });

  return (
    <div
      ref={setNodeRef}
      className={`relative rounded-2xl ${isDragging ? 'opacity-30' : ''} ${
        isPending ? 'pointer-events-none opacity-70' : ''
      }`}
    >
      <Link
        href={`/dashboard/leads/${lead.id}` as never}
        prefetch={false}
        className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 hover:-translate-y-px transition-transform duration-150"
      >
        <LeadCardDraggableBody lead={lead} />
      </Link>

      {/* Drag handle — covers the small grip glyph at the end side of the card footer.
          Stops click propagation so it doesn't navigate while dragging. */}
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`اسحب لتغيير مرحلة ${lead.client?.fullName ?? lead.fullName}`}
        {...listeners}
        {...attributes}
        onClick={(e) => e.preventDefault()}
        className={`absolute bottom-4 end-4 h-7 w-7 rounded-lg bg-transparent z-10 select-none touch-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      />
    </div>
  );
}
