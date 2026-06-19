import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../notifications/presentation/widgets/customer_notification_button.dart';
import '../domain/entities/deposit.dart';
import 'deposit_format.dart';
import 'deposits_cubit.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyCard = Color(0xFF1A3352);
const _navyLight = Color(0xFF243F62);

// ─────────────────────────────────────────────────────────────────────────────
// Deposits Screen
// ─────────────────────────────────────────────────────────────────────────────

class DepositsScreen extends StatefulWidget {
  const DepositsScreen({super.key});

  @override
  State<DepositsScreen> createState() => _DepositsScreenState();
}

class _DepositsScreenState extends State<DepositsScreen> {
  @override
  void initState() {
    super.initState();
    context.read<DepositsCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final session = context.watch<SessionCubit>().state;
    final displayName =
        session.sessionOrNull?.displayName ?? session.sessionOrNull?.email;

    return Scaffold(
      backgroundColor: context.appColors.canvas,
      body: Column(
        children: [
          _DepositsHeader(displayName: displayName, l10n: l10n),
          Expanded(
            child: BlocBuilder<DepositsCubit, DepositsState>(
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const Center(child: CircularProgressIndicator());
                  case DataStatus.failure:
                    return ErrorState(
                      failure: state.failure,
                      onRetry: () => context.read<DepositsCubit>().load(),
                    );
                  case DataStatus.empty:
                    return EmptyState(
                      icon: AppIcons.deposit,
                      title: l10n.depositsEmptyTitle,
                      message: l10n.depositsEmptyMessage,
                    );
                  case DataStatus.success:
                    final deposits = state.data!;
                    return RefreshIndicator(
                      onRefresh: () => context.read<DepositsCubit>().load(),
                      child: ListView.separated(
                        padding: EdgeInsets.fromLTRB(
                          AppSpacing.lg,
                          AppSpacing.lg,
                          AppSpacing.lg,
                          AppSpacing.xl + MediaQuery.of(context).padding.bottom,
                        ),
                        itemCount: deposits.length,
                        separatorBuilder: (_, _) =>
                            const SizedBox(height: AppSpacing.md),
                        itemBuilder: (context, i) =>
                            _DepositCard(deposit: deposits[i]),
                      ),
                    );
                }
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ── Header ────────────────────────────────────────────────────────────────────

class _DepositsHeader extends StatelessWidget {
  const _DepositsHeader({required this.displayName, required this.l10n});
  final String? displayName;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final topInset = MediaQuery.paddingOf(context).top;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: Container(
        width: double.infinity,
        clipBehavior: Clip.antiAlias,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topRight,
            end: Alignment.bottomLeft,
            colors: [_navyLight, _navyCard, _navyDeep],
            stops: [0.0, 0.45, 1.0],
          ),
          borderRadius: BorderRadius.only(
            bottomLeft: Radius.circular(28),
            bottomRight: Radius.circular(28),
          ),
          boxShadow: [
            BoxShadow(
              color: Color(0x35000000),
              blurRadius: 22,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: Stack(
          children: [
            const Positioned.fill(child: IgnorePointer(child: _DotTexture())),
            PositionedDirectional(
              start: 0,
              top: 0,
              child: Container(
                width: 160,
                height: 130,
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment.topLeft,
                    radius: 1.0,
                    colors: [
                      AppPalette.gold400.withValues(alpha: 0.09),
                      AppPalette.gold400.withValues(alpha: 0.0),
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
                      AppPalette.gold400.withValues(alpha: 0.0),
                      AppPalette.gold400.withValues(alpha: 0.5),
                      AppPalette.gold400.withValues(alpha: 0.0),
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
                  _HeaderBackButton(),
                  const SizedBox(width: AppSpacing.md),
                  // Container(
                  //   width: 44,
                  //   height: 44,
                  //   decoration: BoxDecoration(
                  //     color: Colors.white.withValues(alpha: 0.1),
                  //     borderRadius: BorderRadius.circular(13),
                  //     border: Border.all(
                  //       color: AppPalette.gold400.withValues(alpha: 0.35),
                  //     ),
                  //   ),
                  //   child: const Icon(
                  //     AppIcons.deposit,
                  //     color: AppPalette.gold300,
                  //     size: 22,
                  //   ),
                  // ),
                  // const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          l10n.financeDepositsDesc,
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: AppPalette.gold300,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.3,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          l10n.accountDeposits,
                          style: theme.textTheme.titleLarge?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            height: 1.1,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  const CustomerNotificationButton(size: 42),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HeaderBackButton extends StatelessWidget {
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

// ── Deposit Card ──────────────────────────────────────────────────────────────

class _DepositCard extends StatelessWidget {
  const _DepositCard({required this.deposit});
  final Deposit deposit;

  // Unique strip gradient per deposit type
  static List<Color> _stripColors(DepositType type) => switch (type) {
    DepositType.bookingAmount => [
      const Color(0xFF1B5E3F),
      const Color(0xFF0D3826),
    ],
    DepositType.downPayment => [_navyLight, _navyDeep],
    DepositType.installment => [
      const Color(0xFF1E3A6E),
      const Color(0xFF0B1F42),
    ],
    DepositType.finalPayment => [
      const Color(0xFF7A5C1E),
      const Color(0xFF4A3610),
    ],
    DepositType.unknown => [_navyCard, _navyDeep],
  };

  static Color _iconColor(DepositType type) => switch (type) {
    DepositType.bookingAmount => const Color(0xFF4ADE80),
    DepositType.downPayment => AppPalette.gold300,
    DepositType.installment => const Color(0xFF93C5FD),
    DepositType.finalPayment => const Color(0xFFFBD27A),
    DepositType.unknown => AppPalette.gold300,
  };

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;

    final stripGrad = _stripColors(deposit.type);
    final iconColor = _iconColor(deposit.type);
    final typeLabel = depositTypeLabel(l10n, deposit.type);

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
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Gradient strip: amount + type
          SizedBox(
            height: 92,
            child: Stack(
              fit: StackFit.expand,
              children: [
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: stripGrad,
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                ),
                const IgnorePointer(child: _DotTexture()),
                Positioned(
                  bottom: 0,
                  left: 0,
                  right: 0,
                  child: Container(
                    height: 1,
                    color: AppPalette.gold400.withValues(alpha: 0.28),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // Icon tile
                      Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.11),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.22),
                          ),
                        ),
                        child: Icon(
                          AppIcons.deposit,
                          color: iconColor,
                          size: 25,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.md),
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
                                fontSize: 20,
                                height: 1.0,
                                letterSpacing: -0.5,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              typeLabel,
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.75),
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                      // Verified / Pending badge
                      _VerifiedBadge(verified: deposit.verified, l10n: l10n),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // ── White body
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.md,
              AppSpacing.lg,
              AppSpacing.lg,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Contract + unit row
                if (deposit.contractNumber != null ||
                    deposit.unitCode != null) ...[
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
                          AppIcons.contract,
                          size: 16,
                          color: AppPalette.gold300,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (deposit.contractNumber != null)
                              Text(
                                deposit.contractNumber!,
                                style: theme.textTheme.bodyMedium?.copyWith(
                                  color: colors.inkStrong,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            if (deposit.unitCode != null)
                              Text(
                                deposit.unitCode!,
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: colors.inkMuted,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Divider(height: 1, color: colors.hairline),
                  const SizedBox(height: AppSpacing.sm),
                ],
                // Paid date
                if (deposit.paidAt != null)
                  _InfoRow(
                    icon: AppIcons.calendar,
                    label: l10n.depositPaidOn,
                    value: DateFormatter.mediumDate(
                      deposit.paidAt!,
                      languageCode: lang,
                    ),
                  )
                else
                  _InfoRow(
                    icon: AppIcons.calendar,
                    label: l10n.depositPaidOn,
                    value: '—',
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _VerifiedBadge extends StatelessWidget {
  const _VerifiedBadge({required this.verified, required this.l10n});
  final bool verified;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final bg = verified
        ? const Color(0xFF1B7A50).withValues(alpha: 0.85)
        : const Color(0xFF7A5C1E).withValues(alpha: 0.85);
    final dotColor = verified
        ? const Color(0xFF4ADE80)
        : const Color(0xFFFBBF24);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: dotColor.withValues(alpha: 0.4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
          ),
          const SizedBox(width: 5),
          Text(
            verified ? l10n.depositVerified : l10n.depositPending,
            style: TextStyle(
              color: dotColor,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
  });
  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Row(
      children: [
        Icon(icon, size: 14, color: colors.inkMuted),
        const SizedBox(width: AppSpacing.xs),
        Text(
          '$label: ',
          style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted),
        ),
        Expanded(
          child: Text(
            value,
            style: theme.textTheme.bodySmall?.copyWith(
              color: colors.inkStrong,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
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
