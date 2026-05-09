import { Headphones } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

interface Props {
  className?: string;
}

export function SupportCard({ className }: Props) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl bg-sidebar-bg text-white p-6',
        'shadow-md',
        className,
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07] bg-gradient-to-br from-brand-400 via-transparent to-transparent"
      />
      <div className="relative flex items-start gap-4">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-300 ring-1 ring-inset ring-brand-500/20 shrink-0">
          <Headphones className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-brand-300">
            الدعم الفني
          </p>
          <h3 className="mt-1.5 text-base font-semibold leading-snug">
            هل تحتاج مساعدة في إدارة محفظتك؟
          </h3>
          <p className="mt-1 text-xs text-sidebar-text leading-relaxed">
            فريقنا متاح للإجابة على استفساراتك وتقديم الاستشارات العقارية على مدار الساعة.
          </p>
          <div className="mt-4">
            <Button
              variant="primary"
              size="sm"
              className="bg-brand-500 hover:bg-brand-600 text-white"
            >
              تواصل مع المستشار
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
