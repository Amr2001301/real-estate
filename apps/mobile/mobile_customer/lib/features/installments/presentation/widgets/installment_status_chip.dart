import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../domain/entities/installment.dart';

/// Localized colored chip that prefers the proof-review state when one is
/// present (PENDING_REVIEW / APPROVED / REJECTED), otherwise falls back to
/// the installment lifecycle status (PENDING / PAID / OVERDUE). Single
/// component so the list and the submit screen render identical badges.
class InstallmentStatusChip extends StatelessWidget {
  const InstallmentStatusChip({super.key, required this.installment});

  final Installment installment;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final proof = installment.latestProof;

    if (proof != null) {
      switch (proof.reviewStatus) {
        case PaymentProofStatus.pendingReview:
          return StatusBadge(
            label: l10n.paymentProofStatusPendingReview,
            tone: BadgeTone.warning,
            dot: true,
          );
        case PaymentProofStatus.approved:
          return StatusBadge(
            label: l10n.paymentProofStatusApproved,
            tone: BadgeTone.success,
            dot: true,
          );
        case PaymentProofStatus.rejected:
          return StatusBadge(
            label: l10n.paymentProofStatusRejected,
            tone: BadgeTone.error,
            dot: true,
          );
        case PaymentProofStatus.noProof:
        case PaymentProofStatus.unknown:
          break;
      }
    }
    switch (installment.status) {
      case InstallmentStatus.paid:
        return StatusBadge(
          label: l10n.installmentStatusPaid,
          tone: BadgeTone.success,
        );
      case InstallmentStatus.overdue:
        return StatusBadge(
          label: l10n.installmentStatusOverdue,
          tone: BadgeTone.error,
        );
      case InstallmentStatus.pending:
      case InstallmentStatus.unknown:
        return StatusBadge(
          label: l10n.installmentStatusPending,
          tone: BadgeTone.navy,
        );
    }
  }
}
