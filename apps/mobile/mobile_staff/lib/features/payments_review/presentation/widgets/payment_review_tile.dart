import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../domain/entities/payment_review_item.dart';

String paymentReviewStatusLabel(AppLocalizations l10n, PaymentReviewStatus s) =>
    switch (s) {
      PaymentReviewStatus.pendingReview => l10n.paymentStatusPending,
      PaymentReviewStatus.approved => l10n.paymentStatusApproved,
      PaymentReviewStatus.rejected => l10n.paymentStatusRejected,
      PaymentReviewStatus.noProof ||
      PaymentReviewStatus.unknown =>
        l10n.paymentStatusPending,
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

IconData _methodIcon(PaymentMethod m) => switch (m) {
      PaymentMethod.cash => Icons.payments_rounded,
      PaymentMethod.bankTransfer => Icons.account_balance_rounded,
      PaymentMethod.cheque => Icons.receipt_long_rounded,
      _ => Icons.credit_card_rounded,
    };

Color _statusAccent(PaymentReviewStatus s) => switch (s) {
      PaymentReviewStatus.approved => const Color(0xFF22C55E),
      PaymentReviewStatus.rejected => const Color(0xFFEF4444),
      _ => const Color(0xFFF59E0B),
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
    this.onOpenProof,
    this.openBusy = false,
  });

  final PaymentReviewItem item;
  final bool canReview;
  final bool busy;
  final VoidCallback onApprove;
  final VoidCallback onReject;
  final VoidCallback? onOpenProof;
  final bool openBusy;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final method = item.paymentMethod;
    final methodLabel = paymentMethodLabel(l10n, method);
    final accentColor = _statusAccent(item.reviewStatus);

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.5)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Status accent strip
            Container(width: 4, color: accentColor),
            // Content
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                    AppSpacing.md, AppSpacing.md, AppSpacing.md, AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ── Header row ────────────────────────────────────
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Method icon circle
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: accentColor.withValues(alpha: 0.10),
                            shape: BoxShape.circle,
                            border: Border.all(
                                color: accentColor.withValues(alpha: 0.25)),
                          ),
                          child: Icon(
                            _methodIcon(method),
                            size: 18,
                            color: accentColor,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        // Name + contract info
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.customerName ?? l10n.paymentReviewTitle,
                                style: Theme.of(context)
                                    .textTheme
                                    .titleSmall
                                    ?.copyWith(fontWeight: FontWeight.w700),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              if (item.contractNumber != null ||
                                  item.unitCode != null) ...[
                                const SizedBox(height: 2),
                                Text(
                                  [
                                    if (item.contractNumber != null)
                                      '#${item.contractNumber}',
                                    if (item.unitCode != null) item.unitCode!,
                                  ].join('  ·  '),
                                  style: Theme.of(context)
                                      .textTheme
                                      .bodySmall
                                      ?.copyWith(color: colors.inkMuted),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        StatusBadge(
                          label: paymentReviewStatusLabel(
                              l10n, item.reviewStatus),
                          tone: paymentReviewStatusTone(item.reviewStatus),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),

                    // ── Amount ────────────────────────────────────────
                    Text(
                      PriceFormatter.formatString(item.amount,
                          languageCode: lang),
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            color: colors.brandGold,
                            fontWeight: FontWeight.w800,
                          ),
                    ),

                    // ── Fact rows ─────────────────────────────────────
                    if (methodLabel != null) ...[
                      const SizedBox(height: AppSpacing.xs),
                      _IconFact(
                        icon: _methodIcon(method),
                        label: l10n.paymentMethodLabel,
                        value: methodLabel,
                        colors: colors,
                      ),
                    ],
                    if (item.dueDate != null) ...[
                      const SizedBox(height: 2),
                      _IconFact(
                        icon: Icons.calendar_today_outlined,
                        label: l10n.paymentDueDate,
                        value: DateFormatter.shortDate(item.dueDate!,
                            languageCode: lang),
                        colors: colors,
                      ),
                    ],
                    if (item.submittedAt != null) ...[
                      const SizedBox(height: 2),
                      _IconFact(
                        icon: Icons.access_time_rounded,
                        label: l10n.paymentSubmittedDate,
                        value: DateFormatter.shortDate(item.submittedAt!,
                            languageCode: lang),
                        colors: colors,
                      ),
                    ],

                    // ── Proof row ─────────────────────────────────────
                    if (item.hasProof) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.sm, vertical: 6),
                        decoration: BoxDecoration(
                          color: colors.surfaceSoft,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                              color: colors.hairline.withValues(alpha: 0.6)),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.attach_file_rounded,
                                size: 14, color: colors.inkMuted),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                item.proofFileName ?? l10n.paymentProofAttached,
                                style: Theme.of(context)
                                    .textTheme
                                    .bodySmall
                                    ?.copyWith(color: colors.inkMuted),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (onOpenProof != null)
                              GestureDetector(
                                onTap: openBusy ? null : onOpenProof,
                                child: openBusy
                                    ? SizedBox(
                                        width: 16,
                                        height: 16,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          color: colors.brandGold,
                                        ),
                                      )
                                    : Icon(Icons.open_in_new_rounded,
                                        size: 16, color: colors.brandGold),
                              ),
                          ],
                        ),
                      ),
                    ],

                    // ── Action buttons ────────────────────────────────
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
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _IconFact extends StatelessWidget {
  const _IconFact({
    required this.icon,
    required this.label,
    required this.value,
    required this.colors,
  });

  final IconData icon;
  final String label;
  final String value;
  final AppColorsExt colors;

  @override
  Widget build(BuildContext context) => Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Icon(icon, size: 12, color: colors.inkMuted),
          const SizedBox(width: 5),
          Text(
            '$label: ',
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: colors.inkMuted),
          ),
          Expanded(
            child: Text(
              value,
              style: Theme.of(context).textTheme.bodySmall,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      );
}
