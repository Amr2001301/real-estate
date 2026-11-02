import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../common/reservation_status_label.dart';
import '../../../common/staff_list_skeleton.dart';
import '../../../common/visit_status_label.dart';
import '../../leads/presentation/follow_up_labels.dart';
import '../domain/calendar_event.dart';
import 'calendar_cubit.dart';

const _kDaysAr = ['إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت', 'أحد'];
const _kDaysEn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const _kMonthsAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const _kMonthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

String _dayName(DateTime d, String lang) => (lang == 'ar' ? _kDaysAr : _kDaysEn)[d.weekday - 1];
String _month(DateTime d, String lang) => '${(lang == 'ar' ? _kMonthsAr : _kMonthsEn)[d.month - 1]} ${d.year}';

/// CAL1 — «التقويم»: the week's visits, follow-ups, reservations running
/// out, contracts signed and activities logged, a day at a time. A rep sees
/// their own; a manager their team's. Laid out like the other staff lists.
class CalendarScreen extends StatefulWidget {
  const CalendarScreen({super.key});

  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {
  @override
  void initState() {
    super.initState();
    context.read<CalendarCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<CalendarCubit>();
    final bottomPad = MediaQuery.paddingOf(context).bottom;

    return Scaffold(
      body: Column(
        children: [
          AppNavHeader(
            title: l10n.calendarTitle,
            compact: true,
            leadingAction: NavHeaderAction(
              icon: Icons.arrow_back_ios_new_rounded,
              onTap: () => context.canPop() ? context.pop() : context.go('/home'),
            ),
            actions: [
              NavHeaderAction(icon: Icons.today_rounded, tooltip: l10n.followUpsToday, onTap: cubit.goToday),
            ],
          ),
          const _WeekStrip(),
          Expanded(
            child: BlocBuilder<CalendarCubit, CalendarState>(
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const StaffListSkeleton(rows: 4);
                  case DataStatus.failure:
                    return ErrorState(failure: state.failure, onRetry: cubit.load);
                  case DataStatus.empty:
                  case DataStatus.success:
                    final events = state.on(state.selected);
                    if (events.isEmpty) {
                      return RefreshIndicator(
                        onRefresh: cubit.load,
                        child: ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: [
                            const SizedBox(height: AppSpacing.xl),
                            EmptyState(
                              icon: Icons.event_available_rounded,
                              title: l10n.calendarEmptyDay,
                              message: l10n.calendarEmptyHint,
                            ),
                          ],
                        ),
                      );
                    }
                    return RefreshIndicator(
                      onRefresh: cubit.load,
                      child: ListView.separated(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.sm, AppSpacing.md, bottomPad + 100),
                        itemCount: events.length,
                        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
                        itemBuilder: (context, i) => _EventTile(
                          event: events[i],
                          onTap: () async {
                            final route = events[i].route;
                            if (route == null) return;
                            await context.push(route);
                            if (context.mounted) await cubit.load();
                          },
                        ),
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

// ── Week strip ────────────────────────────────────────────────────────────────

class _WeekStrip extends StatelessWidget {
  const _WeekStrip();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final cubit = context.read<CalendarCubit>();
    final today = DateUtils.dateOnly(DateTime.now());

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(bottom: BorderSide(color: colors.hairline, width: 0.5)),
      ),
      child: BlocBuilder<CalendarCubit, CalendarState>(
        buildWhen: (a, b) => a.weekStart != b.weekStart || a.selected != b.selected || a.events != b.events,
        builder: (context, state) => Padding(
          padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.xs, AppSpacing.md, AppSpacing.sm),
          child: Column(
            children: [
              Row(
                children: [
                  IconButton(
                    key: const Key('calendar-prev'),
                    tooltip: l10n.calendarPrevWeek,
                    onPressed: () => cubit.shiftWeek(-1),
                    icon: const Icon(Icons.chevron_left_rounded),
                    color: colors.inkMuted,
                  ),
                  Expanded(
                    child: Text(
                      _month(state.selected, lang),
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: colors.inkStrong),
                    ),
                  ),
                  IconButton(
                    key: const Key('calendar-next'),
                    tooltip: l10n.calendarNextWeek,
                    onPressed: () => cubit.shiftWeek(1),
                    icon: const Icon(Icons.chevron_right_rounded),
                    color: colors.inkMuted,
                  ),
                ],
              ),
              Row(
                children: [
                  for (final day in state.days) ...[
                    if (day != state.days.first) const SizedBox(width: 4),
                    Expanded(
                      child: _DayCell(
                        key: ValueKey('day-${calendarDay(day)}'),
                        name: _dayName(day, lang),
                        day: day.day,
                        count: state.on(day).length,
                        selected: DateUtils.isSameDay(day, state.selected),
                        today: DateUtils.isSameDay(day, today),
                        onTap: () => cubit.select(day),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DayCell extends StatelessWidget {
  const _DayCell({
    super.key,
    required this.name,
    required this.day,
    required this.count,
    required this.selected,
    required this.today,
    required this.onTap,
  });
  final String name;
  final int day;
  final int count;
  final bool selected;
  final bool today;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final ink = selected ? Colors.white : colors.inkStrong;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: selected ? colors.brandNavy : colors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? colors.brandNavy : (today ? AppPalette.gold400 : colors.hairline),
            width: today && !selected ? 1.4 : 1,
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(name, maxLines: 1, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: selected ? Colors.white70 : colors.inkMuted)),
            const SizedBox(height: 2),
            Text('$day', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: ink, height: 1.2)),
            const SizedBox(height: 4),
            // How busy the day is: a dot per entry, up to three.
            SizedBox(
              height: 6,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var i = 0; i < count.clamp(0, 3); i++) ...[
                    if (i > 0) const SizedBox(width: 2),
                    Container(
                      width: 5,
                      height: 5,
                      decoration: BoxDecoration(
                        color: selected ? AppPalette.gold300 : AppPalette.gold400,
                        shape: BoxShape.circle,
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

// ── Event tile ────────────────────────────────────────────────────────────────

class _EventTile extends StatefulWidget {
  const _EventTile({required this.event, required this.onTap});
  final CalendarEvent event;
  final VoidCallback onTap;

  @override
  State<_EventTile> createState() => _EventTileState();
}

class _EventTileState extends State<_EventTile> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final isRtl = Directionality.of(context) == TextDirection.rtl;
    final e = widget.event;

    final (Color accent, IconData icon, String title) = switch (e.type) {
      'visit' => (const Color(0xFF6A1B9A), Icons.event_rounded, l10n.calendarTypeVisit),
      'follow_up' => (colors.brandGold, noteKindIcon(e.kind ?? 'FOLLOW_UP'), '${l10n.calendarTypeFollowUp} · ${noteKindLabel(l10n, e.kind ?? 'FOLLOW_UP')}'),
      'reservation_expiry' => (colors.warning, Icons.timer_outlined, l10n.calendarTypeReservationExpiry),
      'contract_signed' => (colors.success, Icons.draw_rounded, l10n.calendarTypeContract),
      _ => (noteKindColor(e.kind ?? 'NOTE'), noteKindIcon(e.kind ?? 'NOTE'), '${noteKindLabel(l10n, e.kind ?? 'NOTE')} · ${l10n.calendarDone}'),
    };
    final (String? badge, BadgeTone tone) = switch (e.type) {
      'visit' when e.status != null => (visitStatusLabel(l10n, e.status!), visitStatusTone(e.status!)),
      'reservation_expiry' when e.status != null => (reservationStatusLabel(l10n, e.status!), reservationStatusTone(e.status!)),
      'done' when e.callResult != null => (callResultLabel(l10n, e.callResult!), callResultTone(e.callResult!)),
      _ => (null, BadgeTone.neutral),
    };
    final details = [
      if (e.project != null) e.project!.resolve(lang),
      if (e.unit != null) e.unit!,
      if (e.ref != null) e.ref!,
    ].join(' · ');
    final note = e.note?.trim();

    return GestureDetector(
      key: ValueKey('event-${e.type}-${e.id}'),
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: e.route == null ? null : widget.onTap,
      child: AnimatedScale(
        scale: _pressed ? 0.975 : 1.0,
        duration: const Duration(milliseconds: 110),
        curve: Curves.easeOutCubic,
        child: Container(
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: AppRadii.card,
            border: Border.all(color: accent.withValues(alpha: 0.16), width: 0.9),
            boxShadow: [
              BoxShadow(color: accent.withValues(alpha: 0.10), blurRadius: 20, offset: const Offset(0, 6)),
              BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 6, offset: const Offset(0, 2)),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                height: 3,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: isRtl ? Alignment.centerRight : Alignment.centerLeft,
                    end: isRtl ? Alignment.centerLeft : Alignment.centerRight,
                    colors: [accent, accent.withValues(alpha: 0.0)],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(AppSpacing.md, 13, AppSpacing.md, 13),
                child: Row(
                  children: [
                    // Time, then the kind's icon
                    SizedBox(
                      width: 64,
                      child: Text(
                        clockTime(e.at, lang),
                        maxLines: 1,
                        softWrap: false,
                        overflow: TextOverflow.visible,
                        style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: colors.inkStrong),
                      ),
                    ),
                    Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        color: accent.withValues(alpha: 0.10),
                        shape: BoxShape.circle,
                        border: Border.all(color: accent.withValues(alpha: 0.28), width: 1.2),
                      ),
                      child: Icon(icon, color: accent, size: 20),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(title, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: accent)),
                          const SizedBox(height: 2),
                          Text(
                            e.customer ?? '—',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: colors.inkStrong, height: 1.2),
                          ),
                          if (details.isNotEmpty || (note != null && note.isNotEmpty)) ...[
                            const SizedBox(height: 3),
                            Text(
                              note != null && note.isNotEmpty ? note : details,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 12, color: colors.inkMuted, height: 1.3),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        if (badge != null) StatusBadge(label: badge, tone: tone),
                        if (e.route != null) ...[
                          const SizedBox(height: 4),
                          Icon(Icons.chevron_right_rounded, size: 16, color: colors.inkMuted.withValues(alpha: 0.5)),
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
