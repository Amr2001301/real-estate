import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

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
typedef _CardTheme = ({Color accent, IconData icon});

_CardTheme _cardTheme(VisitRequest req, bool dark) {
  Color pick(Color light, Color darkC) => dark ? darkC : light;
  final green = pick(const Color(0xFF15803D), const Color(0xFF4ADE80));
  final gold = pick(const Color(0xFF9A6F1E), AppPalette.gold300);
  final amber = pick(const Color(0xFFB45309), const Color(0xFFFBD27A));
  final red = pick(const Color(0xFFB91C1C), const Color(0xFFF87171));
  final blue = pick(const Color(0xFF1D4ED8), const Color(0xFF93C5FD));
  final appt = req.latestAppointment;
  if (appt != null) {
    return switch (appt.status) {
      AppointmentStatus.confirmed || AppointmentStatus.completed => (
        accent: green,
        icon: Icons.check_circle_rounded,
      ),
      AppointmentStatus.scheduled => (accent: gold, icon: Icons.event_rounded),
      AppointmentStatus.pendingReschedule => (
        accent: amber,
        icon: Icons.update_rounded,
      ),
      AppointmentStatus.cancelled || AppointmentStatus.noShow => (
        accent: red,
        icon: Icons.cancel_rounded,
      ),
      _ => (accent: gold, icon: Icons.event_rounded),
    };
  }
  return switch (req.status) {
    VisitStatus.completed => (accent: green, icon: Icons.done_all_rounded),
    VisitStatus.approved || VisitStatus.scheduled => (
      accent: blue,
      icon: Icons.event_available_rounded,
    ),
    VisitStatus.cancelled => (accent: red, icon: Icons.cancel_rounded),
    _ => (accent: gold, icon: Icons.calendar_today_rounded),
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
      backgroundColor: context.appColors.canvas,
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
                      return EmptyState(
                        icon: Icons.filter_list_off_rounded,
                        title: context.l10n.noResults,
                        message: context.l10n.requestsFilterEmpty,
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
    return AppNavHeader(
      title: l10n.myRequestsTitle,
      subtitle: count != null ? '${l10n.visitRequestTitle} · $count' : l10n.visitRequestTitle,
      compact: true,
      leadingAction: const NavHeaderBack(),
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

  static String _label(AppLocalizations l10n, _FilterKey key) => switch (key) {
        _FilterKey.all => l10n.leadsFilterAll,
        _FilterKey.pending => l10n.requestsNew,
        _FilterKey.confirmed => l10n.requestsConfirmed,
        _FilterKey.completed => l10n.requestsCompleted,
        _FilterKey.cancelled => l10n.requestsCancelled,
      };

  static final _dots = {
    _FilterKey.all:       Colors.white,
    _FilterKey.pending:   AppPalette.gold300,
    _FilterKey.confirmed: Color(0xFF93C5FD),
    _FilterKey.completed: Color(0xFF4ADE80),
    _FilterKey.cancelled: Color(0xFFF87171),
  };

  @override
  Widget build(BuildContext context) {
    return Container(
      color: context.appColors.canvas,
      padding: const EdgeInsets.fromLTRB(16, 12, 0, 8),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.only(right: 16),
        child: Row(
          children: _FilterKey.values.map((key) {
            final isSelected = selected == key;
            final count      = counts[key] ?? 0;
            final dot        = _dots[key]!;
            final label      = _label(context.l10n, key);
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
    final colors = context.appColors;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final selFill = dark ? AppPalette.gold300.withValues(alpha: 0.18) : _navyCard;
    final selText = dark ? AppPalette.gold300 : Colors.white;
    final dotColor = dot == Colors.white ? colors.inkMuted : dot;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: selected ? selFill : colors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected
                ? (dark ? AppPalette.gold300.withValues(alpha: 0.5) : _navyCard)
                : colors.hairline,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 7,
              height: 7,
              decoration: BoxDecoration(
                color: selected ? (dot == Colors.white ? selText : dot) : dotColor.withValues(alpha: 0.6),
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 7),
            Text(
              label,
              style: TextStyle(
                color: selected ? selText : colors.inkMuted,
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
                      ? selText.withValues(alpha: 0.18)
                      : colors.inkMuted.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '$count',
                  style: TextStyle(
                    color: selected ? selText : colors.inkMuted,
                    fontSize: 12,
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
                      child: Icon(Icons.event_note_rounded,
                          color: AppPalette.gold300, size: 17),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      context.l10n.supervisorSummaryTotalLabel,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.75),
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      '$total',
                      style: TextStyle(
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
                      label: context.l10n.requestsNew,
                      count: pending,
                      color: AppPalette.gold300,
                    ),
                    _SummaryDivider(),
                    _SummaryCell(
                      label: context.l10n.requestsConfirmed,
                      count: confirmed,
                      color: const Color(0xFF93C5FD),
                    ),
                    _SummaryDivider(),
                    _SummaryCell(
                      label: context.l10n.requestsCompleted,
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
    final appt = request.latestAppointment;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    final ct = _cardTheme(request, dark);

    final statusLabel = appt != null
        ? appt.status.customerLabel(l10n)
        : request.status.label(l10n);

    final projectTitle = request.projectName?.resolve(lang) ??
        l10n.visitRequestTitle;
    final hasNotes = request.notes?.isNotEmpty == true;

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
                  color: ct.accent.withValues(alpha: 0.13),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(ct.icon, color: ct.accent, size: 24),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      projectTitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: colors.inkStrong,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      l10n.visitRequestTitle,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: colors.inkMuted,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: ct.accent.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  statusLabel,
                  style: TextStyle(
                    color: ct.accent,
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Divider(height: 1, color: colors.hairline),
          const SizedBox(height: AppSpacing.md),
          if (request.preferredDate != null)
            _InfoCell(
              icon: AppIcons.calendar,
              label: context.l10n.preferredDateLabel,
              value: DateFormatter.mediumDate(
                request.preferredDate!,
                languageCode: lang,
              ),
              accent: ct.accent,
            ),
          if (request.preferredTime?.isNotEmpty == true)
            _InfoCell(
              icon: Icons.schedule_rounded,
              label: l10n.preferredTimeLabel,
              value: request.preferredTime!,
              accent: ct.accent,
            ),
          if (appt?.scheduledAt != null)
            _InfoCell(
              icon: Icons.event_available_rounded,
              label: l10n.appointmentProposedDateLabel,
              value: DateFormatter.mediumDate(
                appt!.scheduledAt!,
                languageCode: lang,
              ),
              accent: ct.accent,
              highlight: true,
            ),
          if (request.assignedSalesName?.isNotEmpty == true)
            _InfoCell(
              icon: Icons.person_rounded,
              label: context.l10n.salesRepLabel,
              value: request.assignedSalesName!,
              accent: ct.accent,
            ),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: colors.inkMuted.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(
                      Icons.chat_bubble_outline_rounded,
                      size: 14,
                      color: colors.inkMuted,
                    ),
                    const SizedBox(width: 5),
                    Text(
                      l10n.customerMessageLabel,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: colors.inkMuted,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  hasNotes ? request.notes! : context.l10n.noMessage,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: hasNotes ? colors.ink : colors.inkMuted,
                    height: 1.5,
                    fontStyle: hasNotes ? FontStyle.normal : FontStyle.italic,
                  ),
                ),
              ],
            ),
          ),
          if (appt?.status == AppointmentStatus.pendingReschedule &&
              appt?.customerFeedback?.isNotEmpty == true) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: ct.accent.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${l10n.customerRescheduleReasonLabel}:',
                    style: TextStyle(
                      fontSize: 12,
                      color: ct.accent,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    appt!.customerFeedback!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: colors.ink,
                    ),
                  ),
                ],
              ),
            ),
          ],
          if (appt != null && appt.awaitsCustomer) ...[
            const SizedBox(height: 12),
            _AppointmentActions(appointment: appt, busy: busy),
          ],
          if (request.createdAt != null) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Icon(Icons.access_time_rounded, size: 13, color: colors.inkMuted),
                const SizedBox(width: 4),
                Text(
                  context.l10n.requestDateValue(
                    DateFormatter.mediumDate(request.createdAt!, languageCode: lang),
                  ),
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: colors.inkMuted,
                  ),
                ),
              ],
            ),
          ],
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
                  style: TextStyle(
                    fontSize: 12,
                    color: context.appColors.inkMuted,
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
                        : context.appColors.inkStrong,
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

  Future<String?> _askReason(BuildContext context) {
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _RescheduleReasonSheet(),
    );
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

// ─── Reschedule reason sheet ──────────────────────────────────────────────────
class _RescheduleReasonSheet extends StatefulWidget {
  const _RescheduleReasonSheet();

  @override
  State<_RescheduleReasonSheet> createState() => _RescheduleReasonSheetState();
}

class _RescheduleReasonSheetState extends State<_RescheduleReasonSheet> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final inset = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: inset),
      child: Container(
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        ),
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg,
          AppSpacing.sm,
          AppSpacing.lg,
          AppSpacing.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: colors.hairline,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              l10n.appointmentRescheduleReasonLabel,
              style: theme.textTheme.titleMedium?.copyWith(
                color: colors.inkStrong,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: _controller,
              autofocus: true,
              maxLines: 3,
              maxLength: 500,
              decoration: InputDecoration(
                hintText: l10n.appointmentRescheduleReasonHint,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Expanded(
                  child: AppButton(
                    label: l10n.appointmentSendReschedule,
                    variant: AppButtonVariant.gold,
                    size: AppButtonSize.medium,
                    onPressed: () =>
                        Navigator.pop(context, _controller.text),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: AppButton(
                    label: l10n.actionCancel,
                    variant: AppButtonVariant.outline,
                    size: AppButtonSize.medium,
                    onPressed: () => Navigator.pop(context),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Shared chrome ────────────────────────────────────────────────────────────
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
