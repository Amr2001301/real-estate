'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, UserCircle2 } from 'lucide-react';
import type { SessionRole } from '@/lib/session';
import { Avatar } from '@/components/ui/avatar';
import { logoutAction } from '@/app/login/actions';

const ROLE_LABEL: Record<SessionRole, string> = {
  ADMIN: 'مدير النظام',
  SALES: 'مبيعات',
  SALES_MANAGER: 'مدير مبيعات',
  BROKER: 'وسيط',
  MAINTENANCE_SUPERVISOR: 'مشرف الصيانة',
};

interface Props {
  user: { fullName: string; role: SessionRole };
}

export function UserMenu({ user }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
      >
        <Avatar name={user.fullName} size="sm" />
        <span className="hidden sm:flex flex-col items-start leading-tight pe-1">
          <span className="text-xs font-semibold text-slate-900 truncate max-w-[120px]">
            {user.fullName}
          </span>
          <span className="text-2xs text-slate-500">{ROLE_LABEL[user.role]}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute end-0 mt-1 w-60 bg-surface border border-hairline rounded-lg shadow-card p-1 animate-fade-in z-50"
        >
          <div className="px-3 py-2.5 border-b border-hairline/50 mb-1">
            <p className="text-sm font-semibold text-slate-900 truncate">{user.fullName}</p>
            <p className="text-2xs text-slate-500 mt-0.5">{ROLE_LABEL[user.role]}</p>
          </div>
          <MenuItem icon={<UserCircle2 className="h-4 w-4" />} label="الملف الشخصي" disabled />
          <form action={logoutAction}>
            <button
              type="submit"
              role="menuitem"
              className="w-full flex items-center gap-2.5 px-2.5 h-9 rounded-lg text-sm text-danger-700 hover:bg-danger-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>تسجيل الخروج</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className="w-full flex items-center gap-2.5 px-2.5 h-9 rounded-lg text-sm text-slate-700 hover:bg-surface-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span className="text-slate-400">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
