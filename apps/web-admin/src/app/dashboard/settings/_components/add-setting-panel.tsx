'use client';

import { useState } from 'react';
import { Plus, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog } from '@/components/ui/dialog';
import { patchSettingAction } from '../actions';

type FieldType = 'text' | 'number' | 'boolean' | 'json';

interface Template {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
}

const TEMPLATES: Template[] = [
  // company
  { key: 'company.name',     label: 'اسم الشركة',                            type: 'text',    placeholder: 'ديفورا للتطوير العقاري' },
  { key: 'company.email',    label: 'البريد الإلكتروني للشركة',             type: 'text',    placeholder: 'info@company.sa' },
  { key: 'company.phone',    label: 'هاتف الشركة',                           type: 'text',    placeholder: '+966 11 000 0000' },
  { key: 'company.address',  label: 'عنوان الشركة',                          type: 'text',    placeholder: 'الرياض، المملكة العربية السعودية' },
  { key: 'company.website',  label: 'الموقع الإلكتروني',                    type: 'text',    placeholder: 'https://company.sa' },
  { key: 'company.vatNumber',label: 'الرقم الضريبي',                         type: 'text',    placeholder: '300000000000003' },
  // broker
  { key: 'broker.defaultCommissionPct', label: 'نسبة عمولة الوسيط الافتراضية', type: 'number', placeholder: '2.5' },
  { key: 'broker.payoutCycleDays',      label: 'دورة صرف مدفوعات الوسيط (أيام)', type: 'number', placeholder: '30' },
  { key: 'broker.minPayoutAmount',      label: 'الحد الأدنى لصرف الوسيط',         type: 'number', placeholder: '1000' },
  { key: 'broker.autoApproveLeads',     label: 'الموافقة التلقائية على العملاء',  type: 'boolean' },
  // sales
  { key: 'sales.leadExpireDays',        label: 'مدة صلاحية العميل المحتمل (أيام)', type: 'number', placeholder: '90' },
  { key: 'sales.reservationExpireDays', label: 'مدة صلاحية الحجز (أيام)',           type: 'number', placeholder: '7' },
  { key: 'sales.allowMultiReservation', label: 'السماح بحجوزات متعددة',            type: 'boolean' },
  // notifications
  { key: 'notifications.emailEnabled',  label: 'تفعيل البريد الإلكتروني',          type: 'boolean' },
  { key: 'notifications.smsEnabled',    label: 'تفعيل الرسائل النصية',             type: 'boolean' },
  { key: 'notifications.fromEmail',     label: 'بريد إرسال الإشعارات',             type: 'text',    placeholder: 'noreply@company.sa' },
  // reports
  { key: 'reports.currency',            label: 'عملة التقارير',                     type: 'text',    placeholder: 'SAR' },
  { key: 'reports.dateFormat',          label: 'تنسيق التاريخ',                     type: 'text',    placeholder: 'DD/MM/YYYY' },
  { key: 'reports.timezone',            label: 'المنطقة الزمنية',                   type: 'text',    placeholder: 'Asia/Riyadh' },
  // security
  { key: 'security.maxLoginAttempts',   label: 'محاولات الدخول القصوى',             type: 'number',  placeholder: '5' },
  { key: 'security.sessionTimeoutMins', label: 'مهلة انتهاء الجلسة (دقيقة)',        type: 'number',  placeholder: '60' },
  { key: 'security.requireMfa',         label: 'تفعيل المصادقة الثنائية',           type: 'boolean' },
];

const CUSTOM_KEY = '__custom__';

export function AddSettingPanel() {
  const [open, setOpen]             = useState(false);
  const [selectedKey, setSelectedKey] = useState('');
  const [customKey, setCustomKey]   = useState('');

  const template   = TEMPLATES.find((t) => t.key === selectedKey);
  const isCustom   = selectedKey === CUSTOM_KEY;
  const resolvedKey = isCustom ? customKey.trim() : (template?.key ?? '');

  function handleClose() {
    setOpen(false);
    setSelectedKey('');
    setCustomKey('');
  }

  return (
    <>
      <Button
        type="button"
        variant="primary"
        leftIcon={<Plus className="h-4 w-4" />}
        onClick={() => setOpen(true)}
      >
        إضافة إعداد
      </Button>

      <Dialog
        open={open}
        onClose={handleClose}
        title="إضافة إعداد جديد"
        description="اختر نوع الإعداد من القائمة، أو أدخل مفتاحاً مخصصاً."
        size="sm"
      >
        <form action={patchSettingAction} className="space-y-4">
          <input type="hidden" name="key" value={resolvedKey} />

          {/* ── Template selector ────────────────────────────────────── */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-900 block">
              نوع الإعداد
            </label>
            <Select
              value={selectedKey}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedKey(e.target.value)}
              required
            >
              <option value="" disabled>اختر من القائمة...</option>
              {TEMPLATES.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
              <option value={CUSTOM_KEY}>— إعداد مخصص (متقدم) —</option>
            </Select>

            {/* Technical key chip — shown after template selection */}
            {template && (
              <p className="text-2xs text-slate-400">
                المفتاح التقني:{' '}
                <span
                  className="font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded"
                  dir="ltr"
                >
                  {template.key}
                </span>
              </p>
            )}
          </div>

          {/* ── Custom key — shown for إعداد مخصص only ───────────────── */}
          {isCustom && (
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-900 block">
                المفتاح التقني
              </label>
              <Input
                placeholder="group.fieldName"
                dir="ltr"
                value={customKey}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomKey(e.target.value)}
              />
              <p className="text-2xs text-slate-400">
                بالتنسيق{' '}
                <span className="font-mono" dir="ltr">group.fieldName</span>
                {' '}— مثال:{' '}
                <span className="font-mono" dir="ltr">company.logoUrl</span>
              </p>
            </div>
          )}

          {/* ── Value input — type-aware ──────────────────────────────── */}
          {(template || isCustom) && (
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-900 block">القيمة</label>

              {template?.type === 'boolean' ? (
                <Select name="value" required>
                  <option value="">اختر القيمة...</option>
                  <option value="true">نعم (مفعّل)</option>
                  <option value="false">لا (معطّل)</option>
                </Select>
              ) : template?.type === 'number' ? (
                <Input
                  name="value"
                  type="number"
                  step="any"
                  dir="ltr"
                  placeholder={template.placeholder ?? '0'}
                  required
                />
              ) : template?.type === 'json' || isCustom ? (
                <Textarea
                  name="value"
                  rows={3}
                  dir="ltr"
                  placeholder={isCustom ? 'نص، رقم، أو JSON: {"key": "value"}' : ''}
                  className="text-xs font-mono resize-none"
                  required
                />
              ) : (
                <Input
                  name="value"
                  dir="ltr"
                  placeholder={template?.placeholder ?? ''}
                  required
                />
              )}
            </div>
          )}

          {/* ── Actions ───────────────────────────────────────────────── */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-hairline">
            <Button type="button" variant="ghost" size="sm" onClick={handleClose}>
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!resolvedKey}
              leftIcon={<Save className="h-3.5 w-3.5" />}
            >
              حفظ الإعداد
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
