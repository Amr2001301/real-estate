import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import 'admin_home_data.dart';
import '../../notifications/presentation/cubit/unread_count_cubit.dart';

/// The company admin's home: the month's collection, what waits for the
/// admin's decision, and a way to the reports (the funnel, the rankings, the
/// projects and the cash flow live there, not on the home).
class AdminHomeScreen extends StatefulWidget {
  const AdminHomeScreen({super.key, this.onSwitchTab});
  final void Function(int)? onSwitchTab;

  @override
  State<AdminHomeScreen> createState() => _AdminHomeScreenState();
}

class _AdminHomeScreenState extends State<AdminHomeScreen> {
  @override
  void initState() {
    super.initState();
    context.read<AdminHomeCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: BlocBuilder<AdminHomeCubit, AdminHomeState>(
        builder: (context, state) {
          final data = state.data;
          final cubit = context.read<AdminHomeCubit>();
          final now = DateTime.now();
          final lang = Localizations.localeOf(context).languageCode;
          final first = homeSessionName(context).trim().split(RegExp(r'\s+')).first;
          return Scaffold(
            body: RefreshIndicator(
              onRefresh: cubit.load,
              child: ListView(
                key: const Key('admin-home'),
                physics: const AlwaysScrollableScrollPhysics(),
                padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 120),
                children: [
                  HomeListHero(
                    key: const Key('dv-hero'),
                    title: '${now.hour < 12 ? l10n.shGreetMorning : l10n.shGreetEvening} $first',
                    subtitle: '${DateFormatter.weekdayShort(now, languageCode: lang)}، ${DateFormatter.dayMonth(now, languageCode: lang)}',
                    actions: [
                      BlocBuilder<UnreadCountCubit, int>(
                        builder: (context, n) => HomeHeroButton(
                          key: const Key('home-bell'),
                          icon: AppIcons.notification,
                          dot: n > 0,
                          tooltip: l10n.accountNotifications,
                          onTap: () => context.push('/notifications'),
                        ),
                      ),
                    ],
                    bottom: data == null ? null : _heroFigure(context, data),
                  ),
                  if (data == null && state.status == DataStatus.failure)
                    Padding(padding: const EdgeInsets.all(AppSpacing.lg), child: ErrorState(failure: state.failure, onRetry: cubit.load))
                  else if (data == null)
                    const Padding(padding: EdgeInsets.only(top: 120), child: Center(child: CircularProgressIndicator()))
                  else ...[
                    const SizedBox(height: 4),
                    DvSectionTitle(title: l10n.dvAwaiting, trailing: '${_awaiting(context, data).length}'),
                    if (_awaiting(context, data).isEmpty)
                      DvListCard(children: [DvRow(icon: Icons.check_circle_outline_rounded, title: l10n.dvAllClear)])
                    else
                      DvListCard(children: _awaiting(context, data)),
                    const SizedBox(height: 14),
                    DvListCard(children: [
                      DvRow(
                        key: const Key('home-reports'),
                        icon: Icons.insights_rounded,
                        title: l10n.dvReports,
                        subtitle: l10n.dvReportsSub,
                        onTap: () => context.push('/reports'),
                      ),
                    ]),
                  ],
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  /// The month's collection against last month; the line is the overall
  /// collection rate of what is due.
  Widget _heroFigure(BuildContext context, AdminHome d) {
    final l10n = context.l10n;
    final (value, unit) = homeCompact(d.collectedThisMonth, l10n);
    final (prev, prevUnit) = homeCompact(d.prevMonthCollected, l10n);
    return DvHeroFigure(
      label: l10n.dvCollectedMonth,
      value: value,
      unit: '$unit ${_symbol(context)}'.trim(),
      badge: DvHeroBadge('${l10n.dvLastMonth} ${'$prev $prevUnit'.trim()}'),
      progress: d.collectionRate == null ? null : d.collectionRate! / 100,
      footer: Text(
        [
          if (d.collectionRate != null) l10n.dvCollectionPct(d.collectionRate!),
          l10n.dvSignedN(d.signedThisMonth),
          l10n.dvNewLeadsN(d.newLeadsThisMonth),
        ].join('  ·  '),
        style: const TextStyle(fontSize: 12.5, height: 1.5, color: Color(0xFFAEB8CB)),
      ),
    );
  }

  /// What waits for the admin, most urgent first; nothing at zero is shown.
  List<Widget> _awaiting(BuildContext context, AdminHome d) {
    final l10n = context.l10n;
    final a = d.alerts;
    final rows = <(String, IconData, String, int, DvTone, String)>[
      ('follow-ups', Icons.phone_in_talk_rounded, l10n.ahAttFollowUps, d.overdueFollowUps, DvTone.bad, '/follow-ups'),
      ('sign', Icons.draw_rounded, l10n.ahAttSign, a.contractsAwaitingSignature, DvTone.warn, '/contracts'),
      ('proofs', Icons.receipt_long_rounded, l10n.ahAttProofs, a.depositsPendingReview, DvTone.warn, '/payments-review'),
      ('visits', Icons.event_available_rounded, l10n.ahAttVisits, a.visitsAwaitingConfirmation, DvTone.neutral, '/visits'),
      ('maintenance', Icons.build_rounded, l10n.ahAttMaintenance, a.openMaintenance, DvTone.neutral, '/admin-maintenance'),
      ('inquiries', Icons.help_outline_rounded, l10n.ahAttInquiries, a.infoRequestsOpen, DvTone.neutral, '/inquiries'),
    ];
    return [
      for (final (id, icon, title, n, tone, route) in rows)
        if (n > 0)
          DvRow(
            key: Key('home-await-$id'),
            icon: icon,
            title: title,
            trailing: DvPill('$n', tone: tone),
            onTap: () => context.push(route),
          ),
    ];
  }

  String _symbol(BuildContext context) => PriceFormatter.symbol(Localizations.localeOf(context).languageCode);








}



/// "منذ ساعة", as the website's activity list.
String adminAgo(AppLocalizations l10n, DateTime at, DateTime now) {
  final mins = now.difference(at).inMinutes;
  if (mins < 1) return l10n.ahAgoNow;
  if (mins < 60) return l10n.ahAgoMinutes(mins);
  final hours = (mins / 60).round();
  if (hours < 24) return l10n.ahAgoHours(hours);
  return l10n.ahAgoDays((hours / 24).round());
}

/// [v] in the unit [like] is shown in ("2.56" million → last month "0.18"),
/// so the two read side by side.
String adminInUnit(double v, double like) {
  final div = like.abs() >= 1000000 ? 1000000 : (like.abs() >= 1000 ? 1000 : 1);
  final t = (v / div).toStringAsFixed(2);
  return t.contains('.') ? t.replaceFirst(RegExp(r'\.?0+$'), '') : t;
}
