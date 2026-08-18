'use client';

import { useState, useTransition, useMemo } from 'react';
import { CheckCircle2, XCircle, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PremiumSectionCard } from '@/components/premium';
import { getClientLocale } from '@/lib/locale-client';
import { modulesT } from '@/messages/super-admin';

type ModuleKey = 'broker' | 'website' | 'maintenance' | 'reports' | 'leads' | 'visits' | 'contracts' | 'installments' | 'deposits';

const ALL_MODULES: ModuleKey[] = [
  'broker', 'website', 'maintenance', 'reports',
  'leads', 'visits', 'contracts', 'installments', 'deposits',
];

interface Props {
  companyId: string;
  initialModules: Record<ModuleKey, boolean>;
}

export function CompanyModulesPanel({ companyId, initialModules }: Props) {
  const locale = getClientLocale();
  const m = useMemo(() => modulesT(locale), [locale]);

  const [modules, setModules] = useState<Record<ModuleKey, boolean>>(initialModules);
  const [pending, startTransition] = useTransition();
  const [savedOk, setSavedOk] = useState(false);

  function toggle(key: ModuleKey) {
    setModules((prev) => ({ ...prev, [key]: !prev[key] }));
    setSavedOk(false);
  }

  function save() {
    startTransition(async () => {
      await fetch(`/api-proxy/super-admin/companies/${companyId}/modules`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules }),
      });
      setSavedOk(true);
    });
  }

  return (
    <PremiumSectionCard
      title={m.title}
      icon={<Layers />}
      trailing={
        <Button variant="primary" size="sm" loading={pending} onClick={save}>
          {m.saveBtn}
        </Button>
      }
    >
      <p className="text-[12px] text-slate-400 mb-4">{m.description}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {ALL_MODULES.map((key) => {
          const enabled = modules[key];
          return (
            <button
              key={key}
              onClick={() => toggle(key)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-start
                ${enabled
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'
                }`}
            >
              {enabled
                ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                : <XCircle className="h-4 w-4 text-slate-300 shrink-0" />
              }
              <span className={`text-[13px] font-semibold ${enabled ? 'text-emerald-900' : 'text-slate-400'}`}>
                {m.modules[key]}
              </span>
            </button>
          );
        })}
      </div>
      {savedOk && (
        <p className="mt-3 text-[12px] text-emerald-600 font-semibold flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {m.savedOk}
        </p>
      )}
    </PremiumSectionCard>
  );
}
