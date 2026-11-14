'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PrintButton({ label }: { label: string }) {
  return (
    <Button type="button" variant="outline" size="md" leftIcon={<Printer className="h-4 w-4" />} onClick={() => window.print()} className="print:hidden">
      {label}
    </Button>
  );
}
