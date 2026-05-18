'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import type { BrokerUser, BrokerUserStatus } from '@/lib/types';

function str(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (v === null) return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

function bool(formData: FormData, key: string): boolean {
  return formData.get(key) === 'on' || formData.get(key) === 'true';
}

export interface TeamFormState {
  error?: string;
}

export async function createTeamMemberAction(
  _prev: TeamFormState,
  formData: FormData,
): Promise<TeamFormState> {
  const fullName = str(formData, 'fullName');
  if (!fullName) return { error: 'الاسم الكامل مطلوب' };
  const email = str(formData, 'email');
  const phone = str(formData, 'phone');
  if (!email && !phone) return { error: 'يرجى إدخال بريد إلكتروني أو رقم جوال' };

  const payload = {
    fullName,
    email,
    phone,
    password: str(formData, 'password'),
    jobTitle: str(formData, 'jobTitle'),
    locale: (str(formData, 'locale') as 'ar' | 'en' | undefined) ?? 'ar',
    isPrimaryContact: bool(formData, 'isPrimaryContact'),
    canManageBrokerUsers: bool(formData, 'canManageBrokerUsers'),
    canViewCommissions: formData.get('canViewCommissions') === null
      ? true
      : bool(formData, 'canViewCommissions'),
  };

  let created: BrokerUser;
  try {
    created = await api.post<BrokerUser>('/portal/team', payload);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath('/portal/team');
  redirect(`/portal/team/${created.id}/edit`);
}

export async function updateTeamMemberAction(
  id: string,
  _prev: TeamFormState,
  formData: FormData,
): Promise<TeamFormState> {
  const payload: Record<string, unknown> = {
    fullName: str(formData, 'fullName'),
    email: str(formData, 'email'),
    phone: str(formData, 'phone'),
    jobTitle: formData.get('jobTitle') === null ? undefined : str(formData, 'jobTitle') ?? null,
    locale: (str(formData, 'locale') as 'ar' | 'en' | undefined) ?? undefined,
    isPrimaryContact: bool(formData, 'isPrimaryContact'),
    canManageBrokerUsers: bool(formData, 'canManageBrokerUsers'),
    canViewCommissions: bool(formData, 'canViewCommissions'),
  };
  try {
    await api.patch(`/portal/team/${id}`, payload);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath('/portal/team');
  revalidatePath(`/portal/team/${id}/edit`);
  return {};
}

export async function setTeamMemberStatusAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '') as BrokerUserStatus;
  if (!id || !status) return;
  let errMessage: string | null = null;
  try {
    await api.patch(`/portal/team/${id}/status`, { status });
  } catch (e) {
    errMessage = (e as Error).message;
  }
  revalidatePath('/portal/team');
  // `redirect()` throws a NEXT_REDIRECT internally; never wrap it in
  // try/catch above or the success path would be swallowed.
  if (errMessage) {
    redirect(`/portal/team?err=${encodeURIComponent(errMessage)}`);
  }
  redirect('/portal/team');
}
