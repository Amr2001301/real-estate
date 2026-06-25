import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../domain/entities/visit_request.dart';
import 'my_visits_cubit.dart';

// ─── palette ──────────────────────────────────────────────────────────────────
const _navyDeep  = Color(0xFF0B1726);
const _navyCard  = Color(0xFF1A3352);
const _navyLight = Color(0xFF243F62);

// ─── local filter ─────────────────────────────────────────────────────────────
enum _FilterKey { all, pending, confirmed, completed, cancelled }

// ─── status helpers ───────────────────────────────────────────────────────────
extension on VisitStatus {
  String label(AppLocalizations l) => switch (this) {
        VisitStatus.pending   => l.visitStatusPending,
        VisitStatus.approved  => l.visitStatusApproved,
        VisitStatus.scheduled => l.visitStatusScheduled,
        VisitStatus.completed => l.visitStatusCompleted,
        VisitStatus.cancelled => l.visitStatusCancelled,
        VisitStatus.unknown   => '',
      };
}

extension on AppointmentStatus {
  String customerLabel(AppLocalizations l) => switch (this) {
        AppointmentStatus.scheduled        => l.appointmentStatusAwaitingCustomer,
        AppointmentStatus.confirmed        => l.appointmentStatusConfirmedByCustomer,
        AppointmentStatus.pendingReschedule =>
          l.appointmentStatusPendingRescheduleCustomer,
        AppointmentStatus.completed  => l.visitStatusCompleted,
        AppointmentStatus.cancelled  => l.visitStatusCancelled,
        AppointmentStatus.noShow     => l.visitStatusNoShow,
        AppointmentStatus.rescheduled => l.visitStatusRescheduled,
        AppointmentStatus.unknown    => '',
      };
}

// ─── card theme ───────────────────────────────────────────────────────────────
typedef _CardTheme = ({List<Color> gradient, Color accent, IconData icon});

_CardTheme _cardTheme(VisitRequest req) {
  final appt = req.latestAppointment;
  if (appt != null) {
    return switch (appt.status) {
      AppointmentStatus.confirmed || AppointmentStatus.completed => (
        gradient: const [Color(0xFF1B5E3F), Color(0xFF0D3826)],
        accent: const Color(0xFF4ADE80),
        icon: Icons.check_circle_rounded,
      ),
      AppointmentStatus.scheduled => (
        gradient: const [_navyLight, _navyDeep],
        accent: AppPalette.gold300,
        icon: Icons.event_rounded,
      ),
      AppointmentStatus.pendingReschedule => (
        gradient: const [Color(0xFF7A5C1E), Color(0xFF4A3610)],
        accent: const Color(0xFFFBD27A),
        icon: Icons.update_rounded,
      ),
      AppointmentStatus.cancelled || AppointmentStatus.noShow => (
        gradient: const [Color(0xFF9B2020), Color(0xFF620D0D)],
        accent: const Color(0xFFF87171),
        icon: Icons.cancel_rounded,
      ),
      _ => (
        gradient: const [_navyLight, _navyDeep],
        accent: AppPalette.gold300,
        icon: Icons.event_rounded,
      ),
    };
  }
  return switch (req.status) {
    VisitStatus.completed => (
      gradient: const [Color(0xFF1B5E3F), Color(0xFF0D3826)],
      accent: const Color(0xFF4ADE80),
      icon: Icons.done_all_rounded,
    ),
    VisitStatus.approved || VisitStatus.scheduled => (
      gradient: const [Color(0xFF1E3A6E), Color(0xFF0B1F42)],
      accent: const Color(0xFF93C5FD),
      icon: Icons.event_available_rounded,
    ),
    VisitStatus.cancelled => (
      gradient: const [Color(0xFF9B2020), Color(0xFF620D0D)],
      accent: const Color(0xFFF87171),
      icon: Icons.cancel_rounded,
    ),
    _ => (
      gradient: const [_navyLight, _navyDeep],
      accent: AppPalette.gold300,
      icon: Icons.calendar_today_rounded,
    ),
  };
}

// ─── filter predicate ─────────────────────────────────────────────────────────
bool _matches(_FilterKey key, VisitRequest req) {
  final appt = req.latestAppointment;
  return switch (key) {
    _FilterKey.all       => true,
    _FilterKey.pending   => req.status == VisitStatus.pending,
    _FilterKey.confirmed =>
      req.status == VisitStatus.approved ||
      req.status == VisitStatus.scheduled ||
      appt?.status == AppointmentStatus.confirmed ||
      appt?.status == AppointmentStatus.scheduled,
    _FilterKey.completed =>
      req.status == VisitStatus.completed ||
      appt?.status == AppointmentStatus.completed,
    _FilterKey.cancelled =>
      req.status == VisitStatus.cancelled ||
      appt?.status == AppointmentStatus.cancelled ||
      appt?.status == AppointmentStatus.noShow,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// My Requests Screen
// ─────────────────────────────────────────────────────────────────────────────
class MyRequestsScreen extends StatefulWidget {
  const MyRequestsScreen({super.key});

  @override
  State<MyRequestsScreen> createState() => _MyRequestsScreenState();
}

class _MyRequestsScreenState extends State<MyRequestsScreen> {
  _FilterKey _filter = _FilterKey.all;

  List<VisitRequest> _apply(List<VisitRequest> all) =>
      _filter == _FilterKey.all
          ? all
          : all.where((r) => _matches(_filter, r)).toList();

  int _count(List<VisitRequest> all, _FilterKey key) =>
      all.where((r) => _matches(key, r)).length;

  @override
  void initState() {
    super.initState();
    context.read<MyVisitsCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final bottom = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      body: Column(
        children: [
          // ── Header
          BlocBuilder<MyVisitsCubit, MyVisitsState>(
            buildWhen: (a, b) =>
                a.status != b.status || a.data?.length != b.data?.length,
            builder: (context, state) => _Header(
              l10n: l10n,
              count: state.status == DataStatus.success
                  ? state.data!.length
                  : null,
            ),
          ),

          // ── Filter row — only when list is loaded
          BlocBuilder<MyVisitsCubit, MyVisitsState>(
            buildWhen: (a, b) => a.status != b.status || a.data != b.data,
            builder: (context, state) {
              if (state.status != DataStatus.success) {
                return const SizedBox.shrink();
              }
              final all = state.data!;
              return _FilterRow(
                counts: {
                  _FilterKey.all:       all.length,
                  _FilterKey.pending:   _count(all, _FilterKey.pending),
                  _FilterKey.confirmed: _count(all, _FilterKey.confirmed),
                  _FilterKey.completed: _count(all, _FilterKey.completed),
                  _FilterKey.cancelled: _count(all, _FilterKey.cancelled),
                },
                selected: _filter,
                onSelect: (k) => setState(() => _filter = k),
              );
            },
          ),

          // ── Body
          Expanded(
            child: BlocConsumer<MyVisitsCubit, MyVisitsState>(
              listenWhen: (a, b) =>
                  !identical(a.lastOutcome, b.lastOutcome) &&
                  b.lastOutcome != null,
              listener: (context, state) {
                final outcome = state.lastOutcome!;
                if (outcome.isSuccess) {
                  final msg = switch (outcome.kind) {
                    VisitActionKind.confirm =>
                      l10n.appointmentConfirmSuccess,
                    VisitActionKind.requestReschedule =>
                      l10n.appointmentRescheduleSuccess,
                  };
                  ScaffoldMessenger.of(context)
                      .showSnackBar(SnackBar(content: Text(msg)));
                } else {
                  showFailureSnackBar(context, outcome.failure!);
                }
              },
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const Center(child: CircularProgressIndicator());

                  case DataStatus.failure:
                    return ErrorState(
                      failure: state.failure,
                      onRetry: () => context.read<MyVisitsCubit>().load(),
                    );

                  case DataStatus.empty:
                    return EmptyState(
                      icon: Icons.event_note_outlined,
                      title: l10n.myRequestsEmptyTitle,
                      message: l10n.myRequestsEmptyMessage,
                    );

                  case DataStatus.success:
                    final lang    = Localizations.localeOf(context).languageCode;
                    final all     = state.data!;
                    final visible = _apply(all);

                    if (visible.isEmpty) {
                      return const EmptyState(
                        icon: Icons.filter_list_off_rounded,
                        title: 'لا توجد نتائج',
                        message: 'لا توجد طلبات في هذا التصنيف',
                      );
                    }

                    return RefreshIndicator(
                      onRefresh: () => context.read<MyVisitsCubit>().load(),
                      child: ListView.separated(
                        padding: EdgeInsets.fromLTRB(
                            16, 12, 16, 96 + bottom),
                        itemCount: visible.length + 1,
                        separatorBuilder: (_, _) =>
                            const SizedBox(height: 14),
                        itemBuilder: (_, i) {
                          if (i == 0) {
                            return _VisitSummary(
                              total: all.length,
                              pending:
                                  _count(all, _FilterKey.pending),
                              confirmed:
                                  _count(all, _FilterKey.confirmed),
                              completed:
                                  _count(all, _FilterKey.completed),
                            );
                          }
                          final req = visible[i - 1];
                          return _VisitCard(
                            request: req,
                            lang: lang,
                            l10n: l10n,
                            busy: state.inFlightAppointmentId != null &&
                                req.latestAppointment?.id ==
                                    state.inFlightAppointmentId,
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

// ─── Header ───────────────────────────────────────────────────────────────────
class _Header extends StatelessWidget {
  const _Header({required this.l10n, this.count});
  final AppLocalizations l10n;
  final int? count;

  @override
  Widget build(BuildContext context) {
    final theme    = Theme.of(context);
    final topInset = MediaQuery.paddingOf(context).top;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light
          .copyWith(statusBarColor: Colors.transparent),
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
            const Positioned.fill(
                child: IgnorePointer(child: _DotTexture())),
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
                  _BackBtn(),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          l10n.myRequestsTitle,
                          style: theme.textTheme.titleLarge?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            height: 1.1,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          l10n.visitRequestTitle,
                          style: const TextStyle(
                            color: AppPalette.gold300,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (count != null) ...[
                    const SizedBox(width: AppSpacing.sm),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                            color: Colors.white.withValues(alpha: 0.2)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.event_note_rounded,
                              color: AppPalette.gold300, size: 13),
                          const SizedBox(width: 5),
                          Text(
                            '$count',
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              fontSize: 14,
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

// ─── Filter row ───────────────────────────────────────────────────────────────
class _FilterRow extends StatelessWidget {
  const _FilterRow({
    required this.counts,
    required this.selected,
    required this.onSelect,
  });

  final Map<_FilterKey, int> counts;
  final _FilterKey            selected;
  final ValueChanged<_FilterKey> onSelect;

  static const _labels = {
    _FilterKey.all:       'الكل',
    _FilterKey.pending:   'جديدة',
    _FilterKey.confirmed: 'مؤكدة',
    _FilterKey.completed: 'مكتملة',
    _FilterKey.cancelled: 'ملغية',
  };

  static const _dots = {
    _FilterKey.all:       Colors.white,
    _FilterKey.pending:   AppPalette.gold300,
    _FilterKey.confirmed: Color(0xFF93C5FD),
    _FilterKey.completed: Color(0xFF4ADE80),
    _FilterKey.cancelled: Color(0xFFF87171),
  };

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFF5F7FA),
      padding: const EdgeInsets.fromLTRB(16, 12, 0, 8),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.only(right: 16),
        child: Row(
          children: _FilterKey.values.map((key) {
            final isSelected = selected == key;
            final count      = counts[key] ?? 0;
            final dot        = _dots[key]!;
            final label      = _labels[key]!;
            return Padding(
              padding: const EdgeInsets.only(left: 8),
              child: _FilterItem(
                label: label,
                dot: dot,
                count: count,
                selected: isSelected,
                onTap: () => onSelect(key),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
}

class _FilterItem extends StatelessWidget {
  const _FilterItem({
    required this.label,
    required this.dot,
    required this.count,
    required this.selected,
    required this.onTap,
  });

  final String       label;
  final Color        dot;
  final int          count;
  final bool         selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
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
                color: selected ? dot : dot.withValues(alpha: 0.45),
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 7),
            Text(
              label,
              style: TextStyle(
                color: selected ? Colors.white : const Color(0xFF6B7280),
                fontSize: 13,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
            if (count > 0) ...[
              const SizedBox(width: 6),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: selected
                      ? dot.withValues(alpha: 0.22)
                      : const Color(0xFFF3F4F6),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '$count',
                  style: TextStyle(
                    color: selected ? dot : const Color(0xFF9CA3AF),
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ─── Summary card ─────────────────────────────────────────────────────────────
class _VisitSummary extends StatelessWidget {
  const _VisitSummary({
    required this.total,
    required this.pending,
    required this.confirmed,
    required this.completed,
  });

  final int total;
  final int pending;
  final int confirmed;
  final int completed;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 2),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_navyLight, _navyDeep],
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: _navyDeep.withValues(alpha: 0.35),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          const Positioned.fill(child: IgnorePointer(child: _DotTexture())),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: AppPalette.gold300.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(9),
                        border: Border.all(
                          color: AppPalette.gold300.withValues(alpha: 0.35),
                        ),
                      ),
                      child: const Icon(Icons.event_note_rounded,
                          color: AppPalette.gold300, size: 17),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      'إجمالي الطلبات',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.75),
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      '$total',
                      style: const TextStyle(
                        color: AppPalette.gold300,
                        fontSize: 28,
                        fontWeight: FontWeight.w900,
                        height: 1,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Container(
                  height: 0.5,
                  color: Colors.white.withValues(alpha: 0.12),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    _SummaryCell(
                      label: 'جديدة',
                      count: pending,
                      color: AppPalette.gold300,
                    ),
                    _SummaryDivider(),
                    _SummaryCell(
                      label: 'مؤكدة',
                      count: confirmed,
                      color: const Color(0xFF93C5FD),
                    ),
                    _SummaryDivider(),
                    _SummaryCell(
                      label: 'مكتملة',
                      count: completed,
                      color: const Color(0xFF4ADE80),
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
    required this.label,
    required this.count,
    required this.color,
  });

  final String label;
  final int    count;
  final Color  color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(
            '$count',
            style: TextStyle(
              color: color,
              fontSize: 22,
              fontWeight: FontWeight.w900,
              height: 1,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.65),
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 0.5,
      height: 36,
      color: Colors.white.withValues(alpha: 0.15),
      margin: const EdgeInsets.symmetric(horizontal: 4),
    );
  }
}

// ─── Visit request card ───────────────────────────────────────────────────────
class _VisitCard extends StatelessWidget {
  const _VisitCard({
    required this.request,
    required this.lang,
    required this.l10n,
    required this.busy,
  });

  final VisitRequest    request;
  final String          lang;
  final AppLocalizations l10n;
  final bool            busy;

  @override
  Widget build(BuildContext context) {
    final appt  = request.latestAppointment;
    final theme = _cardTheme(request);

    final statusLabel = appt != null
        ? appt.status.customerLabel(l10n)
        : request.status.label(l10n);

    final projectTitle = request.projectName?.resolve(lang) ??
        l10n.visitRequestTitle;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
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
          // ── Gradient strip ───────────────────────────────────────────────
          Container(
            height: 100,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: theme.gradient,
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
                    color: theme.accent.withValues(alpha: 0.3),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 14),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // Icon box
                      Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          color: theme.accent.withValues(alpha: 0.18),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                              color: theme.accent.withValues(alpha: 0.35)),
                        ),
                        child: Icon(theme.icon,
                            color: theme.accent, size: 26),
                      ),
                      const SizedBox(width: 14),
                      // Title + type label
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              projectTitle,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 20,
                                fontWeight: FontWeight.w900,
                                height: 1.2,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 3),
                            Row(
                              children: [
                                Icon(
                                  Icons.calendar_month_rounded,
                                  size: 12,
                                  color: theme.accent.withValues(alpha: 0.8),
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  l10n.visitRequestTitle,
                                  style: TextStyle(
                                    color: theme.accent.withValues(alpha: 0.85),
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      // Status badge
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: theme.accent.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                              color: theme.accent.withValues(alpha: 0.4)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 6,
                              height: 6,
                              decoration: BoxDecoration(
                                color: theme.accent,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 5),
                            Text(
                              statusLabel,
                              style: TextStyle(
                                color: theme.accent,
                                fontSize: 12,
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

          // ── White body ───────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Info rows
                if (request.preferredDate != null)
                  _InfoCell(
                    icon: AppIcons.calendar,
                    label: 'التاريخ المفضّل',
                    value: DateFormatter.mediumDate(
                      request.preferredDate!,
                      languageCode: lang,
                    ),
                    accent: theme.accent,
                  ),
                if (request.preferredTime?.isNotEmpty == true)
                  _InfoCell(
                    icon: Icons.schedule_rounded,
                    label: l10n.preferredTimeLabel,
                    value: request.preferredTime!,
                    accent: theme.accent,
                  ),
                if (appt?.scheduledAt != null)
                  _InfoCell(
                    icon: Icons.event_available_rounded,
                    label: l10n.appointmentProposedDateLabel,
                    value: DateFormatter.mediumDate(
                      appt!.scheduledAt!,
                      languageCode: lang,
                    ),
                    accent: theme.accent,
                    highlight: true,
                  ),
                if (request.assignedSalesName?.isNotEmpty == true)
                  _InfoCell(
                    icon: Icons.person_rounded,
                    label: 'المبيعات',
                    value: request.assignedSalesName!,
                    accent: theme.accent,
                  ),

                // Customer message
                const SizedBox(height: 10),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8F9FA),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.chat_bubble_outline_rounded,
                              size: 13,
                              color: const Color(0xFF9CA3AF)),
                          const SizedBox(width: 5),
                          Text(
                            l10n.customerMessageLabel,
                            style: const TextStyle(
                              fontSize: 11,
                              color: Color(0xFF9CA3AF),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        request.notes?.isNotEmpty == true
                            ? request.notes!
                            : 'لا توجد رسالة',
                        style: TextStyle(
                          fontSize: 15,
                          color: request.notes?.isNotEmpty == true
                              ? const Color(0xFF1A1A2E)
                              : const Color(0xFFB0B7C3),
                          fontWeight: FontWeight.w500,
                          height: 1.5,
                          fontStyle: request.notes?.isNotEmpty == true
                              ? FontStyle.normal
                              : FontStyle.italic,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),

                // Reschedule reason (when pendingReschedule)
                if (appt?.status == AppointmentStatus.pendingReschedule &&
                    appt?.customerFeedback?.isNotEmpty == true) ...[
                  const SizedBox(height: 10),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color:
                          const Color(0xFFFBD27A).withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: const Color(0xFFFBD27A)
                              .withValues(alpha: 0.3)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${l10n.customerRescheduleReasonLabel}:',
                          style: const TextStyle(
                            fontSize: 11,
                            color: Color(0xFFFBD27A),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          appt!.customerFeedback!,
                          style: const TextStyle(
                            fontSize: 14,
                            color: Color(0xFF1A1A2E),
                            fontWeight: FontWeight.w500,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                ],

                // Appointment actions (awaits customer confirmation)
                if (appt != null && appt.awaitsCustomer) ...[
                  const SizedBox(height: 12),
                  _AppointmentActions(
                    appointment: appt,
                    busy: busy,
                  ),
                ],

                // Creation date footer
                if (request.createdAt != null) ...[
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Icon(
                        Icons.access_time_rounded,
                        size: 12,
                        color: const Color(0xFFB0B7C3),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        'تاريخ الطلب: ${DateFormatter.mediumDate(request.createdAt!, languageCode: lang)}',
                        style: const TextStyle(
                          fontSize: 11,
                          color: Color(0xFFB0B7C3),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
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

// ─── Info cell ────────────────────────────────────────────────────────────────
class _InfoCell extends StatelessWidget {
  const _InfoCell({
    required this.icon,
    required this.label,
    required this.value,
    required this.accent,
    this.highlight = false,
  });

  final IconData icon;
  final String   label;
  final String   value;
  final Color    accent;
  final bool     highlight;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(9),
              border: Border.all(color: accent.withValues(alpha: 0.25)),
            ),
            child: Icon(icon, size: 15, color: accent),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 11,
                    color: Color(0xFF9CA3AF),
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 1),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight:
                        highlight ? FontWeight.w800 : FontWeight.w600,
                    color: highlight
                        ? accent
                        : const Color(0xFF1A1A2E),
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

// ─── Appointment actions ──────────────────────────────────────────────────────
class _AppointmentActions extends StatelessWidget {
  const _AppointmentActions({
    required this.appointment,
    required this.busy,
  });

  final AppointmentSummary appointment;
  final bool               busy;

  Future<void> _onRequestReschedule(BuildContext context) async {
    final cubit  = context.read<MyVisitsCubit>();
    final reason = await _askReason(context);
    if (reason == null) return;
    await cubit.requestReschedule(
      appointment.id,
      reason: reason.isEmpty ? null : reason,
    );
  }

  Future<String?> _askReason(BuildContext context) async {
    final l10n       = context.l10n;
    final controller = TextEditingController();
    final result     = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.appointmentRescheduleReasonLabel),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLines: 3,
          maxLength: 500,
          decoration: InputDecoration(
            hintText: l10n.appointmentRescheduleReasonHint,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(l10n.actionCancel),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, controller.text),
            child: Text(l10n.appointmentSendReschedule),
          ),
        ],
      ),
    );
    controller.dispose();
    return result;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Row(
      children: [
        Expanded(
          child: AppButton(
            label: l10n.appointmentActionConfirm,
            variant: AppButtonVariant.gold,
            size: AppButtonSize.medium,
            isLoading: busy,
            onPressed: busy
                ? null
                : () => context
                    .read<MyVisitsCubit>()
                    .confirmAppointment(appointment.id),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: AppButton(
            label: l10n.appointmentActionRequestReschedule,
            variant: AppButtonVariant.outline,
            size: AppButtonSize.medium,
            onPressed: busy ? null : () => _onRequestReschedule(context),
          ),
        ),
      ],
    );
  }
}

// ─── Shared chrome ────────────────────────────────────────────────────────────
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
