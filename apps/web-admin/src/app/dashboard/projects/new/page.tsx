import Link from 'next/link';
import ProjectForm from '../_form';

export default function NewProjectPage() {
  return (
    <div className="flex flex-col gap-5 lg:gap-6">

      {/* ── Premium Command Header Card ── */}
      <div className="relative bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
        {/* Gold accent strip */}
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-200 via-brand-500 to-brand-200" />

        <div className="px-7 sm:px-9 pt-8 pb-7">
          {/* Breadcrumb */}
          <nav aria-label="breadcrumb" className="mb-5">
            <ol className="flex flex-wrap items-center gap-1 text-xs text-slate-400">
              <li className="flex items-center gap-1">
                <Link
                  href={'/dashboard' as never}
                  className="font-medium hover:text-brand-600 transition-colors duration-150"
                >
                  لوحة التحكم
                </Link>
                <span className="text-slate-300 text-sm select-none">›</span>
              </li>
              <li className="flex items-center gap-1">
                <Link
                  href={'/dashboard/projects' as never}
                  className="font-medium hover:text-brand-600 transition-colors duration-150"
                >
                  المشاريع
                </Link>
                <span className="text-slate-300 text-sm select-none">›</span>
              </li>
              <li>
                <span className="font-semibold text-slate-600">مشروع جديد</span>
              </li>
            </ol>
          </nav>

          {/* Title row */}
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h1 className="text-[28px] sm:text-[34px] font-bold tracking-tight text-navy leading-tight">
                إضافة مشروع جديد
              </h1>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed max-w-md">
                أضف تفاصيل المشروع الجديد. سيُحفظ كمسودة حتى تقوم بنشره.
              </p>
            </div>
            <span className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-3 py-1.5 text-xs font-bold text-brand-700 tracking-wide mt-1 select-none">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400 shrink-0" />
              مسودة
            </span>
          </div>
        </div>
      </div>

      <ProjectForm />
    </div>
  );
}
