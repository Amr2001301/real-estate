import 'dart:math' as math;

import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../installments/domain/entities/installment.dart';
import '../../installments/presentation/cubit/installments_cubit.dart';
import '../domain/entities/property.dart';

const _navy = Color(0xFF0B1726);
const _navyCard = Color(0xFF152236);
const _navyAccent = Color(0xFF1E3451);

enum _Filter { all, paid, pending, overdue }

// ─────────────────────────────────────────────────────────────────────────────
// Property Detail Screen
// ─────────────────────────────────────────────────────────────────────────────

class PropertyDetailScreen extends StatefulWidget {
  const PropertyDetailScreen({super.key, required this.property});
  final Property property;

  @override
  State<PropertyDetailScreen> createState() => _PropertyDetailScreenState();
}

class _PropertyDetailScreenState extends State<PropertyDetailScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  _Filter _filter = _Filter.all;

  @override
  void initState() {
    super.initState();
    // index 0 = الأقساط  |  index 1 = الملخص
    _tabs = TabController(length: 2, vsync: this);
    context.read<InstallmentsCubit>().load();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final lang = Localizations.localeOf(context).languageCode;
    final l10n = context.l10n;
    final property = widget.property;
    final colors = context.appColors;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: Scaffold(
        backgroundColor: colors.canvas,
        body: BlocBuilder<InstallmentsCubit, InstallmentsState>(
          builder: (context, state) {
            final all = state.status == DataStatus.success
                ? state.data!
                      .where((i) => i.contractId == property.contractId)
                      .toList()
                : const <Installment>[];

            final paidCount =
                all.where((i) => i.status == InstallmentStatus.paid).length;
            final overdueCount = all
                .where((i) => i.status == InstallmentStatus.overdue)
                .length;
            final pendingCount = all.length - paidCount - overdueCount;

            final displayed = switch (_filter) {
              _Filter.paid => all
                  .where((i) => i.status == InstallmentStatus.paid)
                  .toList(),
              _Filter.pending => all
                  .where((i) => i.status == InstallmentStatus.pending)
                  .toList(),
              _Filter.overdue => all
                  .where((i) => i.status == InstallmentStatus.overdue)
                  .toList(),
              _Filter.all => all,
            };

            return Column(
              children: [
                // ── Unit card header ──────────────────────────────────
                _UnitHeader(
                  property: property,
                  lang: lang,
                  l10n: l10n,
                  total: all.length,
                  paid: paidCount,
                ),
                // ── Pill tab bar ──────────────────────────────────────
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.lg,
                    AppSpacing.sm,
                    AppSpacing.lg,
                    0,
                  ),
                  child: _PillTabBar(controller: _tabs, colors: colors),
                ),
                const SizedBox(height: AppSpacing.sm),
                // ── Tab content ───────────────────────────────────────
                Expanded(
                  child: TabBarView(
                    controller: _tabs,
                    children: [
                      // Tab 0: الأقساط
                      _InstallmentsTab(
                        state: state,
                        displayed: displayed,
                        all: all,
                        filter: _filter,
                        onFilterChanged: (f) =>
                            setState(() => _filter = f),
                        paidCount: paidCount,
                        pendingCount: pendingCount,
                        overdueCount: overdueCount,
                        lang: lang,
                        l10n: l10n,
                      ),
                      // Tab 1: الملخص
                      _SummaryTab(
                        property: property,
                        lang: lang,
                        l10n: l10n,
                        total: all.length,
                        paid: paidCount,
                        pending: pendingCount,
                        overdue: overdueCount,
                      ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

// ── Unit header card ──────────────────────────────────────────────────────────

class _UnitHeader extends StatelessWidget {
  const _UnitHeader({
    required this.property,
    required this.lang,
    required this.l10n,
    required this.total,
    required this.paid,
  });
  final Property property;
  final String lang;
  final AppLocalizations l10n;
  final int total;
  final int paid;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final topInset = MediaQuery.paddingOf(context).top;
    final owned = property.status == PropertyStatus.owned;
    final progress = total > 0 ? paid / total : 0.0;

    return Container(
      width: double.infinity,
      clipBehavior: Clip.antiAlias,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: [_navyAccent, _navyCard, _navy],
          stops: [0.0, 0.45, 1.0],
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(32),
          bottomRight: Radius.circular(32),
        ),
        boxShadow: [
          BoxShadow(
            color: Color(0x55000000),
            blurRadius: 28,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: Stack(
        children: [
          const Positioned.fill(
            child: IgnorePointer(child: _DotTexture()),
          ),
          // Gold radial glow
          PositionedDirectional(
            end: 0,
            top: 0,
            child: Container(
              width: 220,
              height: 180,
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment.topRight,
                  radius: 1.0,
                  colors: [
                    AppPalette.gold400.withValues(alpha: 0.16),
                    AppPalette.gold400.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
          // Decorative arc — bottom-start
          PositionedDirectional(
            start: -56,
            bottom: -56,
            child: Container(
              width: 180,
              height: 180,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.03),
                  width: 1.5,
                ),
              ),
            ),
          ),
          // Gold hairline
          Positioned(
            bottom: 0,
            left: 56,
            right: 56,
            child: Container(
              height: 1,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppPalette.gold400.withValues(alpha: 0.0),
                    AppPalette.gold400.withValues(alpha: 0.55),
                    AppPalette.gold400.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.lg,
              topInset + AppSpacing.xs,
              AppSpacing.lg,
              AppSpacing.lg,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Back button row
                _BackBtn(),
                const SizedBox(height: AppSpacing.md),
                // Main content row: icon + info + progress ring
                Row(
                  children: [
                    // Triple-ring icon
                    Stack(
                      alignment: Alignment.center,
                      children: [
                        Container(
                          width: 72,
                          height: 72,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: AppPalette.gold400.withValues(
                                  alpha: 0.28,
                                ),
                                blurRadius: 22,
                                spreadRadius: 4,
                              ),
                            ],
                          ),
                        ),
                        Container(
                          width: 70,
                          height: 70,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: AppPalette.gold400.withValues(alpha: 0.18),
                              width: 1,
                            ),
                          ),
                        ),
                        Container(
                          width: 60,
                          height: 60,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: const LinearGradient(
                              colors: [_navyAccent, _navy],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            border: Border.all(
                              color: AppPalette.gold400.withValues(alpha: 0.65),
                              width: 1.5,
                            ),
                          ),
                          child: const Icon(
                            Icons.domain_rounded,
                            color: AppPalette.gold400,
                            size: 26,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(width: AppSpacing.md),
                    // Project info
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            property.projectName.resolve(lang),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.titleLarge?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              height: 1.1,
                              letterSpacing: -0.3,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${property.unitType}  ·  ${property.unitCode}',
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.50),
                              fontSize: 12.5,
                              letterSpacing: 0.4,
                            ),
                          ),
                          const SizedBox(height: 8),
                          // Status + contract chips
                          Wrap(
                            spacing: 6,
                            children: [
                              _SmallChip(
                                label: owned
                                    ? l10n.myPropertyStatusOwned
                                    : l10n.myPropertyStatusReserved,
                                color: owned
                                    ? Colors.greenAccent
                                    : Colors.amber,
                              ),
                              if (property.contractNumber != null)
                                _SmallChip(
                                  label: property.contractNumber!,
                                  color: AppPalette.gold300,
                                  icon: Icons.article_outlined,
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    // Mini donut progress
                    if (total > 0) ...[
                      const SizedBox(width: AppSpacing.md),
                      SizedBox(
                        width: 52,
                        height: 52,
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            CustomPaint(
                              painter: _DonutPainter(progress: progress),
                              child: const SizedBox.expand(),
                            ),
                            Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  '$paid',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w900,
                                    height: 1.0,
                                  ),
                                ),
                                Text(
                                  '/ $total',
                                  style: TextStyle(
                                    color: Colors.white.withValues(
                                      alpha: 0.45,
                                    ),
                                    fontSize: 10,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
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

class _SmallChip extends StatelessWidget {
  const _SmallChip({required this.label, required this.color, this.icon});
  final String label;
  final Color color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.13),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.40)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: color),
            const SizedBox(width: 4),
          ] else ...[
            Container(
              width: 5,
              height: 5,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 12,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.1,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Pill tab bar ──────────────────────────────────────────────────────────────

class _PillTabBar extends StatelessWidget {
  const _PillTabBar({required this.controller, required this.colors});
  final TabController controller;
  final AppColorsExt colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 46,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: colors.surfaceSoft,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.55)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: TabBar(
        controller: controller,
        indicator: BoxDecoration(
          gradient: const LinearGradient(
            colors: [_navyAccent, _navy],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(10),
          boxShadow: [
            BoxShadow(
              color: _navy.withValues(alpha: 0.32),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        indicatorSize: TabBarIndicatorSize.tab,
        dividerColor: Colors.transparent,
        labelColor: Colors.white,
        unselectedLabelColor: colors.inkMuted,
        labelStyle: const TextStyle(
          fontWeight: FontWeight.w700,
          fontSize: 13.5,
        ),
        unselectedLabelStyle: const TextStyle(
          fontWeight: FontWeight.w500,
          fontSize: 13.5,
        ),
        tabs: const [
          Tab(text: 'الأقساط'),
          Tab(text: 'الملخص'),
        ],
      ),
    );
  }
}

// ── Installments tab ──────────────────────────────────────────────────────────

class _InstallmentsTab extends StatelessWidget {
  const _InstallmentsTab({
    required this.state,
    required this.displayed,
    required this.all,
    required this.filter,
    required this.onFilterChanged,
    required this.paidCount,
    required this.pendingCount,
    required this.overdueCount,
    required this.lang,
    required this.l10n,
  });
  final InstallmentsState state;
  final List<Installment> displayed;
  final List<Installment> all;
  final _Filter filter;
  final ValueChanged<_Filter> onFilterChanged;
  final int paidCount;
  final int pendingCount;
  final int overdueCount;
  final String lang;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.xs,
        AppSpacing.lg,
        AppSpacing.xl + MediaQuery.of(context).padding.bottom,
      ),
      children: [
        // Filter chips
        if (all.isNotEmpty) ...[
          _FilterBar(
            filter: filter,
            onChanged: onFilterChanged,
            paid: paidCount,
            pending: pendingCount,
            overdue: overdueCount,
            l10n: l10n,
          ),
          const SizedBox(height: AppSpacing.md),
        ],
        // Table or state
        if (state.status == DataStatus.initial ||
            state.status == DataStatus.loading)
          const _Skeleton()
        else if (displayed.isEmpty)
          _EmptyState(l10n: l10n)
        else
          _InstallmentTable(
            installments: displayed,
            lang: lang,
            l10n: l10n,
          ),
      ],
    );
  }
}

// ── Filter bar ────────────────────────────────────────────────────────────────

class _FilterBar extends StatelessWidget {
  const _FilterBar({
    required this.filter,
    required this.onChanged,
    required this.paid,
    required this.pending,
    required this.overdue,
    required this.l10n,
  });
  final _Filter filter;
  final ValueChanged<_Filter> onChanged;
  final int paid;
  final int pending;
  final int overdue;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final chips = <({String label, _Filter value, int? count, Color? dot})>[
      (label: 'الكل', value: _Filter.all, count: null, dot: null),
      (
        label: l10n.installmentStatusOverdue,
        value: _Filter.overdue,
        count: overdue,
        dot: const Color(0xFFFF6B6B),
      ),
      (
        label: l10n.installmentStatusPending,
        value: _Filter.pending,
        count: pending,
        dot: Colors.amber,
      ),
      (
        label: l10n.installmentStatusPaid,
        value: _Filter.paid,
        count: paid,
        dot: Colors.greenAccent,
      ),
    ];

    return SizedBox(
      height: 34,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: chips.map((chip) {
          final selected = filter == chip.value;
          final colors = context.appColors;
          return Padding(
            padding: const EdgeInsetsDirectional.only(end: 8),
            child: GestureDetector(
              onTap: () => onChanged(chip.value),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 160),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                decoration: BoxDecoration(
                  color: selected ? _navy : colors.surface,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(
                    color: selected
                        ? _navy
                        : colors.hairline.withValues(alpha: 0.7),
                  ),
                  boxShadow: selected
                      ? [
                          BoxShadow(
                            color: _navy.withValues(alpha: 0.28),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ]
                      : null,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (chip.dot != null) ...[
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: chip.dot,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 5),
                    ],
                    Text(
                      chip.count != null
                          ? '${chip.label} (${chip.count})'
                          : chip.label,
                      style: TextStyle(
                        color: selected ? Colors.white : colors.inkMuted,
                        fontSize: 13,
                        fontWeight:
                            selected ? FontWeight.w700 : FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

// ── Installment table ─────────────────────────────────────────────────────────

class _InstallmentTable extends StatelessWidget {
  const _InstallmentTable({
    required this.installments,
    required this.lang,
    required this.l10n,
  });
  final List<Installment> installments;
  final String lang;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.45)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.07),
            blurRadius: 18,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          // ── Header ────────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.md,
              12,
              AppSpacing.md,
              12,
            ),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [_navyAccent, _navyCard, _navy],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Stack(
              children: [
                const Positioned.fill(
                  child: IgnorePointer(child: _DotTexture()),
                ),
                Row(
                  children: [
                    // Amount (rightmost in RTL)
                    SizedBox(
                      width: 116,
                      child: Row(
                        children: [
                          Icon(
                            Icons.payments_rounded,
                            size: 12,
                            color: AppPalette.gold300.withValues(alpha: 0.80),
                          ),
                          const SizedBox(width: 5),
                          Text(
                            'المبلغ',
                            style: TextStyle(
                              color: AppPalette.gold300.withValues(alpha: 0.95),
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.3,
                            ),
                          ),
                        ],
                      ),
                    ),
                    // Date (center)
                    Expanded(
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.event_rounded,
                            size: 11,
                            color: Colors.white.withValues(alpha: 0.50),
                          ),
                          const SizedBox(width: 5),
                          Text(
                            'الاستحقاق',
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.60),
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                    // Status (leftmost in RTL)
                    SizedBox(
                      width: 92,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          Icon(
                            Icons.radio_button_checked_rounded,
                            size: 11,
                            color: Colors.white.withValues(alpha: 0.50),
                          ),
                          const SizedBox(width: 5),
                          Text(
                            'الحالة',
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.60),
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          // ── Data rows ─────────────────────────────────────────────
          ...installments.asMap().entries.map((e) {
            final rowIndex = e.key;
            final inst = e.value;
            return Column(
              children: [
                if (rowIndex > 0)
                  Container(
                    height: 1,
                    color: colors.hairline.withValues(alpha: 0.7),
                  ),
                _TableRow(
                  installment: inst,
                  rowIndex: rowIndex,
                  lang: lang,
                  l10n: l10n,
                  colors: colors,
                ),
              ],
            );
          }),
        ],
      ),
    );
  }
}

class _TableRow extends StatelessWidget {
  const _TableRow({
    required this.installment,
    required this.rowIndex,
    required this.lang,
    required this.l10n,
    required this.colors,
  });
  final Installment installment;
  final int rowIndex;
  final String lang;
  final AppLocalizations l10n;
  final AppColorsExt colors;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final status = installment.status;

    final (statusColor, statusLabel) = switch (status) {
      InstallmentStatus.paid => (
          const Color(0xFF34C77B),
          l10n.installmentStatusPaid,
        ),
      InstallmentStatus.overdue => (
          const Color(0xFFEF4444),
          l10n.installmentStatusOverdue,
        ),
      _ => (const Color(0xFFF59E0B), l10n.installmentStatusPending),
    };

    // Alternating row stripe
    final stripe = rowIndex.isOdd
        ? colors.surfaceSoft.withValues(alpha: 0.55)
        : Colors.transparent;

    final typeLabel = switch (installment.type) {
      InstallmentPaymentType.downPayment => 'دفعة مقدمة',
      InstallmentPaymentType.finalPayment => 'دفعة أخيرة',
      _ => null,
    };

    final rowNum = (rowIndex + 1).toString().padLeft(2, '0');

    return InkWell(
      onTap: installment.canSubmitProof
          ? () => context.push(
                '/account/installments/${installment.id}/submit-proof',
                extra: installment,
              )
          : null,
      splashColor: AppPalette.gold400.withValues(alpha: 0.05),
      highlightColor: AppPalette.gold400.withValues(alpha: 0.03),
      child: Container(
        decoration: BoxDecoration(
          color: stripe,
          // Status indicator bar on visual-left side
          border: Border(
            left: BorderSide(
              color: statusColor.withValues(alpha: 0.55),
              width: 3,
            ),
          ),
        ),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: 13,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // ── Amount column (rightmost in RTL) ──────────────────
            SizedBox(
              width: 116,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Row number
                  Text(
                    '#$rowNum',
                    style: TextStyle(
                      color: colors.inkMuted.withValues(alpha: 0.55),
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.5,
                      height: 1.0,
                    ),
                  ),
                  const SizedBox(height: 2),
                  // Amount
                  Text(
                    PriceFormatter.formatString(
                      installment.amount,
                      languageCode: lang,
                    ),
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: colors.inkStrong,
                      fontWeight: FontWeight.w900,
                      fontSize: 13.5,
                      letterSpacing: -0.3,
                      height: 1.1,
                    ),
                  ),
                  if (typeLabel != null) ...[
                    const SizedBox(height: 2),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 5,
                        vertical: 1,
                      ),
                      decoration: BoxDecoration(
                        color: AppPalette.gold400.withValues(alpha: 0.10),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(
                          color: AppPalette.gold400.withValues(alpha: 0.30),
                        ),
                      ),
                      child: Text(
                        typeLabel,
                        style: const TextStyle(
                          color: AppPalette.gold500,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.1,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            // ── Date column (center) ───────────────────────────────
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.event_rounded,
                    size: 13,
                    color: colors.inkMuted.withValues(alpha: 0.65),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    DateFormatter.mediumDate(
                      installment.dueDate,
                      languageCode: lang,
                    ),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: colors.inkMuted,
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      height: 1.1,
                    ),
                  ),
                ],
              ),
            ),
            // ── Status column (leftmost in RTL) ───────────────────
            SizedBox(
              width: 92,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Status badge
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 9,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.10),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: statusColor.withValues(alpha: 0.30),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 5,
                          height: 5,
                          decoration: BoxDecoration(
                            color: statusColor,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          statusLabel,
                          style: TextStyle(
                            color: statusColor,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Submit action (when payable)
                  if (installment.canSubmitProof) ...[
                    const SizedBox(height: 5),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [
                            Color(0xFFD4A843),
                            AppPalette.gold500,
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(6),
                        boxShadow: [
                          BoxShadow(
                            color: AppPalette.gold400.withValues(alpha: 0.28),
                            blurRadius: 6,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.upload_rounded,
                            size: 11,
                            color: _navy,
                          ),
                          const SizedBox(width: 3),
                          Text(
                            installment.isResubmit ? 'إعادة إرسال' : 'إرسال',
                            style: const TextStyle(
                              color: _navy,
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Summary tab ───────────────────────────────────────────────────────────────

class _SummaryTab extends StatelessWidget {
  const _SummaryTab({
    required this.property,
    required this.lang,
    required this.l10n,
    required this.total,
    required this.paid,
    required this.pending,
    required this.overdue,
  });
  final Property property;
  final String lang;
  final AppLocalizations l10n;
  final int total;
  final int paid;
  final int pending;
  final int overdue;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.xs,
        AppSpacing.lg,
        AppSpacing.xl + MediaQuery.of(context).padding.bottom,
      ),
      children: [
        // Financial overview card
        if (property.hasInstallmentPlan) ...[
          _FinancialCard(
            property: property,
            lang: lang,
            total: total,
            paid: paid,
            pending: pending,
            overdue: overdue,
          ),
          const SizedBox(height: AppSpacing.lg),
        ],
        // Contract details card
        _ContractCard(property: property, lang: lang, l10n: l10n),
      ],
    );
  }
}

// ── Financial card ────────────────────────────────────────────────────────────

class _FinancialCard extends StatelessWidget {
  const _FinancialCard({
    required this.property,
    required this.lang,
    required this.total,
    required this.paid,
    required this.pending,
    required this.overdue,
  });
  final Property property;
  final String lang;
  final int total;
  final int paid;
  final int pending;
  final int overdue;

  @override
  Widget build(BuildContext context) {
    final progress = total > 0 ? paid / total : 0.0;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [_navyAccent, _navyCard, _navy],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          stops: [0.0, 0.5, 1.0],
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: _navy.withValues(alpha: 0.45),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
          BoxShadow(
            color: AppPalette.gold400.withValues(alpha: 0.06),
            blurRadius: 32,
            spreadRadius: 4,
          ),
        ],
      ),
      child: Stack(
        children: [
          const Positioned.fill(
            child: IgnorePointer(child: _DotTexture()),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Eyebrow
              Row(
                children: [
                  Text(
                    'اللوحة المالية',
                    style: TextStyle(
                      color: AppPalette.gold300.withValues(alpha: 0.80),
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.6,
                    ),
                  ),
                  const Spacer(),
                  if (property.totalMonths != null)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 9,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: AppPalette.gold400.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(
                          color: AppPalette.gold400.withValues(alpha: 0.30),
                        ),
                      ),
                      child: Text(
                        '${property.totalMonths} شهرًا',
                        style: const TextStyle(
                          color: AppPalette.gold300,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Donut ring
                  SizedBox(
                    width: 100,
                    height: 100,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        CustomPaint(
                          painter: _DonutPainter(progress: progress),
                          child: const SizedBox.expand(),
                        ),
                        Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              '$paid',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 24,
                                fontWeight: FontWeight.w900,
                                height: 1.0,
                              ),
                            ),
                            Text(
                              'من $total',
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.42),
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.lg),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'القسط الشهري',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.48),
                            fontSize: 13,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          PriceFormatter.formatString(
                            property.monthlyAmount,
                            languageCode: lang,
                          ),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.5,
                            height: 1.1,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        Row(
                          children: [
                            _MiniStat(
                              label: 'مسددة',
                              value: '$paid',
                              color: Colors.greenAccent,
                            ),
                            const SizedBox(width: 6),
                            _MiniStat(
                              label: 'معلقة',
                              value: '$pending',
                              color: Colors.amber,
                            ),
                            if (overdue > 0) ...[
                              const SizedBox(width: 6),
                              _MiniStat(
                                label: 'متأخرة',
                                value: '$overdue',
                                color: const Color(0xFFFF6B6B),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({
    required this.label,
    required this.value,
    required this.color,
  });
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(9),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            value,
            style: TextStyle(
              color: color,
              fontSize: 15,
              fontWeight: FontWeight.w900,
              height: 1.0,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              color: color.withValues(alpha: 0.70),
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Contract card (summary tab) ───────────────────────────────────────────────

class _ContractCard extends StatelessWidget {
  const _ContractCard({
    required this.property,
    required this.lang,
    required this.l10n,
  });
  final Property property;
  final String lang;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    final cells = <_Cell>[
      if (property.contractNumber != null)
        _Cell(
          icon: AppIcons.contract,
          label: l10n.myPropertyContractNumber,
          value: property.contractNumber!,
        ),
      if (property.signedAt != null)
        _Cell(
          icon: AppIcons.calendar,
          label: l10n.myPropertySignedDate,
          value: DateFormatter.mediumDate(
            property.signedAt!,
            languageCode: lang,
          ),
        ),
      if (property.reservationNumber != null)
        _Cell(
          icon: Icons.confirmation_number_rounded,
          label: l10n.myPropertyReservationNumber,
          value: property.reservationNumber!,
        ),
      if (property.totalMonths != null)
        _Cell(
          icon: Icons.calendar_month_rounded,
          label: 'مدة التقسيط',
          value: '${property.totalMonths} شهرًا',
        ),
    ];

    if (cells.isEmpty) return const SizedBox.shrink();

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.45)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Strip header
          Container(
            height: 56,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [_navyAccent, _navyCard, _navy],
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
                    color: AppPalette.gold400.withValues(alpha: 0.28),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          color: AppPalette.gold400.withValues(alpha: 0.14),
                          borderRadius: BorderRadius.circular(7),
                          border: Border.all(
                            color: AppPalette.gold400.withValues(alpha: 0.35),
                          ),
                        ),
                        child: const Icon(
                          Icons.article_rounded,
                          size: 13,
                          color: AppPalette.gold400,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      const Text(
                        'تفاصيل العقد',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 15,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          // 2-col grid
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: GridView.count(
              shrinkWrap: true,
              crossAxisCount: 2,
              physics: const NeverScrollableScrollPhysics(),
              childAspectRatio: 2.4,
              crossAxisSpacing: AppSpacing.sm,
              mainAxisSpacing: AppSpacing.sm,
              children: cells
                  .map(
                    (c) =>
                        _CellWidget(cell: c, colors: colors, theme: theme),
                  )
                  .toList(),
            ),
          ),
        ],
      ),
    );
  }
}

class _Cell {
  const _Cell({
    required this.icon,
    required this.label,
    required this.value,
  });
  final IconData icon;
  final String label;
  final String value;
}

class _CellWidget extends StatelessWidget {
  const _CellWidget({
    required this.cell,
    required this.colors,
    required this.theme,
  });
  final _Cell cell;
  final AppColorsExt colors;
  final ThemeData theme;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm + 2,
        vertical: AppSpacing.xs + 2,
      ),
      decoration: BoxDecoration(
        color: colors.surfaceSoft,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.55)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Row(
            children: [
              Icon(cell.icon, size: 12, color: colors.inkMuted),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  cell.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: colors.inkMuted,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            cell.value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.bodySmall?.copyWith(
              color: colors.inkStrong,
              fontWeight: FontWeight.w800,
              fontSize: 13.5,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Empty / skeleton ──────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.l10n});
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.xl),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.5)),
      ),
      child: Column(
        children: [
          Icon(
            Icons.calendar_today_outlined,
            size: 36,
            color: colors.inkMuted,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            l10n.installmentsEmptyTitle,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: colors.inkMuted,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return AppSkeletonizer(
      enabled: true,
      child: Container(
        height: 280,
        decoration: BoxDecoration(
          color: colors.surfaceSoft,
          borderRadius: BorderRadius.circular(16),
        ),
      ),
    );
  }
}

// ── Donut painter ─────────────────────────────────────────────────────────────

class _DonutPainter extends CustomPainter {
  const _DonutPainter({required this.progress});
  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = math.min(size.width, size.height) / 2 - 5;
    final rect = Rect.fromCircle(center: center, radius: radius);
    const startAngle = -math.pi / 2;

    final trackPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.09)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 5;
    canvas.drawArc(rect, 0, math.pi * 2, false, trackPaint);

    if (progress <= 0) return;

    final glowPaint = Paint()
      ..color = AppPalette.gold400.withValues(alpha: 0.22)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 9
      ..strokeCap = StrokeCap.round
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4);
    canvas.drawArc(
        rect, startAngle, math.pi * 2 * progress, false, glowPaint);

    final solidPaint = Paint()
      ..shader = const LinearGradient(
        colors: [Color(0xFFCFAA52), AppPalette.gold500],
      ).createShader(rect)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 5
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(
        rect, startAngle, math.pi * 2 * progress, false, solidPaint);
  }

  @override
  bool shouldRepaint(_DonutPainter old) => old.progress != progress;
}

// ── Shared ────────────────────────────────────────────────────────────────────

class _BackBtn extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.pop(),
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: Colors.white.withValues(alpha: 0.18),
          ),
        ),
        child: const Icon(
          Icons.arrow_back_ios_new_rounded,
          color: Colors.white,
          size: 15,
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
