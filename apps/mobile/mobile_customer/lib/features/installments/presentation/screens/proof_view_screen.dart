import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:go_router/go_router.dart';

import '../../../documents/presentation/widgets/documents_list_view.dart';
import '../../domain/entities/installment.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyCard = Color(0xFF1A3352);
const _navyLight = Color(0xFF243F62);

const _paidGradient = [Color(0xFF1B5E3F), Color(0xFF0D3826)];
const _paidAccent = Color(0xFF4ADE80);
const _pendingAccent = AppPalette.gold300;

// ─────────────────────────────────────────────────────────────────────────────
// Proof View Screen
// Shows documents uploaded as payment proof for a specific installment.
// Requires DocumentsListCubit + DocumentDownloadCubit to be provided above
// (injected via _documentsProviders in the router).
// ─────────────────────────────────────────────────────────────────────────────

class ProofViewScreen extends StatelessWidget {
  const ProofViewScreen({super.key, required this.installment});
  final Installment installment;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;

    return Scaffold(
      backgroundColor: colors.canvas,
      body: Column(
        children: [
          _ProofHeader(installment: installment, l10n: l10n),
          Expanded(
            child: ListView(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.md,
                AppSpacing.lg,
                AppSpacing.xl + MediaQuery.of(context).padding.bottom,
              ),
              children: [
                _InstallmentSummaryCard(installment: installment, l10n: l10n),
                const SizedBox(height: AppSpacing.lg),
                _ProofFilesSection(l10n: l10n),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Header ────────────────────────────────────────────────────────────────────

class _ProofHeader extends StatelessWidget {
  const _ProofHeader({required this.installment, required this.l10n});
  final Installment installment;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final topInset = MediaQuery.paddingOf(context).top;
    final isApproved =
        installment.latestProof?.reviewStatus == PaymentProofStatus.approved;
    final accentColor = isApproved ? _paidAccent : _pendingAccent;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: Container(
        width: double.infinity,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topRight,
            end: Alignment.bottomLeft,
            colors: isApproved
                ? [
                    const Color(0xFF1B5E3F),
                    const Color(0xFF0E3B26),
                    const Color(0xFF062013),
                  ]
                : [_navyLight, _navyCard, _navyDeep],
            stops: const [0.0, 0.45, 1.0],
          ),
          borderRadius: const BorderRadius.only(
            bottomLeft: Radius.circular(28),
            bottomRight: Radius.circular(28),
          ),
          boxShadow: [
            BoxShadow(
              color: (isApproved ? _paidAccent : _navyDeep).withValues(
                alpha: 0.22,
              ),
              blurRadius: 22,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Stack(
          children: [
            const Positioned.fill(child: IgnorePointer(child: _DotTexture())),
            PositionedDirectional(
              end: 0,
              top: 0,
              child: Container(
                width: 160,
                height: 130,
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment.topRight,
                    radius: 1.0,
                    colors: [
                      accentColor.withValues(alpha: 0.12),
                      accentColor.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),
            Positioned(
              bottom: 0,
              left: 48,
              right: 48,
              child: Container(
                height: 1,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      accentColor.withValues(alpha: 0.0),
                      accentColor.withValues(alpha: 0.4),
                      accentColor.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.lg,
                topInset + AppSpacing.md,
                AppSpacing.lg,
                AppSpacing.xl,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  _BackButton(),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          l10n.paymentProofTitle,
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: accentColor,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.3,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          isApproved
                              ? l10n.paymentProofStatusApproved
                              : l10n.paymentProofStatusPendingReview,
                          style: theme.textTheme.titleLarge?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            height: 1.1,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BackButton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.pop(),
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(11),
          border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
        ),
        child: const Icon(
          Icons.arrow_back_ios_new_rounded,
          color: Colors.white,
          size: 16,
        ),
      ),
    );
  }
}

// ── Installment summary card ──────────────────────────────────────────────────

class _InstallmentSummaryCard extends StatelessWidget {
  const _InstallmentSummaryCard({
    required this.installment,
    required this.l10n,
  });
  final Installment installment;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final proof = installment.latestProof!;
    final isApproved = proof.reviewStatus == PaymentProofStatus.approved;
    final accentColor = isApproved ? _paidAccent : _pendingAccent;
    final headerGradient = isApproved ? _paidGradient : [_navyLight, _navyDeep];

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.45)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.07),
            blurRadius: 20,
            offset: const Offset(0, 5),
          ),
          if (isApproved)
            BoxShadow(
              color: _paidAccent.withValues(alpha: 0.07),
              blurRadius: 20,
              spreadRadius: 2,
            ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Gradient strip
          Container(
            height: 80,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: headerGradient,
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Stack(
              fit: StackFit.expand,
              children: [
                const IgnorePointer(child: _DotTexture()),
                Positioned(
                  bottom: 0,
                  left: 0,
                  right: 0,
                  child: Container(
                    height: 1,
                    color: accentColor.withValues(alpha: 0.3),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                    vertical: AppSpacing.md,
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              PriceFormatter.formatString(
                                installment.amount,
                                languageCode: lang,
                              ),
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w900,
                                fontSize: 22,
                                letterSpacing: -0.5,
                              ),
                            ),
                            if (installment.contractNumber != null)
                              Text(
                                installment.contractNumber!,
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.7),
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                          ],
                        ),
                      ),
                      // Status badge
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: accentColor.withValues(alpha: 0.18),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(
                            color: accentColor.withValues(alpha: 0.4),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              isApproved
                                  ? Icons.check_circle_rounded
                                  : Icons.hourglass_top_rounded,
                              color: accentColor,
                              size: 13,
                            ),
                            const SizedBox(width: 5),
                            Text(
                              isApproved
                                  ? l10n.paymentProofStatusApproved
                                  : l10n.paymentProofStatusPendingReview,
                              style: TextStyle(
                                color: accentColor,
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // ── Info rows
          Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              children: [
                _InfoRow(
                  icon: AppIcons.calendar,
                  label: l10n.installmentDueOn(''),
                  value: DateFormatter.mediumDate(
                    installment.dueDate,
                    languageCode: lang,
                  ),
                  colors: colors,
                  theme: theme,
                ),
                if (installment.paidAt != null) ...[
                  Divider(height: AppSpacing.lg, color: colors.hairline),
                  _InfoRow(
                    icon: Icons.check_circle_outline_rounded,
                    label: 'تاريخ السداد',
                    value: DateFormatter.mediumDate(
                      installment.paidAt!,
                      languageCode: lang,
                    ),
                    colors: colors,
                    theme: theme,
                    accent: _paidAccent,
                  ),
                ],
                if (proof.paymentMethod != null &&
                    proof.paymentMethod != PaymentMethod.unknown) ...[
                  Divider(height: AppSpacing.lg, color: colors.hairline),
                  _InfoRow(
                    icon: Icons.account_balance_rounded,
                    label: l10n.paymentProofMethodLabel,
                    value: _methodLabel(l10n, proof.paymentMethod!),
                    colors: colors,
                    theme: theme,
                  ),
                ],
                if (proof.submittedAt != null) ...[
                  Divider(height: AppSpacing.lg, color: colors.hairline),
                  _InfoRow(
                    icon: Icons.upload_file_rounded,
                    label: 'تاريخ الإرسال',
                    value: DateFormatter.mediumDate(
                      proof.submittedAt!,
                      languageCode: lang,
                    ),
                    colors: colors,
                    theme: theme,
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _methodLabel(AppLocalizations l10n, PaymentMethod method) =>
      switch (method) {
        PaymentMethod.bankTransfer => l10n.paymentProofMethodBankTransfer,
        PaymentMethod.cheque => 'شيك',
        PaymentMethod.cash => 'نقدي',
        _ => l10n.paymentProofMethodOther,
      };
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.colors,
    required this.theme,
    this.accent,
  });
  final IconData icon;
  final String label;
  final String value;
  final AppColorsExt colors;
  final ThemeData theme;
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 15, color: accent ?? colors.inkMuted),
        const SizedBox(width: AppSpacing.sm),
        Text(
          '$label:',
          style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted),
        ),
        const SizedBox(width: AppSpacing.xs),
        Expanded(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: accent ?? colors.inkStrong,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    );
  }
}

// ── Proof files section ───────────────────────────────────────────────────────

class _ProofFilesSection extends StatelessWidget {
  const _ProofFilesSection({required this.l10n});
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section header
        Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: _paidGradient,
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                Icons.folder_open_rounded,
                size: 17,
                color: _paidAccent,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'ملفات الإثبات',
                    style: theme.textTheme.titleMedium?.copyWith(
                      color: colors.inkStrong,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  Text(
                    'اضغط على الملف لتحميله أو عرضه',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: colors.inkMuted,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        // Documents list (uses ambient DocumentsListCubit + DocumentDownloadCubit)
        DocumentsListView(emptyMessage: l10n.depositNoReceipts),
      ],
    );
  }
}

// ── Dot texture ───────────────────────────────────────────────────────────────

class _DotTexture extends StatelessWidget {
  const _DotTexture();
  @override
  Widget build(BuildContext context) =>
      const CustomPaint(painter: _DotPainter(), child: SizedBox.expand());
}

class _DotPainter extends CustomPainter {
  const _DotPainter();
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.04);
    const step = 20.0;
    for (var y = 6.0; y < size.height; y += step) {
      for (var x = 6.0; x < size.width; x += step) {
        canvas.drawCircle(Offset(x, y), 1.1, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DotPainter _) => false;
}
