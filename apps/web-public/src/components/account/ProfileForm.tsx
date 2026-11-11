'use client';

import { useRef, useState } from 'react';
import { Save, Camera, KeyRound, ChevronDown, Loader2, Check, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/cn';
import { updateProfileAction, uploadAvatarAction, changePasswordAction, confirmPhoneAction } from '@/lib/account-actions';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { FormError } from '@/components/states/FormError';
import { InlineNotice } from '@/components/states/InlineNotice';
import { useSiteLocale } from '@/components/locale/SiteLocaleProvider';
import { accountT } from '@/messages/account';

const PHONE_RE = /^\+?[1-9]\d{7,14}$/;
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

type Status = 'idle' | 'submitting' | 'success' | 'error';
type AvatarStatus = 'idle' | 'uploading' | 'success' | 'error';

/** First letters of the first two name words — Arabic-friendly avatar fallback. */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '؟';
  if (parts.length === 1) return (parts[0] ?? '').slice(0, 2);
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
}

/**
 * Password input with a self-contained show/hide eye toggle. Defined at module
 * scope (not inside ProfileForm) so its visibility state survives parent
 * re-renders. The toggle sits at the input's end with comfortable padding.
 */
function PasswordInput({
  invalid,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  const t = accountT(useSiteLocale()).profile;
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      {/* Input is dir="ltr" (passwords read LTR), so use PHYSICAL sides: the
          eye sits on the left with matching left padding; Arabic context aside,
          the toggle never overlaps the password glyphs. */}
      <Input {...rest} type={show ? 'text' : 'password'} dir="ltr" invalid={invalid} className="pl-10 pr-4" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? t.hidePassword : t.showPassword}
        className="absolute inset-y-0 left-3 flex items-center text-ink-muted/70 transition-colors hover:text-ink-strong"
      >
        {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}

/**
 * Editable profile card body: premium avatar upload + a 2-column credential
 * grid + a collapsible password panel. All three are now fully wired:
 *  • fullName + phone  → updateProfileAction (PATCH /users/me); a new phone
 *                        is confirmed with the code sent to it
 *                        (confirmPhoneAction)
 *  • avatar            → uploadAvatarAction (POST /users/me/avatar, MinIO)
 *  • password          → changePasswordAction (POST /auth/change-password)
 * Email is intentionally omitted — it can't be changed here (backend), and it's
 * already shown read-only in the "معلومات الحساب" card.
 */
export function ProfileForm({
  initialFullName,
  initialPhone,
  initialAvatarUrl,
}: {
  initialFullName: string;
  initialPhone: string;
  initialAvatarUrl: string | null;
}) {
  const t = accountT(useSiteLocale()).profile;
  const [fullName, setFullName] = useState(initialFullName);
  const [phone, setPhone] = useState(initialPhone);
  // The current (confirmed) number, and the code step for a new one.
  const [savedPhone, setSavedPhone] = useState(initialPhone);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [codeStatus, setCodeStatus] = useState<Status>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>('idle');
  const [topError, setTopError] = useState('');

  // Avatar — persisted URL + transient local preview during upload.
  const fileRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [preview, setPreview] = useState<string | null>(null);
  const [avatarStatus, setAvatarStatus] = useState<AvatarStatus>('idle');
  const [avatarError, setAvatarError] = useState('');

  // Password panel.
  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [pwStatus, setPwStatus] = useState<Status>('idle');
  const [pwTopError, setPwTopError] = useState('');

  async function onPickPhoto(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    // Allow re-selecting the same file later.
    ev.target.value = '';
    if (!file) return;

    if (!AVATAR_TYPES.includes(file.type)) {
      setAvatarStatus('error');
      setAvatarError(t.badType);
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setAvatarStatus('error');
      setAvatarError(t.tooBig);
      return;
    }

    // Optimistic local preview while the upload runs.
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const localUrl = URL.createObjectURL(file);
    objectUrlRef.current = localUrl;
    setPreview(localUrl);
    setAvatarStatus('uploading');
    setAvatarError('');

    const fd = new FormData();
    fd.append('file', file);
    const res = await uploadAvatarAction(fd);

    if (res.ok) {
      setAvatarUrl(res.avatarUrl);
      setAvatarStatus('success');
    } else {
      // Roll back the preview to whatever was persisted before.
      setPreview(null);
      setAvatarStatus('error');
      setAvatarError(res.error);
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (fullName.trim().length < 2) e.fullName = t.fullNameRequired;
    if (!PHONE_RE.test(phone.trim().replace(/[\s-]/g, '')))
      e.phone = t.phoneInvalid;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setStatus('submitting');
    setTopError('');

    const res = await updateProfileAction({ fullName: fullName.trim(), phone: phone.trim(), initialPhone: savedPhone });

    if (res.ok) {
      setStatus('success');
      setCodeSent(!!res.codeSent);
      setCode('');
      setCodeError('');
      setCodeStatus('idle');
    } else {
      setStatus('error');
      if (res.field) setErrors((prev) => ({ ...prev, [res.field as string]: res.error }));
      else setTopError(res.error);
    }
  }

  async function onConfirmPhone() {
    setCodeStatus('submitting');
    setCodeError('');
    const res = await confirmPhoneAction(code);
    if (res.ok) {
      setCodeStatus('success');
      setSavedPhone(phone.trim());
      setCodeSent(false);
    } else {
      setCodeStatus('error');
      setCodeError(res.error);
    }
  }

  async function onChangePassword() {
    const e: Record<string, string> = {};
    if (!currentPassword) e.currentPassword = t.currentRequired;
    if (newPassword.length < 8) e.newPassword = t.newMin;
    if (confirmPassword !== newPassword) e.confirmPassword = t.mismatch;
    setPwErrors(e);
    if (Object.keys(e).length > 0) return;

    setPwStatus('submitting');
    setPwTopError('');
    const res = await changePasswordAction({ currentPassword, newPassword });

    if (res.ok) {
      setPwStatus('success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setPwStatus('error');
      if (res.field) setPwErrors((prev) => ({ ...prev, [res.field as string]: res.error }));
      else setPwTopError(res.error);
    }
  }

  const initials = getInitials(fullName || initialFullName);
  const shownImage = preview ?? avatarUrl;

  return (
    <div className="space-y-7">
      {/* ── Premium avatar block ── */}
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        <div className="relative shrink-0">
          <div
            className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gold-400/15 ring-1 ring-hairline"
            style={
              shownImage
                ? { backgroundImage: `url(${shownImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                : undefined
            }
          >
            {!shownImage && <span className="font-display text-2xl font-semibold text-gold-700 dark:text-gold-300">{initials}</span>}
            {avatarStatus === 'uploading' && (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-navy/55 backdrop-blur-[1px]">
                <Loader2 className="h-6 w-6 animate-spin text-gold-200" aria-hidden />
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={avatarStatus === 'uploading'}
            aria-label={t.changePhoto}
            className="absolute -bottom-1 -left-1 inline-flex h-9 w-9 items-center justify-center rounded-full bg-gold-400 text-[#1B1206] ring-2 ring-surface transition-colors hover:bg-gold-300 disabled:opacity-60"
          >
            <Camera className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="text-center sm:text-start">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={avatarStatus === 'uploading'}
            className="!rounded-full"
          >
            <Camera className="h-4 w-4" aria-hidden />
            {avatarStatus === 'uploading' ? t.uploading : t.changePhoto}
          </Button>
          {avatarStatus === 'success' ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-success">
              <Check className="h-3.5 w-3.5" aria-hidden />
              {t.photoUpdated}
            </p>
          ) : avatarStatus === 'error' ? (
            <p className="mt-2 text-xs font-medium text-error">{avatarError}</p>
          ) : (
            <p className="mt-2 text-xs text-ink-muted">{t.photoHint}</p>
          )}
        </div>

        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickPhoto} />
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-6 border-t border-hairline pt-7">
        {/* ── Credentials grid ── */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label={t.fullName} required>
            <Input
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (status !== 'idle') setStatus('idle');
              }}
              invalid={!!errors.fullName}
              placeholder={t.fullNameExample}
              autoComplete="name"
            />
            <FormError>{errors.fullName}</FormError>
          </Field>

          <Field label={t.phone} required>
            <Input
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (status !== 'idle') setStatus('idle');
              }}
              invalid={!!errors.phone}
              placeholder="+2010XXXXXXXX"
              inputMode="tel"
              dir="ltr"
              autoComplete="tel"
            />
            <FormError>{errors.phone}</FormError>
          </Field>
        </div>

        {codeSent && (
          <div className="space-y-3 rounded-2xl border border-hairline bg-surface-soft/60 p-4">
            <p className="text-sm text-ink-strong">
              {t.codeSentBefore} <span dir="ltr">{phone.trim()}</span>. {t.codeSentMiddle}{' '}
              <span dir="ltr">{savedPhone || '—'}</span> {t.codeSentAfter}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <Field label={t.codeLabel} required>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  invalid={!!codeError}
                  placeholder="000000"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  dir="ltr"
                />
                <FormError>{codeError}</FormError>
              </Field>
              <Button
                type="button"
                size="md"
                onClick={onConfirmPhone}
                disabled={codeStatus === 'submitting' || code.trim().length !== 6}
                className="sm:mt-7"
              >
                {codeStatus === 'submitting' ? t.confirming : t.confirmPhone}
              </Button>
            </div>
          </div>
        )}
        {codeStatus === 'success' && <InlineNotice tone="success">{t.phoneChanged}</InlineNotice>}

        {/* ── Password panel (collapsible, fully wired) ── */}
        <div className="rounded-2xl border border-hairline bg-surface-soft/40">
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-expanded={showPassword}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-start transition-colors hover:bg-surface-soft/70"
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-400/15 text-gold-700 dark:text-gold-300">
              <KeyRound className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink-strong">{t.changePassword}</span>
              <span className="block text-xs text-ink-muted">{t.changePasswordSub}</span>
            </span>
            <ChevronDown
              className={cn('h-5 w-5 shrink-0 text-ink-muted transition-transform duration-200', showPassword && 'rotate-180')}
              aria-hidden
            />
          </button>

          {showPassword && (
            <div className="space-y-4 px-4 pb-4 pt-1">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label={t.currentPassword} className="md:col-span-2">
                  <PasswordInput
                    placeholder="••••••••"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      if (pwStatus !== 'idle') setPwStatus('idle');
                    }}
                    invalid={!!pwErrors.currentPassword}
                  />
                  <FormError>{pwErrors.currentPassword}</FormError>
                </Field>
                <Field label={t.newPassword}>
                  <PasswordInput
                    placeholder="••••••••"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (pwStatus !== 'idle') setPwStatus('idle');
                    }}
                    invalid={!!pwErrors.newPassword}
                  />
                  <FormError>{pwErrors.newPassword}</FormError>
                </Field>
                <Field label={t.confirmPassword}>
                  <PasswordInput
                    placeholder="••••••••"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (pwStatus !== 'idle') setPwStatus('idle');
                    }}
                    invalid={!!pwErrors.confirmPassword}
                  />
                  <FormError>{pwErrors.confirmPassword}</FormError>
                </Field>
              </div>

              {pwStatus === 'success' && (
                <InlineNotice tone="success">{t.passwordChanged}</InlineNotice>
              )}
              {pwStatus === 'error' && pwTopError && <InlineNotice tone="error">{pwTopError}</InlineNotice>}

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onChangePassword}
                  disabled={pwStatus === 'submitting'}
                >
                  {pwStatus === 'submitting' ? t.updating : t.updatePassword}
                </Button>
              </div>
            </div>
          )}
        </div>

        {status === 'success' && <InlineNotice tone="success">{t.saved}</InlineNotice>}
        {status === 'error' && topError && <InlineNotice tone="error">{topError}</InlineNotice>}

        {/* ── Save: full-width on mobile, end-aligned on desktop ── */}
        <div className="flex flex-col-reverse gap-3 border-t border-hairline pt-6 sm:flex-row sm:items-center sm:justify-end">
          <Button type="submit" size="md" disabled={status === 'submitting'} className="w-full sm:w-auto">
            {status === 'submitting' ? (
              t.saving
            ) : (
              <>
                <Save className="h-5 w-5" aria-hidden />
                {t.save}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
