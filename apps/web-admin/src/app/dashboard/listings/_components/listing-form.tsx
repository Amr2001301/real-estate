'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { AlertCircle, Building, Home, KeyRound, ImagePlus, Loader2, Star, X } from 'lucide-react';
import type { Locale } from '@/lib/locale';
import type { UnitTypeOption } from '@/lib/types';
import type { StaffOption } from '@/lib/options';
import { tx } from '@/lib/format';
import { cn } from '@/lib/cn';
import { uiT } from '@/messages/ui';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';
import { PremiumFormLayout, PremiumFormPanel } from '@/components/premium';
import { listingsT, LISTING_KINDS, type Listing, type ListingKind } from '@/components/listings/messages';
import { createListingAction, updateListingAction, type ListingFormState } from '../actions';

export interface ProjectOption {
  id: string;
  name: string;
  developer: { id: string; name: string };
  commissionPct: number | null;
}

const KIND_ICON: Record<ListingKind, typeof Building> = { PRIMARY: Building, RESALE: Home, RENT: KeyRound };
const FINISHING = ['CORE_AND_SHELL', 'SEMI_FINISHED', 'FULLY_FINISHED', 'FURNISHED'] as const;
const VIEWS = ['GARDEN', 'POOL', 'LAGOON', 'SEA', 'NILE', 'CLUB', 'LANDSCAPE', 'MAIN_STREET', 'SIDE_STREET'] as const;
const MAX_PHOTOS = 20;
const day = (v: string | null | undefined) => (v ? v.slice(0, 10) : '');

/** Upload one photo: a signed URL from the API, then straight to storage. */
async function uploadPhoto(file: File): Promise<string> {
  const res = await fetch('/api-proxy/listings/photos/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ contentType: file.type, sizeBytes: file.size, extension: file.name.split('.').pop() }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    throw new Error(Array.isArray(body?.message) ? body.message[0] : body?.message ?? String(res.status));
  }
  const { uploadUrl, publicUrl } = (await res.json()) as { uploadUrl: string; publicUrl?: string };
  const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
  if (!put.ok || !publicUrl) throw new Error(String(put.status));
  return publicUrl;
}

/** Add or edit a listing: the offer type, the unit, where, specs, price, owner, photos and agent. */
export function ListingForm({
  locale,
  listing,
  unitTypes,
  agents,
  projects = [],
}: {
  locale: Locale;
  listing?: Listing;
  unitTypes: UnitTypeOption[];
  agents: StaffOption[];
  /** BRK-5: the projects in the developer directory, for a primary sale. */
  projects?: ProjectOption[];
}) {
  const m = listingsT(locale);
  const f = m.form;
  const u = uiT(locale).pages.units;
  const action = listing ? updateListingAction.bind(null, listing.id) : createListingAction;
  const [state, formAction, pending] = useActionState<ListingFormState, FormData>(action, {});
  const [kind, setKind] = useState<ListingKind>(listing?.kind ?? 'RESALE');
  const [projectId, setProjectId] = useState(listing?.developerProjectId ?? '');
  const [developerName, setDeveloperName] = useState(listing?.developerName ?? '');
  const [projectName, setProjectName] = useState(listing?.projectName ?? '');
  function pickProject(id: string) {
    setProjectId(id);
    const p = projects.find((x) => x.id === id);
    if (p) {
      setDeveloperName(p.developer.name);
      setProjectName(p.name);
    }
  }
  const [photos, setPhotos] = useState<string[]>(listing?.photos ?? []);
  const [uploading, setUploading] = useState(0);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const label = 'block text-[12.5px] font-semibold text-slate-600';
  const hint = 'mt-1 block text-[11.5px] font-normal text-slate-500';

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    setPhotoError(null);
    const list = Array.from(files).slice(0, MAX_PHOTOS - photos.length);
    setUploading((n) => n + list.length);
    for (const file of list) {
      try {
        const url = await uploadPhoto(file);
        setPhotos((p) => (p.length < MAX_PHOTOS ? [...p, url] : p));
      } catch (e) {
        setPhotoError(`${f.photoError}: ${(e as Error).message}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  const nav = [
    { id: 'kind', num: '01', label: f.kind, sub: m.kind[kind] },
    { id: 'unit', num: '02', label: f.basics, sub: f.title },
    { id: 'location', num: '03', label: f.location, sub: kind === 'PRIMARY' ? f.developer : f.city },
    { id: 'specs', num: '04', label: f.specs, sub: f.area },
    { id: 'price', num: '05', label: f.pricing, sub: kind === 'RENT' ? f.rent : f.price },
    { id: 'owner', num: '06', label: f.owner, sub: f.ownerHint },
    { id: 'photos', num: '07', label: f.photos, sub: `${photos.length} / ${MAX_PHOTOS}` },
  ];

  return (
    <form action={formAction} data-testid="listing-form">
      <PremiumFormLayout navSections={nav} locale={locale} sidebarTitle={listing ? f.editTitle : f.newTitle} sidebarBadge={listing?.code ?? m.kind[kind]} sidebarInfo={f.desc}>
        {state.error && (
          <p role="alert" className="flex items-start gap-2 rounded-2xl bg-danger-500/10 px-4 py-3 text-[13px] font-medium text-danger-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {state.error}
          </p>
        )}

        <PremiumFormPanel id="kind" number="01" title={f.kind} description={listing ? f.kindLocked : m.kindHint[kind]}>
          <input type="hidden" name="kind" value={kind} />
          <div role="radiogroup" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {LISTING_KINDS.map((k) => {
              const Icon = KIND_ICON[k];
              const on = kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={Boolean(listing) && !on}
                  data-testid={`kind-${k}`}
                  onClick={() => setKind(k)}
                  className={cn(
                    'flex items-start gap-3 rounded-2xl border p-4 text-start transition-all disabled:opacity-40',
                    on
                      ? 'border-[#D8B66A] bg-[#D8B66A]/[0.08] shadow-[0_10px_24px_-14px_rgba(184,140,58,0.7)]'
                      : 'border-hairline hover:-translate-y-0.5 hover:border-[#D8B66A]/50',
                  )}
                >
                  <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border', on ? 'border-[#D8B66A]/60 bg-[#0E1626] text-[#E6C77E]' : 'border-hairline text-slate-500')}>
                    <Icon className="h-[18px] w-[18px] stroke-[1.6]" />
                  </span>
                  <span>
                    <span className="block text-[14px] font-bold text-slate-900">{m.kind[k]}</span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-slate-500">{m.kindHint[k]}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </PremiumFormPanel>

        <PremiumFormPanel id="unit" number="02" title={f.basics} description={f.panelUnit}>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <label className={cn(label, 'md:col-span-2')}>
              {f.title}
              <Input name="title" required minLength={3} maxLength={160} defaultValue={listing?.title} placeholder={f.titlePlaceholder} className="mt-1.5" data-testid="listing-title" />
            </label>
            <label className={label}>
              {f.unitType}
              <Select name="unitType" required defaultValue={listing?.unitType ?? ''} className="mt-1.5" data-testid="listing-type">
                <option value="" disabled>{f.pickType}</option>
                {unitTypes.filter((t) => t.active || t.code === listing?.unitType).map((t) => (
                  <option key={t.code} value={t.code}>{tx(t.name, locale)}</option>
                ))}
              </Select>
            </label>
            <label className={label}>
              {f.agent}
              <Select name="agentId" defaultValue={listing?.agentId ?? ''} className="mt-1.5">
                <option value="">{f.noAgent}</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.fullName}</option>)}
              </Select>
            </label>
            <label className={cn(label, 'md:col-span-2')}>
              {f.description}
              <Textarea name="description" rows={4} maxLength={4000} defaultValue={listing?.description ?? ''} placeholder={f.descriptionPlaceholder} className="mt-1.5" />
            </label>
          </div>
        </PremiumFormPanel>

        <PremiumFormPanel id="location" number="03" title={f.location} description={f.panelLocation}>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <label className={label}>
              {f.city}
              <Input name="city" required minLength={2} defaultValue={listing?.city} className="mt-1.5" data-testid="listing-city" />
            </label>
            <label className={label}>
              {f.district}
              <Input name="district" defaultValue={listing?.district ?? ''} className="mt-1.5" />
            </label>
            <label className={label}>
              {f.compound}
              <Input name="compound" defaultValue={listing?.compound ?? ''} className="mt-1.5" />
            </label>
            <label className={label}>
              {f.address}
              <Input name="address" defaultValue={listing?.address ?? ''} className="mt-1.5" />
            </label>
            {kind === 'PRIMARY' && projects.length > 0 && (
              <label className={cn(label, 'md:col-span-2')}>
                {f.directoryProject}
                <Select name="developerProjectId" value={projectId} onChange={(e) => pickProject(e.target.value)} className="mt-1.5" data-testid="listing-project">
                  <option value="">{f.noDirectoryProject}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.developer.name} — {p.name}</option>
                  ))}
                </Select>
                <span className={hint}>{f.directoryHint}</span>
              </label>
            )}
            <label className={label}>
              {f.developer}
              <Input name="developerName" required={kind === 'PRIMARY' && !projectId} value={developerName} onChange={(e) => setDeveloperName(e.target.value)} className="mt-1.5" data-testid="listing-developer" />
              {kind === 'PRIMARY' && <span className={hint}>{f.developerRequired}</span>}
            </label>
            <label className={label}>
              {f.project}
              <Input name="projectName" value={projectName} onChange={(e) => setProjectName(e.target.value)} className="mt-1.5" />
            </label>
          </div>
        </PremiumFormPanel>

        <PremiumFormPanel id="specs" number="04" title={f.specs} description={f.panelSpecs}>
          <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
            <label className={label}>
              {f.area}
              <Input name="area" type="number" required min={1} step="0.01" defaultValue={listing?.area ?? ''} className="mt-1.5" dir="ltr" data-testid="listing-area" />
            </label>
            <label className={label}>
              {f.bedrooms}
              <Input name="bedrooms" type="number" min={0} defaultValue={listing?.bedrooms ?? ''} className="mt-1.5" dir="ltr" />
            </label>
            <label className={label}>
              {f.bathrooms}
              <Input name="bathrooms" type="number" min={0} defaultValue={listing?.bathrooms ?? ''} className="mt-1.5" dir="ltr" />
            </label>
            <label className={label}>
              {f.floor}
              <Input name="floor" type="number" min={-5} defaultValue={listing?.floor ?? ''} className="mt-1.5" dir="ltr" />
            </label>
            <label className={cn(label, 'col-span-2 md:col-span-1')}>
              {f.finishing}
              <Select name="finishing" defaultValue={listing?.finishing ?? ''} className="mt-1.5">
                <option value="">{f.none}</option>
                {FINISHING.map((v) => <option key={v} value={v}>{u.finishingLabels[v] ?? v}</option>)}
              </Select>
            </label>
            <label className={cn(label, 'col-span-2 md:col-span-1')}>
              {f.view}
              <Select name="view" defaultValue={listing?.view ?? ''} className="mt-1.5">
                <option value="">{f.none}</option>
                {VIEWS.map((v) => <option key={v} value={v}>{u.viewLabels[v] ?? v}</option>)}
              </Select>
            </label>
            <label className={cn(label, 'col-span-2')}>
              {f.delivery}
              <Input name="deliveryDate" type="date" defaultValue={day(listing?.deliveryDate)} className="mt-1.5" />
            </label>
          </div>
        </PremiumFormPanel>

        <PremiumFormPanel id="price" number="05" title={f.pricing} description={kind === 'RENT' ? f.panelPriceRent : f.panelPriceSale}>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <label className={label}>
              {kind === 'RENT' ? f.rent : f.price}
              <Input name="price" type="number" required min={1} step="0.01" defaultValue={listing ? Number(listing.price) : ''} className="mt-1.5" dir="ltr" data-testid="listing-price" />
            </label>
            {kind !== 'RENT' && (
              <label className={label}>
                {f.downPayment}
                <Input name="downPayment" type="number" min={0} step="0.01" defaultValue={listing?.downPayment ? Number(listing.downPayment) : ''} className="mt-1.5" dir="ltr" />
                <span className={hint}>{f.downPaymentHint}</span>
              </label>
            )}
          </div>
        </PremiumFormPanel>

        <PremiumFormPanel id="owner" number="06" title={f.owner} description={f.ownerHint}>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <label className={label}>
              {f.ownerName}
              <Input name="ownerName" defaultValue={listing?.ownerName ?? ''} className="mt-1.5" />
            </label>
            <label className={label}>
              {f.ownerPhone}
              <Input name="ownerPhone" type="tel" defaultValue={listing?.ownerPhone ?? ''} className="mt-1.5" dir="ltr" />
            </label>
          </div>
        </PremiumFormPanel>

        <PremiumFormPanel id="photos" number="07" title={f.photos} description={f.photosHint}>
          {photos.map((p) => <input key={p} type="hidden" name="photos" value={p} />)}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((p, i) => (
              <figure key={p} className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-hairline">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p} alt="" className="h-full w-full object-cover" />
                {i === 0 ? (
                  <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#0E1626]/85 px-2 py-0.5 text-[11px] font-bold text-[#E6C77E]">
                    <Star className="h-3 w-3" /> {f.cover}
                  </span>
                ) : (
                  <button type="button" onClick={() => setPhotos((ps) => [p, ...ps.filter((x) => x !== p)])} className="absolute start-2 top-2 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100">
                    {f.makeCover}
                  </button>
                )}
                <button
                  type="button"
                  aria-label={f.removePhoto}
                  onClick={() => setPhotos((ps) => ps.filter((x) => x !== p))}
                  className="absolute end-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/65"
                >
                  <X className="h-4 w-4" />
                </button>
              </figure>
            ))}
            {photos.length + uploading < MAX_PHOTOS && (
              <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#D8B66A]/60 bg-[#D8B66A]/[0.05] text-[13px] font-bold text-brand-700 transition-colors hover:bg-[#D8B66A]/[0.1]">
                {uploading > 0 ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6 stroke-[1.6]" />}
                {uploading > 0 ? f.uploading : f.addPhoto}
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => { void addPhotos(e.target.files); e.target.value = ''; }} data-testid="listing-photo-input" />
              </label>
            )}
          </div>
          {photoError && <p role="alert" className="mt-3 text-[12.5px] font-medium text-danger-700">{photoError}</p>}
        </PremiumFormPanel>

        <FormFooter
          sticky
          secondary={
            <Link href={(listing ? `/dashboard/listings/${listing.id}` : '/dashboard/listings') as never}>
              <Button type="button" variant="ghost" size="md">{f.cancel}</Button>
            </Link>
          }
          primary={
            <Button type="submit" variant="primary" size="md" disabled={pending || uploading > 0} data-testid="listing-save">
              {pending ? f.saving : f.save}
            </Button>
          }
        />
      </PremiumFormLayout>
    </form>
  );
}
