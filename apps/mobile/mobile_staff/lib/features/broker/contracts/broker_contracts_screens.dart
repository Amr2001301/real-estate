import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../common/broker_status_label.dart';
import '../../../common/staff_list_skeleton.dart';
import '../../contracts/view/contract_page_screen.dart' show ContractParty, KvTable;
import '../../contracts/view/contracts_list_screen.dart' show ContractCardView, contractBadge, contractMoney;
import 'broker_contracts_data.dart';

/// The broker's contracts (owner-approved design k4, 2026-11-04), as the
/// portal's contracts page: how many, how many signed, their value; all /
/// signed / unsigned; a card each with the value and the broker's
/// commission (when the agent may see money) or the plan.
class BrokerContractsScreen extends StatefulWidget {
  const BrokerContractsScreen({super.key});

  @override
  State<BrokerContractsScreen> createState() => _BrokerContractsScreenState();
}

class _BrokerContractsScreenState extends State<BrokerContractsScreen> {
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<BrokerContractsCubit>().load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<BrokerContractsCubit>();
    final currency = PriceFormatter.symbol(Localizations.localeOf(context).languageCode);
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BlocBuilder<BrokerContractsCubit, BrokerContractsState>(
          builder: (context, state) {
            final all = state.all;
            final ready = state.data.status == DataStatus.success || state.data.status == DataStatus.empty;
            final pct = all.isEmpty ? null : (state.signed * 100 / all.length).round();
            final shown = state.shown;
            return RefreshIndicator(
              onRefresh: cubit.load,
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverToBoxAdapter(
                    child: HomeListHero(
                      title: l10n.navContracts,
                      subtitle: ready ? l10n.kcCountN(all.length) : null,
                      back: Navigator.of(context).canPop(),
                      bottom: HomeSearchField(
                        controller: _search,
                        hint: l10n.kcSearchHint,
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
                          HomeFigure(id: 'all', value: '${all.length}', label: l10n.kcContracts, hint: l10n.kbFromClients),
                          HomeFigure(
                            id: 'signed',
                            value: '${state.signed}',
                            label: l10n.kcSigned,
                            hint: state.signed == all.length ? l10n.kcAllSigned : l10n.kcSignedPct(ltr('$pct%')),
                          ),
                          HomeFigure(id: 'value', value: (state.value / 1e6).toStringAsFixed(2), label: l10n.kbValueM, hint: currency),
                        ]),
                      ),
                    ),
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 14),
                        child: HomePills(pills: [
                          HomePill(id: 'all', label: l10n.lvAll, count: all.length, selected: state.filter == null, onTap: () => cubit.setFilter(null)),
                          HomePill(
                            id: 'SIGNED',
                            label: l10n.kcSigned,
                            count: state.signed,
                            dot: catalogAvailable,
                            selected: state.filter == 'SIGNED',
                            onTap: () => cubit.setFilter('SIGNED'),
                          ),
                          HomePill(
                            id: 'UNSIGNED',
                            label: l10n.kcUnsigned,
                            count: all.length - state.signed,
                            dot: catalogReserved,
                            selected: state.filter == 'UNSIGNED',
                            onTap: () => cubit.setFilter('UNSIGNED'),
                          ),
                        ]),
                      ),
                    ),
                  ],
                  ...switch (state.data.status) {
                    DataStatus.initial || DataStatus.loading => [const SliverToBoxAdapter(child: SizedBox(height: 600, child: StaffListSkeleton()))],
                    DataStatus.failure => [SliverToBoxAdapter(child: ErrorState(failure: state.data.failure, onRetry: cubit.load))],
                    DataStatus.empty => [
                        SliverToBoxAdapter(child: EmptyState(icon: Icons.description_rounded, title: l10n.kbEmpty, message: l10n.kbEmptyMessage)),
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
                              final c = shown[i];
                              final com = c.commission;
                              return ContractCardView(
                                row: c.row,
                                route: '/broker/contracts',
                                extraMini: com == null
                                    ? null
                                    : (
                                        l10n.kbYourCommission,
                                        [if (com.gross != null) contractMoney(com.gross!), brokerCommissionStatusLabel(l10n, com.status)].join(' · '),
                                      ),
                              );
                            },
                          ),
                        ),
                      ],
                  },
                  SliverPadding(padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 40)),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

/// A contract as the broker sees it (owner-approved design k5): the value
/// and down payment, the commission (rate, amount, status, net); the client
/// to call; the unit and project; the plan.
class BrokerContractScreen extends StatefulWidget {
  const BrokerContractScreen({super.key});

  @override
  State<BrokerContractScreen> createState() => _BrokerContractScreenState();
}

class _BrokerContractScreenState extends State<BrokerContractScreen> {
  @override
  void initState() {
    super.initState();
    context.read<BrokerContractCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BlocBuilder<BrokerContractCubit, DataState<BrokerContract>>(
          builder: (context, state) {
            final c = state.data;
            if (c == null) {
              return Column(children: [
                const HomeListHero(title: '', back: true),
                Expanded(
                  child: state.status == DataStatus.failure
                      ? ErrorState(failure: state.failure, onRetry: context.read<BrokerContractCubit>().load)
                      : const KitDetailSkeleton(heroHeight: 0, facts: 6),
                ),
              ]);
            }
            final lang = Localizations.localeOf(context).languageCode;
            final currency = PriceFormatter.symbol(lang);
            String day(DateTime? d) => d == null ? '—' : DateFormatter.mediumDate(d, languageCode: lang);
            String month(DateTime? d) => d == null ? '—' : DateFormatter.monthYear(d, languageCode: lang);
            final r = c.row;
            return RefreshIndicator(
              onRefresh: context.read<BrokerContractCubit>().load,
              child: ListView(padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 24), children: [
                HomeOverlap(
                  overlap: 44,
                  top: HomeListHero(
                    title: ltr(r.displayNumber),
                    subtitle: [if ((r.customerName ?? '').isNotEmpty) r.customerName!, if ((r.unitCode ?? '').isNotEmpty) ltr(r.unitCode!)].join(' · '),
                    back: true,
                    bottom: Padding(
                      padding: const EdgeInsets.only(bottom: 48),
                      child: Wrap(children: [
                        r.signedAt != null && !r.cancelled
                            ? CatalogBadge.status(l10n.kcSignedOn(DateFormatter.dayMonth(r.signedAt!, languageCode: lang)), catalogAvailable,
                                icon: Icons.verified_rounded)
                            : contractBadge(l10n, r),
                      ]),
                    ),
                  ),
                  bottom: _Figures(contract: c, currency: currency),
                ),
                HomeSection(
                  icon: Icons.person_rounded,
                  title: l10n.kbClient,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                    decoration: homeCard(context, radius: 22),
                    child: ContractParty(label: l10n.kbClient, name: r.customerName ?? '—', phone: r.customerPhone),
                  ),
                ),
                HomeSection(
                  icon: Icons.apartment_rounded,
                  title: l10n.kbUnitProject,
                  child: KvTable(rows: [
                    (l10n.cvUnit, r.unitCode == null ? '—' : ltr(r.unitCode!)),
                    (l10n.kbType, c.unitType == null ? '—' : unitTypeLabel(c.unitType, languageCode: lang)),
                    (l10n.kbArea, c.area == null ? '—' : l10n.kbAreaM(ltr(catalogGrouped(c.area!)))),
                    (l10n.kbBuilding, c.buildingName ?? '—'),
                    (l10n.cvProject, r.projectName ?? '—'),
                    (l10n.kbDelivery, month(c.delivery)),
                  ]),
                ),
                HomeSection(
                  icon: Icons.payments_rounded,
                  title: l10n.kbPlan,
                  child: KvTable(rows: [
                    (l10n.cvTerm, r.planMonths == null ? l10n.kcNoPlan : l10n.cvMonthsN(r.planMonths!)),
                    (l10n.kcInstallment, r.planMonthly == null ? '—' : '${contractMoney(r.planMonthly!)} $currency'),
                    (l10n.kcStarts, day(c.planStarts)),
                    (l10n.kbPayments, ltr('${c.payments}')),
                  ]),
                ),
              ]),
            );
          },
        ),
      ),
    );
  }
}

class _Figures extends StatelessWidget {
  const _Figures({required this.contract, required this.currency});
  final BrokerContract contract;
  final String currency;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final r = contract.row;
    final com = contract.commission;
    Widget tile(String k, String v, {Key? key}) => Expanded(
          child: Container(
            key: key,
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(color: homeTint(context), border: Border.all(color: homeTintBorder(context)), borderRadius: BorderRadius.circular(14)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(k, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
              Text(v, maxLines: 1, overflow: TextOverflow.ellipsis, style: homeDisplay(15, colors.inkStrong)),
            ]),
          ),
        );
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: homeLine(context)),
        boxShadow: const [BoxShadow(color: Color(0x290E1626), blurRadius: 40, offset: Offset(0, 18))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(l10n.kcValue, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
        Text.rich(
          key: const Key('broker-contract-value'),
          TextSpan(children: [
            TextSpan(text: r.total == null ? '—' : contractMoney(r.total!), style: homeDisplay(26, colors.inkStrong)),
            TextSpan(text: ' $currency', style: TextStyle(fontSize: 13, color: colors.inkMuted)),
          ]),
        ),
        if ((r.downPayment ?? 0) > 0)
          Text(l10n.kcDown('${contractMoney(r.downPayment!)} $currency'), style: TextStyle(fontSize: 12, color: colors.inkMuted)),
        if (com != null) ...[
          const SizedBox(height: 12),
          Row(key: const Key('broker-contract-commission'), children: [
            tile(
              com.pct == null ? l10n.kbYourCommission : l10n.kbYourCommissionPct(ltr('${com.pct!.toStringAsFixed(com.pct! % 1 == 0 ? 0 : 1)}%')),
              com.gross == null ? '—' : contractMoney(com.gross!),
            ),
            const SizedBox(width: 8),
            tile(l10n.kbCommissionStatus, brokerCommissionStatusLabel(l10n, com.status)),
            const SizedBox(width: 8),
            tile(l10n.kbNet, com.net == null ? '—' : contractMoney(com.net!)),
          ]),
        ],
      ]),
    );
  }
}
