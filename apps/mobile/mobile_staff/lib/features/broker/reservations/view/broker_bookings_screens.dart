import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/staff_list_skeleton.dart';
import '../../../contracts/view/contract_page_screen.dart' show ContractParty;
import '../../../contracts/view/contracts_list_screen.dart' show contractMoney;
import '../../../reservations/view/reservation_page_screen.dart';
import '../../../reservations/view/reservations_list_screen.dart' show ReservationCardView;
import 'broker_bookings_data.dart';

/// The broker's bookings tab (owner-approved design r4, 2026-11-04), as the
/// portal's bookings page: how many, how many became contracts, the
/// commission on them; all / under review / approved / converted; a card
/// each with the booking amount and the broker's commission (when the
/// agent may see money) or the plan. A new booking from the hero.
class BrokerBookingsScreen extends StatefulWidget {
  const BrokerBookingsScreen({super.key});

  @override
  State<BrokerBookingsScreen> createState() => _BrokerBookingsScreenState();
}

class _BrokerBookingsScreenState extends State<BrokerBookingsScreen> {
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<BrokerBookingsCubit>().load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _new() async {
    final created = await context.push<bool>('/broker/reservations/new');
    if (created == true && mounted) await context.read<BrokerBookingsCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<BrokerBookingsCubit>();
    final currency = PriceFormatter.symbol(Localizations.localeOf(context).languageCode);
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BlocBuilder<BrokerBookingsCubit, BrokerBookingsState>(
          builder: (context, state) {
            final all = state.all;
            final ready = state.data.status == DataStatus.success || state.data.status == DataStatus.empty;
            final shown = state.shown;
            final commission = homeCompact(state.commission, l10n);
            return RefreshIndicator(
              onRefresh: cubit.load,
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverToBoxAdapter(
                    child: HomeListHero(
                      title: l10n.navReservations,
                      subtitle: ready ? l10n.rvCountN(all.length) : null,
                      actions: [HomeHeroButton(key: const Key('broker-bookings-new'), icon: Icons.bookmark_add_rounded, tooltip: l10n.rvNew, onTap: _new)],
                      bottom: HomeSearchField(
                        controller: _search,
                        hint: l10n.rbSearchHint,
                        onSubmitted: cubit.setSearch,
                        onClear: () {
                          _search.clear();
                          cubit.setSearch('');
                        },
                      ),
                    ),
                  ),
                  if (ready && all.isNotEmpty) ...[
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 0),
                        child: HomeBand(figures: [
                          HomeFigure(id: 'all', value: '${all.length}', label: l10n.navReservations, hint: l10n.rbFromClients),
                          HomeFigure(
                            id: 'converted',
                            value: '${state.converted}',
                            label: l10n.rbConvertedHint,
                            hint: state.converted == all.length ? l10n.rbAll : l10n.rvOutOf(l10n.rvCountN(all.length)),
                          ),
                          if (state.hasCommission)
                            HomeFigure(id: 'commission', value: commission.$1, label: l10n.rbCommission, hint: [if (commission.$2.isNotEmpty) commission.$2, currency].join(' '))
                          else
                            HomeFigure(id: 'pending', value: '${state.count('PENDING')}', label: l10n.rvUnderReview, hint: l10n.rvStPending, warn: state.count('PENDING') > 0),
                        ]),
                      ),
                    ),
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 14),
                        child: HomePills(pills: [
                          HomePill(id: 'all', label: l10n.lvAll, count: all.length, selected: state.filter == null, onTap: () => cubit.setFilter(null)),
                          HomePill(
                            id: 'PENDING',
                            label: l10n.rvPillPending,
                            count: state.count('PENDING'),
                            dot: catalogReserved,
                            selected: state.filter == 'PENDING',
                            onTap: () => cubit.setFilter('PENDING'),
                          ),
                          HomePill(
                            id: 'APPROVED',
                            label: l10n.rvPillApproved,
                            count: state.count('APPROVED'),
                            dot: catalogAvailable,
                            selected: state.filter == 'APPROVED',
                            onTap: () => cubit.setFilter('APPROVED'),
                          ),
                          HomePill(
                            id: 'CONVERTED',
                            label: l10n.rvPillConverted,
                            count: state.converted,
                            dot: AppPalette.gold500,
                            selected: state.filter == 'CONVERTED',
                            onTap: () => cubit.setFilter('CONVERTED'),
                          ),
                        ]),
                      ),
                    ),
                  ],
                  ...switch (state.data.status) {
                    DataStatus.initial || DataStatus.loading => [const SliverToBoxAdapter(child: SizedBox(height: 600, child: StaffListSkeleton()))],
                    DataStatus.failure => [SliverToBoxAdapter(child: ErrorState(failure: state.data.failure, onRetry: cubit.load))],
                    DataStatus.empty => [
                        SliverToBoxAdapter(child: EmptyState(icon: Icons.bookmark_rounded, title: l10n.rbEmpty, message: l10n.rbEmptyMessage)),
                      ],
                    DataStatus.success when shown.isEmpty => [
                        SliverToBoxAdapter(child: EmptyState(icon: Icons.filter_list_off_rounded, title: l10n.kcNoMatch)),
                      ],
                    DataStatus.success => [
                        SliverPadding(
                          padding: const EdgeInsets.fromLTRB(AppSpacing.md, 12, AppSpacing.md, 0),
                          sliver: SliverList.separated(
                            itemCount: shown.length,
                            separatorBuilder: (_, _) => const SizedBox(height: 10),
                            itemBuilder: (context, i) {
                              final b = shown[i];
                              final c = b.commission;
                              return ReservationCardView(
                                row: b.row,
                                route: '/broker/reservations',
                                showConsultant: false,
                                extraMini: c?.amount == null
                                    ? null
                                    : (l10n.rbCommission, contractMoney(c!.amount!)),
                              );
                            },
                          ),
                        ),
                      ],
                  },
                  // Clear of the floating navigation bar.
                  SliverPadding(padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 110)),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

/// A booking as the broker sees it (owner-approved design r5): the booking
/// amount, the commission locked on it, the journey, the contract it
/// became, the client to call, the unit and the plan.
class BrokerBookingScreen extends StatefulWidget {
  const BrokerBookingScreen({super.key});

  @override
  State<BrokerBookingScreen> createState() => _BrokerBookingScreenState();
}

class _BrokerBookingScreenState extends State<BrokerBookingScreen> {
  @override
  void initState() {
    super.initState();
    context.read<BrokerBookingCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BlocBuilder<BrokerBookingCubit, DataState<BrokerBookingPage>>(
          builder: (context, state) {
            final b = state.data;
            if (b == null) {
              return Column(children: [
                const HomeListHero(title: '', back: true),
                Expanded(
                  child: state.status == DataStatus.failure
                      ? ErrorState(failure: state.failure, onRetry: context.read<BrokerBookingCubit>().load)
                      : const Center(child: CircularProgressIndicator()),
                ),
              ]);
            }
            final p = b.page;
            final r = p.row;
            final lang = Localizations.localeOf(context).languageCode;
            final c = b.commission;
            return RefreshIndicator(
              onRefresh: context.read<BrokerBookingCubit>().load,
              child: ListView(padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 24), children: [
                HomeOverlap(
                  overlap: 44,
                  top: ReservationHeader(page: p),
                  bottom: ReservationBookingCard(
                    page: p,
                    extra: c == null
                        ? null
                        : Row(key: const Key('broker-booking-commission'), children: [
                            _Tile(
                              c.pct == null ? l10n.rbCommission : l10n.rbCommissionPct(ltr('${c.pct!.toStringAsFixed(c.pct! % 1 == 0 ? 0 : 1)}%')),
                              c.amount == null ? '—' : contractMoney(c.amount!),
                            ),
                            if ((r.salesName ?? '').isNotEmpty) ...[const SizedBox(width: 8), _Tile(l10n.rvConsultant, r.salesName!, small: true)],
                          ]),
                  ),
                ),
                if (b.contractId != null)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 0),
                    child: ReservationLinkCard(
                      key: const Key('broker-booking-contract'),
                      icon: Icons.description_rounded,
                      title: l10n.rvContractN(ltr(b.contractNumber ?? '')),
                      subtitle: r.convertedAt == null ? null : l10n.rvConvertedOn(DateFormatter.mediumDate(r.convertedAt!, languageCode: lang)),
                      onTap: () => context.push('/broker/contracts/${b.contractId}'),
                    ),
                  ),
                HomeSection(
                  icon: Icons.person_rounded,
                  title: l10n.kbClient,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                    decoration: homeCard(context, radius: 22),
                    child: ContractParty(label: l10n.kbClient, name: r.clientName ?? '—', phone: r.clientPhone),
                  ),
                ),
                HomeSection(
                  icon: Icons.apartment_rounded,
                  title: l10n.kbUnitProject,
                  child: ReservationPlan(page: p),
                ),
              ]),
            );
          },
        ),
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile(this.label, this.value, {this.small = false});
  final String label;
  final String value;
  final bool small;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(color: homeTint(context), border: Border.all(color: homeTintBorder(context)), borderRadius: BorderRadius.circular(14)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
          Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: small ? TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: colors.inkStrong) : homeDisplay(15, colors.inkStrong)),
        ]),
      ),
    );
  }
}
