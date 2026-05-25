import { routes } from '@/lib/routes';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/states/EmptyState';

/**
 * Shared "section being prepared" placeholder for account pages whose real data
 * UI lands in a later step. Reuses EmptyState so it matches the public site.
 */
export function SectionPlaceholder({
  title,
  icon,
}: {
  title: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl text-ink-strong">{title}</h1>
      <EmptyState
        title={`${title} قيد التجهيز`}
        message="نعمل على تجهيز هذا القسم، وسيتم تفعيله في الخطوات التالية."
        icon={icon}
        action={
          <ButtonLink href={routes.account} variant="outline" size="md">
            العودة إلى لوحة الحساب
          </ButtonLink>
        }
      />
    </div>
  );
}
