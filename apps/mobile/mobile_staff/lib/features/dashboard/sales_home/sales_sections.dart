import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../common/lead_stage_label.dart';
import '../../leads/domain/entities/lead.dart';
import '../../leads/presentation/follow_up_labels.dart';
import 'sales_home_cubit.dart';
import 'sales_home_data.dart';

/// The sections of the sales homes (rep and manager): follow-ups, the week's
/// agenda and the sales pipeline.

// ── 6. Follow-ups ────────────────────────────────────────────────────────────

class HomeFollowUps extends StatelessWidget {
  const HomeFollowUps({super.key, required this.state});
  final SalesHomeState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final s = state.followUpSummary;
    final cubit = context.read<SalesHomeCubit>();

    Widget seg(FollowUpBucket b, String label, int n) {
      final on = state.followUpBucket == b;
      return Expanded(child: InkWell(
        key: Key('sales-home-fu-${b.name}'),
        borderRadius: BorderRadius.circular(9),
        onTap: () => cubit.showFollowUps(b),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: on ? context.appColors.surface : Colors.transparent,
            borderRadius: BorderRadius.circular(9),
            boxShadow: on ? [BoxShadow(color: AppPalette.navy.withValues(alpha: 0.08), blurRadius: 6, offset: const Offset(0, 2))] : null,
          ),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Flexible(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600,
                color: on ? context.appColors.inkStrong : context.appColors.inkMuted))),
            const SizedBox(width: 5),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6),
              decoration: BoxDecoration(color: homeTintBorder(context), borderRadius: BorderRadius.circular(6)),
              child: Text(ltr('$n'), style: TextStyle(fontSize: 12, color: AppPalette.gold600)),
            ),
          ]),
        ),
      ));
    }

    return HomeSection(
      icon: Icons.call_rounded,
      title: l10n.shFollowUps,
      action: l10n.shAll,
      onAction: () => context.push('/follow-ups'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(color: context.appColors.surfaceSoft, borderRadius: BorderRadius.circular(12)),
            child: Row(children: [
              seg(FollowUpBucket.overdue, l10n.shOverdue, s.overdue),
              seg(FollowUpBucket.today, l10n.shToday, s.today),
              seg(FollowUpBucket.upcoming, l10n.shUpcoming, s.upcoming),
            ]),
          ),
          const SizedBox(height: 10),
          if (state.followUpsLoading)
            const Padding(padding: EdgeInsets.all(AppSpacing.md), child: Center(child: CircularProgressIndicator()))
          else if (state.followUps.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: homeCard(context),
              child: Text(l10n.shNoFollowUps, style: TextStyle(color: context.appColors.inkMuted, fontSize: 13)),
            )
          else
            for (final f in state.followUps) _FollowUpTile(f: f, l10n: l10n, lang: lang),
        ],
      ),
    );
  }
}

class _FollowUpTile extends StatelessWidget {
  const _FollowUpTile({required this.f, required this.l10n, required this.lang});
  final FollowUp f;
  final AppLocalizations l10n;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final lead = f.lead;
    final at = lead.nextActionAt?.toLocal();
    final phone = lead.phone?.trim() ?? '';
    final tone = leadStageTone(lead.stage);
    final sub = [
      // followUpWhen already says the day and the time ("اليوم 12:02 م").
      if (at != null) followUpWhen(at, l10n, lang),
      if ((lead.nextActionNote ?? '').isNotEmpty) lead.nextActionNote!,
    ].join(' · ');
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: context.appColors.surface,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          key: Key('sales-home-fu-lead-${lead.id}'),
          borderRadius: BorderRadius.circular(20),
          onTap: () => context.push('/leads/${lead.id}'),
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              border: Border.all(color: context.appColors.hairline),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              children: [
                Container(width: 3, height: 34, decoration: BoxDecoration(color: AppPalette.gold400, borderRadius: BorderRadius.circular(3))),
                const SizedBox(width: 9),
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(gradient: homeNavyGradient, borderRadius: BorderRadius.circular(15)),
                  alignment: Alignment.center,
                  child: Text(homeInitials(lead.fullName), style: homeDisplay(14, AppPalette.gold300)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Flexible(
                          child: Text(lead.fullName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: context.appColors.inkStrong)),
                        ),
                        const SizedBox(width: 6),
                        StatusBadge(label: leadStageLabel(l10n, lead.stage), tone: tone),
                      ]),
                      const SizedBox(height: 3),
                      Row(children: [
                        Icon(Icons.schedule_rounded, size: 14, color: AppPalette.gold500),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 12, color: context.appColors.inkMuted)),
                        ),
                      ]),
                    ],
                  ),
                ),
                if (phone.isNotEmpty) ...[
                  _RoundBtn(
                    icon: Icons.chat_rounded,
                    bg: const Color(0xFFE8F4EC),
                    fg: const Color(0xFF1F8F55),
                    onTap: () => ContactActions.whatsApp(number: phone),
                  ),
                  const SizedBox(width: 6),
                  _RoundBtn(
                    icon: Icons.call_rounded,
                    bg: AppPalette.navy,
                    fg: AppPalette.gold300,
                    onTap: () => ContactActions.call(phone),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _RoundBtn extends StatelessWidget {
  const _RoundBtn({required this.icon, required this.bg, required this.fg, required this.onTap});
  final IconData icon;
  final Color bg;
  final Color fg;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
        color: bg,
        borderRadius: BorderRadius.circular(13),
        child: InkWell(
          borderRadius: BorderRadius.circular(13),
          onTap: onTap,
          child: SizedBox(width: 38, height: 38, child: Icon(icon, size: 19, color: fg)),
        ),
      );
}

// ── 7. Agenda ────────────────────────────────────────────────────────────────

class HomeAgenda extends StatelessWidget {
  const HomeAgenda({super.key, required this.state, this.title, this.showWho = false});
  final SalesHomeState state;

  /// «أجندة الفريق» on the manager's home.
  final String? title;

  /// Say which rep each visit is with (the manager's team agenda).
  final bool showWho;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final data = state.data!;
    final today = homeDay(DateTime.now());
    final days = [for (var i = 0; i < kAgendaDays; i++) today.add(Duration(days: i))];
    final selected = state.selectedDay ?? today;
    final events = [...data.visits, ...data.expiring]..sort((a, b) => a.at.compareTo(b.at));
    List<AgendaEvent> on(DateTime d) => events.where((e) => homeDay(e.at) == d).toList();
    final dayEvents = on(selected);
    final next = events.where((e) => homeDay(e.at).isAfter(selected)).firstOrNull;

    return HomeSection(
      icon: Icons.event_note_rounded,
      title: title ?? l10n.shAgenda,
      action: l10n.shAllAppointments,
      onAction: () => context.push('/calendar'),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: homeCard(context, radius: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                for (final d in days)
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 2.5),
                      child: InkWell(
                        key: Key('sales-home-day-${d.day}'),
                        borderRadius: BorderRadius.circular(15),
                        onTap: () => context.read<SalesHomeCubit>().selectDay(d),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          decoration: BoxDecoration(
                            gradient: d == selected ? homeNavyGradient : null,
                            borderRadius: BorderRadius.circular(15),
                          ),
                          child: Column(children: [
                            Text(DateFormatter.weekdayShort(d, languageCode: lang),
                                maxLines: 1,
                                style: TextStyle(fontSize: 12, color: d == selected ? const Color(0xFFC9D2DE) : context.appColors.inkMuted)),
                            Text(ltr('${d.day}'), style: homeDisplay(18, d == selected ? Colors.white : context.appColors.inkStrong)),
                            const SizedBox(height: 2),
                            Container(
                              width: 5,
                              height: 5,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: on(d).isEmpty ? Colors.transparent : (d == selected ? AppPalette.gold300 : AppPalette.gold400),
                              ),
                            ),
                          ]),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            if (dayEvents.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 14, bottom: 4),
                child: Text(l10n.shDayEmpty, textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 12.5, color: context.appColors.inkMuted)),
              )
            else
              for (final e in dayEvents) _EventTile(e: e, lang: lang, l10n: l10n, showWho: showWho),
            if (next != null) ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: context.appColors.surfaceSoft, borderRadius: BorderRadius.circular(12)),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(Icons.update_rounded, size: 15, color: AppPalette.gold500),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      l10n.shNextUp(
                        '${DateFormatter.weekdayShort(next.at, languageCode: lang)} ${DateFormatter.dayMonth(next.at, languageCode: lang)} — '
                        '${next.kind == AgendaKind.visit ? l10n.shTagVisit : l10n.shTagExpiry} ${next.title}',
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 12, color: context.appColors.inkMuted),
                    ),
                  ),
                ]),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _EventTile extends StatelessWidget {
  const _EventTile({required this.e, required this.lang, required this.l10n, this.showWho = false});
  final bool showWho;
  final AgendaEvent e;
  final String lang;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final visit = e.kind == AgendaKind.visit;
    final time = clockTime(e.at, lang).split(' ');
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 54,
            child: Column(children: [
              Text(ltr(time.first), style: homeDisplay(18, context.appColors.inkStrong)),
              if (time.length > 1) Text(time.last, style: TextStyle(fontSize: 12, color: context.appColors.inkMuted)),
            ]),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: InkWell(
              key: Key('sales-home-event-${e.id}'),
              borderRadius: BorderRadius.circular(18),
              onTap: () => context.push(visit ? '/visits/${e.id}' : '/reservations/${e.id}'),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  gradient: visit ? homeNavyGradient : null,
                  color: visit ? null : const Color(0xFFF8E6E4),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 2),
                      decoration: BoxDecoration(
                        color: visit ? AppPalette.gold300 : AppPalette.errorLight,
                        borderRadius: BorderRadius.circular(99),
                      ),
                      child: Text(
                        visit ? (e.confirmed ? '${l10n.shTagVisit} · ${l10n.shConfirmed}' : l10n.shTagVisit) : l10n.shTagExpiry,
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: visit ? AppPalette.navy : Colors.white),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(e.title,
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: visit ? Colors.white : context.appColors.inkStrong)),
                    for (final (icon, line) in [
                      if (showWho && e.who != null) (Icons.badge_rounded, l10n.shWithRep(e.who!)),
                      if (e.project != null) (Icons.apartment_rounded, e.project!.resolve(lang)),
                      if (e.unitCode != null) (Icons.home_work_rounded, ltr(e.unitCode!)),
                      if (e.place != null && e.place!.isNotEmpty) (visit ? Icons.location_on_rounded : Icons.bookmark_rounded, e.place!),
                    ])
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Row(children: [
                          Icon(icon, size: 14, color: visit ? AppPalette.gold300 : AppPalette.errorLight),
                          const SizedBox(width: 5),
                          Expanded(
                            child: Text(line, maxLines: 1, overflow: TextOverflow.ellipsis,
                                style: TextStyle(fontSize: 12, color: visit ? const Color(0xFFC9D2DE) : context.appColors.inkMuted)),
                          ),
                        ]),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── 8. Pipeline ──────────────────────────────────────────────────────────────

class HomePipeline extends StatelessWidget {
  const HomePipeline({super.key, required this.stages, required this.onLeads});
  final Map<String, int> stages;
  final VoidCallback onLeads;

  static final _open = ['NEW', 'INTERESTED', 'VISIT', 'NEGOTIATION'];
  static final _fills = {
    'NEW': [Color(0xFF8A7F70), Color(0xFF6B6256)],
    'INTERESTED': [AppPalette.navy600, AppPalette.navy],
    'VISIT': [AppPalette.gold300, AppPalette.gold500],
    'NEGOTIATION': [Color(0xFFDDA14A), AppPalette.warningLight],
  };

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final max = _open.map((s) => stages[s] ?? 0).fold<int>(1, (m, v) => v > m ? v : m);
    return HomeSection(
      icon: Icons.filter_alt_rounded,
      title: l10n.shPipeline,
      action: l10n.shLeadsLink,
      onAction: onLeads,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: homeCard(context, radius: 24),
        child: Column(
          children: [
            for (final s in _open)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4.5),
                child: Row(children: [
                  SizedBox(
                    width: 56,
                    child: Text(leadStageLabel(l10n, s), style: TextStyle(fontSize: 12, color: context.appColors.inkMuted)),
                  ),
                  Expanded(
                    child: Container(
                      height: 30,
                      decoration: BoxDecoration(color: context.appColors.surfaceSoft, borderRadius: BorderRadius.circular(10)),
                      child: FractionallySizedBox(
                        key: Key('sales-home-stage-$s'),
                        alignment: AlignmentDirectional.centerStart,
                        widthFactor: ((stages[s] ?? 0) / max).clamp(0.12, 1.0),
                        child: Container(
                          alignment: AlignmentDirectional.centerEnd,
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(colors: _fills[s]!),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(ltr('${stages[s] ?? 0}'),
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
                        ),
                      ),
                    ),
                  ),
                ]),
              ),
          ],
        ),
      ),
    );
  }
}
