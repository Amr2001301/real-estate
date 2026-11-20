import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../common/staff_list_skeleton.dart';
import '../../contracts/view/contracts_list_screen.dart' show contractMoney;
import '../presentation/screens/reservation_decision_card.dart' show askReservationRejectReason, confirmReservationApprove;
import 'reservations_data.dart';

/// The bookings list (owner-approved design r1, 2026-11-04), as the
/// website's bookings page, over what the viewer may see (the rep their
/// own, the manager the team's, the admin all): the active ones, those
/// waiting for a decision, those waiting for the booking amount; a pill per
/// state; and on each card the client, the number and consultant, the unit,
/// the booking amount and the plan, and the next step — approve or reject
/// right there for whoever decides.
class ReservationsListScreen extends StatefulWidget {
  const ReservationsListScreen({super.key});

  @override
  State<ReservationsListScreen> createState() => _ReservationsListScreenState();
}

class _ReservationsListScreenState extends State<ReservationsListScreen> {
  final _search = TextEditingController();
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    context.read<ReservationsListCubit>().load();
    _scroll.addListener(() {
      if (_scroll.position.pixels >= _scroll.position.maxScrollExtent - 300) context.read<ReservationsListCubit>().loadMore();
    });
  }

  @override
  void dispose() {
    _search.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _filters() {
    final cubit = context.read<ReservationsListCubit>();
    final role = context.read<SessionCubit>().state.role;
    showFilterSheet(
      context,
      (_) => ReservationsFilterSheet(
        query: cubit.state.query,
        counts: cubit.state.counts,
        consultants: role == AppRole.admin || role == AppRole.salesManager,
        repository: cubit.repository,
        onApply: cubit.apply,
        count: cubit.count,
      ),
    );
  }

  Future<void> _new() async {
    final created = await context.push<bool>('/reservations/new');
    if (created == true && mounted) await context.read<ReservationsListCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<ReservationsListCubit>();
    final role = context.read<SessionCubit>().state.role;
    final decides = role == AppRole.admin || role == AppRole.salesManager;
    final bottomPad = MediaQuery.paddingOf(context).bottom;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BlocBuilder<ReservationsListCubit, ReservationsListState>(
          builder: (context, state) {
            final c = state.counts;
            final q = state.query;
            return RefreshIndicator(
              onRefresh: cubit.load,
              child: CustomScrollView(
                controller: _scroll,
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverToBoxAdapter(
                    child: HomeListHero(
                      title: l10n.navReservations,
                      subtitle: c == null ? null : l10n.rvCountN(c.all),
                      back: Navigator.of(context).canPop(),
                      actions: [
                        HomeHeroButton(key: const Key('reservations-new'), icon: Icons.bookmark_add_rounded, tooltip: l10n.rvNew, onTap: _new),
                        const SizedBox(width: 8),
                        HomeHeroButton(
                          key: const Key('reservations-filters'),
                          icon: Icons.tune_rounded,
                          dot: q.filter != null || q.projectId != null || q.salesId != null,
                          tooltip: l10n.rvFilters,
                          onTap: _filters,
                        ),
                      ],
                      bottom: HomeSearchField(
                        controller: _search,
                        hint: l10n.rvSearchHint,
                        onSubmitted: cubit.setSearch,
                        onClear: () {
                          _search.clear();
                          cubit.setSearch('');
                        },
                      ),
                    ),
                  ),
                  if (c != null)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 0),
                        child: HomeBand(figures: [
                          HomeFigure(id: 'active', value: '${c.active}', label: l10n.rvActive, hint: l10n.rvOutOf(l10n.rvCountN(c.all))),
                          HomeFigure(
                            id: 'pending',
                            value: '${c.of('PENDING')}',
                            label: decides ? l10n.rvNeedsDecision : l10n.rvUnderReview,
                            hint: l10n.rvUnderReview,
                            warn: c.of('PENDING') > 0,
                          ),
                          HomeFigure(
                            id: 'awaiting',
                            value: '${c.awaitingPayment}',
                            label: l10n.rvAwaitingPayment,
                            hint: l10n.rvApprovedHint,
                            warn: c.awaitingPayment > 0,
                          ),
                        ]),
                      ),
                    ),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 14),
                      child: HomePills(pills: [
                        HomePill(id: 'all', label: l10n.lvAll, count: c?.all, selected: q.filter == null, onTap: () => cubit.setFilter(null)),
                        HomePill(
                          id: 'PENDING',
                          label: l10n.rvPillPending,
                          count: c?.of('PENDING'),
                          dot: catalogReserved,
                          selected: q.filter == 'PENDING',
                          onTap: () => cubit.setFilter('PENDING'),
                        ),
                        HomePill(
                          id: 'APPROVED',
                          label: l10n.rvPillApproved,
                          count: c?.of('APPROVED'),
                          dot: catalogAvailable,
                          selected: q.filter == 'APPROVED',
                          onTap: () => cubit.setFilter('APPROVED'),
                        ),
                        HomePill(
                          id: 'CONVERTED',
                          label: l10n.rvPillConverted,
                          count: c?.of('CONVERTED'),
                          dot: AppPalette.gold500,
                          selected: q.filter == 'CONVERTED',
                          onTap: () => cubit.setFilter('CONVERTED'),
                        ),
                        HomePill(
                          id: 'CLOSED',
                          label: l10n.rvPillClosed,
                          count: c?.closed,
                          dot: const Color(0xFF9A9083),
                          selected: q.filter == 'CLOSED',
                          onTap: () => cubit.setFilter('CLOSED'),
                        ),
                      ]),
                    ),
                  ),
                  ..._body(context, state),
                  if (state.loadingMore)
                    const SliverToBoxAdapter(child: Padding(padding: EdgeInsets.all(AppSpacing.md), child: Center(child: CircularProgressIndicator()))),
                  SliverPadding(padding: EdgeInsets.only(bottom: bottomPad + 40)),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  List<Widget> _body(BuildContext context, ReservationsListState state) {
    final l10n = context.l10n;
    switch (state.status) {
      case DataStatus.initial:
      case DataStatus.loading:
        return const [SliverToBoxAdapter(child: SizedBox(height: 600, child: StaffListSkeleton(band: true)))];
      case DataStatus.failure:
        return [SliverToBoxAdapter(child: ErrorState(failure: state.failure, onRetry: context.read<ReservationsListCubit>().load))];
      case DataStatus.empty:
        return [
          SliverToBoxAdapter(
            child: state.query != const ReservationsQuery()
                ? EmptyState(icon: Icons.filter_list_off_rounded, title: l10n.kcNoMatch)
                : EmptyState(icon: Icons.bookmark_rounded, title: l10n.rvEmpty, message: l10n.rvEmptyMessage),
          ),
        ];
      case DataStatus.success:
        return [
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(AppSpacing.md, 12, AppSpacing.md, 0),
            sliver: SliverList.separated(
              itemCount: state.rows.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (context, i) => ReservationCardView(row: state.rows[i], working: state.working.contains(state.rows[i].id)),
            ),
          ),
        ];
    }
  }
}

/// The badge of a booking's state.
Widget reservationBadge(AppLocalizations l10n, ReservationRow r) => switch (r.status) {
      'PENDING' => CatalogBadge.status(l10n.rvStPending, catalogReserved, icon: Icons.hourglass_top_rounded),
      'APPROVED' => CatalogBadge.status(l10n.rvStApproved, catalogAvailable, icon: Icons.verified_rounded),
      'CONVERTED' => CatalogBadge.gold(l10n.rvStConverted, icon: Icons.description_rounded),
      'REJECTED' => CatalogBadge.status(l10n.rvStRejected, const Color(0xFF6B6256), icon: Icons.block_rounded),
      'CANCELLED' => CatalogBadge.status(l10n.rvStCancelled, const Color(0xFF6B6256), icon: Icons.cancel_rounded),
      _ => CatalogBadge.status(l10n.rvStExpired, const Color(0xFF6B6256), icon: Icons.timer_off_rounded),
    };

/// The booking amount's state, in a word.
String bookingPayLabel(AppLocalizations l10n, ReservationRow r) => switch (r.bookingStatus) {
      'PAID' => l10n.rvPaid,
      'WAIVED' => l10n.rvWaived,
      _ => l10n.rvUnpaid,
    };

/// A small rounded chip with an icon (the card's next step).
class ReservationChip extends StatelessWidget {
  const ReservationChip({super.key, required this.label, required this.icon, required this.color});
  final String label;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(99)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 13, color: color),
          const SizedBox(width: 4),
          Flexible(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color))),
        ]),
      );
}

/// A "more" link: the label and a chevron that points outward («‹» in
/// Arabic: `chevron_right` mirrors itself).
class ReservationLink extends StatelessWidget {
  const ReservationLink({super.key, required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppPalette.gold600)),
            Icon(Icons.chevron_right_rounded, size: 17, color: AppPalette.gold600),
          ]),
        ),
      );
}

/// One booking: the client and the badge; the number, the consultant and
/// whether a broker brought it; the project and unit; the booking amount
/// and the plan; and the next step.
class ReservationCardView extends StatelessWidget {
  const ReservationCardView({super.key, required this.row, this.working = false, this.route = '/reservations', this.extraMini, this.showConsultant = true});
  final ReservationRow row;
  final bool working;

  /// The broker's bookings open their own page.
  final String route;

  /// A second figure instead of the plan (the broker's commission).
  final (String, String)? extraMini;
  final bool showConsultant;

  Future<void> _decide(BuildContext context, {required bool approve}) async {
    final l10n = context.l10n;
    final messenger = ScaffoldMessenger.of(context);
    String? reason;
    if (approve) {
      if (!await confirmReservationApprove(context)) return;
    } else {
      reason = await askReservationRejectReason(context);
      if (reason == null) return;
    }
    if (!context.mounted) return;
    final f = await context.read<ReservationsListCubit>().decide(row.id, approve: approve, reason: reason);
    messenger.showSnackBar(SnackBar(content: Text(f?.userMessage(l10n) ?? (approve ? l10n.rvApprovedMsg : l10n.rvRejectedMsg))));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final session = context.read<SessionCubit>().state;
    final role = session.role;
    final decides = route == '/reservations' && canDecideBooking(row, role: role, userId: session.sessionOrNull?.userId);
    String day(DateTime d) => DateFormatter.dayMonth(d, languageCode: lang);
    final where = [if ((row.projectName ?? '').isNotEmpty) row.projectName!, if ((row.unitCode ?? '').isNotEmpty) ltr(row.unitCode!)].join(' · ');
    final (String status, Color statusColor) = switch (row.status) {
      'PENDING' => (l10n.rvStPending, colors.warning),
      'APPROVED' => (l10n.rvStApproved, colors.success),
      'CONVERTED' => (l10n.rvStConverted, colors.inkStrong),
      'REJECTED' => (l10n.rvStRejected, colors.inkMuted),
      'CANCELLED' => (l10n.rvStCancelled, colors.inkMuted),
      _ => (l10n.rvStExpired, colors.inkMuted),
    };

    // The one fact that matters now, by state.
    final left = row.daysLeft(DateTime.now());
    final (IconData footIcon, String footText, Color footColor) = switch (row.status) {
      'PENDING' when left != null && left < 0 => (Icons.timer_off_rounded, l10n.rvExpiredOn(day(row.expiresAt!)), colors.error),
      'PENDING' when left != null => (Icons.schedule_rounded, '${l10n.rvExpiresInN(left)} · ${day(row.expiresAt!)}', colors.warning),
      'APPROVED' when !row.bookingSettled => (Icons.payments_outlined, l10n.rvUnpaidWarn, colors.warning),
      'APPROVED' => (Icons.task_alt_rounded, l10n.rvReady, colors.success),
      'CONVERTED' => (Icons.description_outlined, row.convertedAt == null ? l10n.rvStConverted : l10n.rvConvertedOn(day(row.convertedAt!)), colors.inkMuted),
      _ => (
          Icons.info_outline_rounded,
          (row.reason ?? '').isNotEmpty ? l10n.rvReasonLine(row.reason!) : (row.closedAt == null ? status : day(row.closedAt!)),
          colors.inkMuted
        ),
    };
    final money = [
      if (row.bookingAmount > 0) '${l10n.rvBooking} ${contractMoney(row.bookingAmount)} · ${bookingPayLabel(l10n, row)}',
      extraMini != null
          ? '${extraMini!.$1} ${extraMini!.$2}'
          : (row.months == null || row.months == 0 ? l10n.kcNoPlan : l10n.kcPlanLine(row.months!, row.monthly == null ? '—' : contractMoney(row.monthly!))),
    ].join(' · ');
    final who = [
      ltr(row.displayNumber),
      if (showConsultant && (row.salesName ?? '').isNotEmpty) row.salesName!,
      if (row.viaBroker && route == '/reservations') l10n.rvByBroker,
    ].join(' · ');

    return DvEntityCard(
      inkKey: Key('reservation-card-${row.id}'),
      onTap: () => context.push('$route/${row.id}'),
      initials: homeInitials(row.clientName),
      title: row.clientName ?? '—',
      subtitle: [who, if (where.isNotEmpty) where].join(' · '),
      status: status,
      statusColor: statusColor,
      footIcon: footIcon,
      footColor: footColor,
      footText: footText,
      footSub: money,
      actions: [
        if (decides) ...[
          DvSquareAction(
            key: Key('reservation-reject-${row.id}'),
            icon: Icons.close_rounded,
            color: colors.error,
            tooltip: l10n.reservationReject,
            busy: working,
            onTap: () => _decide(context, approve: false),
          ),
          DvSquareAction(
            key: Key('reservation-approve-${row.id}'),
            icon: Icons.check_rounded,
            gold: true,
            tooltip: l10n.reservationApprove,
            busy: working,
            onTap: () => _decide(context, approve: true),
          ),
        ] else if (row.status == 'APPROVED' && row.bookingSettled && role == AppRole.admin && route == '/reservations')
          DvSquareAction(
            key: Key('reservation-convert-${row.id}'),
            icon: Icons.description_rounded,
            gold: true,
            tooltip: l10n.rvConvert,
            onTap: () => context.push('/reservations/${row.id}/convert'),
          ),
      ],
    );
  }
}

/// The state, the project and (for whoever sees the team) the consultant,
/// in the filter sheet's look.
class ReservationsFilterSheet extends StatefulWidget {
  const ReservationsFilterSheet({
    super.key,
    required this.query,
    required this.onApply,
    required this.count,
    required this.repository,
    this.counts,
    this.consultants = false,
  });
  final ReservationsQuery query;
  final ReservationsCounts? counts;
  final bool consultants;
  final ReservationsViewRepository repository;
  final Future<void> Function(ReservationsQuery) onApply;
  final Future<int?> Function(ReservationsQuery) count;

  @override
  State<ReservationsFilterSheet> createState() => _ReservationsFilterSheetState();
}

class _ReservationsFilterSheetState extends State<ReservationsFilterSheet> with FilterCounting {
  late String? _filter = widget.query.filter;
  late String? _project = widget.query.projectId;
  late String? _sales = widget.query.salesId;
  List<(String, String)> _projects = const [];
  List<(String, String)> _people = const [];

  ReservationsQuery get _draft => ReservationsQuery(filter: _filter, projectId: _project, salesId: _sales, search: widget.query.search);

  @override
  Future<int?> countDraft() => widget.count(_draft);

  @override
  void initState() {
    super.initState();
    recount();
    widget.repository.options(consultants: widget.consultants).then((o) {
      if (!mounted) return;
      setState(() {
        _projects = o.$1;
        _people = o.$2;
      });
    });
  }

  void _set(VoidCallback f) {
    setState(f);
    recount();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final c = widget.counts;
    String? n(int? v) => v == null ? null : (v == 0 ? l10n.fsNone : l10n.rvCountN(v));
    return FilterSheet(
      title: l10n.rvFilters,
      active: [_filter, _project, _sales].where((v) => v != null).length,
      applyKey: const Key('reservations-apply'),
      applyLabel: shown == null ? l10n.cuApply : l10n.rvShowN(shown!),
      onClear: () => _set(() {
        _filter = null;
        _project = null;
        _sales = null;
      }),
      onApply: () {
        Navigator.of(context).pop();
        widget.onApply(_draft);
      },
      sections: [
        FilterSection(
          icon: Icons.flag_rounded,
          title: l10n.kcStatus,
          child: FilterTiles<String?>(
            keyPrefix: 'reservations-filter',
            selected: _filter,
            onSelect: (v) => _set(() => _filter = v),
            options: [
              FilterOption(null, l10n.lvAll, sub: n(c?.all), icon: Icons.bookmarks_rounded, color: AppPalette.navy),
              FilterOption('PENDING', l10n.rvPillPending, sub: n(c?.of('PENDING')), icon: Icons.hourglass_top_rounded, color: catalogReserved, empty: c?.of('PENDING') == 0),
              FilterOption('APPROVED', l10n.rvPillApproved, sub: n(c?.of('APPROVED')), icon: Icons.verified_rounded, color: catalogAvailable, empty: c?.of('APPROVED') == 0),
              FilterOption('CONVERTED', l10n.rvPillConverted, sub: n(c?.of('CONVERTED')), icon: Icons.description_rounded, color: AppPalette.gold600, empty: c?.of('CONVERTED') == 0),
              FilterOption('CLOSED', l10n.rvPillClosed, sub: n(c?.closed), icon: Icons.block_rounded, color: const Color(0xFF6B6256), empty: c?.closed == 0),
            ],
          ),
        ),
        if (_projects.isNotEmpty)
          FilterSection(
            icon: Icons.apartment_rounded,
            title: l10n.cuProject,
            child: FilterRadioList<String?>(
              keyPrefix: 'reservations-project',
              selected: _project,
              onSelect: (v) => _set(() => _project = v),
              options: [FilterOption(null, l10n.cuAllProjects), for (final (id, name) in _projects) FilterOption(id, name)],
            ),
          ),
        if (_people.isNotEmpty)
          FilterSection(
            icon: Icons.badge_rounded,
            title: l10n.rvConsultant,
            child: FilterRadioList<String?>(
              keyPrefix: 'reservations-sales',
              selected: _sales,
              onSelect: (v) => _set(() => _sales = v),
              options: [FilterOption(null, l10n.rvAllConsultants), for (final (id, name) in _people) FilterOption(id, name)],
            ),
          ),
      ],
    );
  }
}
