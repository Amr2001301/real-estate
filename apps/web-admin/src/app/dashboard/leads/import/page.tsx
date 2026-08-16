'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowLeft,
  Loader2,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { uiT } from '@/messages/ui';

interface ImportRow {
  rowNumber: number;
  name?: string;
  phone?: string;
  email?: string;
  notes?: string;
  valid: boolean;
  error?: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  total: number;
  errors: Array<{ row: number; message: string }>;
}

type Stage = 'idle' | 'previewing' | 'importing' | 'done';

async function postFile(endpoint: string, file: File): Promise<Response> {
  const fd = new FormData();
  fd.append('file', file);
  return fetch(`/api-proxy${endpoint}`, {
    method: 'POST',
    body: fd,
  });
}

export default function LeadsImportPage() {
  // locale is always 'ar' on first render; switching is handled at layout level
  const m = uiT('ar').leadsImportPage;

  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function handleFile(f: File) {
    setFile(f);
    setRows([]);
    setResult(null);
    setError(null);
    setStage('idle');
  }

  async function handlePreview() {
    if (!file) return;
    setStage('previewing');
    setError(null);
    try {
      const res = await postFile('/leads/import/preview', file);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? m.httpError(res.status));
      }
      const data = await res.json();
      setRows(data.rows ?? []);
      setStage('idle');
    } catch (e) {
      setError((e as Error).message);
      setStage('idle');
    }
  }

  async function handleImport() {
    if (!file) return;
    setStage('importing');
    setError(null);
    try {
      const res = await postFile('/leads/import', file);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? m.httpError(res.status));
      }
      const data: ImportResult = await res.json();
      setResult(data);
      setStage('done');
    } catch (e) {
      setError((e as Error).message);
      setStage('idle');
    }
  }

  function reset() {
    setFile(null);
    setRows([]);
    setResult(null);
    setError(null);
    setStage('idle');
    if (inputRef.current) inputRef.current.value = '';
  }

  const validRows = rows.filter((r) => r.valid);
  const invalidRows = rows.filter((r) => !r.valid);
  const isPreviewing = stage === 'previewing';
  const isImporting = stage === 'importing';

  return (
    <div className="space-y-5 pb-8">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href="/dashboard/leads" className="hover:text-brand-600 transition-colors">
              {m.breadcrumbLeads}
            </Link>
            <span>/</span>
            <span>{m.breadcrumbImport}</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">{m.title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {m.subtitle}
          </p>
        </div>
        <Link href="/dashboard/leads">
          <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>
            {m.btnBack}
          </Button>
        </Link>
      </div>

      {/* Template hint */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          {m.templateHint} <strong>{m.templateColName}</strong> · <strong>{m.templateColPhone}</strong>. {m.templateOptional}{' '}
          <strong>{m.templateColEmail}</strong> · <strong>{m.templateColNotes}</strong>. {m.templateFirstRow}
        </div>
      </div>

      {/* Drop zone */}
      {!file && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) handleFile(f);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed cursor-pointer transition-colors py-16 ${
            dragging
              ? 'border-brand-400 bg-brand-50'
              : 'border-slate-200 bg-slate-50 hover:border-brand-300 hover:bg-brand-50/50'
          }`}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-100">
            <FileSpreadsheet className="h-7 w-7 text-brand-500" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-slate-700">{m.dropZoneText}</p>
            <p className="text-sm text-slate-400 mt-1">{m.dropZoneSubText}</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>
      )}

      {/* File selected */}
      {file && stage !== 'done' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 border border-green-100">
                <FileSpreadsheet className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">{file.name}</p>
                <p className="text-xs text-slate-400">
                  {(file.size / 1024).toFixed(0)} KB
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handlePreview}
                disabled={isPreviewing || isImporting}
                leftIcon={isPreviewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : undefined}
              >
                {isPreviewing ? m.btnPreviewPending : m.btnPreview}
              </Button>
              <button
                onClick={reset}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label={m.ariaRemoveFile}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* Preview table */}
      {rows.length > 0 && stage !== 'done' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-slate-800">{m.previewTitle}</h2>
              <span className="rounded-full bg-brand-50 border border-brand-100 px-2.5 py-0.5 text-xs font-bold text-brand-700">
                {rows.length} {m.previewRowSuffix}
              </span>
              {invalidRows.length > 0 && (
                <span className="rounded-full bg-danger-50 border border-danger-100 px-2.5 py-0.5 text-xs font-bold text-danger-700">
                  {invalidRows.length} {m.previewErrorSuffix}
                </span>
              )}
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={handleImport}
              disabled={isImporting || validRows.length === 0}
              leftIcon={isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            >
              {isImporting ? m.btnImportPending : m.btnImport.replace('{n}', String(validRows.length))}
            </Button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="py-3 px-4 text-start text-xs font-semibold text-slate-500 w-10">{m.colNumber}</th>
                    <th className="py-3 px-4 text-start text-xs font-semibold text-slate-500">{m.colName}</th>
                    <th className="py-3 px-4 text-start text-xs font-semibold text-slate-500">{m.colPhone}</th>
                    <th className="py-3 px-4 text-start text-xs font-semibold text-slate-500">{m.colEmail}</th>
                    <th className="py-3 px-4 text-start text-xs font-semibold text-slate-500">{m.colNotes}</th>
                    <th className="py-3 px-4 text-end text-xs font-semibold text-slate-500">{m.colStatus}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((row) => (
                    <tr
                      key={row.rowNumber}
                      className={`transition-colors ${row.valid ? 'hover:bg-slate-50/60' : 'bg-danger-50/40'}`}
                    >
                      <td className="py-2.5 px-4 text-xs text-slate-400">{row.rowNumber}</td>
                      <td className="py-2.5 px-4 font-medium text-slate-800">{row.name ?? <span className="text-danger-500 italic text-xs">{m.missingValue}</span>}</td>
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-700">{row.phone ?? <span className="text-danger-500 italic">{m.missingValue}</span>}</td>
                      <td className="py-2.5 px-4 text-xs text-slate-500">{row.email ?? '—'}</td>
                      <td className="py-2.5 px-4 text-xs text-slate-400 max-w-[180px] truncate">{row.notes ?? '—'}</td>
                      <td className="py-2.5 px-4 text-end">
                        {row.valid ? (
                          <CheckCircle2 className="inline h-4 w-4 text-success-500" />
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-danger-600">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            {row.error}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Done result */}
      {stage === 'done' && result && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-4 border-b border-slate-100 bg-gradient-to-l from-success-50 to-white px-6 py-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success-100">
              <CheckCircle2 className="h-6 w-6 text-success-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">{m.doneTitle}</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {m.doneSubtitle.replace('{n}', String(result.total))}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-x-reverse divide-slate-100 px-6 py-5">
            <div className="pe-6">
              <p className="text-2xl font-bold text-success-600">{result.imported}</p>
              <p className="text-xs text-slate-500 mt-0.5">{m.doneImported}</p>
            </div>
            <div className="px-6">
              <p className="text-2xl font-bold text-amber-500">{result.skipped}</p>
              <p className="text-xs text-slate-500 mt-0.5">{m.doneSkipped}</p>
            </div>
            <div className="ps-6">
              <p className="text-2xl font-bold text-danger-500">{result.errors.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">{m.doneErrors}</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="border-t border-slate-100 px-6 pb-5">
              <p className="text-xs font-semibold text-slate-500 mb-2">{m.doneErrorsTitle}</p>
              <ul className="space-y-1">
                {result.errors.slice(0, 10).map((e) => (
                  <li key={e.row} className="text-xs text-danger-600 flex items-start gap-2">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>{m.doneErrorRow} {e.row}: {e.message}</span>
                  </li>
                ))}
                {result.errors.length > 10 && (
                  <li className="text-xs text-slate-400">{m.doneMoreErrors.replace('{n}', String(result.errors.length - 10))}</li>
                )}
              </ul>
            </div>
          )}
          <div className="border-t border-slate-100 px-6 py-4 flex items-center gap-3">
            <Link href="/dashboard/leads">
              <Button variant="primary" size="sm">
                {m.btnViewAll}
              </Button>
            </Link>
            <Button variant="secondary" size="sm" onClick={reset}>
              {m.btnImportAnother}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
