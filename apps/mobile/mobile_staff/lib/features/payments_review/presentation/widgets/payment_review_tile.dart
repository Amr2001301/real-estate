import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../domain/entities/payment_review_item.dart';

String paymentReviewStatusLabel(AppLocalizations l10n, PaymentReviewStatus s) => switch (s) {
      PaymentReviewStatus.pendingReview => l10n.paymentStatusPending,
      PaymentReviewStatus.approved => l10n.paymentStatusApproved,
      PaymentReviewStatus.rejected => l10n.paymentStatusRejected,
      PaymentReviewStatus.noProof || PaymentReviewStatus.unknown => l10n.paymentStatusPending,
    };

BadgeTone paymentReviewStatusTone(PaymentReviewStatus s) => switch (s) {
      PaymentReviewStatus.approved => BadgeTone.success,
      PaymentReviewStatus.rejected => BadgeTone.error,
      _ => BadgeTone.warning,
    };

String? paymentMethodLabel(AppLocalizations l10n, PaymentMethod m) => switch (m) {
      PaymentMethod.cash => l10n.paymentMethodCash,
      PaymentMethod.bankTransfer => l10n.paymentMethodBankTransfer,
      PaymentMethod.cheque => l10n.paymentMethodCheque,
      PaymentMethod.other => l10n.paymentMethodOther,
      PaymentMethod.unknown => null,
    };

/// A single pending payment proof. When [canReview] is true (ADMIN) it shows
/// Approve / Reject actions; otherwise it is read-only (e.g. SALES_MANAGER).
class PaymentReviewTile extends StatelessWidget {
  const PaymentReviewTile({
    super.key,
    required this.item,
    required this.canReview,
    required this.busy,
    required this.onApprove,
    required this.onReject,
  });

  final PaymentReviewItem item;
  final bool canReview;

  /// True while THIS item is being approved/rejected (disables its buttons).
  final bool busy;
  final VoidCallback onApprove;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final method = paymentMethodLabel(l10n, item.paymentMethod);

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.customerName ?? l10n.paymentReviewTitle,
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    if (item.contractNumber != null || item.unitCode != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        [
                          if (item.contractNumber != null) item.contractNumber!,
                          if (item.unitCode != null) item.unitCode!,
                        ].join(' · '),
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.inkMuted),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              StatusBadge(
                label: paymentReviewStatusLabel(l10n, item.reviewStatus),
                tone: paymentReviewStatusTone(item.reviewStatus),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            PriceFormatter.formatString(item.amount, languageCode: lang),
            style: Theme.of(context).textTheme.titleMedium?.copyWith(color: colors.brandGold),
          ),
          const SizedBox(height: AppSpacing.xs),
          if (method != null) _Fact(label: l10n.paymentMethodLabel, value: method),
          if (item.dueDate != null)
            _Fact(label: l10n.paymentDueDate, value: DateFormatter.shortDate(item.dueDate!, languageCode: lang)),
          if (item.submittedAt != null)
            _Fact(label: l10n.paymentSubmittedDate, value: DateFormatter.shortDate(item.submittedAt!, languageCode: lang)),
          if (item.hasProof) ...[
            const SizedBox(height: AppSpacing.xs),
            Row(
              children: [
                Icon(Icons.attach_file_rounded, size: 16, color: colors.inkMuted),
                const SizedBox(width: AppSpacing.xs),
                Expanded(
                  child: Text(
                    item.proofFileName ?? l10n.paymentProofAttached,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.inkMuted),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],
          if (canReview) ...[
            const SizedBox(height: AppSpacing.md),
            Row(
              children: [
                Expanded(
                  child: AppButton(
                    label: l10n.paymentApprove,
                    size: AppButtonSize.medium,
                    variant: AppButtonVariant.gold,
                    isLoading: busy,
                    onPressed: busy ? null : onApprove,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: AppButton(
                    label: l10n.paymentReject,
                    size: AppButtonSize.medium,
                    variant: AppButtonVariant.outline,
                    onPressed: busy ? null : onReject,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 1),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('$label: ', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
          Expanded(
            child: Text(value, style: Theme.of(context).textTheme.bodySmall),
          ),
        ],
      ),
    );
  }
}
