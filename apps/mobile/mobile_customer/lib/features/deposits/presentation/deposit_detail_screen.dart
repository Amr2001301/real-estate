import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:go_router/go_router.dart';

import '../../documents/presentation/widgets/documents_list_view.dart';
import '../domain/entities/deposit.dart';
import 'deposit_format.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyCard = Color(0xFF1A3352);
const _navyLight = Color(0xFF243F62);

// ─────────────────────────────────────────────────────────────────────────────
// Deposit Detail Screen
// ─────────────────────────────────────────────────────────────────────────────

class DepositDetailScreen extends StatelessWidget {
  const DepositDetailScreen({super.key, required this.deposit});
  final Deposit deposit;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: Column(
          children: [
            _DetailHeader(deposit: deposit, l10n: l10n),
            Expanded(
              child: ListView(
                padding: EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  AppSpacing.md,
                  AppSpacing.lg,
                  AppSpacing.xl + MediaQuery.of(context).padding.bottom,
                ),
                children: [
                  _DepositSummaryCard(
                    deposit: deposit,
                    l10n: l10n,
                    lang: lang,
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  _ReceiptsSection(l10n: l10n),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Header ────────────────────────────────────────────────────────────────────

class _DetailHeader extends StatelessWidget {
  const _DetailHeader({required this.deposit, required this.l10n});
  final Deposit deposit;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final topInset = MediaQuery.paddingOf(context).top;
    final accent = _typeAccent(deposit.type);

    return Container(
      width: double.infinity,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: _typeGradient(deposit.type),
          stops: const [0.0, 0.45, 1.0],
        ),
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(28),
          bottomRight: Radius.circular(28),
        ),
        boxShadow: [
          BoxShadow(
            color: _typeGradient(deposit.type).last.withValues(alpha: 0.3),
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
              height: 120,
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment.topRight,
                  radius: 1.0,
                  colors: [
                    accent.withValues(alpha: 0.12),
                    accent.withValues(alpha: 0.0),
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
                    accent.withValues(alpha: 0.0),
                    accent.withValues(alpha: 0.45),
                    accent.withValues(alpha: 0.0),
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
                _BackBtn(),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        depositTypeLabel(l10n, deposit.type),
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: accent,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.3,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        l10n.depositDetailTitle,
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
    );
  }
}

// ── Deposit Summary Card (split: colored strip + white body) ──────────────────

class _DepositSummaryCard extends StatelessWidget {
  const _DepositSummaryCard({
    required this.deposit,
    required this.l10n,
    required this.lang,
  });
  final Deposit deposit;
  final AppLocalizations l10n;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    final gradient = _typeGradient(deposit.type);
    final accent = _typeAccent(deposit.type);

    final hasBody = deposit.paidAt != null ||
        deposit.contractNumber != null ||
        deposit.unitCode != null;

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
          BoxShadow(
            color: accent.withValues(alpha: 0.06),
            blurRadius: 20,
            spreadRadius: 2,
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Colored gradient strip ─────────────────────────────────────
          Container(
            height: 88,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: gradient,
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
                    color: accent.withValues(alpha: 0.3),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                    vertical: AppSpacing.md,
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              PriceFormatter.formatString(
                                deposit.amount,
                                languageCode: lang,
                              ),
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w900,
                                fontSize: 22,
                                letterSpacing: -0.5,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              depositTypeLabel(l10n, deposit.type),
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
                      _StatusBadge(verified: deposit.verified, l10n: l10n, accent: accent),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // ── White info body ────────────────────────────────────────────
          if (hasBody)
            Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(
                children: [
                  if (deposit.paidAt != null) ...[
                    _InfoRow(
                      icon: AppIcons.calendar,
                      label: l10n.depositPaidOn,
                      value: DateFormatter.mediumDate(
                        deposit.paidAt!,
                        languageCode: lang,
                      ),
                      colors: colors,
                      theme: theme,
                    ),
                  ],
                  if (deposit.contractNumber != null) ...[
                    if (deposit.paidAt != null)
                      Divider(height: AppSpacing.lg, color: colors.hairline),
                    _InfoRow(
                      icon: AppIcons.contract,
                      label: l10n.myPropertyContractNumber,
                      value: deposit.contractNumber!,
                      colors: colors,
                      theme: theme,
                    ),
                  ],
                  if (deposit.unitCode != null) ...[
                    if (deposit.paidAt != null || deposit.contractNumber != null)
                      Divider(height: AppSpacing.lg, color: colors.hairline),
                    _InfoRow(
                      icon: Icons.home_work_rounded,
                      label: l10n.maintenanceUnitLabel,
                      value: deposit.unitCode!,
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
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({
    required this.verified,
    required this.l10n,
    required this.accent,
  });
  final bool verified;
  final AppLocalizations l10n;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: accent.withValues(alpha: 0.4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            verified
                ? Icons.check_circle_rounded
                : Icons.hourglass_top_rounded,
            color: accent,
            size: 13,
          ),
          const SizedBox(width: 5),
          Text(
            verified ? l10n.depositVerified : l10n.depositPending,
            style: TextStyle(
              color: accent,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Info row ──────────────────────────────────────────────────────────────────

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.colors,
    required this.theme,
  });
  final IconData icon;
  final String label;
  final String value;
  final AppColorsExt colors;
  final ThemeData theme;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 15, color: colors.inkMuted),
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
              color: colors.inkStrong,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    );
  }
}

// ── Receipts section ──────────────────────────────────────────────────────────

class _ReceiptsSection extends StatelessWidget {
  const _ReceiptsSection({required this.l10n});
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [_navyLight, _navyDeep],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                Icons.receipt_long_rounded,
                size: 17,
                color: AppPalette.gold300,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l10n.depositReceiptsTitle,
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
        DocumentsListView(emptyMessage: l10n.depositNoReceipts),
      ],
    );
  }
}

// ── Type helpers ──────────────────────────────────────────────────────────────

List<Color> _typeGradient(DepositType type) => switch (type) {
      DepositType.bookingAmount => [
          const Color(0xFF1B5E3F),
          const Color(0xFF0E3B26),
          const Color(0xFF062013),
        ],
      DepositType.downPayment => [_navyLight, _navyCard, _navyDeep],
      DepositType.installment => [
          const Color(0xFF1E3A6E),
          const Color(0xFF122346),
          const Color(0xFF0B1F42),
        ],
      DepositType.finalPayment => [
          const Color(0xFF7A5C1E),
          const Color(0xFF5A4214),
          const Color(0xFF3D2800),
        ],
      DepositType.unknown => [_navyCard, _navyCard, _navyDeep],
    };

Color _typeAccent(DepositType type) => switch (type) {
      DepositType.bookingAmount => const Color(0xFF4ADE80),
      DepositType.downPayment => AppPalette.gold300,
      DepositType.installment => const Color(0xFF93C5FD),
      DepositType.finalPayment => const Color(0xFFFBD27A),
      DepositType.unknown => AppPalette.gold300,
    };

// ── Shared ────────────────────────────────────────────────────────────────────

class _BackBtn extends StatelessWidget {
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
