import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../dashboard/home_kit/home_kit.dart';
import '../catalog/domain/entities/broker_project.dart';
import '../profile/presentation/cubit/broker_profile_cubit.dart';
import 'broker_home_data.dart';

/// The broker's home (owner-approved design, 2026-11-04), with the figures
/// of the broker portal's dashboard on the website: the sales and the
/// approval rate, the performance band, what needs following up, the latest
/// leads, the funnel, the projects open to them and the latest activity.
/// Commission figures show only to brokers who may see commissions.
class BrokerHomeScreen extends StatefulWidget {
  const BrokerHomeScreen({super.key, this.onSwitchTab});

  /// 1 projects, 2 leads, 3 bookings.
  final void Function(int)? onSwitchTab;

  @override
  State<BrokerHomeScreen> createState() => _BrokerHomeScreenState();
}

class _BrokerHomeScreenState extends State<BrokerHomeScreen> {
  @override
  void initState() {
    super.initState();
    context.read<BrokerHomeCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final profile = context.watch<BrokerProfileCubit>().state.data;
    final commissions = profile?.canViewCommissions ?? false;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: BlocBuilder<BrokerHomeCubit, BrokerHomeState>(
        builder: (context, state) {
          final data = state.data;
          final cubit = context.read<BrokerHomeCubit>();
          return HomePage(
            pageKey: const Key('broker-home'),
            loading: data == null && state.status != DataStatus.failure,
            failure: data == null ? state.failure : null,
            onRetry: cubit.load,
            onRefresh: cubit.load,
            hero: HomeHero(
              name: (profile?.fullName ?? '').trim().isNotEmpty ? profile!.fullName!.trim() : homeSessionName(context),
              roleLabel: l10n.roleBroker,
              companyName: profile?.companyName,
            ),
            overlap: data == null ? null : _sales(context, data, commissions),
            children: data == null
                ? const []
                : [
                    HomeActions(actions: [
                      HomeAction(
                          id: 'lead', icon: Icons.person_add_rounded, label: l10n.shActLead, onTap: () => context.push('/broker/leads/new')),
                      HomeAction(
                          id: 'reservation',
                          icon: Icons.bookmark_add_rounded,
                          label: l10n.shActReservation,
                          onTap: () => context.push('/broker/reservations/new')),
                      HomeAction(
                          id: 'projects', icon: Icons.apartment_rounded, label: l10n.navProjects, onTap: () => widget.onSwitchTab?.call(1)),
                      if (commissions)
                        HomeAction(
                            id: 'commissions',
                            icon: Icons.payments_rounded,
                            label: l10n.bhActCommissions,
                            onTap: () => context.push('/broker/commissions'))
                      else
                        HomeAction(
                            id: 'reservations',
                            icon: Icons.bookmarks_rounded,
                            label: l10n.navReservations,
                            onTap: () => widget.onSwitchTab?.call(3)),
                    ]),
                    _performance(context, data, commissions),
                    HomeSection(
                      icon: Icons.priority_high_rounded,
                      title: l10n.bhFollow,
                      child: HomeAttentionGrid(columns: 2, cards: [
                        HomeAttention(
                          id: 'leads-pending',
                          icon: Icons.hourglass_top_rounded,
                          tone: HomeTone.gold,
                          count: data.leadsPending,
                          label: l10n.bhAttLeads,
                          hot: true,
                          onTap: () => widget.onSwitchTab?.call(2),
                        ),
                        HomeAttention(
                          id: 'reservations-pending',
                          icon: Icons.bookmark_rounded,
                          tone: HomeTone.sky,
                          count: data.reservationsPending,
                          label: l10n.bhAttReservations,
                          onTap: () => widget.onSwitchTab?.call(3),
                        ),
                      ]),
                    ),
                    HomeSection(
                      icon: Icons.groups_rounded,
                      title: l10n.bhRecentLeads,
                      action: l10n.shAll,
                      onAction: () => widget.onSwitchTab?.call(2),
                      child: _LeadsList(leads: data.recentLeads),
                    ),
                    HomeSection(
                      icon: Icons.filter_alt_rounded,
                      title: l10n.bhFunnel,
                      child: HomeFunnel(steps: [
                        HomeFunnelStep(label: l10n.bhStSent, value: data.leadsSubmitted, colors: homeTaupe),
                        HomeFunnelStep(label: l10n.bhStApproved, value: data.leadsApproved, colors: homeNavy),
                        HomeFunnelStep(label: l10n.bhStReservations, value: data.reservations, colors: homeGold),
                        HomeFunnelStep(label: l10n.bhStContracts, value: data.contractsSigned, colors: homeGreen),
                        if (commissions) HomeFunnelStep(label: l10n.bhStPayouts, value: data.payoutsPaid, colors: homeAmber),
                      ]),
                    ),
                    HomeSection(
                      icon: Icons.apartment_rounded,
                      title: l10n.bhProjects,
                      action: l10n.shAll,
                      onAction: () => widget.onSwitchTab?.call(1),
                      child: _ProjectsStrip(projects: data.projects),
                    ),
                    if (data.activity.isNotEmpty)
                      HomeSection(
                        icon: Icons.history_rounded,
                        title: l10n.ahActivity,
                        child: HomeActivityList(items: [
                          for (final a in data.activity)
                            HomeActivityItem(
                              icon: brokerActivityIcon(a.type),
                              title: brokerActivityLabel(l10n, a.type),
                              subtitle: [
                                if ((a.reference ?? '').isNotEmpty) ltr(a.reference!),
                                ?_method(l10n, a.method),
                                if (a.reference == null && (a.lead ?? '').isNotEmpty) a.lead!,
                                if (a.reference == null && a.lead == null) l10n.bhCompanyLevel,
                              ].join(' · '),
                              when: brokerDay(context, a.at, DateTime.now()),
                            ),
                        ]),
                      ),
                  ],
          );
        },
      ),
    );
  }

  String _symbol(BuildContext context) => PriceFormatter.symbol(Localizations.localeOf(context).languageCode);

  Widget _sales(BuildContext context, BrokerHome d, bool commissions) {
    final l10n = context.l10n;
    final (value, unit) = homeCompact(d.salesGross, l10n);
    return HomeGoalCard(
      percent: d.approvalRate ?? 0,
      percentLabel: l10n.bhApprovalRate,
      icon: Icons.trending_up_rounded,
      title: l10n.bhSalesVolume,
      value: value,
      unit: unit,
      trailing: '${_symbol(context)} · ${l10n.ahContractsN(d.contractsSigned)}',
      minis: commissions
          ? [
              (l10n.bhMyCommissions, homeCompactText(d.commissionsNet, l10n)),
              (l10n.bhPaidOut, homeCompactText(d.payoutsNet, l10n)),
            ]
          : const [],
    );
  }

  Widget _performance(BuildContext context, BrokerHome d, bool commissions) {
    final l10n = context.l10n;
    final (pending, pUnit) = homeCompact(d.commissionsPendingNet, l10n);
    final projectsWithUnits = d.projects.where((p) => p.$2 > 0).length;
    return HomeSection(
      icon: Icons.auto_graph_rounded,
      title: l10n.bhPerformance,
      child: Column(children: [
        HomeBand(figures: [
          HomeFigure(
            id: 'sent',
            value: '${d.leadsSubmitted}',
            label: l10n.bhLeadsSent,
            hint: d.leadsPending > 0 ? l10n.bhPendingN(d.leadsPending) : l10n.bhNonePending,
            warn: d.leadsPending > 0,
          ),
          HomeFigure(id: 'signed', value: '${d.contractsSigned}', label: l10n.bhSigned, hint: l10n.bhOfReservations(d.reservations)),
          if (commissions)
            HomeFigure(
              id: 'pending-commission',
              value: pending,
              label: pUnit.isEmpty ? l10n.bhPendingCommission : l10n.bhPendingCommissionUnit(pUnit),
              hint: l10n.bhCommissionsN(d.commissionsPending),
            )
          else
            HomeFigure(
              id: 'reservations',
              value: '${d.reservations}',
              label: l10n.bhReservations,
              hint: d.reservationsPending > 0 ? l10n.bhPendingN(d.reservationsPending) : l10n.bhNonePending,
              warn: d.reservationsPending > 0,
            ),
        ]),
        HomeTiles(tiles: [
          HomeTile(label: l10n.bhUnitsForYou, value: '${d.availableUnits}', sub: l10n.bhInProjects(projectsWithUnits)),
          if (commissions)
            HomeTile(label: l10n.bhPayoutRate, value: _pct(d.payoutRate), sub: l10n.bhPayoutsPaid(d.payoutsPaid)),
          HomeTile(label: l10n.bhContractRate, value: _pct(d.contractRate), sub: l10n.bhOfBookings),
        ]),
      ]),
    );
  }

  String _pct(int? v) => v == null ? '—' : '$v%';

  String? _method(AppLocalizations l10n, String? m) => switch (m) {
        'BANK_TRANSFER' => l10n.paymentMethodBankTransfer,
        'CASH' => l10n.paymentMethodCash,
        'CHEQUE' => l10n.paymentMethodCheque,
        null || '' => null,
        _ => l10n.paymentMethodOther,
      };
}

/// The latest leads, each with where the company's approval stands.
class _LeadsList extends StatelessWidget {
  const _LeadsList({required this.leads});
  final List<BrokerHomeLead> leads;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      decoration: homeCard(context, radius: 24),
      child: leads.isEmpty
          ? Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(l10n.bhNoLeads, style: TextStyle(color: colors.inkMuted, fontSize: 13)),
            )
          : Column(children: [
              for (var i = 0; i < leads.length; i++)
                InkWell(
                  key: Key('broker-lead-${leads[i].id}'),
                  onTap: () => context.push('/broker/leads/${leads[i].id}'),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 11),
                    decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: colors.hairline))),
                    child: Row(children: [
                      Container(
                        width: 40,
                        height: 40,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(gradient: homeNavyGradient, borderRadius: BorderRadius.circular(13)),
                        child: Text(homeInitials(leads[i].name), style: homeDisplay(13, AppPalette.gold300)),
                      ),
                      const SizedBox(width: 11),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(leads[i].name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                          if (leads[i].at != null)
                            Text(_sent(context, leads[i].at!), style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                        ]),
                      ),
                      _StatusChip(status: leads[i].status),
                    ]),
                  ),
                ),
            ]),
    );
  }

  String _sent(BuildContext context, DateTime at) {
    final now = DateTime.now();
    if (homeDay(at) == homeDay(now)) return context.l10n.bhSentToday;
    return DateFormatter.dayMonth(at, languageCode: Localizations.localeOf(context).languageCode);
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});
  final String? status;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final (label, fg, bg) = switch (status) {
      'APPROVED' => (l10n.brokerLeadStatusApproved, AppPalette.successLight, homeOkFill(context)),
      'REJECTED' => (l10n.brokerLeadStatusRejected, const Color(0xFFC0392B), homeErrFill(context)),
      'DUPLICATE' => (l10n.brokerLeadStatusDuplicate, const Color(0xFF8A6D1E), homeWarnFill(context)),
      'EXPIRED' => (l10n.brokerLeadStatusExpired, context.appColors.inkMuted, context.appColors.surfaceSoft),
      _ => (l10n.brokerLeadStatusPending, AppPalette.gold600, AppPalette.gold50),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(99)),
      child: Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: fg)),
    );
  }
}

/// The projects open to the broker, side by side, each with its available
/// units.
class _ProjectsStrip extends StatelessWidget {
  const _ProjectsStrip({required this.projects});
  final List<(BrokerProject, int)> projects;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    if (projects.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(14),
        decoration: homeCard(context, radius: 24),
        child: Text(l10n.bhNoProjects, style: TextStyle(color: context.appColors.inkMuted, fontSize: 13)),
      );
    }
    return SizedBox(
      height: 150,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: projects.length,
        separatorBuilder: (_, _) => const SizedBox(width: 10),
        itemBuilder: (context, i) {
          final (p, units) = projects[i];
          return InkWell(
            key: Key('broker-project-${p.id}'),
            borderRadius: BorderRadius.circular(22),
            onTap: () => context.push('/broker/projects/${p.id}', extra: p),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(22),
              child: SizedBox(
                width: 260,
                child: Stack(fit: StackFit.expand, children: [
                  if (p.coverImageUrl?.isNotEmpty ?? false)
                    AppNetworkImage(url: p.coverImageUrl!)
                  else
                    DecoratedBox(decoration: BoxDecoration(gradient: homeNavyGradient)),
                  DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Colors.transparent, AppPalette.navy.withValues(alpha: 0.85)],
                      ),
                    ),
                  ),
                  PositionedDirectional(
                    top: 10,
                    start: 10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(99)),
                      child: Text(l10n.bhUnitsAvailable(units),
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppPalette.navy)),
                    ),
                  ),
                  PositionedDirectional(
                    start: 12,
                    end: 12,
                    bottom: 10,
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(p.name.resolve(lang),
                          maxLines: 1, overflow: TextOverflow.ellipsis, style: homeDisplay(15, Colors.white)),
                      if (p.city?.isNotEmpty ?? false)
                        Row(children: [
                          Icon(Icons.location_on_rounded, size: 13, color: AppPalette.gold300),
                          const SizedBox(width: 3),
                          Text(p.city!, style: const TextStyle(fontSize: 12, color: Color(0xFFDCE3EC))),
                        ]),
                    ]),
                  ),
                ]),
              ),
            ),
          );
        },
      ),
    );
  }
}

IconData brokerActivityIcon(String type) => switch (type) {
      'LEAD_SUBMITTED' => Icons.person_add_rounded,
      'VISIT_REQUESTED' => Icons.event_rounded,
      'LEAD_APPROVED' => Icons.how_to_reg_rounded,
      'LEAD_REJECTED' => Icons.person_off_rounded,
      'LEAD_MARKED_DUPLICATE' => Icons.content_copy_rounded,
      'RESERVATION_CREATED' => Icons.bookmark_added_rounded,
      'CONTRACT_CREATED' || 'CONTRACT_SIGNED' => Icons.description_rounded,
      'COMMISSION_EARNED' || 'COMMISSION_APPROVED' => Icons.percent_rounded,
      'PAYOUT_APPROVED' => Icons.verified_rounded,
      'PAYOUT_PAID' || 'PAYOUT_CREATED' || 'PAYOUT_PROCESSING' => Icons.payments_rounded,
      _ => Icons.history_rounded,
    };

String brokerActivityLabel(AppLocalizations l10n, String type) => switch (type) {
      'LEAD_SUBMITTED' => l10n.bhEvLeadSubmitted,
      'VISIT_REQUESTED' => l10n.bhEvVisitRequested,
      'LEAD_APPROVED' => l10n.bhEvLeadApproved,
      'LEAD_REJECTED' => l10n.bhEvLeadRejected,
      'LEAD_MARKED_DUPLICATE' => l10n.bhEvLeadDuplicate,
      'RESERVATION_CREATED' => l10n.bhEvReservationCreated,
      'CONTRACT_CREATED' => l10n.bhEvContractCreated,
      'CONTRACT_SIGNED' => l10n.bhEvContractSigned,
      'COMMISSION_EARNED' => l10n.bhEvCommissionEarned,
      'COMMISSION_APPROVED' => l10n.bhEvCommissionApproved,
      'COMMISSION_REJECTED' => l10n.bhEvCommissionRejected,
      'COMMISSION_CANCELLED' => l10n.bhEvCommissionCancelled,
      'PAYOUT_CREATED' => l10n.bhEvPayoutCreated,
      'PAYOUT_APPROVED' => l10n.bhEvPayoutApproved,
      'PAYOUT_PROCESSING' => l10n.bhEvPayoutProcessing,
      'PAYOUT_PAID' => l10n.bhEvPayoutPaid,
      'PAYOUT_CANCELLED' => l10n.bhEvPayoutCancelled,
      _ => type,
    };

/// «اليوم», «أمس» or the date.
String brokerDay(BuildContext context, DateTime at, DateTime now) {
  final l10n = context.l10n;
  final days = homeDay(now).difference(homeDay(at)).inDays;
  if (days == 0) return l10n.bhToday;
  if (days == 1) return l10n.bhYesterday;
  return DateFormatter.dayMonth(at, languageCode: Localizations.localeOf(context).languageCode);
}
