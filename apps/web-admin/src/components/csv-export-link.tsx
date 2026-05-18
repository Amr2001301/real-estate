import Link from 'next/link';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  /** API path (without /v1) — must be on the route handler's whitelist. */
  path: string;
  /** Suggested filename for the browser download. */
  filename: string;
  /** Extra query params to forward to the upstream CSV endpoint. */
  params?: Record<string, string | undefined>;
  label?: string;
}

export function CsvExportLink({ path, filename, params, label = 'تصدير CSV' }: Props) {
  const qs = new URLSearchParams();
  qs.set('path', path);
  qs.set('filename', filename);
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v) qs.set(k, v);
  }
  return (
    <Link href={`/api/csv?${qs.toString()}`} prefetch={false}>
      <Button type="button" variant="outline" size="sm" leftIcon={<Download className="h-3.5 w-3.5" />}>
        {label}
      </Button>
    </Link>
  );
}
