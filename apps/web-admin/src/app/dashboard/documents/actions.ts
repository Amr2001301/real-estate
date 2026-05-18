'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import type {
  DocumentCategory,
  DocumentItem,
  DocumentOwnerType,
  DocumentVisibility,
} from '@/lib/types';

export interface DocumentFormState {
  error?: string;
}

function str(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (v === null) return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

function int(formData: FormData, key: string): number | undefined {
  const s = str(formData, key);
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
}

export async function createDocumentAction(
  _prev: DocumentFormState,
  formData: FormData,
): Promise<DocumentFormState> {
  const ownerType = str(formData, 'ownerType') as DocumentOwnerType | undefined;
  const ownerId = str(formData, 'ownerId');
  const title = str(formData, 'title');
  const fileUrl = str(formData, 'fileUrl');
  if (!ownerType) return { error: 'نوع المالك مطلوب' };
  if (!ownerId) return { error: 'معرّف المالك مطلوب' };
  if (!title) return { error: 'العنوان مطلوب' };
  if (!fileUrl) return { error: 'رابط الملف مطلوب' };

  const payload = {
    ownerType,
    ownerId,
    category: (str(formData, 'category') as DocumentCategory | undefined) ?? 'OTHER',
    title,
    description: str(formData, 'description'),
    fileUrl,
    fileName: str(formData, 'fileName'),
    mimeType: str(formData, 'mimeType'),
    sizeBytes: int(formData, 'sizeBytes'),
    visibility:
      (str(formData, 'visibility') as DocumentVisibility | undefined) ?? 'ADMIN_ONLY',
  };

  let created: DocumentItem;
  try {
    created = await api.post<DocumentItem>('/documents', payload);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath('/dashboard/documents');
  redirect(`/dashboard/documents/${created.id}`);
}

export async function softDeleteDocumentAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  let errMessage: string | null = null;
  try {
    await api.delete(`/documents/${id}`);
  } catch (e) {
    errMessage = (e as Error).message;
  }
  revalidatePath('/dashboard/documents');
  if (errMessage) {
    redirect(`/dashboard/documents?err=${encodeURIComponent(errMessage)}`);
  }
  redirect('/dashboard/documents?ok=1');
}
