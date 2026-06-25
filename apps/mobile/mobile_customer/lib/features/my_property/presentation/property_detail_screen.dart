import 'dart:math' as math;

import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../installments/domain/entities/installment.dart';
import '../../installments/presentation/cubit/installments_cubit.dart';
import '../domain/entities/property.dart';

const _navy      = Color(0xFF0B1726);
const _navyCard  = Color(0xFF152236);
const _navyAccent= Color(0xFF1E3451);

enum _Filter { all, paid, pending, overdue }

// ── helpers ───────────────────────────────────────────────────────────────────

Installment? _nextInstallment(List<Installment> all) {
  final unpaid = all
      .where((i) => i.status != InstallmentStatus.paid)
      .toList()
    ..sort((a, b) => a.dueDate.compareTo(b.dueDate));
  return unpaid.isEmpty ? null : unpaid.first;
}

(Color, String) _statusStyle(InstallmentStatus s, AppLocalizations l10n) =>
    switch (s) {
      InstallmentStatus.paid => (const Color(0xFF34C77B), l10n.installmentStatusPaid),
      InstallmentStatus.overdue => (const Color(0xFFEF4444), l10n.installmentStatusOverdue),
      _ => (const Color(0xFFF59E0B), l10n.installmentStatusPending),
    };

String _paymentMethodLabel(PaymentMethod? method) => switch (method) {
      PaymentMethod.cash         => 'نقدًا',
      PaymentMethod.bankTransfer => 'تحويل بنكي',
      PaymentMethod.cheque       => 'شيك',
      PaymentMethod.other        => 'أخرى',
      _                          => '—',
    };

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
    final lang     = Localizations.localeOf(context).languageCode;
    final l10n     = context.l10n;
    final property = widget.property;
    final colors   = context.appColors;

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

            final paidCount    = all.where((i) => i.status == InstallmentStatus.paid).length;
            final overdueCount = all.where((i) => i.status == InstallmentStatus.overdue).length;
            final pendingCount = all.length - paidCount - overdueCount;
            final nextInst     = _nextInstallment(all);

            final displayed = switch (_filter) {
              _Filter.paid    => all.where((i) => i.status == InstallmentStatus.paid).toList(),
              _Filter.pending => all.where((i) => i.status == InstallmentStatus.pending).toList(),
              _Filter.overdue => all.where((i) => i.status == InstallmentStatus.overdue).toList(),
              _Filter.all     => all,
            };

            return Column(
              children: [
                _UnitHeader(
                  property:    property,
                  lang:        lang,
                  l10n:        l10n,
                  total:       all.length,
                  paid:        paidCount,
                  nextInst:    nextInst,
                ),
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
                Expanded(
                  child: TabBarView(
                    controller: _tabs,
                    children: [
                      // Tab 0: الأقساط
                      _InstallmentsTab(
                        state:            state,
                        displayed:        displayed,
                        all:              all,
                        filter:           _filter,
                        onFilterChanged:  (f) => setState(() => _filter = f),
                        paidCount:        paidCount,
                        pendingCount:     pendingCount,
                        overdueCount:     overdueCount,
                        lang:             lang,
                        l10n:             l10n,
                      ),
                      // Tab 1: الملخص
                      _SummaryTab(
                        property:     property,
                        lang:         lang,
                        l10n:         l10n,
                        total:        all.length,
                        paid:         paidCount,
                        pending:      pendingCount,
                        overdue:      overdueCount,
                        nextInst:     nextInst,
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

// ── Unit header ───────────────────────────────────────────────────────────────

class _UnitHeader extends StatelessWidget {
  const _UnitHeader({
    required this.property,
    required this.lang,
    required this.l10n,
    required this.total,
    required this.paid,
    required this.nextInst,
  });

  final Property      property;
  final String        lang;
  final AppLocalizations l10n;
  final int           total;
  final int           paid;
  final Installment?  nextInst;

  @override
  Widget build(BuildContext context) {
    final theme     = Theme.of(context);
    final topInset  = MediaQuery.paddingOf(context).top;
    final owned     = property.status == PropertyStatus.owned;
    final progress  = total > 0 ? paid / total : 0.0;

    final nextIsOverdue = nextInst?.status == InstallmentStatus.overdue;
    final nextColor     = nextIsOverdue
        ? const Color(0xFFEF4444)
        : AppPalette.gold300;

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
          const Positioned.fill(child: IgnorePointer(child: _DotTexture())),
          PositionedDirectional(
            end: 0,
            top: 0,
            child: Container(
              width: 220,
              height: 200,
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
                _BackBtn(),
                const SizedBox(height: AppSpacing.md),
                Row(
                  children: [
                    // Icon
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
                                color: AppPalette.gold400.withValues(alpha: 0.28),
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
                          Wrap(
                            spacing: 6,
                            children: [
                              _SmallChip(
                                label: owned
                                    ? l10n.myPropertyStatusOwned
                                    : l10n.myPropertyStatusReserved,
                                color: owned ? Colors.greenAccent : Colors.amber,
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
                    if (total > 0) ...[
                      const SizedBox(width: AppSpacing.md),
                      SizedBox(
                        width: 52,
                        height: 52,
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            CustomPaint(
                              painter: _DonutPainter(
                                  progress: progress),
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
                                    color: Colors.white.withValues(alpha: 0.45),
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

                // ── Next installment banner ───────────────────────────────
                if (nextInst != null) ...[
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 9),
                    decoration: BoxDecoration(
                      color: nextColor.withValues(alpha: 0.10),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: nextColor.withValues(alpha: 0.30)),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          nextIsOverdue
                              ? Icons.warning_amber_rounded
                              : Icons.pending_actions_rounded,
                          size: 15,
                          color: nextColor,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          nextIsOverdue
                              ? 'قسط متأخر: '
                              : 'القسط القادم: ',
                          style: TextStyle(
                            color: nextColor.withValues(alpha: 0.80),
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          PriceFormatter.formatString(
                            nextInst!.amount,
                            languageCode: lang,
                          ),
                          style: TextStyle(
                            color: nextColor,
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          width: 3,
                          height: 3,
                          decoration: BoxDecoration(
                            color: nextColor.withValues(alpha: 0.5),
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          DateFormatter.mediumDate(
                            nextInst!.dueDate,
                            languageCode: lang,
                          ),
                          style: TextStyle(
                            color: nextColor.withValues(alpha: 0.85),
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
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
              decoration:
                  BoxDecoration(color: color, shape: BoxShape.circle),
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
  final TabController  controller;
  final AppColorsExt   colors;

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
        labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
        unselectedLabelStyle:
            const TextStyle(fontWeight: FontWeight.w500, fontSize: 13.5),
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

  final InstallmentsState      state;
  final List<Installment>      displayed;
  final List<Installment>      all;
  final _Filter                filter;
  final ValueChanged<_Filter>  onFilterChanged;
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
        96 + MediaQuery.of(context).padding.bottom,
      ),
      children: [
        if (all.isNotEmpty) ...[
          _FilterBar(
            filter:          filter,
            onChanged:       onFilterChanged,
            paid:            paidCount,
            pending:         pendingCount,
            overdue:         overdueCount,
            total:           all.length,
            l10n:            l10n,
          ),
          const SizedBox(height: AppSpacing.md),
        ],
        if (state.status == DataStatus.initial ||
            state.status == DataStatus.loading)
          const _Skeleton()
        else if (displayed.isEmpty)
          _EmptyState(l10n: l10n)
        else
          _InstallmentCards(
            installments: displayed,
            lang:         lang,
            l10n:         l10n,
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
    required this.total,
    required this.l10n,
  });

  final _Filter            filter;
  final ValueChanged<_Filter> onChanged;
  final int paid;
  final int pending;
  final int overdue;
  final int total;
  final AppLocalizations l10n;

  static const _dotColors = {
    _Filter.all:     Colors.white,
    _Filter.overdue: Color(0xFFEF4444),
    _Filter.pending: Color(0xFFF59E0B),
    _Filter.paid:    Color(0xFF34C77B),
  };

  @override
  Widget build(BuildContext context) {
    final items = <({String label, _Filter value, int count})>[
      (label: 'الكل', value: _Filter.all, count: total),
      (label: l10n.installmentStatusOverdue, value: _Filter.overdue, count: overdue),
      (label: l10n.installmentStatusPending, value: _Filter.pending, count: pending),
      (label: l10n.installmentStatusPaid,    value: _Filter.paid,    count: paid),
    ];

    return SizedBox(
      height: 38,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: items.map((item) {
          final selected = filter == item.value;
          final dot      = _dotColors[item.value]!;
          return Padding(
            padding: const EdgeInsetsDirectional.only(end: 8),
            child: GestureDetector(
              onTap: () => onChanged(item.value),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: selected ? _navyCard : Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: selected ? _navyCard : const Color(0xFFE5E7EB),
                  ),
                  boxShadow: selected
                      ? [
                          BoxShadow(
                            color: _navyCard.withValues(alpha: 0.18),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          )
                        ]
                      : null,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 7,
                      height: 7,
                      decoration: BoxDecoration(
                        color: selected
                            ? dot
                            : dot.withValues(alpha: 0.45),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 7),
                    Text(
                      item.label,
                      style: TextStyle(
                        color: selected
                            ? Colors.white
                            : const Color(0xFF6B7280),
                        fontSize: 13,
                        fontWeight: selected
                            ? FontWeight.w700
                            : FontWeight.w500,
                      ),
                    ),
                    if (item.count > 0) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: selected
                              ? dot.withValues(alpha: 0.22)
                              : const Color(0xFFF3F4F6),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          '${item.count}',
                          style: TextStyle(
                            color: selected
                                ? dot
                                : const Color(0xFF9CA3AF),
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
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

// ── Installment cards ─────────────────────────────────────────────────────────

class _InstallmentCards extends StatelessWidget {
  const _InstallmentCards({
    required this.installments,
    required this.lang,
    required this.l10n,
  });

  final List<Installment>  installments;
  final String             lang;
  final AppLocalizations   l10n;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: installments.asMap().entries.map((e) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: _InstallmentCard(
            installment: e.value,
            rowIndex:    e.key,
            lang:        lang,
            l10n:        l10n,
          ),
        );
      }).toList(),
    );
  }
}

class _InstallmentCard extends StatelessWidget {
  const _InstallmentCard({
    required this.installment,
    required this.rowIndex,
    required this.lang,
    required this.l10n,
  });

  final Installment      installment;
  final int              rowIndex;
  final String           lang;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final inst = installment;
    final (statusColor, statusLabel) =
        _statusStyle(inst.status, l10n);

    final typeLabel = switch (inst.type) {
      InstallmentPaymentType.downPayment  => 'دفعة مقدمة',
      InstallmentPaymentType.finalPayment => 'دفعة أخيرة',
      _                                   => null,
    };
    final rowNum = (rowIndex + 1).toString().padLeft(2, '0');

    final proof         = inst.latestProof;
    final proofPending  = proof?.reviewStatus == PaymentProofStatus.pendingReview;
    final proofRejected = proof?.reviewStatus == PaymentProofStatus.rejected;

    return InkWell(
      onTap: inst.canSubmitProof
          ? () => context.push(
                '/account/installments/${inst.id}/submit-proof',
                extra: inst,
              )
          : null,
      borderRadius: BorderRadius.circular(16),
      splashColor: AppPalette.gold400.withValues(alpha: 0.05),
      highlightColor: AppPalette.gold400.withValues(alpha: 0.03),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 16,
              offset: const Offset(0, 4),
            ),
          ],
          border: Border(
            right: BorderSide(
              color: statusColor.withValues(alpha: 0.6),
              width: 3.5,
            ),
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Top row: number + type badge + status badge ──────────
              Row(
                children: [
                  Text(
                    '#$rowNum',
                    style: TextStyle(
                      color: const Color(0xFF9CA3AF),
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.5,
                    ),
                  ),
                  if (typeLabel != null) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppPalette.gold400.withValues(alpha: 0.10),
                        borderRadius: BorderRadius.circular(6),
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
                        ),
                      ),
                    ),
                  ],
                  const Spacer(),
                  // Status badge
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 9, vertical: 4),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.10),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: statusColor.withValues(alpha: 0.28),
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
                ],
              ),

              const SizedBox(height: 12),

              // ── Amount + due date row ────────────────────────────────
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'المبلغ',
                          style: TextStyle(
                            color: const Color(0xFF9CA3AF),
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          PriceFormatter.formatString(
                            inst.amount,
                            languageCode: lang,
                          ),
                          style: const TextStyle(
                            color: Color(0xFF1A1A2E),
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.5,
                            height: 1.1,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        'تاريخ الاستحقاق',
                        style: TextStyle(
                          color: const Color(0xFF9CA3AF),
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Icon(
                            Icons.event_rounded,
                            size: 13,
                            color: const Color(0xFF9CA3AF),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            DateFormatter.mediumDate(
                              inst.dueDate,
                              languageCode: lang,
                            ),
                            style: const TextStyle(
                              color: Color(0xFF374151),
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),

              // ── Proof / action area ──────────────────────────────────
              if (inst.status == InstallmentStatus.paid && inst.paidAt != null) ...[
                const SizedBox(height: 10),
                Container(
                  height: 0.5,
                  color: const Color(0xFFE5E7EB),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Container(
                      width: 26,
                      height: 26,
                      decoration: BoxDecoration(
                        color: const Color(0xFF34C77B).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(
                        Icons.check_circle_rounded,
                        size: 15,
                        color: Color(0xFF34C77B),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'تم الدفع بتاريخ ${DateFormatter.mediumDate(inst.paidAt!, languageCode: lang)}',
                      style: const TextStyle(
                        color: Color(0xFF34C77B),
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (proof?.paymentMethod != null &&
                        proof!.paymentMethod != PaymentMethod.unknown) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFF34C77B).withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          _paymentMethodLabel(proof.paymentMethod),
                          style: TextStyle(
                            color: const Color(0xFF34C77B).withValues(alpha: 0.80),
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ] else if (proofPending) ...[
                const SizedBox(height: 10),
                Container(
                  height: 0.5,
                  color: const Color(0xFFE5E7EB),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Container(
                      width: 26,
                      height: 26,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF59E0B).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(
                        Icons.hourglass_top_rounded,
                        size: 14,
                        color: Color(0xFFF59E0B),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'الإيصال قيد المراجعة',
                          style: TextStyle(
                            color: Color(0xFFF59E0B),
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        if (proof?.submittedAt != null)
                          Text(
                            'تم الإرسال ${DateFormatter.mediumDate(proof!.submittedAt!, languageCode: lang)}',
                            style: TextStyle(
                              color: const Color(0xFF9CA3AF),
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ] else if (proofRejected) ...[
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEF4444).withValues(alpha: 0.06),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: const Color(0xFFEF4444).withValues(alpha: 0.20),
                    ),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.error_outline_rounded,
                        size: 15,
                        color: Color(0xFFEF4444),
                      ),
                      const SizedBox(width: 7),
                      Expanded(
                        child: Text(
                          proof?.rejectionReason?.isNotEmpty == true
                              ? proof!.rejectionReason!
                              : 'تم رفض الإيصال · يرجى إعادة الإرسال',
                          style: const TextStyle(
                            color: Color(0xFFEF4444),
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                _SubmitButton(
                  label: 'إعادة إرسال الإيصال',
                  isResubmit: true,
                ),
              ] else if (inst.canSubmitProof) ...[
                const SizedBox(height: 10),
                _SubmitButton(
                  label: 'إرسال إيصال الدفع',
                  isResubmit: false,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _SubmitButton extends StatelessWidget {
  const _SubmitButton({required this.label, required this.isResubmit});
  final String label;
  final bool   isResubmit;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 11),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: isResubmit
              ? [const Color(0xFFD97706), const Color(0xFFB45309)]
              : [const Color(0xFFD4A843), AppPalette.gold500],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(11),
        boxShadow: [
          BoxShadow(
            color: AppPalette.gold400.withValues(alpha: 0.25),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            isResubmit ? Icons.refresh_rounded : Icons.upload_rounded,
            size: 16,
            color: _navy,
          ),
          const SizedBox(width: 7),
          Text(
            label,
            style: const TextStyle(
              color: _navy,
              fontSize: 13,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
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
    required this.nextInst,
  });

  final Property      property;
  final String        lang;
  final AppLocalizations l10n;
  final int           total;
  final int           paid;
  final int           pending;
  final int           overdue;
  final Installment?  nextInst;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.xs,
        AppSpacing.lg,
        96 + MediaQuery.of(context).padding.bottom,
      ),
      children: [
        if (property.hasInstallmentPlan) ...[
          _FinancialCard(
            property: property,
            lang:     lang,
            total:    total,
            paid:     paid,
            pending:  pending,
            overdue:  overdue,
            nextInst: nextInst,
          ),
          const SizedBox(height: AppSpacing.lg),
        ],
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
    required this.nextInst,
  });

  final Property     property;
  final String       lang;
  final int          total;
  final int          paid;
  final int          pending;
  final int          overdue;
  final Installment? nextInst;

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
              child: IgnorePointer(child: _DotTexture())),
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
                          horizontal: 9, vertical: 3),
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

              // Main row: donut + amount + stats
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
                            fontSize: 22,
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
                              color: const Color(0xFF4ADE80),
                            ),
                            const SizedBox(width: 6),
                            _MiniStat(
                              label: 'معلقة',
                              value: '$pending',
                              color: const Color(0xFFF59E0B),
                            ),
                            const SizedBox(width: 6),
                            _MiniStat(
                              label: 'متأخرة',
                              value: '$overdue',
                              color: const Color(0xFFEF4444),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),

              // Progress bar
              if (total > 0) ...[
                const SizedBox(height: AppSpacing.lg),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'نسبة السداد',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.45),
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    Text(
                      '${(progress * 100).round()}%',
                      style: const TextStyle(
                        color: AppPalette.gold300,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: Container(
                    height: 6,
                    color: Colors.white.withValues(alpha: 0.10),
                    child: FractionallySizedBox(
                      widthFactor: 1,
                      child: LayoutBuilder(
                        builder: (_, constraints) => Stack(
                          children: [
                            Positioned.fill(
                              child: Container(
                                color: Colors.white
                                    .withValues(alpha: 0.10),
                              ),
                            ),
                            Positioned(
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: constraints.maxWidth * progress,
                              child: Container(
                                decoration: const BoxDecoration(
                                  gradient: LinearGradient(
                                    colors: [
                                      Color(0xFFCFAA52),
                                      AppPalette.gold400,
                                    ],
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color:
                                          Color(0x44D4A843),
                                      blurRadius: 4,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],

              // ── Next installment highlight ─────────────────────────────
              if (nextInst != null) ...[
                const SizedBox(height: 14),
                Container(
                  height: 0.5,
                  color: Colors.white.withValues(alpha: 0.12),
                ),
                const SizedBox(height: 14),
                _NextInstallmentRow(
                  installment: nextInst!,
                  lang: lang,
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _NextInstallmentRow extends StatelessWidget {
  const _NextInstallmentRow({
    required this.installment,
    required this.lang,
  });

  final Installment installment;
  final String      lang;

  @override
  Widget build(BuildContext context) {
    final isOverdue = installment.status == InstallmentStatus.overdue;
    final color     = isOverdue
        ? const Color(0xFFEF4444)
        : AppPalette.gold300;

    return Row(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.14),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: color.withValues(alpha: 0.30)),
          ),
          child: Icon(
            isOverdue
                ? Icons.warning_amber_rounded
                : Icons.event_rounded,
            color: color,
            size: 18,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                isOverdue ? 'قسط متأخر' : 'القسط القادم',
                style: TextStyle(
                  color: color.withValues(alpha: 0.75),
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                DateFormatter.mediumDate(
                  installment.dueDate,
                  languageCode: lang,
                ),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
        Text(
          PriceFormatter.formatString(
            installment.amount,
            languageCode: lang,
          ),
          style: TextStyle(
            color: color,
            fontSize: 16,
            fontWeight: FontWeight.w900,
            letterSpacing: -0.3,
          ),
        ),
      ],
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
  final Color  color;

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

// ── Contract card ─────────────────────────────────────────────────────────────

class _ContractCard extends StatelessWidget {
  const _ContractCard({
    required this.property,
    required this.lang,
    required this.l10n,
  });
  final Property      property;
  final String        lang;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    final rows = <({IconData icon, String label, String value})>[
      if (property.contractNumber != null)
        (
          icon: AppIcons.contract,
          label: l10n.myPropertyContractNumber,
          value: property.contractNumber!,
        ),
      if (property.signedAt != null)
        (
          icon: AppIcons.calendar,
          label: l10n.myPropertySignedDate,
          value: DateFormatter.mediumDate(
            property.signedAt!,
            languageCode: lang,
          ),
        ),
      if (property.reservationNumber != null)
        (
          icon: Icons.confirmation_number_rounded,
          label: l10n.myPropertyReservationNumber,
          value: property.reservationNumber!,
        ),
      if (property.totalMonths != null)
        (
          icon: Icons.calendar_month_rounded,
          label: 'مدة التقسيط',
          value: '${property.totalMonths} شهرًا',
        ),
    ];

    if (rows.isEmpty) return const SizedBox.shrink();

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
          // Header strip
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
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
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
          // Info rows
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              children: rows.asMap().entries.map((e) {
                final item = e.value;
                final isLast = e.key == rows.length - 1;
                return Column(
                  children: [
                    _ContractInfoRow(
                      icon:   item.icon,
                      label:  item.label,
                      value:  item.value,
                      colors: colors,
                    ),
                    if (!isLast) ...[
                      const SizedBox(height: 4),
                      Container(
                        height: 0.5,
                        color: colors.hairline.withValues(alpha: 0.6),
                        margin: const EdgeInsets.only(right: 44),
                      ),
                      const SizedBox(height: 4),
                    ],
                  ],
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }
}

class _ContractInfoRow extends StatelessWidget {
  const _ContractInfoRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.colors,
  });

  final IconData     icon;
  final String       label;
  final String       value;
  final AppColorsExt colors;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: _navyCard.withValues(alpha: 0.07),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: _navyCard.withValues(alpha: 0.12),
              ),
            ),
            child: Icon(icon, size: 16, color: _navyCard),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    color: colors.inkMuted,
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: TextStyle(
                    color: colors.inkStrong,
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
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
          Icon(Icons.calendar_today_outlined, size: 36, color: colors.inkMuted),
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
    final center    = Offset(size.width / 2, size.height / 2);
    final radius    = math.min(size.width, size.height) / 2 - 5;
    final rect      = Rect.fromCircle(center: center, radius: radius);
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
    canvas.drawArc(rect, startAngle, math.pi * 2 * progress, false, glowPaint);

    final solidPaint = Paint()
      ..shader = const LinearGradient(
        colors: [Color(0xFFCFAA52), AppPalette.gold500],
      ).createShader(rect)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 5
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(rect, startAngle, math.pi * 2 * progress, false, solidPaint);
  }

  @override
  bool shouldRepaint(_DonutPainter old) => old.progress != progress;
}

// ── Shared chrome ─────────────────────────────────────────────────────────────

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
          border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
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
