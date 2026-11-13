import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../notifications/presentation/widgets/customer_notification_button.dart';
import '../../domain/entities/installment.dart';
import '../cubit/installments_cubit.dart';
import '../widgets/installment_card.dart';

Color get _navyDeep => AppPalette.navyDeep;
Color get _navyLight => AppPalette.navyLight;

// ── Status colors ─────────────────────────────────────────────────────────────

const _paidGradient = [Color(0xFF1B5E3F), Color(0xFF0D3826)];
const _paidAccent = Color(0xFF4ADE80);
final _overdueGradient = [
  Color(0xFF9B2020),
  Color(0xFF620D0D),
]; // warmer crimson
final _overdueAccent = Color(0xFFF87171);
List<Color> get _pendingGradient => [_navyLight, _navyDeep];
Color get _pendingAccent => AppPalette.gold300;

// ─────────────────────────────────────────────────────────────────────────────
// Installments Screen
// ─────────────────────────────────────────────────────────────────────────────

class InstallmentsScreen extends StatefulWidget {
  const InstallmentsScreen({super.key});

  @override
  State<InstallmentsScreen> createState() => _InstallmentsScreenState();
}

class _InstallmentsScreenState extends State<InstallmentsScreen> {
  InstallmentStatus? _filter; // null = all

  @override
  void initState() {
    super.initState();
    context.read<InstallmentsCubit>().load();
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
          _InstallmentsHeader(displayName: displayName, l10n: l10n),

          // ── Filter chips ────────────────────────────────────────────────
          BlocBuilder<InstallmentsCubit, InstallmentsState>(
            builder: (context, state) {
              if (state.status != DataStatus.success) {
                return const SizedBox.shrink();
              }
              final all = state.data!;
              final overdueCount = all
                  .where((i) => i.status == InstallmentStatus.overdue)
                  .length;
              final pendingCount = all
                  .where((i) => i.status == InstallmentStatus.pending)
                  .length;
              final paidCount = all
                  .where((i) => i.status == InstallmentStatus.paid)
                  .length;
              return _FilterRow(
                selected: _filter?.name,
                items: [
                  _FilterItem(
                    key: null,
                    label: l10n.filterAny,
                    dotColor: null,
                    activeGradient: _pendingGradient,
                    count: all.length,
                  ),
                  _FilterItem(
                    key: InstallmentStatus.overdue.name,
                    label: l10n.installmentStatusOverdue,
                    dotColor: _overdueAccent,
                    activeGradient: _overdueGradient,
                    count: overdueCount,
                  ),
                  _FilterItem(
                    key: InstallmentStatus.pending.name,
                    label: l10n.installmentStatusPending,
                    dotColor: _pendingAccent,
                    activeGradient: _pendingGradient,
                    count: pendingCount,
                  ),
                  _FilterItem(
                    key: InstallmentStatus.paid.name,
                    label: l10n.installmentStatusPaid,
                    dotColor: _paidAccent,
                    activeGradient: _paidGradient,
                    count: paidCount,
                  ),
                ],
                onSelect: (k) => setState(() {
                  _filter = k == null
                      ? null
                      : InstallmentStatus.values.firstWhere((s) => s.name == k);
                }),
              );
            },
          ),

          // ── List ────────────────────────────────────────────────────────
          Expanded(
            child: BlocBuilder<InstallmentsCubit, InstallmentsState>(
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
                        itemCount: _skeletonInstallments.length + 1,
                        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
                        itemBuilder: (context, i) => i == 0 ? _InstallmentsSummary(installments: _skeletonInstallments, l10n: l10n) : InstallmentCard(installment: _skeletonInstallments[i - 1]),
                      ),
                    );
                  case DataStatus.failure:
                    return ErrorState(
                      failure: state.failure,
                      onRetry: () => context.read<InstallmentsCubit>().load(),
                    );
                  case DataStatus.empty:
                    return EmptyState(
                      icon: AppIcons.installments,
                      title: l10n.installmentsEmptyTitle,
                      message: l10n.installmentsEmptyMessage,
                    );
                  case DataStatus.success:
                    final all = state.data!;
                    final visible = _filter == null
                        ? all
                        : all.where((i) => i.status == _filter).toList();
                    return RefreshIndicator(
                      onRefresh: () => context.read<InstallmentsCubit>().load(),
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
                            return _InstallmentsSummary(
                              installments: all,
                              l10n: l10n,
                            );
                          }
                          return InstallmentCard(installment: visible[i - 1]);
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

/// Placeholder rows the loading screen lays out (never shown as data).
final _skeletonInstallments = [
  for (var i = 1; i <= 3; i++)
    Installment(
      id: 'skeleton-$i',
      amount: '97589.33',
      dueDate: DateTime(2026, i),
      status: InstallmentStatus.pending,
      type: InstallmentPaymentType.installment,
      contractNumber: 'CON-2026-0001',
      unitCode: 'DF-NG-B01-101',
      projectNameAr: 'اسم المشروع',
      projectNameEn: 'Project name',
    ),
];

// ── Header ────────────────────────────────────────────────────────────────────

class _InstallmentsHeader extends StatelessWidget {
  const _InstallmentsHeader({required this.displayName, required this.l10n});
  final String? displayName;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return AppNavHeader(
      title: l10n.installmentsTitle,
      subtitle: l10n.financeInstallmentsDesc,
      compact: true,
      leadingAction: const NavHeaderBack(),
      actions: const [CustomerNotificationButton()],
    );
  }
}

// ── Summary card ──────────────────────────────────────────────────────────────

class _InstallmentsSummary extends StatelessWidget {
  const _InstallmentsSummary({required this.installments, required this.l10n});
  final List<Installment> installments;
  final AppLocalizations l10n;

  static double _sum(Iterable<Installment> items) =>
      items.fold(0.0, (acc, i) => acc + (double.tryParse(i.amount) ?? 0.0));

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;

    final paid = installments
        .where((i) => i.status == InstallmentStatus.paid)
        .toList();
    final overdue = installments
        .where((i) => i.status == InstallmentStatus.overdue)
        .length;
    final pending = installments.length - paid.length - overdue;
    final paidTotal = _sum(paid);

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
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            l10n.installmentStatusPaid,
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
                              paidTotal.toStringAsFixed(2),
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
                        '${installments.length} ${l10n.installmentsTitle}',
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
                Row(
                  children: [
                    Expanded(
                      child: _SummaryCell(
                        value: '${paid.length}',
                        label: l10n.installmentStatusPaid,
                        accent: _paidAccent,
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
                        value: '$overdue',
                        label: l10n.installmentStatusOverdue,
                        accent: _overdueAccent,
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
                        label: l10n.installmentStatusPending,
                        accent: _pendingAccent,
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

// ── Installment Card ──────────────────────────────────────────────────────────

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
