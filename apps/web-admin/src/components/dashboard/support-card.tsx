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
        'relative overflow-hidden rounded-2xl bg-navy text-white p-5',
        'shadow-soft border border-navy-700',
        'transition-all duration-150 hover:shadow-card',
        className,
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.05] bg-gradient-to-br from-brand-400 via-transparent to-transparent"
      />
      <div className="relative flex items-start gap-4">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/20 text-brand-200 ring-1 ring-inset ring-brand-500/30 shrink-0">
          <Headphones className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-2xs font-semibold uppercase tracking-wider text-brand-300">
            الدعم الفني
          </p>
          <h3 className="mt-1.5 text-sm font-semibold leading-snug">
            هل تحتاج مساعدة في إدارة محفظتك؟
          </h3>
          <p className="mt-1 text-xs text-navy-200 leading-relaxed">
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
