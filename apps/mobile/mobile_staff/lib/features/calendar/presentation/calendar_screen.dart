import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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

/// «التقويم» (design x2, owner-approved 2026-11-05): the week's visits,
/// follow-ups, reservations running out, contracts signed and activities
/// logged, a day at a time, on a timeline. A rep sees their own; a manager
/// their team's.
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
    final lang = Localizations.localeOf(context).languageCode;
    final cubit = context.read<CalendarCubit>();
    final colors = context.appColors;
    final today = DateUtils.dateOnly(DateTime.now());
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BlocBuilder<CalendarCubit, CalendarState>(
          builder: (context, state) {
            final events = state.on(state.selected);
            final ready = state.status == DataStatus.success || state.status == DataStatus.empty;
            int n(String t) => events.where((e) => e.type == t).length;
            return RefreshIndicator(
              onRefresh: cubit.load,
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverToBoxAdapter(
                    child: HomeListHero(
                      title: l10n.calendarTitle,
                      subtitle: DateFormatter.mediumDate(state.selected, languageCode: lang),
                      back: true,
                      actions: [HomeHeroButton(key: const Key('calendar-today'), icon: Icons.today_rounded, tooltip: l10n.followUpsToday, onTap: cubit.goToday)],
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(AppSpacing.md, 10, AppSpacing.md, 0),
                      child: Column(children: [
                        Row(children: [
                          IconButton(key: const Key('calendar-prev'), tooltip: l10n.calendarPrevWeek, onPressed: () => cubit.shiftWeek(-1), icon: const Icon(Icons.chevron_left_rounded), color: colors.inkMuted),
                          Expanded(child: Text(_month(state.selected, lang), textAlign: TextAlign.center, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: colors.inkStrong))),
                          IconButton(key: const Key('calendar-next'), tooltip: l10n.calendarNextWeek, onPressed: () => cubit.shiftWeek(1), icon: const Icon(Icons.chevron_right_rounded), color: colors.inkMuted),
                        ]),
                        Row(children: [
                          for (final day in state.days) ...[
                            if (day != state.days.first) const SizedBox(width: 5),
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
                        ]),
                      ]),
                    ),
                  ),
                  if (ready)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(AppSpacing.md, 12, AppSpacing.md, 0),
                        child: HomeBand(figures: [
                          HomeFigure(id: 'visits', value: '${n('visit')}', label: l10n.calBandVisits, hint: l10n.calBandDay),
                          HomeFigure(id: 'follow', value: '${n('follow_up')}', label: l10n.calBandFollowUps, hint: l10n.calBandDay, warn: n('follow_up') > 0),
                          HomeFigure(id: 'contracts', value: '${n('contract_signed')}', label: l10n.calBandContracts, hint: l10n.calBandDay),
                        ]),
                      ),
                    ),
                  ...switch (state.status) {
                    DataStatus.initial || DataStatus.loading => [const SliverToBoxAdapter(child: SizedBox(height: 420, child: StaffListSkeleton(rows: 4)))],
                    DataStatus.failure => [SliverToBoxAdapter(child: ErrorState(failure: state.failure, onRetry: cubit.load))],
                    _ when events.isEmpty => [SliverToBoxAdapter(child: Padding(padding: const EdgeInsets.only(top: 16), child: EmptyState(icon: Icons.event_available_rounded, title: l10n.calendarEmptyDay, message: l10n.calendarEmptyHint)))],
                    _ => [
                        SliverPadding(
                          padding: const EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 0),
                          sliver: SliverList.separated(
                            itemCount: events.length,
                            separatorBuilder: (_, _) => const SizedBox(height: 9),
                            itemBuilder: (context, i) => _EventRow(
                              event: events[i],
                              onTap: () async {
                                final route = events[i].route;
                                if (route == null) return;
                                await context.push(route);
                                if (context.mounted) await cubit.load();
                              },
                            ),
                          ),
                        ),
                      ],
                  },
                  SliverPadding(padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 100)),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _DayCell extends StatelessWidget {
  const _DayCell({super.key, required this.name, required this.day, required this.count, required this.selected, required this.today, required this.onTap});
  final String name;
  final int day;
  final int count;
  final bool selected;
  final bool today;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: selected ? AppPalette.navy : colors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: selected ? AppPalette.navy : (today ? AppPalette.gold400 : colors.hairline), width: today && !selected ? 1.4 : 1),
        ),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(name, maxLines: 1, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: selected ? Colors.white70 : colors.inkMuted)),
          const SizedBox(height: 2),
          Text('$day', style: homeDisplay(17, selected ? Colors.white : colors.inkStrong)),
          const SizedBox(height: 4),
          SizedBox(
            height: 6,
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              for (var i = 0; i < count.clamp(0, 3); i++) ...[
                if (i > 0) const SizedBox(width: 2),
                Container(width: 5, height: 5, decoration: BoxDecoration(color: selected ? AppPalette.gold300 : AppPalette.gold400, shape: BoxShape.circle)),
              ],
            ]),
          ),
        ]),
      ),
    );
  }
}

/// One entry on the day's timeline: its time, then a card with the kind, the
/// client, the project/unit/number and its status.
class _EventRow extends StatelessWidget {
  const _EventRow({required this.event, required this.onTap});
  final CalendarEvent event;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final e = event;
    final (Color accent, IconData icon, String title) = switch (e.type) {
      'visit' => (const Color(0xFF26405F), Icons.event_rounded, l10n.calendarTypeVisit),
      'follow_up' => (const Color(0xFFB3261E), noteKindIcon(e.kind ?? 'FOLLOW_UP'), '${l10n.calendarTypeFollowUp} · ${noteKindLabel(l10n, e.kind ?? 'FOLLOW_UP')}'),
      'reservation_expiry' => (const Color(0xFF8A5A12), Icons.timer_outlined, l10n.calendarTypeReservationExpiry),
      'contract_signed' => (const Color(0xFF2F6B4A), Icons.description_rounded, l10n.calendarTypeContract),
      _ => (noteKindColor(e.kind ?? 'NOTE'), noteKindIcon(e.kind ?? 'NOTE'), '${noteKindLabel(l10n, e.kind ?? 'NOTE')} · ${l10n.calendarDone}'),
    };
    final (String? badge, BadgeTone tone) = switch (e.type) {
      'visit' when e.status != null => (visitStatusLabel(l10n, e.status!), visitStatusTone(e.status!)),
      'reservation_expiry' when e.status != null => (reservationStatusLabel(l10n, e.status!), reservationStatusTone(e.status!)),
      'done' when e.callResult != null => (callResultLabel(l10n, e.callResult!), callResultTone(e.callResult!)),
      _ => (null, BadgeTone.neutral),
    };
    final details = [if (e.project != null) e.project!.resolve(lang), if (e.unit != null) ltr(e.unit!), if (e.ref != null) ltr(e.ref!)].join(' · ');
    final note = e.note?.trim();
    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SizedBox(
        width: 50,
        child: Padding(
          padding: const EdgeInsets.only(top: 14),
          child: Text(clockTime(e.at, lang), textAlign: TextAlign.center, maxLines: 1, softWrap: false, style: homeDisplay(12.5, colors.inkStrong)),
        ),
      ),
      const SizedBox(width: 6),
      Expanded(
        child: Material(
          color: colors.surface,
          borderRadius: BorderRadius.circular(18),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            key: ValueKey('event-${e.type}-${e.id}'),
            onTap: e.route == null ? null : onTap,
            child: DecoratedBox(
              decoration: BoxDecoration(borderRadius: BorderRadius.circular(18), border: Border.all(color: colors.hairline)),
              child: Padding(
                padding: const EdgeInsets.all(10),
                child: Row(children: [
                  Container(width: 38, height: 38, decoration: BoxDecoration(color: accent.withValues(alpha: 0.13), borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: accent, size: 20)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(title, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: accent)),
                      Text(e.customer ?? '—', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: colors.inkStrong)),
                      if (details.isNotEmpty || (note != null && note.isNotEmpty)) Text(note != null && note.isNotEmpty ? note : details, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                    ]),
                  ),
                  if (badge != null) ...[const SizedBox(width: 6), StatusBadge(label: badge, tone: tone)],
                ]),
              ),
            ),
          ),
        ),
      ),
    ]);
  }
}
