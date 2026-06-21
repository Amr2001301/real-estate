'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Loader2, Check, ShieldCheck, ShieldOff, Clock, HelpCircle, X } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';
import { PremiumFormLayout, PremiumFormPanel } from '@/components/premium';
import { tx, formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  createRequestAction,
  loadCustomerUnits,
  loadUnitItems,
  type MaintenanceUnitOption,
  type MaintenanceItemOption,
} from './actions';

const NAV_SECTIONS = [
  { id: 'section-customer-unit', num: '01', label: 'العميل والوحدة',    sub: 'تحديد العميل والوحدة المعنية' },
  { id: 'section-items',         num: '02', label: 'عناصر الصيانة',     sub: 'اختيار عناصر العمل المطلوبة' },
  { id: 'section-description',   num: '03', label: 'الوصف والإسناد',    sub: 'تفاصيل المشكلة والمسؤول' },
];

interface Option {
  id: string;
  fullName: string;
}
interface AdminOption extends Option {
  role: string;
}

function assigneeRoleLabel(role: string): string {
  return role === 'MAINTENANCE_SUPERVISOR' ? 'مشرف الصيانة' : 'مدير النظام';
}

function ItemWarranty({ item }: { item: MaintenanceItemOption }) {
  if (!item.warrantyStart) {
    return <span className="inline-flex items-center gap-1 text-slate-500"><Clock className="h-3 w-3" /> لم يبدأ الضمان بعد</span>;
  }
  if (item.warrantyStatus === 'IN_WARRANTY') {
    return (
      <span className="inline-flex items-center gap-1 text-success-700">
        <ShieldCheck className="h-3 w-3" />
        {item.warrantyEnd ? `تحت الضمان حتى ${formatDate(item.warrantyEnd)}` : 'تحت الضمان'}
      </span>
    );
  }
  if (item.warrantyStatus === 'OUT_OF_WARRANTY') {
    return <span className="inline-flex items-center gap-1 text-danger-600"><ShieldOff className="h-3 w-3" /> خارج الضمان</span>;
  }
  return <span className="inline-flex items-center gap-1 text-slate-400"><HelpCircle className="h-3 w-3" /> غير معروف</span>;
}

export function NewMaintenanceForm({
  customers,
  admins,
}: {
  customers: Option[];
  admins: AdminOption[];
}) {
  const [customerId, setCustomerId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [description, setDescription] = useState('');
  const [units, setUnits] = useState<MaintenanceUnitOption[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [unitsError, setUnitsError] = useState<string | null>(null);
  const [items, setItems] = useState<MaintenanceItemOption[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function onCustomerChange(id: string) {
    setCustomerId(id);
    setUnitId('');
    setUnits([]);
    setItems([]);
    setSelected(new Set());
    setUnitsError(null);
    if (!id) return;
    setLoadingUnits(true);
    const { units: loaded, error } = await loadCustomerUnits(id);
    setLoadingUnits(false);
    if (error) return setUnitsError(error);
    setUnits(loaded);
  }

  async function onUnitChange(id: string) {
    setUnitId(id);
    setItems([]);
    setSelected(new Set());
    setItemsError(null);
    if (!id) return;
    setLoadingItems(true);
    const { items: loaded, error } = await loadUnitItems(id);
    setLoadingItems(false);
    if (error) return setItemsError(error);
    setItems(loaded);
  }

  function toggleCategory(categoryId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  const unitDisabled = !customerId || loadingUnits;
  const showNoUnits = !!customerId && !loadingUnits && !unitsError && units.length === 0;
  const showNoItems = !!unitId && !loadingItems && !itemsError && items.length === 0;
  const canSubmit = !!customerId && !!unitId && selected.size > 0 && description.trim().length >= 5;

  return (
    <form action={createRequestAction} className="flex flex-col gap-4 lg:gap-5">
      {/* Hidden inputs carry the selected category ids to the server action. */}
      {[...selected].map((catId) => (
        <input key={catId} type="hidden" name="categoryIds" value={catId} />
      ))}

      <PremiumFormLayout
        navSections={NAV_SECTIONS}
        sidebarBadge="جديد"
        sidebarInfo="الطلبات المُنشأة من لوحة التحكم تُعتمد تلقائياً، ويُحتسب الموعد المستهدف فوراً."
      >
        {/* ── Panel 01: العميل والوحدة ── */}
        <PremiumFormPanel
          id="section-customer-unit"
          number="01"
          title="العميل والوحدة"
          description="اختر العميل أولاً، ثم حدد الوحدة العقارية المرتبطة بالطلب."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="customerId" className="text-xs font-medium text-slate-500">العميل</label>
              <Select
                id="customerId"
                name="customerId"
                required
                value={customerId}
                onChange={(e) => onCustomerChange(e.target.value)}
              >
                <option value="" disabled>— اختر العميل —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.fullName}</option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="unitId" className="text-xs font-medium text-slate-500">الوحدة</label>
              <Select
                id="unitId"
                name="unitId"
                required
                disabled={unitDisabled}
                value={unitId}
                onChange={(e) => onUnitChange(e.target.value)}
              >
                <option value="" disabled>
                  {customerId ? '— اختر الوحدة —' : '— اختر العميل أولاً —'}
                </option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code}{u.building ? ` · ${u.building.name}` : ''}
                  </option>
                ))}
              </Select>
              {loadingUnits && (
                <p className="text-[11px] text-slate-400 inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> جارٍ تحميل الوحدات…
                </p>
              )}
              {unitsError && <p className="text-[11px] text-danger-600">{unitsError}</p>}
              {showNoUnits && <p className="text-[11px] text-warning-700">لا توجد وحدات مرتبطة بهذا العميل.</p>}
            </div>
          </div>
        </PremiumFormPanel>

        {/* ── Panel 02: عناصر الصيانة ── */}
        <PremiumFormPanel
          id="section-items"
          number="02"
          title="عناصر الصيانة"
          description="اختر عنصراً أو أكثر من عناصر الصيانة المفعّلة للوحدة."
        >
          {!unitId ? (
            <p className="text-sm text-slate-400">اختر الوحدة أولاً لعرض عناصر الصيانة المتاحة.</p>
          ) : loadingItems ? (
            <p className="text-sm text-slate-400 inline-flex items-center gap-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> جارٍ تحميل العناصر…
            </p>
          ) : itemsError ? (
            <p className="text-sm text-danger-600">{itemsError}</p>
          ) : showNoItems ? (
            <p className="text-sm text-warning-700">لا توجد عناصر صيانة مفعلة لهذه الوحدة.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {items.map((it) => {
                const catId = it.categoryId!;
                const isSel = selected.has(catId);
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => toggleCategory(catId)}
                    className={cn(
                      'text-start rounded-xl border p-3 transition-colors',
                      isSel
                        ? 'border-brand-300 bg-brand-50/60 ring-1 ring-inset ring-brand-200'
                        : 'border-hairline bg-surface hover:bg-canvas/40',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900">{tx(it.name)}</span>
                      <span
                        className={cn(
                          'inline-flex h-5 w-5 items-center justify-center rounded-full border',
                          isSel
                            ? 'bg-brand-600 border-brand-600 text-white'
                            : 'border-slate-300 text-transparent',
                        )}
                      >
                        <Check className="h-3 w-3" />
                      </span>
                    </div>
                    <div className="mt-1.5 text-[11px]"><ItemWarranty item={it} /></div>
                  </button>
                );
              })}
            </div>
          )}
        </PremiumFormPanel>

        {/* ── Panel 03: الوصف والإسناد ── */}
        <PremiumFormPanel
          id="section-description"
          number="03"
          title="الوصف والإسناد"
          description="اكتب وصفاً واضحاً للمشكلة، وحدد المسؤول عن المتابعة إن وجد."
        >
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="description" className="text-xs font-medium text-slate-500">وصف المشكلة</label>
              <Textarea
                id="description"
                name="description"
                required
                minLength={5}
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="اكتب وصفاً واضحاً للمشكلة (5 أحرف على الأقل)"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="assignedAdminId" className="text-xs font-medium text-slate-500">
                المسؤول (اختياري)
              </label>
              <Select id="assignedAdminId" name="assignedAdminId" defaultValue="">
                <option value="">— بدون إسناد —</option>
                {admins.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.fullName} — {assigneeRoleLabel(a.role)}
                  </option>
                ))}
              </Select>
              <p className="text-[11px] text-slate-400">
                عند اختيار مسؤول يبدأ الطلب بحالة «مسند»، وإلا يبدأ بحالة «مفتوح».
              </p>
            </div>
          </div>
        </PremiumFormPanel>
      </PremiumFormLayout>

      <FormFooter
        sticky
        primary={
          <>
            <Link href={'/dashboard/maintenance' as never}>
              <Button type="button" variant="ghost" leftIcon={<X className="h-4 w-4" />}>
                إلغاء
              </Button>
            </Link>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!canSubmit}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              إنشاء الطلب
            </Button>
          </>
        }
        helper="الطلبات المُنشأة من لوحة التحكم تُعتمد تلقائياً."
      />
    </form>
  );
}
