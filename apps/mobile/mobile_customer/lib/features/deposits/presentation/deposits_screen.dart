import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../notifications/presentation/widgets/customer_notification_button.dart';
import '../domain/entities/deposit.dart';
import 'deposit_format.dart';
import 'deposits_cubit.dart';

Color get _navyDeep => AppPalette.navyDeep;
Color get _navyLight => AppPalette.navyLight;

// ─────────────────────────────────────────────────────────────────────────────
// Deposits Screen
// ─────────────────────────────────────────────────────────────────────────────

class DepositsScreen extends StatefulWidget {
  const DepositsScreen({super.key});

  @override
  State<DepositsScreen> createState() => _DepositsScreenState();
}

class _DepositsScreenState extends State<DepositsScreen> {
  DepositType? _filter; // null = all

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

          // ── Filter chips ────────────────────────────────────────────────
          BlocBuilder<DepositsCubit, DepositsState>(
            builder: (context, state) {
              if (state.status != DataStatus.success) {
                return const SizedBox.shrink();
              }
              final all = state.data!;
              int countOf(DepositType t) =>
                  all.where((d) => d.type == t).length;
              return _FilterRow(
                selected: _filter?.name,
                items: [
                  _FilterItem(
                    key: null,
                    label: l10n.filterAny,
                    dotColor: null,
                    activeGradient: [_navyLight, _navyDeep],
                    count: all.length,
                  ),
                  _FilterItem(
                    key: DepositType.bookingAmount.name,
                    label: l10n.depositTypeBooking,
                    dotColor: const Color(0xFF4ADE80),
                    activeGradient: const [
                      Color(0xFF1B5E3F),
                      Color(0xFF0D3826),
                    ],
                    count: countOf(DepositType.bookingAmount),
                  ),
                  _FilterItem(
                    key: DepositType.downPayment.name,
                    label: l10n.depositTypeDownPayment,
                    dotColor: AppPalette.gold300,
                    activeGradient: [_navyLight, _navyDeep],
                    count: countOf(DepositType.downPayment),
                  ),
                  _FilterItem(
                    key: DepositType.installment.name,
                    label: l10n.depositTypeInstallment,
                    dotColor: Color(0xFF93C5FD),
                    activeGradient: [
                      AppPalette.navyHero,
                      AppPalette.navyInk,
                    ],
                    count: countOf(DepositType.installment),
                  ),
                  _FilterItem(
                    key: DepositType.finalPayment.name,
                    label: l10n.depositTypeFinal,
                    dotColor: AppPalette.goldPale,
                    activeGradient: [
                      AppPalette.goldBrown1,
                      Color(0xFF4A3610),
                    ],
                    count: countOf(DepositType.finalPayment),
                  ),
                ],
                onSelect: (k) => setState(() {
                  _filter = k == null
                      ? null
                      : DepositType.values.firstWhere((t) => t.name == k);
                }),
              );
            },
          ),

          // ── List ────────────────────────────────────────────────────────
          Expanded(
            child: BlocBuilder<DepositsCubit, DepositsState>(
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    // The list itself, as bones: its summary card and a few cards.
                    return AppSkeletonizer(
                      enabled: true,
                      child: ListView.separated(
                        physics: const NeverScrollableScrollPhysics(),
                        padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.xl),
                        itemCount: _skeletonDeposits.length + 1,
                        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
                        itemBuilder: (context, i) => i == 0 ? _DepositsSummary(deposits: _skeletonDeposits, l10n: l10n) : _DepositCard(deposit: _skeletonDeposits[i - 1], l10n: l10n),
                      ),
                    );
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
                    final all = state.data!;
                    final visible = _filter == null
                        ? all
                        : all.where((d) => d.type == _filter).toList();
                    return RefreshIndicator(
                      onRefresh: () => context.read<DepositsCubit>().load(),
                      child: ListView.separated(
                        padding: EdgeInsets.fromLTRB(
                          AppSpacing.lg,
                          AppSpacing.md,
                          AppSpacing.lg,
                          AppSpacing.xl + MediaQuery.of(context).padding.bottom,
                        ),
                        itemCount: visible.length + 1,
                        separatorBuilder: (_, _) =>
                            const SizedBox(height: AppSpacing.md),
                        itemBuilder: (context, i) {
                          if (i == 0) {
                            return _DepositsSummary(deposits: all, l10n: l10n);
                          }
                          return _DepositCard(
                            deposit: visible[i - 1],
                            l10n: l10n,
                          );
                        },
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

/// Placeholder payments the loading screen lays out (never shown as data).
final _skeletonDeposits = [
  for (var i = 1; i <= 3; i++)
    Deposit(
      id: 'skeleton-$i',
      amount: '100000',
      type: DepositType.installment,
      verified: true,
      paidAt: DateTime(2026, i),
      contractNumber: 'CON-2026-0001',
      unitCode: 'DF-NG-B01-101',
    ),
];

// ── Header ────────────────────────────────────────────────────────────────────

class _DepositsHeader extends StatelessWidget {
  const _DepositsHeader({required this.displayName, required this.l10n});
  final String? displayName;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return AppNavHeader(
      title: l10n.accountDeposits,
      subtitle: l10n.financeDepositsDesc,
      compact: true,
      leadingAction: const NavHeaderBack(),
      actions: const [CustomerNotificationButton()],
    );
  }
}

// ── Summary card ──────────────────────────────────────────────────────────────

class _DepositsSummary extends StatelessWidget {
  const _DepositsSummary({required this.deposits, required this.l10n});
  final List<Deposit> deposits;
  final AppLocalizations l10n;

  // Only money that arrived: summing every row counted proofs under review,
  // rejected ones, reversed payments and returned cheques as paid.
  static double _sum(Iterable<Deposit> items) => items
      .where((d) => d.collected)
      .fold(0.0, (acc, d) => acc + (double.tryParse(d.amount) ?? 0.0));

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;

    final total = _sum(deposits);
    final verified = deposits.where((d) => d.collected).length;
    final pending = deposits.length - verified;

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [_navyLight, _navyDeep],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: _navyDeep.withValues(alpha: 0.25),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
          BoxShadow(
            color: AppPalette.gold400.withValues(alpha: 0.08),
            blurRadius: 24,
            spreadRadius: 2,
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          const Positioned.fill(child: IgnorePointer(child: _DotTexture())),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Total paid amount
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            l10n.depositPaidOn,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.6),
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 0.3,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            PriceFormatter.formatString(
                              total.toStringAsFixed(2),
                              languageCode: lang,
                            ),
                            style: theme.textTheme.titleLarge?.copyWith(
                              color: AppPalette.gold300,
                              fontWeight: FontWeight.w900,
                              letterSpacing: -0.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.15),
                        ),
                      ),
                      child: Text(
                        '${deposits.length} ${l10n.accountDeposits}',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.75),
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                Container(
                  height: 1,
                  color: Colors.white.withValues(alpha: 0.12),
                ),
                const SizedBox(height: AppSpacing.md),
                // Verified / Pending split
                Row(
                  children: [
                    Expanded(
                      child: _SummaryCell(
                        value: '$verified',
                        label: l10n.depositVerified,
                        accent: const Color(0xFF4ADE80),
                        theme: theme,
                      ),
                    ),
                    Container(
                      width: 1,
                      height: 40,
                      color: Colors.white.withValues(alpha: 0.15),
                    ),
                    Expanded(
                      child: _SummaryCell(
                        value: '$pending',
                        label: l10n.depositPending,
                        accent: const Color(0xFFFBBF24),
                        theme: theme,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryCell extends StatelessWidget {
  const _SummaryCell({
    required this.value,
    required this.label,
    required this.accent,
    required this.theme,
  });
  final String value;
  final String label;
  final Color accent;
  final ThemeData theme;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          value,
          style: theme.textTheme.headlineSmall?.copyWith(
            color: accent,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.65),
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

// ── Deposit Card ──────────────────────────────────────────────────────────────

class _DepositCard extends StatelessWidget {
  const _DepositCard({required this.deposit, required this.l10n});
  final Deposit deposit;
  final AppLocalizations l10n;

  static Color _accent(DepositType type, bool dark) => switch (type) {
    DepositType.bookingAmount =>
      dark ? const Color(0xFF4ADE80) : const Color(0xFF15803D),
    DepositType.downPayment =>
      dark ? AppPalette.gold300 : AppPalette.goldInk,
    DepositType.installment =>
      dark ? const Color(0xFF93C5FD) : const Color(0xFF1D4ED8),
    DepositType.finalPayment =>
      dark ? AppPalette.goldPale : const Color(0xFFB45309),
    DepositType.fee =>
      dark ? const Color(0xFFFCA5A5) : const Color(0xFFB91C1C),
    DepositType.unknown =>
      dark ? AppPalette.gold300 : AppPalette.goldInk,
  };

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;

    final dark = Theme.of(context).brightness == Brightness.dark;
    final accent = _accent(deposit.type, dark);
    final typeLabel = depositTypeLabel(l10n, deposit.type);
    final locationLine = [
      if (deposit.contractNumber != null) deposit.contractNumber!,
      if (deposit.unitCode != null) deposit.unitCode!,
    ].join(' · ');

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
          Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.13),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(AppIcons.deposit, color: accent, size: 24),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      PriceFormatter.formatString(
                        deposit.amount,
                        languageCode: lang,
                      ),
                      style: theme.textTheme.titleLarge?.copyWith(
                        color: colors.inkStrong,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      typeLabel,
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
              _VerifiedBadge(verified: deposit.collected, l10n: l10n),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Divider(height: 1, color: colors.hairline),
          const SizedBox(height: AppSpacing.md),
          if (locationLine.isNotEmpty) ...[
            Row(
              children: [
                Icon(AppIcons.contract, size: 16, color: colors.inkMuted),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    locationLine,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: colors.inkStrong,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
          _InfoRow(
            icon: AppIcons.calendar,
            label: l10n.depositPaidOn,
            value: deposit.paidAt != null
                ? DateFormatter.mediumDate(deposit.paidAt!, languageCode: lang)
                : '—',
          ),
          const SizedBox(height: AppSpacing.md),
          _ReceiptsButton(
            label: l10n.depositReceiptsTitle,
            onTap: () => context.push(
              '/account/deposits/${deposit.id}',
              extra: deposit,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Verified badge ────────────────────────────────────────────────────────────

class _VerifiedBadge extends StatelessWidget {
  const _VerifiedBadge({required this.verified, required this.l10n});
  final bool verified;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final dotColor = verified
        ? (dark ? const Color(0xFF4ADE80) : const Color(0xFF15803D))
        : (dark ? const Color(0xFFFBBF24) : const Color(0xFFB45309));
    final bg = dotColor.withValues(alpha: 0.12);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: dotColor.withValues(alpha: 0.3)),
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
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Receipts button ───────────────────────────────────────────────────────────

class _ReceiptsButton extends StatelessWidget {
  const _ReceiptsButton({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    final accent = AppPalette.gold300;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: accent.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: accent.withValues(alpha: 0.35),
            width: 1.5,
          ),
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
                    colors: [_navyLight, _navyDeep],
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
                child: Icon(
                  Icons.receipt_long_rounded,
                  color: accent,
                  size: 22,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: colors.inkStrong,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      context.l10n.tapToViewReceipts,
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

// ── Info row ──────────────────────────────────────────────────────────────────

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

// ── Filter row ────────────────────────────────────────────────────────────────

class _FilterItem {
  const _FilterItem({
    required this.key,
    required this.label,
    required this.dotColor,
    required this.activeGradient,
    required this.count,
  });
  final String? key;
  final String label;
  final Color? dotColor;
  final List<Color> activeGradient;
  final int count;
}

class _FilterRow extends StatelessWidget {
  const _FilterRow({
    required this.items,
    required this.selected,
    required this.onSelect,
  });
  final List<_FilterItem> items;
  final String? selected;
  final void Function(String?) onSelect;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 58,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: 8),
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
        itemBuilder: (context, i) {
          final item = items[i];
          return AppFilterChip(
            label: item.label,
            count: item.count,
            dotColor: item.dotColor,
            selected: item.key == selected,
            onTap: () => onSelect(item.key),
          );
        },
      ),
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
