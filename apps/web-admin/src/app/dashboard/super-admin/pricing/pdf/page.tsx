'use client';

import { useEffect, useState, useMemo } from 'react';
import { Printer, CheckCircle2, Sparkles } from 'lucide-react';
import { getClientLocale } from '@/lib/locale-client';
import { pricingT } from '@/messages/super-admin';
import { Button } from '@/components/ui/button';

interface PricingPackage {
  id: string;
  planTier: string;
  nameAr: string;
  nameEn: string;
  descAr: string | null;
  descEn: string | null;
  currency: string;
  monthlyPrice: string | null;
  annualPrice: string | null;
  setupFee: string | null;
  maxUsers: number | null;
  highlights: string[];
  specialOffer: { titleAr: string; titleEn: string; discountPct: number; validUntil?: string } | null;
  isActive: boolean;
}

function fmt(val: string | null, currency: string) {
  if (!val) return null;
  return `${Number(val).toLocaleString()} ${currency}`;
}

export default function PricingPdfPage() {
  const locale = getClientLocale();
  const m = useMemo(() => pricingT(locale), [locale]);
  const isRtl = locale !== 'en';

  const [packages, setPackages] = useState<PricingPackage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api-proxy/super-admin/pricing')
      .then((r) => r.json())
      .then((data) => { setPackages((data as PricingPackage[]).filter((p) => p.isActive)); })
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toLocaleDateString(locale === 'en' ? 'en-SA' : 'ar-SA', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Print toolbar — hidden when printing */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[14px] font-bold text-slate-900">{m.pdf.title}</span>
          <span className="text-[12px] text-slate-400">{today}</span>
        </div>
        <Button variant="primary" leftIcon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
          {m.pdf.printBtn}
        </Button>
      </div>

      {/* PDF content */}
      <div className="max-w-[900px] mx-auto px-8 py-10 print:px-0 print:py-0 print:max-w-none">
        {/* Cover header */}
        <div className="mb-10 print:mb-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-2">{today}</p>
              <h1 className="text-[32px] font-black text-navy leading-none mb-2">{m.pdf.title}</h1>
              <p className="text-[15px] text-slate-500">{m.pdf.subtitle}</p>
            </div>
            <div className="text-end">
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-brand-600 text-white text-[22px] font-black">
                د
              </div>
            </div>
          </div>
          <div className="h-0.5 bg-gradient-to-r from-brand-600 via-brand-400 to-transparent" />
        </div>

        {loading && (
          <div className="text-center py-20 text-slate-400 text-sm">…</div>
        )}

        {/* Package cards grid */}
        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 print:grid-cols-3 print:gap-4">
            {packages.map((pkg) => {
              const name = locale === 'en' ? pkg.nameEn : pkg.nameAr;
              const desc = locale === 'en' ? pkg.descEn : pkg.descAr;
              const monthly = fmt(pkg.monthlyPrice, pkg.currency);
              const annual = fmt(pkg.annualPrice, pkg.currency);
              const setup = fmt(pkg.setupFee, pkg.currency);
              const hasOffer = !!pkg.specialOffer;

              return (
                <div
                  key={pkg.id}
                  className={`relative rounded-2xl border-2 overflow-hidden flex flex-col print:rounded-xl print:break-inside-avoid
                    ${hasOffer
                      ? 'border-brand-500 shadow-[0_0_0_4px_rgb(var(--color-brand-500)_/_0.08)]'
                      : 'border-slate-200'
                    }`}
                >
                  {/* Offer ribbon */}
                  {hasOffer && (
                    <div className="absolute top-3 start-3 z-10">
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-600 text-white px-2.5 py-0.5 text-[10px] font-bold">
                        <Sparkles className="h-2.5 w-2.5" />
                        {pkg.specialOffer!.discountPct}% {m.pdf.discount}
                      </span>
                    </div>
                  )}

                  {/* Plan tier bar */}
                  <div className={`px-5 pt-${hasOffer ? '8' : '5'} pb-4 ${hasOffer ? 'bg-brand-50' : 'bg-slate-50'}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-[0.12em] mb-1 ${hasOffer ? 'text-brand-600' : 'text-slate-400'}`}>
                      {pkg.planTier}
                    </p>
                    <h2 className="text-[18px] font-black text-navy leading-tight">{name}</h2>
                    {desc && <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{desc}</p>}
                  </div>

                  {/* Price block */}
                  <div className="px-5 py-4 border-t border-slate-100 bg-white">
                    {monthly ? (
                      <div className="mb-1">
                        <span className="text-[26px] font-black text-navy tabular-nums leading-none">
                          {monthly.split(' ')[0]}
                        </span>
                        <span className="text-[12px] text-slate-400 ms-1">
                          {pkg.currency} {m.pdf.monthly}
                        </span>
                      </div>
                    ) : (
                      <p className="text-[13px] text-slate-400 italic mb-1">—</p>
                    )}
                    {annual && (
                      <p className="text-[11px] text-slate-500">
                        {annual.split(' ')[0]} {pkg.currency} {m.pdf.annual}
                        {hasOffer && pkg.specialOffer && (
                          <span className="ms-1.5 line-through text-slate-300">
                            {Math.round(Number(pkg.annualPrice) / (1 - pkg.specialOffer.discountPct / 100)).toLocaleString()} {pkg.currency}
                          </span>
                        )}
                      </p>
                    )}
                    {setup && (
                      <p className="text-[11px] text-slate-400 mt-0.5">{m.pdf.setup}: {setup}</p>
                    )}
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {pkg.maxUsers
                        ? `${pkg.maxUsers} ${m.pdf.users}`
                        : m.pdf.unlimited}
                    </p>
                  </div>

                  {/* Highlights */}
                  {pkg.highlights.length > 0 && (
                    <div className="px-5 py-4 border-t border-slate-100 bg-white flex-1">
                      <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-2.5">{m.pdf.highlights}</p>
                      <ul className="space-y-1.5">
                        {pkg.highlights.map((h, i) => (
                          <li key={i} className="flex items-start gap-2 text-[11px] text-slate-700 leading-snug">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                            {h}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Offer footer */}
                  {hasOffer && (
                    <div className="px-5 py-3 bg-brand-50 border-t border-brand-100">
                      <p className="text-[10px] font-bold text-brand-700">
                        <Sparkles className="h-2.5 w-2.5 inline me-1" />
                        {locale === 'en' ? pkg.specialOffer!.titleEn : pkg.specialOffer!.titleAr}
                      </p>
                      {pkg.specialOffer!.validUntil && (
                        <p className="text-[10px] text-brand-500 mt-0.5">
                          {m.pdf.validUntil} {pkg.specialOffer!.validUntil}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-slate-200 print:mt-8 flex items-center justify-between text-[11px] text-slate-400">
          <span>{m.pdf.footer}</span>
          <span>{today}</span>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 15mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
