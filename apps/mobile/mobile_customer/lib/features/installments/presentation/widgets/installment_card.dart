import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../domain/entities/installment.dart';
import 'installment_status_chip.dart';

/// Card for a single installment row. Shows the amount, due date, project
/// + unit context, the status chip, an optional rejection-reason banner,
/// and a "Submit / Resubmit proof" CTA when the installment is still
/// payable.
class InstallmentCard extends StatelessWidget {
  const InstallmentCard({super.key, required this.installment});

  final Installment installment;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    final projectName =
        (lang == 'ar' ? installment.projectNameAr : installment.projectNameEn) ??
            installment.projectNameAr ??
            installment.projectNameEn;
    final unit = installment.unitCode;
    final subtitle = [projectName, unit].whereType<String>().join(' · ');

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  PriceFormatter.formatString(installment.amount, languageCode: lang),
                  style: theme.textTheme.titleMedium,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              InstallmentStatusChip(installment: installment),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            l10n.installmentDueOn(
              DateFormatter.shortDate(installment.dueDate, languageCode: lang),
            ),
            style: theme.textTheme.bodyMedium?.copyWith(color: colors.inkMuted),
          ),
          if (subtitle.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xxs),
            Text(
              subtitle,
              style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted),
            ),
          ],
          if (installment.latestProof?.reviewStatus == PaymentProofStatus.rejected &&
              installment.latestProof?.rejectionReason != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: colors.error.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                l10n.paymentProofRejectionReason(
                  installment.latestProof!.rejectionReason!,
                ),
                style: theme.textTheme.bodySmall?.copyWith(color: colors.error),
              ),
            ),
          ],
          if (installment.canSubmitProof) ...[
            const SizedBox(height: AppSpacing.sm),
            Align(
              alignment: AlignmentDirectional.centerEnd,
              child: FilledButton.tonalIcon(
                onPressed: () => context.push(
                  '/account/installments/${installment.id}/submit-proof',
                  extra: installment,
                ),
                icon: const Icon(Icons.receipt_long_outlined, size: 18),
                label: Text(
                  installment.isResubmit
                      ? l10n.paymentProofResubmit
                      : l10n.paymentProofSubmit,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
