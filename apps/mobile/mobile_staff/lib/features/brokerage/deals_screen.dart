import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../common/staff_list_skeleton.dart';
import 'brokerage_data.dart';
import 'brokerage_kit.dart';
import 'listings_screen.dart' show BxPersonCard, bxKindIcon;

/// «الصفقات» — the deals the caller may see (a rep their own, a manager the
/// team's, the admin all): the commission over them and what is collected,
/// then one card a deal.
class BxDealsScreen extends StatefulWidget {
  const BxDealsScreen({super.key, required this.repository});
  final BrokerageRepository repository;

  @override
  State<BxDealsScreen> createState() => _BxDealsScreenState();
}

class _BxDealsScreenState extends State<BxDealsScreen> {
  final _scroll = ScrollController();
  final _search = TextEditingController();
  String? _kind;
  BxDealsPage? _head;
  List<BxDeal> _rows = const [];
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
    final r = await widget.repository.deals(kind: kind, q: _search.text);
    if (!mounted || kind != _kind) return;
    setState(() {
      _loading = false;
      switch (r) {
        case Ok(data: final v):
          _head = v;
          _rows = v.page.data;
          _more = v.page.hasMore;
          _page = 1;
        case Err(failure: final f):
          _failure = f;
          _rows = const [];
      }
    });
  }

  Future<void> _loadMore() async {
    setState(() => _loadingMore = true);
    final r = await widget.repository.deals(kind: _kind, q: _search.text, page: _page + 1);
    if (!mounted) return;
    setState(() {
      _loadingMore = false;
      if (r case Ok(data: final v)) {
        _rows = [..._rows, ...v.page.data];
        _more = v.page.hasMore;
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
    final head = _head;
    final kindCounts = head?.counts['kind'] ?? const <String, int>{};
    final all = kindCounts.values.fold<int>(0, (a, b) => a + b);
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            key: const Key('bx-deals'),
            controller: _scroll,
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 24),
            children: [
              HomeListHero(
                back: true,
                title: l10n.bxDealsTitle,
                subtitle: _loading || head == null ? null : l10n.bxDealsCount(head.page.meta.total),
                bottom: HomeSearchField(
                  controller: _search,
                  hint: l10n.bxSearchDeals,
                  onSubmitted: (_) => _load(),
                  onClear: () {
                    _search.clear();
                    _load();
                  },
                ),
              ),
              if (head != null && !_loading && _failure == null && _rows.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 0),
                  child: _CommissionBand(commission: head.commission, received: head.received, outstanding: head.outstanding),
                ),
              Padding(
                padding: const EdgeInsets.only(top: 14),
                child: HomePills(pills: [
                  HomePill(id: 'all', label: l10n.bxAll, count: kindCounts.isEmpty ? null : all, selected: _kind == null, onTap: () => _setKind(null)),
                  for (final k in kListingKinds)
                    HomePill(id: k, label: bxKind(l10n, k), count: kindCounts[k], selected: _kind == k, onTap: () => _setKind(k)),
                ]),
              ),
              if (_loading)
                const SizedBox(height: 520, child: StaffListSkeleton())
              else if (_failure != null)
                ErrorState(failure: _failure, onRetry: _load)
              else if (_rows.isEmpty)
                EmptyState(icon: Icons.handshake_outlined, title: l10n.bxDealsEmpty, message: l10n.bxDealsEmptyHint)
              else
                Padding(
                  padding: const EdgeInsets.fromLTRB(AppSpacing.md, 12, AppSpacing.md, 0),
                  child: Column(children: [
                    for (final d in _rows) ...[
                      BxDealCard(deal: d, onTap: () => context.push('/bx/deals/${d.id}', extra: d)),
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

/// The commission over the deals shown, what is collected, what is left.
class _CommissionBand extends StatelessWidget {
  const _CommissionBand({required this.commission, required this.received, required this.outstanding});
  final double commission;
  final double received;
  final double outstanding;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final (c, cu) = homeCompact(commission, l10n);
    final (r, ru) = homeCompact(received, l10n);
    final (o, ou) = homeCompact(outstanding, l10n);
    final pct = commission > 0 ? (received / commission * 100).round() : 0;
    String withUnit(String v, String u) => u.isEmpty ? v : '$v $u';
    return HomeBand(figures: [
      HomeFigure(id: 'commission', value: withUnit(c, cu), label: l10n.bxCommission, hint: bxCurrency(context)),
      HomeFigure(id: 'received', value: withUnit(r, ru), label: l10n.bxReceived, hint: l10n.bxCollectedPct(pct)),
      HomeFigure(id: 'outstanding', value: withUnit(o, ou), label: l10n.bxOutstanding, hint: bxCurrency(context), warn: outstanding > 0),
    ]);
  }
}

/// One deal: the customer and the commission; the code, kind and listing;
/// the state, how much is collected, and the close day and agent.
class BxDealCard extends StatelessWidget {
  const BxDealCard({super.key, required this.deal, required this.onTap});
  final BxDeal deal;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final d = deal;
    final cancelled = d.status == 'CANCELLED';
    final collected = d.commissionTotal > 0 ? d.commissionReceived / d.commissionTotal : 0.0;
    return BxCard(
      key: ValueKey('bx-deal-${d.id}'),
      onTap: onTap,
      footer: Row(children: [
        Text(bxDate(context, d.closedOn), style: TextStyle(fontSize: 12, color: colors.inkMuted)),
        if (d.agentName != null) ...[
          Text(' · ', style: TextStyle(fontSize: 12, color: colors.inkMuted)),
          Expanded(child: Text(d.agentName!, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: colors.inkMuted))),
        ] else
          const Spacer(),
        Icon(Icons.chevron_right_rounded, size: 18, color: colors.inkMuted),
      ]),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        BxIconTile(bxKindIcon(d.kind), cancelled ? colors.inkMuted : AppPalette.gold500),
        const SizedBox(width: 11),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(d.customerName, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: colors.inkStrong))),
              const SizedBox(width: 6),
              BxAmount(d.commissionTotal, color: cancelled ? colors.inkMuted : null),
            ]),
            const SizedBox(height: 2),
            Text.rich(
              TextSpan(children: [
                TextSpan(text: ltr(d.code), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppPalette.gold600)),
                TextSpan(text: ' · ${bxKind(l10n, d.kind)}', style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                TextSpan(text: ' · ${d.listingTitle ?? l10n.bxNoListing}', style: TextStyle(fontSize: 12, color: colors.inkMuted)),
              ]),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 8),
            if (cancelled)
              CatalogBadge.status(bxDealStatus(l10n, d.status), colors.error)
            else ...[
              BxProgress(value: collected),
              const SizedBox(height: 5),
              Text(
                '${l10n.bxCollectedPct((collected * 100).round())} · ${l10n.bxDealValue} ${bxMoney(d.dealValue)}',
                style: TextStyle(fontSize: 12, color: colors.inkMuted),
              ),
            ],
          ]),
        ),
      ]),
    );
  }
}

/// One deal: the commission and what is collected, how it is split between
/// the agent, the manager and an outside broker, the developer's claim, and
/// the customer.
class BxDealScreen extends StatefulWidget {
  const BxDealScreen({super.key, required this.repository, required this.id, this.row});
  final BrokerageRepository repository;
  final String id;
  final BxDeal? row;

  @override
  State<BxDealScreen> createState() => _BxDealScreenState();
}

class _BxDealScreenState extends State<BxDealScreen> {
  // The list's row has no splits: show it at once, the full deal on arrival.
  late BxDeal? _d = widget.row;
  bool _full = false;
  AppFailure? _failure;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final r = await widget.repository.deal(widget.id);
    if (!mounted) return;
    setState(() {
      switch (r) {
        case Ok(data: final v):
          _d = v;
          _full = true;
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
    final d = _d;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: colors.canvas,
        body: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            key: const Key('bx-deal'),
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 24),
            children: [
              HomeListHero(back: true, title: d == null ? l10n.bxDealsTitle : ltr(d.code), subtitle: d == null ? null : '${bxKind(l10n, d.kind)} · ${bxDate(context, d.closedOn)}'),
              if (d == null && _failure != null)
                ErrorState(failure: _failure, onRetry: _load)
              else if (d == null)
                const SizedBox(height: 420, child: StaffListSkeleton(rows: 3))
              else ...[
                Padding(
                  padding: const EdgeInsets.fromLTRB(AppSpacing.md, 16, AppSpacing.md, 0),
                  child: _MoneyCard(deal: d),
                ),
                if ((_full && d.splits.isNotEmpty) || d.coBrokerName != null)
                  HomeSection(
                    icon: Icons.pie_chart_outline_rounded,
                    title: l10n.bxSplits,
                    child: Column(children: [
                      for (final s in d.splits) ...[_SplitRow(split: s, deal: d), const SizedBox(height: 8)],
                      if (d.coBrokerName != null) _CoBrokerRow(deal: d),
                    ]),
                  ),
                HomeSection(
                  icon: Icons.fact_check_outlined,
                  title: l10n.bxFacts,
                  child: BxFacts(rows: [
                    BxFactRow(l10n.bxDealValue, '${bxMoney(d.dealValue)} ${bxCurrency(context)}', strong: true),
                    BxFactRow(l10n.bxListing, d.listingTitle == null ? l10n.bxNoListing : '${d.listingTitle} · ${ltr(d.listingCode ?? '')}'),
                    BxFactRow(l10n.bxAgent, d.agentName ?? l10n.bxNoAgent),
                    BxFactRow(l10n.bxClosedOn, bxDate(context, d.closedOn)),
                    if (d.claimStatus != null)
                      BxFactRow(l10n.bxClaim, '${bxClaimStatus(l10n, d.claimStatus!)}${d.developerName != null ? ' · ${d.developerName}' : ''}',
                          valueColor: bxClaimColor(d.claimStatus!, colors)),
                    if (d.status == 'CANCELLED') BxFactRow(l10n.bxCancelReason, d.cancelReason ?? bxDealStatus(l10n, d.status), valueColor: colors.error),
                    if (d.notes != null) BxFactRow(l10n.bxNotes, d.notes!),
                  ]),
                ),
                HomeSection(icon: Icons.person_outline_rounded, title: l10n.bxCustomer, child: BxPersonCard(name: d.customerName, phone: d.customerPhone)),
                const BxWebNote(),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// The commission, the collected bar, and the state.
class _MoneyCard extends StatelessWidget {
  const _MoneyCard({required this.deal});
  final BxDeal deal;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final d = deal;
    final collected = d.commissionTotal > 0 ? d.commissionReceived / d.commissionTotal : 0.0;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: homeCard(context, radius: 24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          CatalogBadge.status(bxDealStatus(l10n, d.status), d.status == 'CANCELLED' ? colors.error : colors.success),
          const Spacer(),
          Text(l10n.bxCommission, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
        ]),
        const SizedBox(height: 8),
        Align(alignment: AlignmentDirectional.centerEnd, child: FittedBox(fit: BoxFit.scaleDown, child: BxAmount(d.commissionTotal, size: 26))),
        const SizedBox(height: 12),
        BxProgress(value: collected, height: 8),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(child: _Mini(label: l10n.bxReceived, value: d.commissionReceived, color: colors.success)),
          const SizedBox(width: 8),
          Expanded(child: _Mini(label: l10n.bxOutstanding, value: d.outstanding, color: d.outstanding > 0 ? colors.warning : colors.inkMuted)),
        ]),
      ]),
    );
  }
}

class _Mini extends StatelessWidget {
  const _Mini({required this.label, required this.value, required this.color});
  final String label;
  final double value;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(color: context.appColors.surfaceSoft, borderRadius: BorderRadius.circular(14)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: TextStyle(fontSize: 12, color: context.appColors.inkMuted)),
          const SizedBox(height: 2),
          FittedBox(fit: BoxFit.scaleDown, alignment: AlignmentDirectional.centerStart, child: BxAmount(value, size: 15, color: color)),
        ]),
      );
}

/// A staff share: who, their role and percent, the amount, and whether paid.
class _SplitRow extends StatelessWidget {
  const _SplitRow({required this.split, required this.deal});
  final BxSplit split;
  final BxDeal deal;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final s = split;
    final (state, tone) = s.paidAt != null
        ? (l10n.bxPaidOn(bxDate(context, s.paidAt)), colors.success)
        : deal.fullyCollected
            ? (l10n.bxSplitPayable, colors.warning)
            : (l10n.bxSplitAwaiting, colors.info);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: homeCard(context, radius: 18),
      child: Row(children: [
        BxIconTile(s.role == 'MANAGER' ? Icons.supervisor_account_rounded : Icons.person_rounded, homeIsDark(context) ? AppPalette.gold400 : AppPalette.navy, size: 38),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(s.userName ?? bxSplitRole(l10n, s.role), style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: colors.inkStrong)),
            Text('${bxSplitRole(l10n, s.role)} · ${l10n.bxSharePct(ltr('${_pct(s.sharePct)}%'))}', style: TextStyle(fontSize: 12, color: colors.inkMuted)),
          ]),
        ),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          BxAmount(s.amount, size: 15),
          const SizedBox(height: 3),
          CatalogBadge.status(state, tone),
        ]),
      ]),
    );
  }
}

/// The outside broker's part, taken off before the staff shares.
class _CoBrokerRow extends StatelessWidget {
  const _CoBrokerRow({required this.deal});
  final BxDeal deal;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final d = deal;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: homeTint(context), border: Border.all(color: homeTintBorder(context)), borderRadius: BorderRadius.circular(18)),
      child: Row(children: [
        BxIconTile(Icons.handshake_rounded, AppPalette.gold600, size: 38),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(d.coBrokerName!, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: colors.inkStrong)),
            Text(
              '${l10n.bxCoBroker}${d.coBrokerPct != null ? ' · ${l10n.bxSharePct(ltr('${_pct(d.coBrokerPct!)}%'))}' : ''}',
              style: TextStyle(fontSize: 12, color: colors.inkMuted),
            ),
          ]),
        ),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          BxAmount(d.coBrokerAmount, size: 15),
          const SizedBox(height: 3),
          d.coBrokerPaidAt != null
              ? CatalogBadge.status(l10n.bxPaidOn(bxDate(context, d.coBrokerPaidAt)), colors.success)
              : CatalogBadge.status(d.fullyCollected ? l10n.bxSplitPayable : l10n.bxSplitAwaiting, d.fullyCollected ? colors.warning : colors.info),
        ]),
      ]),
    );
  }
}

/// 12.5 → "12.5", 30 → "30".
String _pct(double v) => v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toStringAsFixed(1);

/// «عمولاتي» — the caller's shares of the deals' commission (a manager sees
/// the team's, the admin everyone's): what can be paid out now, what waits
/// for the developer, and what is paid.
class BxSharesScreen extends StatefulWidget {
  const BxSharesScreen({super.key, required this.repository, required this.mine});
  final BrokerageRepository repository;

  /// A rep's own shares (the title says «عمولاتي»), else the team's.
  final bool mine;

  @override
  State<BxSharesScreen> createState() => _BxSharesScreenState();
}

class _BxSharesScreenState extends State<BxSharesScreen> {
  BxShares? _data;
  AppFailure? _failure;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _failure = null;
    });
    final r = await widget.repository.shares();
    if (!mounted) return;
    setState(() {
      _loading = false;
      switch (r) {
        case Ok(data: final v):
          _data = v;
        case Err(failure: final f):
          _failure = f;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final data = _data;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: colors.canvas,
        body: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            key: const Key('bx-shares'),
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 24),
            children: [
              HomeListHero(
                back: true,
                title: widget.mine ? l10n.bxSharesMine : l10n.bxSharesTeam,
                subtitle: data == null || _loading ? null : l10n.bxSharesCount(data.rows.length),
              ),
              if (_loading && data == null)
                const SizedBox(height: 520, child: StaffListSkeleton(band: true))
              else if (_failure != null && data == null)
                ErrorState(failure: _failure, onRetry: _load)
              else if (data != null) ...[
                Padding(
                  padding: const EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 0),
                  child: HomeTiles(tiles: [
                    HomeTile(label: l10n.bxTotalPayable, value: bxMoney(data.payable), unit: bxCurrency(context)),
                    HomeTile(label: l10n.bxTotalAwaiting, value: bxMoney(data.awaitingCollection), unit: bxCurrency(context)),
                    HomeTile(label: l10n.bxTotalPaid, value: bxMoney(data.paid), unit: bxCurrency(context)),
                  ]),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(AppSpacing.md, 10, AppSpacing.md, 0),
                  child: Row(children: [
                    Icon(Icons.info_outline_rounded, size: 16, color: colors.inkMuted),
                    const SizedBox(width: 6),
                    Expanded(child: Text(l10n.bxSharesHint, style: TextStyle(fontSize: 12.5, color: colors.inkMuted))),
                  ]),
                ),
                if (data.rows.isEmpty)
                  EmptyState(icon: Icons.payments_outlined, title: l10n.bxSharesEmpty, message: l10n.bxSharesEmptyHint)
                else
                  Padding(
                    padding: const EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 0),
                    child: Column(children: [
                      for (final s in data.rows) ...[
                        _ShareCard(share: s, showName: !widget.mine, onTap: () => context.push('/bx/deals/${s.dealId}')),
                        const SizedBox(height: 10),
                      ],
                    ]),
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ShareCard extends StatelessWidget {
  const _ShareCard({required this.share, required this.showName, required this.onTap});
  final BxShare share;
  final bool showName;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final s = share;
    final (state, tone) = s.paid
        ? (l10n.bxPaidOn(bxDate(context, s.split.paidAt)), colors.success)
        : s.payable
            ? (l10n.bxSplitPayable, colors.warning)
            : (l10n.bxSplitAwaiting, colors.info);
    return BxCard(
      key: ValueKey('bx-share-${s.split.id}'),
      onTap: onTap,
      footer: Row(children: [
        Text('${bxSplitRole(l10n, s.split.role)} · ${l10n.bxSharePct(ltr('${_pct(s.split.sharePct)}%'))}', style: TextStyle(fontSize: 12, color: colors.inkMuted)),
        const Spacer(),
        Text(bxDate(context, s.closedOn), style: TextStyle(fontSize: 12, color: colors.inkMuted)),
        Icon(Icons.chevron_right_rounded, size: 18, color: colors.inkMuted),
      ]),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        BxIconTile(Icons.payments_rounded, tone),
        const SizedBox(width: 11),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(
                child: Text(showName && s.split.userName != null ? s.split.userName! : s.customerName,
                    maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: colors.inkStrong)),
              ),
              const SizedBox(width: 6),
              BxAmount(s.split.amount),
            ]),
            const SizedBox(height: 2),
            Text.rich(
              TextSpan(children: [
                TextSpan(text: ltr(s.dealCode), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppPalette.gold600)),
                if (showName) TextSpan(text: ' · ${s.customerName}', style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                TextSpan(text: ' · ${s.listingTitle ?? bxKind(l10n, s.kind)}', style: TextStyle(fontSize: 12, color: colors.inkMuted)),
              ]),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 6),
            CatalogBadge.status(state, tone),
          ]),
        ),
      ]),
    );
  }
}
