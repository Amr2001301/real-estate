import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;

import '../../common/staff_list_skeleton.dart';
import '../dashboard/home_kit/filter_kit.dart';
import '../dashboard/home_kit/home_kit.dart';
import '../leads/presentation/screens/leads_screen.dart' show leadWhen;
import '../permissions/staff_permissions.dart';
import 'broker_actions.dart';

/// The brokers' side of the company, for whoever manages it (the website's
/// «الوسطاء» pages): the firms, the leads and bookings they send, their
/// contracts, their commissions and the payouts to them. One page, a tab each,
/// each opening only for the code the API asks for.
enum BrokerTab {
  firms('/brokers', 'brokers:read', 'status', ['PENDING', 'ACTIVE', 'SUSPENDED', 'TERMINATED']),
  leads('/broker-leads', 'broker_leads:read', 'brokerApprovalStatus', ['PENDING', 'APPROVED', 'REJECTED', 'DUPLICATE', 'EXPIRED']),
  reservations('/broker-reservations', 'broker_reservations:read', 'status', ['PENDING', 'CONFIRMED', 'APPROVED', 'CONVERTED', 'CANCELLED', 'EXPIRED']),
  contracts('/broker-contracts', 'broker_contracts:read', 'signed', ['yes', 'no']),
  commissions('/broker-commissions', 'broker_commissions:read', 'status', ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']),
  payouts('/broker-payouts', 'broker_payouts:read', 'status', ['DRAFT', 'APPROVED', 'PROCESSING', 'PAID', 'CANCELLED']);

  const BrokerTab(this.path, this.code, this.filterParam, this.statuses);
  final String path;
  final String code;
  final String filterParam;
  final List<String> statuses;
}

bool canOpenBrokerTab(AppRole? role, StaffPermissions p, BrokerTab t) => role == AppRole.admin || p.has(t.code);

List<BrokerTab> brokerTabsFor(AppRole? role, StaffPermissions p) => [for (final t in BrokerTab.values) if (canOpenBrokerTab(role, p, t)) t];

String brokerTabLabel(AppLocalizations l10n, BrokerTab t) => switch (t) {
      BrokerTab.firms => l10n.brkTabFirms,
      BrokerTab.leads => l10n.brkTabLeads,
      BrokerTab.reservations => l10n.brkTabReservations,
      BrokerTab.contracts => l10n.brkTabContracts,
      BrokerTab.commissions => l10n.brkTabCommissions,
      BrokerTab.payouts => l10n.brkTabPayouts,
    };

IconData brokerTabIcon(BrokerTab t) => switch (t) {
      BrokerTab.firms => Icons.storefront_rounded,
      BrokerTab.leads => Icons.people_alt_rounded,
      BrokerTab.reservations => Icons.bookmark_added_rounded,
      BrokerTab.contracts => Icons.description_rounded,
      BrokerTab.commissions => Icons.percent_rounded,
      BrokerTab.payouts => Icons.account_balance_wallet_rounded,
    };

String brokerStatusLabel(AppLocalizations l10n, String s) => switch (s) {
      'PENDING' => l10n.brkStPending,
      'ACTIVE' => l10n.brkStActive,
      'SUSPENDED' => l10n.brkStSuspended,
      'TERMINATED' => l10n.brkStTerminated,
      'APPROVED' => l10n.brkStApproved,
      'REJECTED' => l10n.brkStRejected,
      'DUPLICATE' => l10n.brkStDuplicate,
      'EXPIRED' => l10n.brkStExpired,
      'CONFIRMED' => l10n.brkStConfirmed,
      'CONVERTED' => l10n.brkStConverted,
      'CANCELLED' => l10n.brkStCancelled,
      'DRAFT' => l10n.brkStDraft,
      'PROCESSING' => l10n.brkStProcessing,
      'PAID' => l10n.brkStPaid,
      'yes' => l10n.brkStSigned,
      'no' => l10n.brkStUnsigned,
      _ => s,
    };

Color brokerStatusColor(String s, AppColorsExt c) => switch (s) {
      'ACTIVE' || 'APPROVED' || 'CONFIRMED' || 'PAID' || 'yes' => c.success,
      'CONVERTED' => AppPalette.gold500,
      'PENDING' || 'DRAFT' || 'PROCESSING' || 'no' => c.warning,
      'REJECTED' || 'SUSPENDED' || 'TERMINATED' => c.error,
      _ => c.inkMuted,
    };

/// One card on any tab: who or what, a line under it, a figure, a state.
class BrokerRow extends Equatable {
  const BrokerRow({required this.id, required this.title, required this.subtitle, required this.status, this.amount, this.at, this.note, this.details = const [], this.raw = const {}});
  final String id;
  final String title;
  final String subtitle;

  /// A status code, or `yes`/`no` for a contract's signing.
  final String status;
  final double? amount;
  final DateTime? at;

  /// A second muted line (a hold, a rejection reason).
  final String? note;

  /// Small facts with an icon each (a firm's code, city and phone).
  final List<(IconData, String)> details;

  /// The API's row, for the detail sheet.
  final Map<String, dynamic> raw;

  @override
  List<Object?> get props => [id, title, subtitle, status, amount, at, note, details, raw];

  static BrokerRow fromJson(BrokerTab tab, Map<String, dynamic> j, String lang) {
    String s(Object? v) => v is String ? v : '';
    String join(List<String> parts) => parts.where((p) => p.isNotEmpty).join(' · ');
    Map<String, dynamic> m(Object? v) => v is Map<String, dynamic> ? v : const {};
    final broker = m(j['broker']);
    final brokerName = s(broker['commercialName']).isNotEmpty ? s(broker['commercialName']) : s(broker['companyName']);
    final agent = s(m(j['brokerAgent'])['fullName']);
    DateTime? at(Object? v) => DateTime.tryParse(s(v))?.toLocal();
    String project(Object? v) => v == null ? '' : Translatable.fromJson(m(v)['name']).resolve(lang);
    final id = s(j['id']);
    switch (tab) {
      case BrokerTab.firms:
        final hold = j['payoutHold'] == true;
        return BrokerRow(
          raw: j,
          id: id,
          title: s(j['commercialName']).isNotEmpty ? s(j['commercialName']) : s(j['companyName']),
          subtitle: '',
          details: [
            if (s(j['city']).isNotEmpty) (Icons.place_outlined, s(j['city'])),
            if (s(j['phone']).isNotEmpty) (Icons.phone_outlined, ltr(s(j['phone']))),
          ],
          status: s(j['status']),
          amount: readAmount(j['defaultCommissionPct']),
          at: at(j['createdAt']),
          note: hold ? 'hold' : null,
        );
      case BrokerTab.leads:
        return BrokerRow(
          raw: j,
          id: id,
          title: s(j['fullName']),
          subtitle: join([brokerName, project(j['projectInterest'])]),
          status: s(j['brokerApprovalStatus']).isEmpty ? 'PENDING' : s(j['brokerApprovalStatus']),
          at: at(j['brokerSubmittedAt'] ?? j['createdAt']),
          note: j['brokerRejectionReason'] as String?,
        );
      case BrokerTab.reservations:
        final unit = m(j['unit']);
        return BrokerRow(
          raw: j,
          id: id,
          title: join([ltr(s(j['reservationNumber'])), ltr(s(unit['code']))]),
          subtitle: join([brokerName, agent, s(m(j['client'])['fullName'])]),
          status: s(j['status']),
          amount: readAmount(j['bookingAmount']),
          at: at(j['createdAt']),
        );
      case BrokerTab.contracts:
        return BrokerRow(
          raw: j,
          id: id,
          title: join([ltr(s(j['contractNumber'])), ltr(s(m(j['unit'])['code']))]),
          subtitle: join([brokerName, s(m(j['customer'])['fullName'])]),
          status: j['signedAt'] == null ? 'no' : 'yes',
          amount: readAmount(j['totalAmount']),
          at: at(j['signedAt'] ?? j['createdAt']),
        );
      case BrokerTab.commissions:
        return BrokerRow(
          raw: j,
          id: id,
          title: ltr(s(j['commissionNumber'])),
          subtitle: join([brokerName, agent]),
          status: s(j['status']),
          amount: readAmount(j['netAmount']),
          at: at(j['earnedAt']),
          note: j['rejectionReason'] as String?,
        );
      case BrokerTab.payouts:
        return BrokerRow(
          raw: j,
          id: id,
          title: ltr(s(j['payoutNumber'])),
          subtitle: join([brokerName, s(j['period'])]),
          status: s(j['status']),
          amount: readAmount(j['totalNet']),
          at: at(j['createdAt']),
        );
    }
  }
}

class BrokersAdminRepository {
  BrokersAdminRepository(this._dio);
  final Dio _dio;

  /// For the actions (see broker_actions.dart).
  Dio get dioForActions => _dio;

  Future<Result<Paginated<BrokerRow>>> list(BrokerTab tab, {String? status, int page = 1, String lang = 'ar'}) => guardApiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>(tab.path, queryParameters: {
          'page': page,
          'pageSize': 20,
          tab.filterParam: ?status,
        });
        return Paginated.fromJson(res.data ?? const {}, (j) => BrokerRow.fromJson(tab, j, lang));
      });
}

bool _allowNone(String code) => false;

class BrokersHubScreen extends StatefulWidget {
  const BrokersHubScreen({super.key, required this.repository, required this.tabs, this.initial, this.can = _allowNone});
  final BrokersAdminRepository repository;
  final List<BrokerTab> tabs;
  final BrokerTab? initial;

  /// Whether the account holds a code (the admin holds them all).
  final bool Function(String code) can;

  @override
  State<BrokersHubScreen> createState() => _BrokersHubScreenState();
}

class _BrokersHubScreenState extends State<BrokersHubScreen> {
  final _scroll = ScrollController();
  late BrokerTab _tab = widget.initial != null && widget.tabs.contains(widget.initial) ? widget.initial! : widget.tabs.first;
  final _filters = <BrokerTab, String?>{};
  List<BrokerRow> _rows = const [];
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
      if (_more && !_loadingMore && _scroll.position.pixels >= _scroll.position.maxScrollExtent - 200) _loadMore();
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  String get _lang => Localizations.localeOf(context).languageCode;

  Future<void> _load() async {
    final tab = _tab;
    setState(() {
      _loading = true;
      _failure = null;
    });
    final r = await widget.repository.list(tab, status: _filters[tab], lang: _lang);
    if (!mounted || tab != _tab) return;
    setState(() {
      _loading = false;
      switch (r) {
        case Ok(data: final v):
          _rows = v.data;
          _total = v.meta.total;
          _more = v.hasMore;
          _page = 1;
        case Err(failure: final f):
          _failure = f;
          _rows = const [];
      }
    });
  }

  Future<void> _loadMore() async {
    final tab = _tab;
    setState(() => _loadingMore = true);
    final r = await widget.repository.list(tab, status: _filters[tab], page: _page + 1, lang: _lang);
    if (!mounted || tab != _tab) return;
    setState(() {
      _loadingMore = false;
      if (r case Ok(data: final v)) {
        _rows = [..._rows, ...v.data];
        _more = v.hasMore;
        _page++;
      }
    });
  }

  void _filter() => showFilterSheet(
        context,
        (_) => _StatusSheet(
          tab: _tab,
          selected: _filters[_tab],
          onApply: (v) {
            _filters[_tab] = v;
            _load();
          },
        ),
      );

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            key: const Key('brokers-hub'),
            controller: _scroll,
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 100),
            children: [
              HomeListHero(
                back: true,
                title: l10n.brkTitle,
                subtitle: _loading ? null : l10n.brkCountN(_total),
                actions: [
                  HomeHeroButton(
                    key: const Key('brokers-filters'),
                    icon: Icons.tune_rounded,
                    dot: _filters[_tab] != null,
                    tooltip: l10n.brkFilterTitle,
                    onTap: _filter,
                  ),
                ],
              ),
              if (widget.tabs.length > 1)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: HomePills(pills: [
                    for (final t in widget.tabs)
                      HomePill(
                        id: t.name,
                        label: brokerTabLabel(l10n, t),
                        selected: t == _tab,
                        onTap: () {
                          if (t == _tab) return;
                          setState(() {
                            _tab = t;
                            _rows = const [];
                          });
                          _load();
                        },
                      ),
                  ]),
                ),
              if (_loading)
                const SizedBox(height: 480, child: StaffListSkeleton())
              else if (_failure != null)
                ErrorState(failure: _failure, onRetry: _load)
              else if (_rows.isEmpty)
                EmptyState(icon: brokerTabIcon(_tab), title: brokerTabLabel(l10n, _tab), message: l10n.brkEmpty)
              else
                for (final r in _rows)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(AppSpacing.md, 10, AppSpacing.md, 0),
                    child: _BrokerCard(
                      tab: _tab,
                      row: r,
                      onTap: () async {
                        final changed = await showBrokerDetail(context, tab: _tab, row: r, repository: widget.repository, can: widget.can);
                        if (changed && mounted) _load();
                      },
                    ),
                  ),
              if (_loadingMore) const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator())),
            ],
          ),
        ),
      ),
    );
  }
}

class _BrokerCard extends StatelessWidget {
  const _BrokerCard({required this.tab, required this.row, required this.onTap});
  final BrokerTab tab;
  final BrokerRow row;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final color = brokerStatusColor(row.status, colors);
    final symbol = PriceFormatter.symbol(Localizations.localeOf(context).languageCode);
    final amount = row.amount;
    final firm = tab == BrokerTab.firms;
    final note = row.note == 'hold' ? l10n.brkPayoutHold : row.note;
    final figure = amount == null || (firm && amount == 0)
        ? null
        : firm
            ? ltr('${amount.toStringAsFixed(amount % 1 == 0 ? 0 : 1)}%')
            : '${homeCompactText(amount, l10n)} $symbol';
    return Material(
      color: Colors.transparent,
      child: InkWell(
        key: Key('broker-${tab.name}-${row.id}'),
        borderRadius: BorderRadius.circular(22),
        onTap: onTap,
        child: Container(
      decoration: homeCard(context, radius: 22),
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(
        child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  firm
                      ? Container(
                          width: 44,
                          height: 44,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(gradient: homeNavyGradient, borderRadius: BorderRadius.circular(14)),
                          child: Text(homeInitials(row.title), style: homeDisplay(14, AppPalette.gold300)),
                        )
                      : Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(color: AppPalette.gold50, border: Border.all(color: AppPalette.gold100), borderRadius: BorderRadius.circular(14)),
                          child: Icon(brokerTabIcon(tab), size: 21, color: AppPalette.gold500),
                        ),
                  const SizedBox(width: 11),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(row.title.isEmpty ? '—' : row.title,
                          maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: colors.inkStrong)),
                      if (row.subtitle.isNotEmpty) ...[
                        const SizedBox(height: 3),
                        Text(row.subtitle, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, color: colors.inkMuted)),
                      ],
                      if (row.details.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Wrap(spacing: 12, runSpacing: 4, children: [
                          for (final d in row.details)
                            Row(mainAxisSize: MainAxisSize.min, children: [
                              Icon(d.$1, size: 14, color: colors.inkMuted),
                              const SizedBox(width: 4),
                              Text(d.$2, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                            ]),
                        ]),
                      ],
                    ]),
                  ),
                  const SizedBox(width: 8),
                  _Pill(brokerStatusLabel(l10n, row.status), color),
                ]),
                if (figure != null || row.at != null || (note != null && note.isNotEmpty)) ...[
                  const SizedBox(height: 10),
                  Divider(height: 1, color: colors.hairline),
                  const SizedBox(height: 10),
                  Row(children: [
                    if (figure != null) ...[
                      Text(figure, style: homeDisplay(16, colors.inkStrong)),
                      if (firm) ...[
                        const SizedBox(width: 6),
                        Text(l10n.brkCommissionWord, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                      ],
                    ],
                    if (note != null && note.isNotEmpty) ...[
                      if (figure != null) const SizedBox(width: 10),
                      Flexible(
                        child: Text(note, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: row.note == 'hold' ? colors.warning : colors.error)),
                      ),
                    ],
                    const Spacer(),
                    if (row.at != null) ...[
                      Icon(Icons.calendar_today_rounded, size: 12, color: colors.inkMuted),
                      const SizedBox(width: 4),
                      Text(leadWhen(context, row.at!, withTime: false), style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                    ],
                  ]),
                ],
              ]),
            ),
          ),
        ]),
      ),
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill(this.text, this.color);
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
        child: Text(text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color)),
      );
}

class _StatusSheet extends StatefulWidget {
  const _StatusSheet({required this.tab, required this.selected, required this.onApply});
  final BrokerTab tab;
  final String? selected;
  final ValueChanged<String?> onApply;

  @override
  State<_StatusSheet> createState() => _StatusSheetState();
}

class _StatusSheetState extends State<_StatusSheet> {
  late String? _s = widget.selected;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    return FilterSheet(
      title: l10n.brkFilterTitle,
      active: _s == null ? 0 : 1,
      onClear: () => setState(() => _s = null),
      applyLabel: l10n.brkFilterApply,
      onApply: () {
        widget.onApply(_s);
        Navigator.of(context).pop();
      },
      sections: [
        FilterSection(
          icon: Icons.flag_outlined,
          title: l10n.kcStatus,
          child: FilterRadioList<String?>(
            keyPrefix: 'broker-filter',
            selected: _s,
            onSelect: (v) => setState(() => _s = v),
            options: [
              FilterOption<String?>(null, l10n.leadsFilterAll),
              for (final st in widget.tab.statuses) FilterOption<String?>(st, brokerStatusLabel(l10n, st), color: brokerStatusColor(st, colors)),
            ],
          ),
        ),
      ],
    );
  }
}
