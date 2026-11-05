import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../domain/entities/installment.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyLight = Color(0xFF243F62);

// ── Status colors ─────────────────────────────────────────────────────────────

const _paidGradient = [Color(0xFF1B5E3F), Color(0xFF0D3826)];
const _paidAccent = Color(0xFF4ADE80);
const _overdueAccent = Color(0xFFF87171);
const _pendingGradient = [_navyLight, _navyDeep];
const _pendingAccent = AppPalette.gold300;

/// The one installment card of the customer app: a status tile, the amount and
/// payment type, a state pill, project/unit, due and paid dates, payment method,
/// rejection reason, and the view-proof / submit-proof actions. Used by
/// «أقساطي» and the installments tab of a property.
class InstallmentCard extends StatelessWidget {
  const InstallmentCard({super.key, required this.installment});
  final Installment installment;

  static _StripStyle _stripStyle(Installment inst, bool dark) {
    _StripStyle make(Color light, Color darkC, IconData icon) =>
        _StripStyle(accentColor: dark ? darkC : light, icon: icon);
    final paid = make(
      const Color(0xFF15803D),
      _paidAccent,
      Icons.check_circle_rounded,
    );
    final overdue = make(
      const Color(0xFFB91C1C),
      _overdueAccent,
      Icons.warning_rounded,
    );
    final proof = inst.latestProof;
    if (proof != null) {
      switch (proof.reviewStatus) {
        case PaymentProofStatus.pendingReview:
          return make(
            const Color(0xFFB45309),
            const Color(0xFFFBBF24),
            Icons.hourglass_top_rounded,
          );
        case PaymentProofStatus.approved:
          return paid;
        case PaymentProofStatus.rejected:
          return make(
            const Color(0xFFB91C1C),
            _overdueAccent,
            Icons.cancel_rounded,
          );
        case PaymentProofStatus.noProof:
        case PaymentProofStatus.unknown:
          break;
      }
    }
    return switch (inst.status) {
      InstallmentStatus.paid => paid,
      InstallmentStatus.overdue => overdue,
      _ => make(
        const Color(0xFF9A6F1E),
        _pendingAccent,
        AppIcons.installments,
      ),
    };
  }

  String _statusLabel(AppLocalizations l10n) {
    final proof = installment.latestProof;
    if (proof != null) {
      switch (proof.reviewStatus) {
        case PaymentProofStatus.pendingReview:
          return l10n.paymentProofStatusPendingReview;
        case PaymentProofStatus.approved:
          return l10n.paymentProofStatusApproved;
        case PaymentProofStatus.rejected:
          return l10n.paymentProofStatusRejected;
        case PaymentProofStatus.noProof:
        case PaymentProofStatus.unknown:
          break;
      }
    }
    return switch (installment.status) {
      InstallmentStatus.paid => l10n.installmentStatusPaid,
      InstallmentStatus.overdue => l10n.installmentStatusOverdue,
      InstallmentStatus.cancelled => l10n.installmentStatusCancelled,
      _ => l10n.installmentStatusPending,
    };
  }

  String _paymentTypeLabel(AppLocalizations l10n) => switch (installment.type) {
    InstallmentPaymentType.reservation => l10n.depositTypeBooking,
    InstallmentPaymentType.downPayment => l10n.depositTypeDownPayment,
    InstallmentPaymentType.finalPayment => l10n.depositTypeFinal,
    InstallmentPaymentType.bouncePenalty => l10n.planTypeBouncePenalty,
    InstallmentPaymentType.lateFee => l10n.planTypeLateFee,
    InstallmentPaymentType.transferFee => l10n.planTypeTransferFee,
    _ => l10n.depositTypeInstallment,
  };

  String _paymentMethodLabel(AppLocalizations l10n, PaymentMethod method) =>
      switch (method) {
        PaymentMethod.bankTransfer => l10n.paymentProofMethodBankTransfer,
        PaymentMethod.cheque => l10n.paymentMethodCheque,
        PaymentMethod.cash => l10n.paymentMethodCash,
        _ => l10n.paymentProofMethodOther,
      };

  bool get _isApprovedProof =>
      installment.latestProof?.reviewStatus == PaymentProofStatus.approved;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;

    final style = _stripStyle(
      installment,
      Theme.of(context).brightness == Brightness.dark,
    );
    final accent = style.accentColor;
    final projectName =
        (lang == 'ar' ? installment.projectNameAr : installment.projectNameEn)
            ?.trim();
    final locationLine = [
      if (installment.contractNumber?.isNotEmpty ?? false)
        installment.contractNumber,
      if (projectName?.isNotEmpty ?? false) projectName,
      if (installment.unitCode?.isNotEmpty ?? false) installment.unitCode,
    ].join(' · ');

    final proof = installment.latestProof;
    final hasMethod =
        proof?.paymentMethod != null &&
        proof!.paymentMethod != PaymentMethod.unknown;
    final tint = accent.withValues(alpha: 0.12);

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.6)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Status tile, amount + type, state pill
          Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: tint,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(style.icon, color: accent, size: 24),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      PriceFormatter.formatString(
                        installment.amount,
                        languageCode: lang,
                      ),
                      style: theme.textTheme.titleLarge?.copyWith(
                        color: colors.inkStrong,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _paymentTypeLabel(l10n),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: colors.inkMuted,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 5,
                ),
                decoration: BoxDecoration(
                  color: tint,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  _statusLabel(l10n),
                  style: TextStyle(
                    color: accent,
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          if (locationLine.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Icon(AppIcons.property, size: 15, color: colors.inkMuted),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    locationLine,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: colors.inkMuted,
                    ),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          Divider(height: 1, color: colors.hairline),
          const SizedBox(height: AppSpacing.md),

          // Dates as tinted tiles
          Row(
            children: [
              Expanded(
                child: _DateCell(
                  icon: AppIcons.calendar,
                  label: l10n.installmentDueOn(''),
                  value: DateFormatter.shortDate(
                    installment.dueDate,
                    languageCode: lang,
                  ),
                ),
              ),
              if (installment.paidAt != null) ...[
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: _DateCell(
                    icon: Icons.check_circle_outline_rounded,
                    label: l10n.paidDateLabel,
                    value: DateFormatter.shortDate(
                      installment.paidAt!,
                      languageCode: lang,
                    ),
                    accent: accent,
                  ),
                ),
              ],
            ],
          ),

          if (hasMethod) ...[
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Icon(
                  Icons.account_balance_rounded,
                  size: 15,
                  color: colors.inkMuted,
                ),
                const SizedBox(width: 6),
                Text(
                  '${l10n.paymentProofMethodLabel}: ',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: colors.inkMuted,
                  ),
                ),
                Expanded(
                  child: Text(
                    _paymentMethodLabel(l10n, proof.paymentMethod!),
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: colors.inkStrong,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ],

          if (proof?.reviewStatus == PaymentProofStatus.rejected &&
              proof?.rejectionReason != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: colors.error.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    Icons.info_outline_rounded,
                    size: 15,
                    color: colors.error,
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      l10n.paymentProofRejectionReason(proof!.rejectionReason!),
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: colors.error,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],

          if (_isApprovedProof) ...[
            const SizedBox(height: AppSpacing.md),
            _ViewProofCard(
              onTap: () => context.push(
                '/account/installments/${installment.id}/proof',
                extra: installment,
              ),
            ),
          ],

          if (installment.canSubmitProof) ...[
            const SizedBox(height: AppSpacing.md),
            _SubmitProofButton(
              isResubmit: installment.isResubmit,
              onTap: () => context.push(
                '/account/installments/${installment.id}/submit-proof',
                extra: installment,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ── View proof action card ────────────────────────────────────────────────────

class _ViewProofCard extends StatelessWidget {
  const _ViewProofCard({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: _paidAccent.withValues(alpha: 0.04),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: _paidAccent.withValues(alpha: 0.35),
            width: 1.5,
          ),
          boxShadow: [
            BoxShadow(
              color: _paidAccent.withValues(alpha: 0.10),
              blurRadius: 14,
              spreadRadius: 1,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: 12,
          ),
          child: Row(
            children: [
              // Icon tile
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: _paidGradient,
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(13),
                  boxShadow: [
                    BoxShadow(
                      color: _paidAccent.withValues(alpha: 0.25),
                      blurRadius: 10,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.task_alt_rounded,
                  color: _paidAccent,
                  size: 22,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              // Text content
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      context.l10n.viewApprovedProof,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: colors.inkStrong,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      context.l10n.tapToViewAttachment,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: colors.inkMuted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              // Arrow
              Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: _paidAccent.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.arrow_forward_ios_rounded,
                  color: _paidAccent,
                  size: 14,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Submit proof button ───────────────────────────────────────────────────────

class _SubmitProofButton extends StatelessWidget {
  const _SubmitProofButton({required this.onTap, required this.isResubmit});
  final VoidCallback onTap;
  final bool isResubmit;

  static const _resubmitGradient = [Color(0xFF7C3208), Color(0xFF4A1D00)];
  static const _resubmitAccent = Color(0xFFFBBF24);

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    final accent = isResubmit ? _resubmitAccent : AppPalette.gold300;
    final iconBgGradient = isResubmit ? _resubmitGradient : _pendingGradient;
    final icon = isResubmit ? Icons.refresh_rounded : Icons.upload_file_rounded;
    final l10n = context.l10n;
    final title = isResubmit ? l10n.paymentProofResubmitTitle : l10n.paymentProofSubmit;
    final subtitle = isResubmit ? l10n.paymentProofResubmitHint : l10n.paymentProofSubmitHint;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: accent.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: accent.withValues(alpha: 0.35), width: 1.5),
          boxShadow: [
            BoxShadow(
              color: accent.withValues(alpha: 0.10),
              blurRadius: 14,
              spreadRadius: 1,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: 12,
          ),
          child: Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: iconBgGradient,
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(13),
                  boxShadow: [
                    BoxShadow(
                      color: accent.withValues(alpha: 0.25),
                      blurRadius: 10,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: Icon(icon, color: accent, size: 22),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: colors.inkStrong,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: colors.inkMuted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  Icons.arrow_forward_ios_rounded,
                  color: accent,
                  size: 14,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Strip style config ────────────────────────────────────────────────────────

class _StripStyle {
  const _StripStyle({required this.accentColor, required this.icon});
  final Color accentColor;
  final IconData icon;
}

// ── Date cell ─────────────────────────────────────────────────────────────────

class _DateCell extends StatelessWidget {
  const _DateCell({
    required this.icon,
    required this.label,
    required this.value,
    this.accent,
  });
  final IconData icon;
  final String label;
  final String value;
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    final iconColor = accent ?? colors.inkMuted;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: colors.inkMuted.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 14, color: iconColor),
              const SizedBox(width: 4),
              Flexible(
                child: Text(
                  label.replaceAll(':', '').trim(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: colors.inkMuted,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 3),
          Text(
            value,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: colors.inkStrong,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}
