import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;

import '../../documents/presentation/widgets/documents_list_view.dart';
import '../domain/entities/deposit.dart';
import 'deposit_format.dart';

Color get _navyDeep => AppPalette.navyDeep;
Color get _navyCard => AppPalette.navyPanel;
Color get _navyLight => AppPalette.navyLight;

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
                  const SizedBox(height: AppSpacing.md),
                  _StatusTimeline(deposit: deposit),
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
    return AppNavHeader(
      title: l10n.depositDetailTitle,
      subtitle: depositTypeLabel(l10n, deposit.type),
      compact: true,
      leadingAction: const NavHeaderBack(),
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

    String date(DateTime d) => DateFormatter.mediumDate(d, languageCode: lang);
    final method = paymentMethodLabel(l10n, deposit.paymentMethod);
    final rows = <(IconData, String, String)>[
      if (deposit.paidAt != null) (AppIcons.calendar, l10n.depositPaidOn, date(deposit.paidAt!)),
      if (method != null) (Icons.payments_outlined, l10n.depositMethod, method),
      if (deposit.installmentDueDate != null)
        (Icons.event_note_rounded, l10n.depositForInstallment, date(deposit.installmentDueDate!)),
      if (deposit.contractNumber != null) (AppIcons.contract, l10n.myPropertyContractNumber, ltr(deposit.contractNumber!)),
      if (deposit.reservationNumber != null)
        (Icons.bookmark_added_outlined, l10n.depositBookingNumber, ltr(deposit.reservationNumber!)),
      if (deposit.unitCode != null) (Icons.home_work_rounded, l10n.contractUnit, ltr(deposit.unitCode!)),
    ];

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
                      _StatusBadge(verified: deposit.collected, label: depositStateLabel(l10n, deposit), accent: accent),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // ── White info body ────────────────────────────────────────────
          if (rows.isNotEmpty)
            Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(
                children: [
                  for (var k = 0; k < rows.length; k++) ...[
                    if (k > 0) Divider(height: AppSpacing.lg, color: colors.hairline),
                    _InfoRow(icon: rows[k].$1, label: rows[k].$2, value: rows[k].$3, colors: colors, theme: theme),
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
    required this.label,
    required this.accent,
  });
  final bool verified;
  final String label;
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
            label,
            style: TextStyle(
              color: accent,
              fontSize: 12,
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
                gradient: LinearGradient(
                  colors: [_navyLight, _navyDeep],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
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
                    context.l10n.tapFileToOpen,
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
          AppPalette.navyHero,
          const Color(0xFF122346),
          AppPalette.navyInk,
        ],
      DepositType.finalPayment => [
          const Color(0xFF7A5C1E),
          const Color(0xFF5A4214),
          const Color(0xFF3D2800),
        ],
      DepositType.fee => [
          const Color(0xFF7A2E1E),
          const Color(0xFF55200F),
          const Color(0xFF3A1407),
        ],
      DepositType.unknown => [_navyCard, _navyCard, _navyDeep],
    };

Color _typeAccent(DepositType type) => switch (type) {
      DepositType.bookingAmount => const Color(0xFF4ADE80),
      DepositType.downPayment => AppPalette.gold300,
      DepositType.installment => const Color(0xFF93C5FD),
      DepositType.finalPayment => const Color(0xFFFBD27A),
      DepositType.fee => const Color(0xFFFCA5A5),
      DepositType.unknown => AppPalette.gold300,
    };

// ── Shared ────────────────────────────────────────────────────────────────────

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

/// «حالة الدفعة» — the steps the payment went through: sent by the customer
/// (or recorded by the company), the company's review, then confirmed or
/// rejected (with the reason), each with its date when known.
class _StatusTimeline extends StatelessWidget {
  const _StatusTimeline({required this.deposit});
  final Deposit deposit;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    String? date(DateTime? d) => d == null ? null : DateFormatter.mediumDate(d, languageCode: lang);
    final d = deposit;
    // A payment the customer sent a proof for goes through the company's
    // review; one the company recorded itself does not.
    final sentByCustomer = d.hasProof;
    final rejected = d.state == 'REJECTED' || d.reviewStatus == 'REJECTED';
    final done = d.collected;
    final failed = rejected || d.state == 'REVERSED' || d.state == 'BOUNCED';
    final steps = <(String, String?, _Step)>[
      (sentByCustomer ? l10n.depositStepSent : l10n.depositStepRecorded, date(d.createdAt ?? d.paidAt), _Step.done),
      if (sentByCustomer)
        (l10n.depositStepReview, done || failed ? date(d.reviewedAt) : l10n.depositStepWaiting, done || failed ? _Step.done : _Step.current),
      if (failed)
        (depositStateLabel(l10n, d), date(d.reviewedAt), _Step.failed)
      else
        (l10n.depositStepConfirmed, done ? date(d.reviewedAt ?? d.paidAt) : null, done ? _Step.done : _Step.todo),
    ];
    return Container(
      key: const Key('deposit-timeline'),
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.45)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 14, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.depositStatusTitle,
              style: theme.textTheme.titleMedium?.copyWith(color: colors.inkStrong, fontWeight: FontWeight.w800)),
          const SizedBox(height: AppSpacing.md),
          for (var k = 0; k < steps.length; k++)
            _StepRow(
              label: steps[k].$1,
              note: steps[k].$2,
              step: steps[k].$3,
              last: k == steps.length - 1,
            ),
          if (rejected && (d.rejectionReason ?? '').isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: colors.error.withValues(alpha: 0.07),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text('${l10n.depositRejectedReason}: ${d.rejectionReason}',
                  style: theme.textTheme.bodySmall?.copyWith(color: colors.error, fontWeight: FontWeight.w600)),
            ),
          ],
        ],
      ),
    );
  }
}

enum _Step { done, current, todo, failed }

class _StepRow extends StatelessWidget {
  const _StepRow({required this.label, required this.note, required this.step, required this.last});
  final String label;
  final String? note;
  final _Step step;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    final (Color tone, IconData icon) = switch (step) {
      _Step.done => (colors.success, Icons.check_rounded),
      _Step.current => (AppPalette.gold500, Icons.more_horiz_rounded),
      _Step.failed => (colors.error, Icons.close_rounded),
      _Step.todo => (colors.hairline, Icons.circle_outlined),
    };
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(
                  color: step == _Step.todo ? colors.surface : tone,
                  shape: BoxShape.circle,
                  border: Border.all(color: tone, width: 2),
                ),
                child: Icon(icon, size: 15, color: step == _Step.todo ? tone : Colors.white),
              ),
              if (!last) Expanded(child: Container(width: 2, color: colors.hairline)),
            ],
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(top: 3, bottom: last ? 0 : AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: theme.textTheme.bodyMedium?.copyWith(
                          color: step == _Step.todo ? colors.inkMuted : colors.inkStrong, fontWeight: FontWeight.w700)),
                  if (note != null)
                    Text(note!, style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
