import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../common/staff_list_skeleton.dart';
import '../../catalog/kit/catalog_kit.dart';
import '../../catalog/units_list/units_list_screen.dart';
import '../../dashboard/home_kit/filter_kit.dart';
import '../../dashboard/home_kit/home_kit.dart';
import 'contracts_data.dart';

/// The contracts list (owner-approved design, 2026-11-04), as the website's
/// contracts page: the contracts, the signed and the unsigned ones over
/// everything the user may see; filters by signature, late delivery and
/// source; and on each card the client, the number and where it came from,
/// the project and unit, the value, the plan and the down payment.
class ContractsListScreen extends StatefulWidget {
  const ContractsListScreen({super.key});

  @override
  State<ContractsListScreen> createState() => _ContractsListScreenState();
}

class _ContractsListScreenState extends State<ContractsListScreen> {
  final _search = TextEditingController();
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    context.read<ContractsListCubit>().load();
    _scroll.addListener(() {
      if (_scroll.position.pixels >= _scroll.position.maxScrollExtent - 300) context.read<ContractsListCubit>().loadMore();
    });
  }

  @override
  void dispose() {
    _search.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _filters() {
    final cubit = context.read<ContractsListCubit>();
    showFilterSheet(
      context,
      (_) => ContractsFilterSheet(query: cubit.state.query, counts: cubit.state.counts, onApply: cubit.apply, count: cubit.count),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<ContractsListCubit>();
    final bottomPad = MediaQuery.paddingOf(context).bottom;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BlocBuilder<ContractsListCubit, ContractsListState>(
          builder: (context, state) {
            final c = state.counts;
            final q = state.query;
            final pct = c == null || c.all == 0 ? null : (c.signed * 100 / c.all).round();
            return RefreshIndicator(
              onRefresh: cubit.load,
              child: CustomScrollView(
                controller: _scroll,
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverToBoxAdapter(
                    child: HomeListHero(
                      title: l10n.navContracts,
                      subtitle: c == null ? null : l10n.kcCountN(c.all),
                      back: Navigator.of(context).canPop(),
                      actions: [
                        HomeHeroButton(
                          key: const Key('contracts-filters'),
                          icon: Icons.tune_rounded,
                          dot: q.source != null || q.filter != null,
                          tooltip: l10n.kcFilters,
                          onTap: _filters,
                        ),
                      ],
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
                  if (c != null)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 0),
                        child: HomeBand(figures: [
                          HomeFigure(id: 'all', value: '${c.all}', label: l10n.kcContracts, hint: l10n.kcFromReservations),
                          HomeFigure(id: 'signed', value: '${c.signed}', label: l10n.kcSigned, hint: pct == null ? '—' : l10n.kcSignedPct(ltr('$pct%'))),
                          HomeFigure(
                            id: 'unsigned',
                            value: '${c.unsigned}',
                            label: l10n.kcUnsigned,
                            hint: c.unsigned > 0 ? l10n.kcNeedsFollow : l10n.kcAllSigned,
                            warn: c.unsigned > 0,
                          ),
                        ]),
                      ),
                    ),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: HomePills(pills: [
                        HomePill(id: 'all', label: l10n.lvAll, count: c?.all, selected: q.filter == null, onTap: () => cubit.setFilter(null)),
                        HomePill(
                          id: 'SIGNED',
                          label: l10n.kcSigned,
                          count: c?.signed,
                          dot: catalogAvailable,
                          selected: q.filter == 'SIGNED',
                          onTap: () => cubit.setFilter('SIGNED'),
                        ),
                        HomePill(
                          id: 'UNSIGNED',
                          label: l10n.kcUnsigned,
                          count: c?.unsigned,
                          dot: catalogReserved,
                          selected: q.filter == 'UNSIGNED',
                          onTap: () => cubit.setFilter('UNSIGNED'),
                        ),
                        HomePill(
                          id: 'DELAYED',
                          label: l10n.kcDelayed,
                          count: c?.delayed,
                          dot: context.appColors.error,
                          selected: q.filter == 'DELAYED',
                          onTap: () => cubit.setFilter('DELAYED'),
                        ),
                      ]),
                    ),
                  ),
                  if (q.source != null)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(AppSpacing.md, 8, AppSpacing.md, 0),
                        child: Align(
                          alignment: AlignmentDirectional.centerStart,
                          child: UnitsActiveChip(
                            key: const Key('contracts-chip-source'),
                            icon: Icons.source_rounded,
                            label: q.source == 'MANUAL' ? l10n.kcManual : l10n.kcFromReservationShort,
                            onRemove: () => cubit.setSource(null),
                          ),
                        ),
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

  List<Widget> _body(BuildContext context, ContractsListState state) {
    final l10n = context.l10n;
    switch (state.status) {
      case DataStatus.initial:
      case DataStatus.loading:
        return const [SliverToBoxAdapter(child: SizedBox(height: 600, child: StaffListSkeleton()))];
      case DataStatus.failure:
        return [SliverToBoxAdapter(child: ErrorState(failure: state.failure, onRetry: context.read<ContractsListCubit>().load))];
      case DataStatus.empty:
        final filtered = state.query != const ContractsQuery();
        return [
          SliverToBoxAdapter(
            child: filtered
                ? EmptyState(icon: Icons.filter_list_off_rounded, title: l10n.kcNoMatch)
                : EmptyState(icon: Icons.description_rounded, title: l10n.kcEmpty, message: l10n.kcEmptyMessage),
          ),
        ];
      case DataStatus.success:
        return [
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(AppSpacing.md, 12, AppSpacing.md, 0),
            sliver: SliverList.separated(
              itemCount: state.rows.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (context, i) => ContractCardView(row: state.rows[i]),
            ),
          ),
        ];
    }
  }
}

/// The contract's signature state as a small badge.
Widget contractBadge(AppLocalizations l10n, ContractRow r) {
  if (r.cancelled) return CatalogBadge.status(l10n.kcCancelled, const Color(0xFFB23B3B), icon: Icons.block_rounded);
  if (r.signedAt != null) return CatalogBadge.status(l10n.kcSignedOne, catalogAvailable, icon: Icons.verified_rounded);
  return CatalogBadge.status(l10n.kcUnsigned, catalogReserved, icon: Icons.draw_rounded);
}

String contractMoney(num v) => ltr(catalogGrouped(v));

/// One contract: the client and the badge; the number and its source; the
/// project and unit; the value and the plan; the down payment.
class ContractCardView extends StatelessWidget {
  const ContractCardView({super.key, required this.row, this.route = '/contracts', this.extraMini});
  final ContractRow row;

  /// The broker's contracts open their own page.
  final String route;

  /// A second figure instead of the plan (the broker's commission).
  final (String, String)? extraMini;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final currency = PriceFormatter.symbol(lang);
    final source = row.reservationNumber == null ? l10n.kcManual : l10n.kcFromReservation(ltr(row.reservationNumber!));
    final where = [if ((row.projectName ?? '').isNotEmpty) row.projectName!, if ((row.unitCode ?? '').isNotEmpty) ltr(row.unitCode!)].join(' · ');
    Widget mini(String k, String v) => Expanded(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
            decoration: BoxDecoration(color: colors.surfaceSoft, borderRadius: BorderRadius.circular(12)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(k, style: TextStyle(fontSize: 10, color: colors.inkMuted)),
              Text(v, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: colors.inkStrong)),
            ]),
          ),
        );
    return Material(
      color: colors.surface,
      borderRadius: BorderRadius.circular(22),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        key: Key('contract-card-${row.id}'),
        onTap: () => context.push('$route/${row.id}'),
        child: DecoratedBox(
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(22), border: Border.all(color: colors.hairline)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Container(
                  width: 44,
                  height: 44,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(gradient: homeNavyGradient, borderRadius: BorderRadius.circular(14)),
                  child: Text(homeInitials(row.customerName), style: homeDisplay(14, AppPalette.gold300)),
                ),
                const SizedBox(width: 11),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Expanded(
                        child: Text(row.customerName ?? '—',
                            maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: colors.inkStrong)),
                      ),
                      const SizedBox(width: 6),
                      contractBadge(l10n, row),
                    ]),
                    const SizedBox(height: 2),
                    Text.rich(TextSpan(children: [
                      TextSpan(text: ltr(row.displayNumber), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppPalette.gold600)),
                      TextSpan(text: ' · $source', style: TextStyle(fontSize: 11.5, color: colors.inkMuted)),
                    ])),
                    if (where.isNotEmpty)
                      Row(children: [
                        Icon(Icons.apartment_rounded, size: 13, color: colors.inkMuted),
                        const SizedBox(width: 3),
                        Expanded(child: Text(where, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11.5, color: colors.inkMuted))),
                      ]),
                  ]),
                ),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
              child: Row(children: [
                mini(l10n.kcValue, row.total == null ? '—' : '${contractMoney(row.total!)} $currency'),
                const SizedBox(width: 6),
                extraMini == null
                    ? mini(
                        l10n.kcPlan,
                        row.planMonths == null
                            ? l10n.kcNoPlan
                            : l10n.kcPlanLine(row.planMonths!, row.planMonthly == null ? '—' : contractMoney(row.planMonthly!)),
                      )
                    : mini(extraMini!.$1, extraMini!.$2),
              ]),
            ),
            if ((row.downPayment ?? 0) > 0 || row.signedAt != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(color: colors.surfaceSoft.withValues(alpha: 0.6), border: Border(top: BorderSide(color: colors.hairline))),
                child: Row(children: [
                  if (row.signedAt != null)
                    Expanded(
                      child: Text(l10n.kcSignedOn(DateFormatter.dayMonth(row.signedAt!, languageCode: lang)),
                          style: TextStyle(fontSize: 11, color: colors.inkMuted)),
                    )
                  else
                    const Spacer(),
                  if ((row.downPayment ?? 0) > 0)
                    Text(l10n.kcDown(contractMoney(row.downPayment!)),
                        style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: AppPalette.gold600)),
                ]),
              ),
          ]),
        ),
      ),
    );
  }
}


/// The status (with each one's count) and the source, as the website's
/// contracts filters, in the filter sheet's look.
class ContractsFilterSheet extends StatefulWidget {
  const ContractsFilterSheet({super.key, required this.query, required this.onApply, required this.count, this.counts});
  final ContractsQuery query;
  final ContractsCounts? counts;
  final Future<void> Function(ContractsQuery) onApply;

  /// How many contracts a choice gives.
  final Future<int?> Function(ContractsQuery) count;

  @override
  State<ContractsFilterSheet> createState() => _ContractsFilterSheetState();
}

class _ContractsFilterSheetState extends State<ContractsFilterSheet> with FilterCounting {
  late String? _filter = widget.query.filter;
  late String? _source = widget.query.source;
  final _bySource = <String, int?>{};

  ContractsQuery get _draft => ContractsQuery(filter: _filter, source: _source, search: widget.query.search);

  @override
  Future<int?> countDraft() => widget.count(_draft);

  @override
  void initState() {
    super.initState();
    recount();
    for (final s in ['RESERVATION', 'MANUAL']) {
      widget.count(ContractsQuery(source: s)).then((n) {
        if (mounted) setState(() => _bySource[s] = n);
      });
    }
  }

  void _set(VoidCallback f) {
    setState(f);
    recount();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final c = widget.counts;
    String? n(int? v) => v == null ? null : (v == 0 ? l10n.fsNone : l10n.kcCountN(v));
    String? short(int? v) => v == null ? null : ltr('$v');
    return FilterSheet(
      title: l10n.kcFilters,
      active: [_filter, _source].where((v) => v != null).length,
      applyKey: const Key('contracts-apply'),
      applyLabel: shown == null ? l10n.cuApply : l10n.kcShowN(shown!),
      onClear: () => _set(() {
        _filter = null;
        _source = null;
      }),
      onApply: () {
        Navigator.of(context).pop();
        widget.onApply(_draft);
      },
      sections: [
        FilterSection(
          icon: Icons.verified_rounded,
          title: l10n.kcStatus,
          child: FilterTiles<String?>(
            keyPrefix: 'contracts-filter',
            selected: _filter,
            onSelect: (v) => _set(() => _filter = v),
            options: [
              FilterOption(null, l10n.lvAll, sub: n(c?.all), icon: Icons.description_rounded, color: AppPalette.navy),
              FilterOption('SIGNED', l10n.kcSigned, sub: n(c?.signed), icon: Icons.verified_rounded, color: catalogAvailable, empty: c?.signed == 0),
              FilterOption('UNSIGNED', l10n.kcUnsigned, sub: n(c?.unsigned), icon: Icons.draw_rounded, color: catalogReserved, empty: c?.unsigned == 0),
              FilterOption('DELAYED', l10n.kcDelayed, sub: n(c?.delayed), icon: Icons.schedule_rounded, color: context.appColors.error, empty: c?.delayed == 0),
            ],
          ),
        ),
        FilterSection(
          icon: Icons.alt_route_rounded,
          title: l10n.kcSource,
          child: FilterSegments<String?>(
            keyPrefix: 'contracts-source',
            selected: _source,
            onSelect: (v) => _set(() => _source = v),
            options: [
              FilterOption(null, l10n.cuAny, sub: short(c?.all)),
              FilterOption('RESERVATION', l10n.kcFromReservationShort, sub: short(_bySource['RESERVATION'])),
              FilterOption('MANUAL', l10n.kcManual, sub: short(_bySource['MANUAL'])),
            ],
          ),
        ),
      ],
    );
  }
}
