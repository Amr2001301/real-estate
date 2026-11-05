import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../../dashboard/home_kit/home_kit.dart';
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

/// A single payment proof. When [canReview] is true (ADMIN) it shows
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
    final accent = _statusAccent(item.reviewStatus);
    return Container(
      key: Key('review-${item.id}'),
      decoration: homeCard(context, radius: 24),
      clipBehavior: Clip.antiAlias,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        // A slim accent in the state's colour along the top.
        Container(height: 4, decoration: BoxDecoration(gradient: LinearGradient(colors: [accent, accent.withValues(alpha: 0.35)]))),
        Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(gradient: homeGoldGradient, borderRadius: BorderRadius.circular(14)),
                child: Icon(_methodIcon(method), size: 22, color: AppPalette.navy),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(item.customerName ?? l10n.paymentReviewTitle,
                      maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: colors.inkStrong)),
                  if (methodLabel != null) Text(methodLabel, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                ]),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                decoration: BoxDecoration(color: accent.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(99)),
                child: Text(paymentReviewStatusLabel(l10n, item.reviewStatus), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: accent)),
              ),
            ]),
            const SizedBox(height: 14),
            // The amount, large, with the codes beside it.
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(gradient: homeNavyGradient, borderRadius: BorderRadius.circular(18)),
              child: Row(children: [
                Expanded(
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: AlignmentDirectional.centerStart,
                    child: Text(PriceFormatter.formatString(item.amount, languageCode: lang), style: homeDisplay(24, Colors.white)),
                  ),
                ),
                const SizedBox(width: 10),
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  if (item.contractNumber != null) Text(ltr(item.contractNumber!), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppPalette.gold300)),
                  if (item.unitCode != null) Text(ltr(item.unitCode!), style: const TextStyle(fontSize: 12, color: Color(0xFFC9D2DE))),
                ]),
              ]),
            ),
            if (item.dueDate != null || item.submittedAt != null) ...[
              const SizedBox(height: 12),
              Row(children: [
                if (item.dueDate != null)
                  Expanded(child: _Date(icon: Icons.event_rounded, label: l10n.paymentDueDate, value: DateFormatter.shortDate(item.dueDate!, languageCode: lang))),
                if (item.dueDate != null && item.submittedAt != null) Container(width: 1, height: 30, margin: const EdgeInsets.symmetric(horizontal: 10), color: colors.hairline),
                if (item.submittedAt != null)
                  Expanded(child: _Date(icon: Icons.schedule_rounded, label: l10n.paymentSubmittedDate, value: DateFormatter.shortDate(item.submittedAt!, languageCode: lang))),
              ]),
            ],
        if (item.hasProof) ...[
          const SizedBox(height: 12),
          Material(
            color: AppPalette.gold50,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: AppPalette.gold100)),
            child: InkWell(
              key: Key('review-proof-${item.id}'),
              borderRadius: BorderRadius.circular(16),
              onTap: onOpenProof == null || openBusy ? null : onOpenProof,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                child: Row(children: [
                  const Icon(Icons.attach_file_rounded, size: 18, color: AppPalette.gold600),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(item.proofFileName ?? l10n.paymentProofAttached,
                        maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, color: colors.inkStrong)),
                  ),
                  if (openBusy)
                    const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppPalette.gold600))
                  else if (onOpenProof != null)
                    Row(mainAxisSize: MainAxisSize.min, children: [
                      Text(l10n.prOpenProof, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppPalette.gold600)),
                      const SizedBox(width: 4),
                      const Icon(Icons.open_in_new_rounded, size: 16, color: AppPalette.gold600),
                    ]),
                ]),
              ),
            ),
          ),
        ],
        if (canReview) ...[
          const SizedBox(height: 14),
          Row(children: [
            Expanded(
              flex: 3,
              child: FilledButton.icon(
                key: Key('review-approve-${item.id}'),
                onPressed: busy ? null : onApprove,
                icon: busy
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppPalette.navy))
                    : const Icon(Icons.check_rounded, size: 19),
                label: Text(l10n.paymentApprove),
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                  backgroundColor: AppPalette.gold400,
                  foregroundColor: AppPalette.navy,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                  textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              flex: 2,
              child: OutlinedButton(
                key: Key('review-reject-${item.id}'),
                onPressed: busy ? null : onReject,
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                  foregroundColor: colors.error,
                  side: BorderSide(color: colors.error.withValues(alpha: 0.45), width: 1.4),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                  textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
                ),
                child: Text(l10n.paymentReject),
              ),
            ),
          ]),
        ],
          ]),
        ),
      ]),
    );
  }
}

class _Date extends StatelessWidget {
  const _Date({required this.icon, required this.label, required this.value});
  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Row(children: [
      Icon(icon, size: 17, color: AppPalette.gold600),
      const SizedBox(width: 7),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
          Text(value, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: colors.inkStrong)),
        ]),
      ),
    ]);
  }
}
