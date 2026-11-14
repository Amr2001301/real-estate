import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../common/staff_list_skeleton.dart';
import 'brokerage_data.dart';
import 'brokerage_kit.dart';

/// «الوحدات المعروضة» — the brokerage's listings: developers' units it sells
/// (primary), owners' properties for resale and for rent. Search, a kind
/// filter, then one card each; a card opens the listing.
class BxListingsScreen extends StatefulWidget {
  const BxListingsScreen({super.key, required this.repository});
  final BrokerageRepository repository;

  @override
  State<BxListingsScreen> createState() => _BxListingsScreenState();
}

class _BxListingsScreenState extends State<BxListingsScreen> {
  final _scroll = ScrollController();
  final _search = TextEditingController();
  String? _kind;
  List<BxListing> _rows = const [];
  Map<String, int> _kindCounts = const {};
  int _total = 0;
  int _page = 1;
  bool _more = false;
  bool _loading = true;
  bool _loadingMore = false;
  AppFailure? _failure;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (_more && !_loadingMore && _scroll.position.pixels >= _scroll.position.maxScrollExtent - 300) _loadMore();
    });
    _load();
  }

  @override
  void dispose() {
    _scroll.dispose();
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _failure = null;
    });
    final kind = _kind;
    final r = await widget.repository.listings(kind: kind, q: _search.text);
    if (!mounted || kind != _kind) return;
    setState(() {
      _loading = false;
      switch (r) {
        case Ok(data: final v):
          _rows = v.$1.data;
          _total = v.$1.meta.total;
          _more = v.$1.hasMore;
          _page = 1;
          // The kind counts follow the search, not the kind chosen.
          _kindCounts = v.$2['kind'] ?? const {};
        case Err(failure: final f):
          _failure = f;
          _rows = const [];
      }
    });
  }

  Future<void> _loadMore() async {
    setState(() => _loadingMore = true);
    final r = await widget.repository.listings(kind: _kind, q: _search.text, page: _page + 1);
    if (!mounted) return;
    setState(() {
      _loadingMore = false;
      if (r case Ok(data: final v)) {
        _rows = [..._rows, ...v.$1.data];
        _more = v.$1.hasMore;
        _page++;
      }
    });
  }

  void _setKind(String? k) {
    if (_kind == k) return;
    setState(() => _kind = k);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final all = _kindCounts.values.fold<int>(0, (a, b) => a + b);
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            key: const Key('bx-listings'),
            controller: _scroll,
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 24),
            children: [
              HomeListHero(
                back: true,
                title: l10n.bxListingsTitle,
                subtitle: _loading ? null : l10n.bxListingsCount(_total),
                bottom: HomeSearchField(
                  controller: _search,
                  hint: l10n.bxSearchListings,
                  onSubmitted: (_) => _load(),
                  onClear: () {
                    _search.clear();
                    _load();
                  },
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 14),
                child: HomePills(pills: [
                  HomePill(id: 'all', label: l10n.bxAll, count: _kindCounts.isEmpty ? null : all, selected: _kind == null, onTap: () => _setKind(null)),
                  for (final k in kListingKinds)
                    HomePill(id: k, label: bxKind(l10n, k), count: _kindCounts[k], selected: _kind == k, onTap: () => _setKind(k)),
                ]),
              ),
              if (_loading)
                const SizedBox(height: 520, child: StaffListSkeleton())
              else if (_failure != null)
                ErrorState(failure: _failure, onRetry: _load)
              else if (_rows.isEmpty)
                EmptyState(icon: Icons.home_work_outlined, title: l10n.bxListingsEmpty, message: l10n.bxListingsEmptyHint)
              else
                Padding(
                  padding: const EdgeInsets.fromLTRB(AppSpacing.md, 12, AppSpacing.md, 0),
                  child: Column(children: [
                    for (final r in _rows) ...[
                      BxListingCard(listing: r, onTap: () => context.push('/bx/listings/${r.id}', extra: r)),
                      const SizedBox(height: 10),
                    ],
                    if (_loadingMore) const Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()),
                  ]),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

IconData bxKindIcon(String kind) => switch (kind) {
      'RENT' => Icons.key_rounded,
      'RESALE' => Icons.sell_rounded,
      _ => Icons.apartment_rounded,
    };

/// One listing: its title and price; the code, kind and place; size, rooms
/// and state; the agent at the foot.
class BxListingCard extends StatelessWidget {
  const BxListingCard({super.key, required this.listing, required this.onTap});
  final BxListing listing;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final x = listing;
    final tone = bxListingColor(x.status, colors);
    final specs = [
      '${ltr(catalogGrouped(x.area))} ${l10n.bxSqm}',
      if (x.bedrooms != null) '${ltr('${x.bedrooms}')} ${l10n.bxBedrooms}',
      if (x.bathrooms != null) '${ltr('${x.bathrooms}')} ${l10n.bxBathrooms}',
    ].join(' · ');
    return BxCard(
      key: ValueKey('bx-listing-${x.id}'),
      onTap: onTap,
      footer: Row(children: [
        Icon(Icons.person_outline_rounded, size: 15, color: colors.inkMuted),
        const SizedBox(width: 5),
        Expanded(child: Text(x.agentName ?? l10n.bxNoAgent, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: colors.inkMuted))),
        Icon(Icons.chevron_right_rounded, size: 18, color: colors.inkMuted),
      ]),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        BxIconTile(bxKindIcon(x.kind), AppPalette.gold500),
        const SizedBox(width: 11),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(x.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: colors.inkStrong, height: 1.3)),
            const SizedBox(height: 3),
            Text.rich(
              TextSpan(children: [
                TextSpan(text: ltr(x.code), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppPalette.gold600)),
                TextSpan(text: ' · ${bxKind(l10n, x.kind)}', style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                if (x.place.isNotEmpty) TextSpan(text: ' · ${x.place}', style: TextStyle(fontSize: 12, color: colors.inkMuted)),
              ]),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 6),
            Text(specs, style: TextStyle(fontSize: 12, color: colors.ink)),
            const SizedBox(height: 7),
            Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
              CatalogBadge.status(bxListingStatus(l10n, x.status, kind: x.kind), tone),
              const Spacer(),
              Flexible(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: AlignmentDirectional.centerEnd,
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    BxAmount(x.price, size: 17),
                    if (x.kind == 'RENT') Text(' ${l10n.bxPerMonth}', style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                  ]),
                ),
              ),
            ]),
          ]),
        ),
      ]),
    );
  }
}

/// One listing: what and where, its price, its facts, the owner (for resale
/// and rent) with a call button, and who handles it.
class BxListingScreen extends StatefulWidget {
  const BxListingScreen({super.key, required this.repository, required this.id, this.row});
  final BrokerageRepository repository;
  final String id;
  final BxListing? row;

  @override
  State<BxListingScreen> createState() => _BxListingScreenState();
}

class _BxListingScreenState extends State<BxListingScreen> {
  late BxListing? _x = widget.row;
  AppFailure? _failure;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final r = await widget.repository.listing(widget.id);
    if (!mounted) return;
    setState(() {
      switch (r) {
        case Ok(data: final v):
          _x = v;
          _failure = null;
        case Err(failure: final f):
          _failure = f;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final x = _x;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: colors.canvas,
        body: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            key: const Key('bx-listing'),
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 24),
            children: [
              HomeListHero(back: true, title: x?.title ?? l10n.bxListingsTitle, subtitle: x == null ? null : '${ltr(x.code)} · ${bxKind(l10n, x.kind)}'),
              if (x == null && _failure != null)
                ErrorState(failure: _failure, onRetry: _load)
              else if (x == null)
                const SizedBox(height: 420, child: StaffListSkeleton(rows: 3))
              else ...[
                Padding(
                  padding: const EdgeInsets.fromLTRB(AppSpacing.md, 16, AppSpacing.md, 0),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: homeCard(context, radius: 24),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        CatalogBadge.status(bxListingStatus(l10n, x.status, kind: x.kind), bxListingColor(x.status, colors)),
                        const Spacer(),
                        Text(x.kind == 'RENT' ? l10n.bxRentPerMonth : l10n.bxPrice, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                      ]),
                      const SizedBox(height: 10),
                      if (x.place.isNotEmpty)
                        Row(children: [
                          Icon(Icons.place_outlined, size: 16, color: AppPalette.gold500),
                          const SizedBox(width: 5),
                          Expanded(child: Text(x.place, style: TextStyle(fontSize: 13, color: colors.ink))),
                        ]),
                      const SizedBox(height: 8),
                      Align(alignment: AlignmentDirectional.centerEnd, child: FittedBox(fit: BoxFit.scaleDown, child: BxAmount(x.price, size: 26))),
                    ]),
                  ),
                ),
                HomeSection(
                  icon: Icons.fact_check_outlined,
                  title: l10n.bxFacts,
                  child: BxFacts(rows: [
                    BxFactRow(l10n.bxArea, '${ltr(catalogGrouped(x.area))} ${l10n.bxSqm}'),
                    if (x.unitType != null) BxFactRow(l10n.bxUnitType, x.unitType!),
                    if (x.bedrooms != null) BxFactRow(l10n.bxBedrooms, ltr('${x.bedrooms}')),
                    if (x.bathrooms != null) BxFactRow(l10n.bxBathrooms, ltr('${x.bathrooms}')),
                    if (x.floor != null) BxFactRow(l10n.bxFloor, ltr('${x.floor}')),
                    if (x.finishing != null) BxFactRow(l10n.bxFinishing, x.finishing!),
                    if (x.view != null) BxFactRow(l10n.bxView, x.view!),
                    if (x.developerName != null) BxFactRow(l10n.bxDeveloper, x.developerName!),
                    if (x.projectName != null) BxFactRow(l10n.bxProject, x.projectName!),
                    if (x.downPayment != null) BxFactRow(l10n.bxDownPayment, '${bxMoney(x.downPayment!)} ${bxCurrency(context)}'),
                    if (x.deliveryDate != null) BxFactRow(l10n.bxDelivery, bxDate(context, x.deliveryDate)),
                    BxFactRow(l10n.bxAgent, x.agentName ?? l10n.bxNoAgent),
                  ]),
                ),
                if (x.ownerName != null || x.ownerPhone != null)
                  HomeSection(
                    icon: Icons.person_pin_rounded,
                    title: l10n.bxOwner,
                    child: BxPersonCard(name: x.ownerName ?? '—', phone: x.ownerPhone),
                  ),
                if (x.description != null)
                  HomeSection(
                    icon: Icons.notes_rounded,
                    title: l10n.bxDescription,
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: homeCard(context),
                      child: Text(x.description!, style: TextStyle(fontSize: 13.5, height: 1.6, color: colors.ink)),
                    ),
                  ),
                const BxWebNote(),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// A name and phone with a call button (the listing's owner, a deal's customer).
class BxPersonCard extends StatelessWidget {
  const BxPersonCard({super.key, required this.name, this.phone});
  final String name;
  final String? phone;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: homeCard(context),
      child: Row(children: [
        BxIconTile(Icons.person_rounded, AppPalette.gold500, size: 40),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(name, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: colors.inkStrong)),
            if (phone != null) Text(ltr(phone!), style: TextStyle(fontSize: 12.5, color: colors.inkMuted)),
          ]),
        ),
        if (phone != null)
          IconButton.filledTonal(
            tooltip: context.l10n.bxCall,
            onPressed: () => ContactActions.call(phone!),
            icon: const Icon(Icons.call_rounded, size: 20),
          ),
      ]),
    );
  }
}
