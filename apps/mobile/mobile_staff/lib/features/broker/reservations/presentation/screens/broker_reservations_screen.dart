import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../../common/reservation_status_label.dart';
import '../../domain/entities/broker_reservation.dart';
import '../cubit/broker_reservations_cubit.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyMid = Color(0xFF14273F);
const _navyLight = Color(0xFF243F62);

// ─────────────────────────────────────────────────────────────────────────────
// Broker Reservations Screen
// ─────────────────────────────────────────────────────────────────────────────

Color _statusColor(String s, AppColorsExt colors) => switch (s) {
      'APPROVED' => colors.info,
      'CONVERTED' => colors.success,
      'REJECTED' => colors.error,
      'CANCELLED' => colors.error,
      'EXPIRED' => colors.inkMuted,
      _ => colors.warning, // PENDING
    };

List<BrokerReservation> _applySearch(
    List<BrokerReservation> items, String q) {
  if (q.isEmpty) return items;
  final lower = q.toLowerCase();
  return items.where((r) {
    return (r.clientName?.toLowerCase().contains(lower) ?? false) ||
        (r.reservationNumber?.toLowerCase().contains(lower) ?? false) ||
        (r.projectName?.toLowerCase().contains(lower) ?? false) ||
        (r.unitCode?.toLowerCase().contains(lower) ?? false);
  }).toList();
}

class BrokerReservationsScreen extends StatefulWidget {
  const BrokerReservationsScreen({super.key});

  @override
  State<BrokerReservationsScreen> createState() =>
      _BrokerReservationsScreenState();
}

class _BrokerReservationsScreenState extends State<BrokerReservationsScreen> {
  final _search = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    context.read<BrokerReservationsCubit>().load();
    _search.addListener(
        () => setState(() => _searchQuery = _search.text.trim()));
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    final created = await context.push<bool>('/broker/reservations/new');
    if (created == true && mounted) {
      context.read<BrokerReservationsCubit>().load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<BrokerReservationsCubit>();
    final bottomPad = MediaQuery.of(context).padding.bottom;
    final lang = Localizations.localeOf(context).languageCode;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: Column(
          children: [
            // ── Header with embedded search ───────────────────────────────
            BlocBuilder<BrokerReservationsCubit, BrokerReservationsListState>(
              buildWhen: (a, b) =>
                  a.status != b.status ||
                  a.reservations.length != b.reservations.length,
              builder: (context, state) => _ReservationsHeader(
                l10n: l10n,
                lang: lang,
                count: state.status == DataStatus.success
                    ? state.reservations.length
                    : null,
                onAdd: _create,
                searchController: _search,
                onClearSearch: () => setState(() {
                  _search.clear();
                  _searchQuery = '';
                }),
              ),
            ),

            // ── Filter chips ──────────────────────────────────────────────
            BlocBuilder<BrokerReservationsCubit, BrokerReservationsListState>(
              buildWhen: (a, b) =>
                  a.statusFilter != b.statusFilter ||
                  a.reservations != b.reservations,
              builder: (context, state) {
                final counts = <String, int>{};
                for (final r in state.reservations) {
                  counts[r.status] = (counts[r.status] ?? 0) + 1;
                }
                return _FilterRow(
                  l10n: l10n,
                  lang: lang,
                  selected: state.statusFilter,
                  total: state.reservations.length,
                  counts: counts,
                  onSelected: (s) => cubit
                      .setStatus(s == state.statusFilter ? null : s),
                );
              },
            ),

            // ── List ──────────────────────────────────────────────────────
            Expanded(
              child: BlocBuilder<BrokerReservationsCubit,
                  BrokerReservationsListState>(
                builder: (context, state) {
                  switch (state.status) {
                    case DataStatus.initial:
                    case DataStatus.loading:
                      return _ReservationsSkeleton(
                        bottomPad: bottomPad,
                        lang: lang,
                        l10n: l10n,
                      );
                    case DataStatus.failure:
                      return ErrorState(
                        failure: state.failure,
                        onRetry: cubit.load,
                      );
                    case DataStatus.empty:
                      return EmptyState(
                        icon: Icons.bookmark_border_rounded,
                        title: l10n.reservationsEmptyTitle,
                        message: l10n.reservationsEmptyMessage,
                      );
                    case DataStatus.success:
                      final visible =
                          _applySearch(state.reservations, _searchQuery);
                      if (visible.isEmpty) {
                        return EmptyState(
                          icon: Icons.filter_list_off_rounded,
                          title: lang == 'ar'
                              ? 'لا توجد نتائج'
                              : 'No results',
                          message: lang == 'ar'
                              ? 'جرّب بحثاً آخر'
                              : 'Try a different search',
                        );
                      }
                      return RefreshIndicator(
                        onRefresh: cubit.load,
                        child: CustomScrollView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          slivers: [
                            SliverToBoxAdapter(
                              child: _KpiBar(
                                reservations: state.reservations,
                                lang: lang,
                                l10n: l10n,
                              ),
                            ),
                            SliverPadding(
                              padding: EdgeInsets.fromLTRB(
                                AppSpacing.md,
                                AppSpacing.xs,
                                AppSpacing.md,
                                bottomPad + 100,
                              ),
                              sliver: SliverList(
                                delegate: SliverChildBuilderDelegate(
                                  (context, i) {
                                    if (i.isOdd) {
                                      return const SizedBox(
                                          height: AppSpacing.sm);
                                    }
                                    return _ReservationCard(
                                        reservation: visible[i ~/ 2]);
                                  },
                                  childCount: visible.length * 2 - 1,
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                  }
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Header with embedded search ───────────────────────────────────────────────

class _ReservationsHeader extends StatelessWidget {
  const _ReservationsHeader({
    required this.l10n,
    required this.lang,
    required this.onAdd,
    required this.searchController,
    required this.onClearSearch,
    this.count,
  });

  final AppLocalizations l10n;
  final String lang;
  final int? count;
  final VoidCallback onAdd;
  final TextEditingController searchController;
  final VoidCallback onClearSearch;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final topInset = MediaQuery.paddingOf(context).top;

    return Container(
      width: double.infinity,
      clipBehavior: Clip.antiAlias,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_navyLight, _navyMid, _navyDeep],
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
          // Dot texture
          const Positioned.fill(
            child: IgnorePointer(child: _DotTexture()),
          ),
          // Gold radial bloom
          PositionedDirectional(
            end: 0,
            top: 0,
            child: Container(
              width: 200,
              height: 200,
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment.topRight,
                  radius: 1.0,
                  colors: [
                    AppPalette.gold400.withValues(alpha: 0.12),
                    AppPalette.gold400.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
          // Gold hairline
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
          // Content
          Padding(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.lg,
              topInset + AppSpacing.md,
              AppSpacing.lg,
              AppSpacing.lg,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                // Title row
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            l10n.navReservations,
                            style: theme.textTheme.titleLarge?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w900,
                              height: 1.1,
                              letterSpacing: -0.3,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            lang == 'ar'
                                ? 'طلبات الحجز المقدمة'
                                : 'Your reservation requests',
                            style: const TextStyle(
                              color: AppPalette.gold300,
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                    // Count badge
                    if (count != null) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 5),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.12),
                          borderRadius: AppRadii.pillAll,
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.20),
                            width: 0.8,
                          ),
                        ),
                        child: Text(
                          '$count',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            fontSize: 14,
                          ),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                    ],
                    // Add button
                    GestureDetector(
                      onTap: onAdd,
                      child: Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [AppPalette.gold400, AppPalette.gold300],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(12),
                          boxShadow: [
                            BoxShadow(
                              color:
                                  AppPalette.gold400.withValues(alpha: 0.40),
                              blurRadius: 10,
                              offset: const Offset(0, 3),
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.add_rounded,
                          color: _navyDeep,
                          size: 22,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                // Search bar
                _SearchBar(
                  controller: searchController,
                  hint: lang == 'ar'
                      ? 'ابحث بالعميل أو رقم الحجز'
                      : 'Search by client or number',
                  onClear: onClearSearch,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Search bar ────────────────────────────────────────────────────────────────

class _SearchBar extends StatefulWidget {
  const _SearchBar({
    required this.controller,
    required this.hint,
    required this.onClear,
  });
  final TextEditingController controller;
  final String hint;
  final VoidCallback onClear;

  @override
  State<_SearchBar> createState() => _SearchBarState();
}

class _SearchBarState extends State<_SearchBar> {
  bool _hasText = false;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(
        () => setState(() => _hasText = widget.controller.text.isNotEmpty));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Container(
      height: 46,
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadii.pillAll,
        border: Border.all(color: colors.hairline),
        boxShadow: colors.shadowSoft,
      ),
      child: Row(
        children: [
          const SizedBox(width: AppSpacing.md),
          Icon(Icons.search_rounded, size: 20, color: colors.inkMuted),
          const SizedBox(width: AppSpacing.xs),
          Expanded(
            child: TextField(
              controller: widget.controller,
              textInputAction: TextInputAction.search,
              style: theme.textTheme.bodyMedium,
              decoration: InputDecoration(
                isDense: true,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                contentPadding: EdgeInsets.zero,
                hintText: widget.hint,
                hintStyle: theme.textTheme.bodyMedium
                    ?.copyWith(color: colors.inkMuted),
              ),
            ),
          ),
          if (_hasText)
            IconButton(
              visualDensity: VisualDensity.compact,
              icon:
                  Icon(Icons.close_rounded, size: 18, color: colors.inkMuted),
              onPressed: widget.onClear,
            ),
          const SizedBox(width: AppSpacing.xs),
        ],
      ),
    );
  }
}

// ── Filter chips row ──────────────────────────────────────────────────────────

class _FilterRow extends StatelessWidget {
  const _FilterRow({
    required this.l10n,
    required this.lang,
    required this.selected,
    required this.total,
    required this.counts,
    required this.onSelected,
  });

  final AppLocalizations l10n;
  final String lang;
  final String? selected;
  final int total;
  final Map<String, int> counts;
  final ValueChanged<String?> onSelected;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface,
        border:
            Border(bottom: BorderSide(color: colors.hairline, width: 0.5)),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg, vertical: 6),
        child: Row(
          children: [
            _FilterChip(
              label: lang == 'ar' ? 'الكل' : 'All',
              count: total,
              active: selected == null,
              onTap: () => onSelected(null),
            ),
            const SizedBox(width: AppSpacing.xs),
            for (final s in kReservationStatuses) ...[
              _FilterChip(
                label: reservationStatusLabel(l10n, s),
                count: counts[s] ?? 0,
                dotColor: _dotColor(s, colors),
                active: selected == s,
                onTap: () => onSelected(s),
              ),
              if (s != kReservationStatuses.last)
                const SizedBox(width: AppSpacing.xs),
            ],
          ],
        ),
      ),
    );
  }

  Color _dotColor(String s, AppColorsExt colors) => switch (s) {
        'APPROVED' => colors.info,
        'CONVERTED' => colors.success,
        'REJECTED' => colors.error,
        'CANCELLED' => colors.error,
        'EXPIRED' => colors.inkMuted,
        _ => colors.warning,
      };
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.count,
    required this.active,
    required this.onTap,
    this.dotColor,
  });
  final String label;
  final int count;
  final bool active;
  final VoidCallback onTap;
  final Color? dotColor;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.sm + 4, vertical: 11),
        decoration: BoxDecoration(
          color: active ? colors.brandNavy : colors.surface,
          borderRadius: AppRadii.pillAll,
          border: Border.all(
            color: active ? colors.brandNavy : colors.hairline,
            width: active ? 0 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.xs, vertical: 2),
              decoration: BoxDecoration(
                color: active
                    ? Colors.white.withValues(alpha: 0.18)
                    : colors.surfaceSoft,
                borderRadius: BorderRadius.circular(100),
              ),
              child: Text(
                '$count',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: active ? Colors.white : colors.inkStrong,
                  height: 1.2,
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.xs),
            if (!active && dotColor != null) ...[
              Container(
                width: 6,
                height: 6,
                decoration:
                    BoxDecoration(color: dotColor, shape: BoxShape.circle),
              ),
              const SizedBox(width: AppSpacing.xxs + 2),
            ],
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: active ? FontWeight.w700 : FontWeight.w600,
                color: active ? Colors.white : colors.inkStrong,
                height: 1.2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── KPI bar ───────────────────────────────────────────────────────────────────

class _KpiBar extends StatelessWidget {
  const _KpiBar(
      {required this.reservations, required this.lang, required this.l10n});
  final List<BrokerReservation> reservations;
  final String lang;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final total = reservations.length;
    final approved =
        reservations.where((r) => r.status == 'APPROVED').length;
    final converted =
        reservations.where((r) => r.status == 'CONVERTED').length;

    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.md, AppSpacing.sm, AppSpacing.md, AppSpacing.xs),
      child: Container(
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: AppRadii.card,
          border: Border.all(color: colors.hairline, width: 0.8),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: IntrinsicHeight(
          child: Row(
            children: [
              Expanded(
                child: _KpiStat(
                  value: '$total',
                  label: lang == 'ar' ? 'الإجمالي' : 'Total',
                  color: colors.brandNavy,
                ),
              ),
              VerticalDivider(
                  width: 1, thickness: 0.8, color: colors.hairline),
              Expanded(
                child: _KpiStat(
                  value: '$approved',
                  label: lang == 'ar' ? 'موافق عليه' : 'Approved',
                  color: colors.info,
                ),
              ),
              VerticalDivider(
                  width: 1, thickness: 0.8, color: colors.hairline),
              Expanded(
                child: _KpiStat(
                  value: '$converted',
                  label: lang == 'ar' ? 'محوّل' : 'Converted',
                  color: colors.success,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _KpiStat extends StatelessWidget {
  const _KpiStat(
      {required this.value, required this.label, required this.color});
  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: color,
              height: 1.1,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: colors.inkMuted,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Reservation card ──────────────────────────────────────────────────────────

class _ReservationCard extends StatefulWidget {
  const _ReservationCard({required this.reservation});
  final BrokerReservation reservation;

  @override
  State<_ReservationCard> createState() => _ReservationCardState();
}

class _ReservationCardState extends State<_ReservationCard> {
  bool _pressed = false;
  BrokerReservation get r => widget.reservation;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final isRtl = Directionality.of(context) == TextDirection.rtl;
    final statusColor = _statusColor(r.status, colors);

    final title = r.clientName ?? r.reservationNumber ?? l10n.navReservations;
    final subParts = [
      if (r.reservationNumber != null && r.clientName != null)
        r.reservationNumber!,
      if (r.unitCode != null) r.unitCode!,
      if (r.projectName != null) r.projectName!,
    ];

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: () => context.push(
        '/broker/reservations/${r.id}',
        extra: r,
      ),
      child: AnimatedScale(
        scale: _pressed ? 0.975 : 1.0,
        duration: const Duration(milliseconds: 110),
        curve: Curves.easeOutCubic,
        child: Container(
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: AppRadii.card,
            border: Border.all(
                color: statusColor.withValues(alpha: 0.14), width: 0.8),
            boxShadow: [
              BoxShadow(
                color: statusColor.withValues(alpha: 0.08),
                blurRadius: 18,
                offset: const Offset(0, 5),
              ),
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 6,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Top accent strip ──────────────────────────────────────
              Container(
                height: 3,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: isRtl
                        ? Alignment.centerRight
                        : Alignment.centerLeft,
                    end: isRtl
                        ? Alignment.centerLeft
                        : Alignment.centerRight,
                    colors: [
                      statusColor,
                      statusColor.withValues(alpha: 0.0)
                    ],
                  ),
                ),
              ),
              // ── Card body ─────────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.fromLTRB(
                    AppSpacing.md, AppSpacing.sm, AppSpacing.md, AppSpacing.sm),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ── Icon + title/subtitle + badge + chevron ───────────
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        // Bookmark icon in navy circle
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [_navyLight, _navyDeep],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: statusColor.withValues(alpha: 0.35),
                              width: 1.5,
                            ),
                          ),
                          child: const Icon(
                            Icons.bookmark_rounded,
                            color: AppPalette.gold300,
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        // Title + subtitle
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                  color: colors.inkStrong,
                                  height: 1.2,
                                ),
                              ),
                              if (subParts.isNotEmpty) ...[
                                const SizedBox(height: 2),
                                Text(
                                  subParts.join(' · '),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: colors.inkMuted,
                                    height: 1.3,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        StatusBadge(
                          label: reservationStatusLabel(l10n, r.status),
                          tone: reservationStatusTone(r.status),
                        ),
                        const SizedBox(width: AppSpacing.xxs),
                        Icon(Icons.chevron_right_rounded,
                            size: 20, color: colors.inkMuted),
                      ],
                    ),
                    // ── Divider ───────────────────────────────────────────
                    const SizedBox(height: 8),
                    Container(height: 0.5, color: colors.hairline),
                    const SizedBox(height: 8),
                    // ── Bottom row: status chip + date chips ──────────────
                    Row(
                      children: [
                        // Status chip
                        _InfoChip(
                          icon: Icons.radio_button_checked_rounded,
                          label: reservationStatusLabel(l10n, r.status),
                          color: statusColor,
                        ),
                        const Spacer(),
                        // Created date
                        if (r.createdAt != null) ...[
                          _InfoChip(
                            icon: Icons.calendar_today_outlined,
                            label: DateFormatter.shortDate(
                              r.createdAt!,
                              languageCode: lang,
                            ),
                            color: colors.inkMuted,
                          ),
                          const SizedBox(width: AppSpacing.xs),
                        ],
                        // Expires date (only for pending/approved)
                        if (r.expiresAt != null &&
                            (r.status == 'PENDING' ||
                                r.status == 'APPROVED')) ...[
                          _InfoChip(
                            icon: Icons.timer_outlined,
                            label: DateFormatter.shortDate(
                              r.expiresAt!,
                              languageCode: lang,
                            ),
                            color: colors.warning,
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Info chip ─────────────────────────────────────────────────────────────────

class _InfoChip extends StatelessWidget {
  const _InfoChip({
    required this.icon,
    required this.label,
    required this.color,
  });
  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        border: Border.all(color: color.withValues(alpha: 0.20)),
        borderRadius: AppRadii.pillAll,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: color.withValues(alpha: 0.80)),
          const SizedBox(width: 4),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: color,
                height: 1.2,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

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

// ── Reservations loading skeleton ─────────────────────────────────────────────

class _ReservationsSkeleton extends StatelessWidget {
  const _ReservationsSkeleton({
    required this.bottomPad,
    required this.lang,
    required this.l10n,
  });
  final double bottomPad;
  final String lang;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return AppSkeletonizer(
      enabled: true,
      child: CustomScrollView(
        physics: const NeverScrollableScrollPhysics(),
        slivers: [
          // ── Fake KPI bar ────────────────────────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                  AppSpacing.md, AppSpacing.sm, AppSpacing.md, AppSpacing.xs),
              child: Container(
                decoration: BoxDecoration(
                  color: colors.surface,
                  borderRadius: AppRadii.card,
                  border: Border.all(color: colors.hairline, width: 0.8),
                ),
                child: IntrinsicHeight(
                  child: Row(children: [
                    Expanded(child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        Text('٦', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: colors.brandNavy)),
                        const SizedBox(height: 3),
                        Text(lang == 'ar' ? 'الإجمالي' : 'Total', style: TextStyle(fontSize: 11, color: colors.inkMuted)),
                      ]),
                    )),
                    VerticalDivider(width: 1, thickness: 0.8, color: colors.hairline),
                    Expanded(child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        Text('٣', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: colors.info)),
                        const SizedBox(height: 3),
                        Text(lang == 'ar' ? 'موافق عليه' : 'Approved', style: TextStyle(fontSize: 11, color: colors.inkMuted)),
                      ]),
                    )),
                    VerticalDivider(width: 1, thickness: 0.8, color: colors.hairline),
                    Expanded(child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        Text('٢', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: colors.success)),
                        const SizedBox(height: 3),
                        Text(lang == 'ar' ? 'محوّل' : 'Converted', style: TextStyle(fontSize: 11, color: colors.inkMuted)),
                      ]),
                    )),
                  ]),
                ),
              ),
            ),
          ),
          // ── Fake reservation cards ───────────────────────────────────────
          SliverPadding(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.md, AppSpacing.sm, AppSpacing.md,
              AppSpacing.xl + bottomPad,
            ),
            sliver: SliverList.builder(
              itemCount: 6,
              itemBuilder: (context, index) => Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                child: Container(
                  decoration: BoxDecoration(
                    color: colors.surface,
                    borderRadius: AppRadii.card,
                    border: Border.all(color: colors.hairline.withValues(alpha: 0.4)),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    Container(height: 3, color: colors.warning.withValues(alpha: 0.5)),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(
                          AppSpacing.md, AppSpacing.sm, AppSpacing.md, AppSpacing.sm),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
                        Container(
                          width: 48, height: 48,
                          decoration: const BoxDecoration(color: _navyLight, shape: BoxShape.circle),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('محمد أحمد العمري', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                          const SizedBox(height: 4),
                          Text('RES-٢٠٢٦-٠٠١٢ · A-١٠٢', style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                        ])),
                        StatusBadge(label: 'قيد المراجعة', tone: BadgeTone.warning),
                        const SizedBox(width: AppSpacing.xs),
                        Icon(Icons.arrow_back_ios_new_rounded, size: 13, color: colors.inkMuted),
                      ]),
                    ),
                  ]),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
