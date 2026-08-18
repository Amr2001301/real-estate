'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { Printer, CheckCircle2, Sparkles, Shield, Zap, Crown, Layers } from 'lucide-react';
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

function num(v: string | null) {
  return v ? Number(v).toLocaleString() : null;
}

const TIER_ORDER = ['TRIAL', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'CUSTOM'];
const FEATURED   = new Set(['PROFESSIONAL', 'ENTERPRISE']);
const NAVY       = '#0F1E33';
const NAVY2      = '#1C3050';
const GOLD       = '#C8A24B';
const GOLD2      = '#AE8835';
const GOLD3      = '#CFAE57';

const TIER_ICON: Record<string, React.ReactNode> = {
  TRIAL:        <Layers  style={{ width: 13, height: 13 }} />,
  STARTER:      <Zap     style={{ width: 13, height: 13 }} />,
  PROFESSIONAL: <Shield  style={{ width: 13, height: 13 }} />,
  ENTERPRISE:   <Crown   style={{ width: 13, height: 13 }} />,
  CUSTOM:       <Sparkles style={{ width: 13, height: 13 }} />,
};

export default function PricingPdfPage() {
  const locale = getClientLocale();
  const m      = useMemo(() => pricingT(locale), [locale]);
  const isRtl  = locale !== 'en';

  const [packages, setPackages] = useState<PricingPackage[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch('/api-proxy/super-admin/pricing')
      .then(r => r.json())
      .then((data: PricingPackage[]) => {
        setPackages(
          data
            .filter(p => p.isActive)
            .sort((a, b) => TIER_ORDER.indexOf(a.planTier) - TIER_ORDER.indexOf(b.planTier)),
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toLocaleDateString(locale === 'en' ? 'en-SA' : 'ar-SA', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  /* Open a clean blank window so the admin shell is completely absent */
  const handlePrint = useCallback(() => {
    const el = document.getElementById('devora-pdf');
    if (!el) { window.print(); return; }

    const win = window.open('', '_blank');
    if (!win) { window.print(); return; }          // popup blocked → fallback

    const origin = window.location.origin;
    /* Fix relative logo path for the isolated window */
    const body = el.innerHTML.replace(
      /src="\/brand\/devora-logo\.png"/g,
      `src="${origin}/brand/devora-logo.png"`,
    );

    win.document.write(`<!DOCTYPE html>
<html dir="${isRtl ? 'rtl' : 'ltr'}" lang="${locale}">
<head>
<meta charset="UTF-8">
<title>Devora — ${m.pdf.title}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
/* margin:0 removes browser date/URL headers; body padding replaces them */
@page{size:A4 portrait;margin:0}
body{
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,Tahoma,Arial,sans-serif;
  background:#fff;color:#0f1e33;
  padding:7mm;
  -webkit-print-color-adjust:exact;print-color-adjust:exact;
}
/* Override the screen preview's outer padding so body padding is the only padding */
#devora-pdf{padding:0!important;max-width:none!important;margin:0!important}
ul{list-style:none}
svg{display:inline-block;vertical-align:middle}
p{margin:0}
</style>
</head>
<body>
<div dir="${isRtl ? 'rtl' : 'ltr'}" style="direction:${isRtl ? 'rtl' : 'ltr'}">${body}</div>
<script>window.addEventListener('load',function(){setTimeout(function(){window.print();window.close();},700);});<\/script>
</body>
</html>`);
    win.document.close();
  }, [isRtl, locale, m.pdf.title]);

  const offerCount = packages.filter(p => p.specialOffer).length;
  const currency   = packages[0]?.currency ?? 'SAR';

  return (
    <div>
      {/* ── Screen toolbar ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10, background: '#fff',
        borderBottom: '1px solid #E2E8F0', padding: '10px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/devora-logo.png" alt="Devora" style={{ height: 26, width: 'auto' }} />
          <span style={{ width: 1, height: 16, background: '#E2E8F0', display: 'inline-block' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>{m.pdf.title}</span>
        </div>
        <Button variant="primary" leftIcon={<Printer className="h-4 w-4" />} onClick={handlePrint}>
          {m.pdf.printBtn}
        </Button>
      </div>

      {/* ══ PDF CONTENT ══ (cloned to new window on print) */}
      <div
        id="devora-pdf"
        dir={isRtl ? 'rtl' : 'ltr'}
        style={{ padding: '20px', maxWidth: 860, margin: '0 auto', background: '#fff' }}
      >

        {/* ── Cover Header ── */}
        <div style={{
          borderRadius: 14, overflow: 'hidden', marginBottom: 14, position: 'relative',
          background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY2} 60%, #26405F 100%)`,
        }}>
          {/* Glow orb */}
          <div style={{
            position: 'absolute', insetInlineEnd: -50, top: -50,
            width: 200, height: 200, borderRadius: '50%', pointerEvents: 'none',
            background: 'radial-gradient(circle, rgba(200,162,75,0.16) 0%, transparent 70%)',
          }} />

          <div style={{ padding: '14px 20px 12px', position: 'relative' }}>
            {/* Row: brand + badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              {/* Brand — styled text (PNG has white bg so can't invert; use monogram instead) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: GOLD, fontSize: 20, fontWeight: 900, lineHeight: 1,
                }}>
                  D
                </div>
                <div>
                  <p style={{ color: '#fff', fontSize: 16, fontWeight: 900, letterSpacing: '0.02em' }}>Devora</p>
                  <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                    Real Estate Platform
                  </p>
                </div>
              </div>
              {/* Proposal badge + date */}
              <div style={{ textAlign: isRtl ? 'start' : 'end' }}>
                <span style={{
                  display: 'inline-block', fontSize: 8, fontWeight: 700,
                  letterSpacing: '0.14em', textTransform: 'uppercase',
                  padding: '3px 10px', borderRadius: 999,
                  background: 'rgba(200,162,75,0.15)', color: GOLD3,
                  border: '1px solid rgba(200,162,75,0.25)',
                }}>
                  {locale === 'en' ? 'OFFICIAL PROPOSAL' : 'عرض رسمي'}
                </span>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 4 }}>{today}</p>
              </div>
            </div>

            {/* Title */}
            <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 900, lineHeight: 1, marginBottom: 4 }}>
              {m.pdf.title}
            </h1>
            <p style={{ color: GOLD, fontSize: 13, fontWeight: 600 }}>{m.pdf.subtitle}</p>

            {/* Gold rule */}
            <div style={{
              height: 1, margin: '8px 0',
              background: `linear-gradient(to ${isRtl ? 'left' : 'right'}, ${GOLD}, rgba(200,162,75,0.25), transparent)`,
            }} />

            {/* Stats */}
            {!loading && (
              <div style={{ display: 'flex', gap: 32 }}>
                <div>
                  <p style={{ color: '#fff', fontSize: 18, fontWeight: 900, lineHeight: 1 }}>{packages.length}</p>
                  <p style={{ color: 'rgba(255,255,255,0.42)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.10em', marginTop: 3 }}>
                    {locale === 'en' ? 'Active Plans' : 'خطة نشطة'}
                  </p>
                </div>
                {offerCount > 0 && (
                  <div>
                    <p style={{ color: GOLD, fontSize: 18, fontWeight: 900, lineHeight: 1 }}>{offerCount}</p>
                    <p style={{ color: 'rgba(255,255,255,0.42)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.10em', marginTop: 3 }}>
                      {locale === 'en' ? 'Special Offers' : 'عروض خاصة'}
                    </p>
                  </div>
                )}
                <div>
                  <p style={{ color: '#fff', fontSize: 18, fontWeight: 900, lineHeight: 1 }}>{currency}</p>
                  <p style={{ color: 'rgba(255,255,255,0.42)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.10em', marginTop: 3 }}>
                    {locale === 'en' ? 'Currency' : 'العملة'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Gold bottom strip */}
          <div style={{ height: 3, background: `linear-gradient(to right, ${GOLD}, ${GOLD2} 50%, ${GOLD})` }} />
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: '#94A3B8', fontSize: 13 }}>…</div>
        )}

        {/* Section label */}
        {!loading && packages.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
            <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#94A3B8' }}>
              {locale === 'en' ? 'Subscription Plans' : 'خطط الاشتراك'}
            </p>
            <div style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
          </div>
        )}

        {/* ── Cards ── */}
        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
            {packages.map((pkg) => {
              const name    = locale === 'en' ? pkg.nameEn : pkg.nameAr;
              const desc    = locale === 'en' ? pkg.descEn : pkg.descAr;
              const monthly = num(pkg.monthlyPrice);
              const annual  = num(pkg.annualPrice);
              const setup   = num(pkg.setupFee);
              const isFeat  = FEATURED.has(pkg.planTier) || !!pkg.specialOffer;

              return (
                <div key={pkg.id} style={{
                  display: 'flex', flexDirection: 'column', borderRadius: 12, overflow: 'hidden',
                  border: isFeat ? `2px solid ${GOLD}` : '1.5px solid #E2E8F0',
                  boxShadow: isFeat
                    ? `0 0 0 3px rgba(200,162,75,0.07), 0 6px 20px -6px rgba(15,30,51,0.18)`
                    : '0 2px 12px -4px rgba(15,30,51,0.08)',
                  breakInside: 'avoid', pageBreakInside: 'avoid',
                }}>

                  {/* Card header (navy) */}
                  <div style={{ background: isFeat ? NAVY : NAVY2, padding: '10px 12px', position: 'relative' }}>
                    {isFeat && !pkg.specialOffer && (
                      <div style={{
                        position: 'absolute', top: 8, insetInlineEnd: 8,
                        fontSize: 7, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em',
                        padding: '2px 7px', borderRadius: 999, background: GOLD, color: NAVY,
                      }}>
                        {locale === 'en' ? '★ Popular' : '★ الأكثر طلباً'}
                      </div>
                    )}
                    {pkg.specialOffer && (
                      <div style={{
                        position: 'absolute', top: 8, insetInlineEnd: 8,
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        fontSize: 7, fontWeight: 900,
                        padding: '2px 7px', borderRadius: 999, background: GOLD, color: NAVY,
                      }}>
                        <Sparkles style={{ width: 8, height: 8 }} />
                        {pkg.specialOffer.discountPct}% {m.pdf.discount}
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 22, height: 22, borderRadius: 6,
                        background: isFeat ? 'rgba(200,162,75,0.18)' : 'rgba(255,255,255,0.08)',
                        color: isFeat ? GOLD : 'rgba(255,255,255,0.45)',
                      }}>
                        {TIER_ICON[pkg.planTier] ?? <Layers style={{ width: 12, height: 12 }} />}
                      </span>
                      <p style={{ fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', color: isFeat ? GOLD : 'rgba(255,255,255,0.45)' }}>
                        {pkg.planTier}
                      </p>
                    </div>

                    <h2 style={{ color: '#fff', fontSize: 15, fontWeight: 900, lineHeight: 1.2, paddingInlineEnd: isFeat ? 54 : 0 }}>
                      {name}
                    </h2>
                    {desc && (
                      <p style={{ color: 'rgba(255,255,255,0.50)', fontSize: 10, marginTop: 4, lineHeight: 1.4 }}>
                        {desc}
                      </p>
                    )}
                  </div>

                  {/* Accent strip */}
                  <div style={{
                    height: isFeat ? 2 : 1,
                    background: isFeat
                      ? `linear-gradient(to ${isRtl ? 'left' : 'right'}, ${GOLD}, ${GOLD3}, rgba(200,162,75,0.1))`
                      : '#F1F5F9',
                  }} />

                  {/* Price */}
                  <div style={{ padding: '8px 12px', background: '#fff', borderBottom: '1px solid #F1F5F9' }}>
                    {monthly ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 3 }}>
                          <span style={{ fontSize: 24, fontWeight: 900, color: NAVY, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                            {monthly}
                          </span>
                          <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 500 }}>
                            {pkg.currency}{m.pdf.monthly}
                          </span>
                        </div>
                        {annual && (
                          <p style={{ fontSize: 10, color: '#64748B', marginBottom: 7, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                            <span>{annual} {pkg.currency}{m.pdf.annual}</span>
                            {pkg.specialOffer && (
                              <span style={{ textDecoration: 'line-through', color: '#CBD5E1', fontSize: 9 }}>
                                {Math.round(Number(pkg.annualPrice) / (1 - pkg.specialOffer.discountPct / 100)).toLocaleString()} {pkg.currency}
                              </span>
                            )}
                          </p>
                        )}
                      </>
                    ) : (
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#94A3B8', fontStyle: 'italic', marginBottom: 7 }}>
                        {locale === 'en' ? 'Contact us' : 'تواصل معنا'}
                      </p>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {setup && (
                        <span style={{ fontSize: 8, fontWeight: 600, padding: '2px 6px', borderRadius: 5, background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
                          {m.pdf.setup}: {setup} {pkg.currency}
                        </span>
                      )}
                      <span style={{ fontSize: 8, fontWeight: 600, padding: '2px 6px', borderRadius: 5, background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
                        {pkg.maxUsers ? `${pkg.maxUsers} ${m.pdf.users}` : m.pdf.unlimited}
                      </span>
                    </div>
                  </div>

                  {/* Features */}
                  {pkg.highlights.length > 0 && (
                    <div style={{ padding: '6px 12px 8px', background: '#fff', flex: 1 }}>
                      <p style={{ fontSize: 7.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#94A3B8', marginBottom: 7 }}>
                        {m.pdf.highlights}
                      </p>
                      <ul style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {pkg.highlights.map((h, i) => (
                          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                            <CheckCircle2 style={{ width: 11, height: 11, flexShrink: 0, marginTop: 1, color: isFeat ? GOLD : '#10B981' }} />
                            <span style={{ fontSize: 10, color: '#334155', lineHeight: 1.35 }}>{h}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Offer footer */}
                  {pkg.specialOffer && (
                    <div style={{ padding: '6px 12px', background: 'rgba(200,162,75,0.07)', borderTop: '1px solid rgba(200,162,75,0.18)' }}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: GOLD2, display: 'flex', alignItems: 'center', gap: 3, marginBottom: 2 }}>
                        <Sparkles style={{ width: 9, height: 9 }} />
                        {locale === 'en' ? pkg.specialOffer.titleEn : pkg.specialOffer.titleAr}
                      </p>
                      {pkg.specialOffer.validUntil && (
                        <p style={{ fontSize: 8.5, color: GOLD3 }}>
                          {m.pdf.validUntil} {pkg.specialOffer.validUntil}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Footer ── */}
        <div style={{ borderRadius: 12, overflow: 'hidden', background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY2} 100%)` }}>
          <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            {/* Brand */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <span style={{ color: '#fff', fontSize: 15, fontWeight: 900, letterSpacing: '0.04em' }}>Devora</span>
              <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)' }} />
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.50)' }}>{m.pdf.footer}</p>
            </div>
            {/* Contact */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 11, color: GOLD }}>✉</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.70)', direction: 'ltr', unicodeBidi: 'isolate' }}>devorasoftware@gmail.com</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 11, color: GOLD }}>📞</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.70)', direction: 'ltr', unicodeBidi: 'isolate' }}>01062800394</span>
              </div>
            </div>
            {/* Date */}
            <div style={{ flexShrink: 0, textAlign: isRtl ? 'start' : 'end' }}>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{today}</p>
              <p style={{ fontSize: 9, fontWeight: 600, color: 'rgba(200,162,75,0.75)' }}>devora.sa</p>
            </div>
          </div>
          <div style={{ height: 3, background: `linear-gradient(to right, ${GOLD}, ${GOLD2} 50%, ${GOLD})` }} />
        </div>

      </div>
    </div>
  );
}
