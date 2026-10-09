'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  /** The print sub-path, e.g. "reservations", "contracts", "deposits" */
  path: string;
  id: string;
  label: string;
}

/** Opens the printable company document in a new tab — same look as the export control. */
export function PrintButton({ path, id, label }: Props) {
  return (
    <Button
      type="button"
      variant="outline"
      size="md"
      leftIcon={<Printer className="h-4 w-4" />}
      onClick={() => window.open(`/print/${path}/${id}`, '_blank')}
    >
      {label}
    </Button>
  );
}
