import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:go_router/go_router.dart';

import '../../common/staff_list_skeleton.dart';
import 'financial_report_screen.dart' show comparisonMonths, percentChange, previousRange;

/// The sales report, as on the website's «التقارير»: the period's sales,
/// contracts, what was collected and the lead-to-contract conversion, the
/// stages, the booking states, the projects and broker firms ranked and the
/// year's contracts month by month.

enum ReportPeriod { thisMonth, lastMonth, quarter, year }

({String from, String to}) reportRange(ReportPeriod p, DateTime today) {
  String d(DateTime x) => '${x.year.toString().padLeft(4, '0')}-${x.month.toString().padLeft(2, '0')}-${x.day.toString().padLeft(2, '0')}';
  switch (p) {
    case ReportPeriod.thisMonth:
      return (from: d(DateTime(today.year, today.month, 1)), to: d(today));
    case ReportPeriod.lastMonth:
      return (from: d(DateTime(today.year, today.month - 1, 1)), to: d(DateTime(today.year, today.month, 0)));
    case ReportPeriod.quarter:
      return (from: d(DateTime(today.year, ((today.month - 1) ~/ 3) * 3 + 1, 1)), to: d(today));
    case ReportPeriod.year:
      return (from: d(DateTime(today.year, 1, 1)), to: d(today));
  }
}

String reportPeriodLabel(AppLocalizations l10n, ReportPeriod p) => switch (p) {
      ReportPeriod.thisMonth => l10n.rpPeriodThisMonth,
      ReportPeriod.lastMonth => l10n.rpPeriodLastMonth,
      ReportPeriod.quarter => l10n.rpPeriodQuarter,
      ReportPeriod.year => l10n.rpPeriodYear,
    };

class ReportRank {
  const ReportRank({required this.id, required this.name, required this.count, required this.value});
  final String id;
  final String name;
  final int count;
  final double value;
}

class SalesReport {
  const SalesReport({
    this.sales = 0,
    this.contracts = 0,
    this.collected = 0,
    this.fees = 0,
    this.funnel = const [0, 0, 0, 0],
    this.cohort,
    this.reservations = const [],
    this.projects = const [],
    this.brokers = const [],
    this.trend = const [],
  });

  final double sales;
  final int contracts;
  final double collected;
  final double fees;

  /// Leads, visits, reservations, contracts of the period.
  final List<int> funnel;

  /// The period's leads and how many reached visit, booking and contract.
  final List<int>? cohort;
  final List<(String, int)> reservations;
  final List<ReportRank> projects;
  final List<ReportRank> brokers;

  /// The year's contracts per month: (label, contracts).
  final List<(String, int)> trend;

  double get average => contracts > 0 ? sales / contracts : 0;

  /// Contracts signed over the period's leads, 0–100; null without leads.
  int? get conversion => (cohort == null || cohort![0] == 0) ? null : (cohort![3] / cohort![0] * 100).round();
}

class ReportsRepository {
  ReportsRepository(this._dio);
  final Dio _dio;

  Future<T?> _try<T>(Future<T> f) async {
    try {
      return await f;
    } catch (_) {
      return null;
    }
  }

  /// The report for [p].
  Future<Result<SalesReport>> sales(ReportPeriod p, {DateTime? now}) {
    final today = now ?? DateTime.now();
    final r = reportRange(p, today);
    return salesBetween(r.from, r.to, today.year);
  }

  /// The equal-length period right before [p] (for the comparison).
  Future<Result<SalesReport>> salesBefore(ReportPeriod p, {DateTime? now}) {
    final today = now ?? DateTime.now();
    final r = reportRange(p, today);
    final prev = previousRange(r.from, r.to, months: comparisonMonths(p));
    return salesBetween(prev.from, prev.to, DateTime.parse(prev.from).year);
  }

  Future<Result<SalesReport>> salesBetween(String from, String to, int year) => guardApiCall(() async {
        final today = DateTime(year);
        final q = {'dateFrom': from, 'dateTo': to};
        Future<Response<T>> get<T>(String path, [Map<String, dynamic>? query]) => _dio.get<T>(path, queryParameters: query ?? q);
        final res = await Future.wait<Object?>([
          get<Map<String, dynamic>>('/reports/sales'),
          _try(get<Map<String, dynamic>>('/reports/financial')),
          _try(get<Map<String, dynamic>>('/reports/sales-funnel')),
          _try(get<Map<String, dynamic>>('/reports/reservations')),
          _try(get<List<dynamic>>('/reports/broker-leaderboard')),
          _try(get<List<dynamic>>('/reports/sales-trend', {'year': today.year})),
          _try(get<Map<String, dynamic>>('/projects', {'pageSize': 100})),
        ]);
        Map<String, dynamic> m(Object? v) => v is Response ? (v.data is Map<String, dynamic> ? v.data as Map<String, dynamic> : const {}) : const {};
        List<Map<String, dynamic>> l(Object? v) => v is Response && v.data is List ? (v.data as List).whereType<Map<String, dynamic>>().toList() : const [];
        double d(Map<String, dynamic> o, String k) => readAmount(o[k]) ?? 0;
        int n(Map<String, dynamic> o, String k) => (o[k] as num?)?.toInt() ?? 0;

        final sales = m(res[0]);
        final fin = m(res[1]);
        final funnel = m(res[2]);
        final cohort = funnel['cohort'] as Map<String, dynamic>?;
        final names = <String, String>{
          for (final x in ((m(res[6])['data'] as List?) ?? const []).whereType<Map<String, dynamic>>())
            x['id'] as String? ?? '': Translatable.fromJson(x['name']).resolve('ar'),
        };
        final reservations = [
          for (final e in m(res[3]).entries) (e.key, (e.value as num?)?.toInt() ?? 0),
        ]..sort((a, b) => b.$2.compareTo(a.$2));
        return SalesReport(
          sales: d(sales, 'total'),
          contracts: n(sales, 'contracts'),
          collected: d(fin, 'total'),
          fees: d(fin, 'fees'),
          funnel: [n(funnel, 'leads'), n(funnel, 'visits'), n(funnel, 'reservations'), n(funnel, 'contracts')],
          cohort: cohort == null ? null : [n(cohort, 'leads'), n(cohort, 'visited'), n(cohort, 'reserved'), n(cohort, 'signed')],
          reservations: reservations,
          projects: ([
            for (final x in ((sales['byProject'] as List?) ?? const []).whereType<Map<String, dynamic>>())
              ReportRank(id: x['projectId'] as String? ?? '', name: names[x['projectId']] ?? '', count: n(x, 'count'), value: d(x, 'total')),
          ]..sort((a, b) => b.value.compareTo(a.value)))
              .take(6)
              .toList(),
          brokers: [
            for (final x in l(res[4]).take(5))
              ReportRank(id: x['brokerId'] as String? ?? '', name: x['brokerName'] as String? ?? '', count: n(x, 'count'), value: d(x, 'commissionAmount')),
          ],
          trend: [
            for (final x in l(res[5])) (x['label'] as String? ?? '', n(x, 'contracts')),
          ],
        );
      });
}

String _statusLabel(AppLocalizations l10n, String s) => switch (s) {
      'PENDING' => l10n.rpResPending,
      'CONFIRMED' => l10n.rpResConfirmed,
      'APPROVED' => l10n.rpResApproved,
      'CONVERTED' => l10n.rpResConverted,
      'CANCELLED' => l10n.rpResCancelled,
      'EXPIRED' => l10n.rpResExpired,
      _ => s,
    };

Color _statusColor(String s, AppColorsExt c) => switch (s) {
      'CONFIRMED' || 'APPROVED' => c.success,
      'CONVERTED' => AppPalette.gold500,
      'PENDING' => c.warning,
      _ => c.inkMuted,
    };

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key, required this.repository});
  final ReportsRepository repository;

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  ReportPeriod _period = ReportPeriod.thisMonth;
  bool _compare = false;
  SalesReport? _before;
  SalesReport? _data;
  AppFailure? _failure;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = _data == null;
      _failure = null;
    });
    final out = await Future.wait([
      widget.repository.sales(_period),
      if (_compare) widget.repository.salesBefore(_period),
    ]);
    if (!mounted) return;
    final r = out[0];
    final before = _compare ? out[1].dataOrNull : null;
    setState(() {
      _loading = false;
      _before = before;
      switch (r) {
        case Ok(data: final v):
          _data = v;
        case Err(failure: final f):
          _failure = f;
      }
    });
  }

  void _filters() => showFilterSheet(
        context,
        (_) => _PeriodSheet(
          selected: _period,
          compare: _compare,
          onApply: (p, c) {
            _period = p;
            _compare = c;
            _load();
          },
        ),
      );

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final d = _data;
    final symbol = PriceFormatter.symbol(Localizations.localeOf(context).languageCode);
    String money(double v) => '${homeCompactText(v, l10n)} $symbol';
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            key: const Key('reports'),
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 100),
            children: [
              HomeListHero(
                back: true,
                title: l10n.rpTitle,
                subtitle: '${reportPeriodLabel(l10n, _period)}${_compare ? ' · ${l10n.frCompareOn}' : ''}',
                actions: [
                  HomeHeroButton(
                    key: const Key('reports-filters'),
                    icon: Icons.tune_rounded,
                    dot: _period != ReportPeriod.thisMonth || _compare,
                    tooltip: l10n.rpFilterTitle,
                    onTap: _filters,
                  ),
                ],
              ),
              if (_loading)
                const SizedBox(height: 480, child: StaffListSkeleton())
              else if (_failure != null && d == null)
                ErrorState(failure: _failure, onRetry: _load)
              else if (d != null) ...[
                Padding(
                  padding: const EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 0),
                  child: HomeBand(figures: [
                    HomeFigure(id: 'sales', value: homeCompact(d.sales, l10n).$1, label: '${l10n.rpSales} · ${homeCompact(d.sales, l10n).$2}'.replaceAll(RegExp(r' · $'), ''), hint: _vs(l10n, d.sales, _before?.sales) ?? l10n.rpAvgContract(money(d.average)), warn: _before != null && d.sales < _before!.sales),
                    HomeFigure(id: 'contracts', value: '${d.contracts}', label: l10n.rpContracts, hint: _vs(l10n, d.contracts, _before?.contracts) ?? l10n.rpContractsHint, warn: _before != null && d.contracts < _before!.contracts),
                    HomeFigure(
                      id: 'conversion',
                      value: d.conversion == null ? '—' : '${d.conversion}%',
                      label: l10n.rpConversion,
                      hint: l10n.rpConversionHint,
                      warn: d.conversion != null && d.conversion! < 10,
                    ),
                  ]),
                ),
                HomeTiles(tiles: [
                  HomeTile(
                    label: l10n.rpCollected,
                    value: homeCompact(d.collected, l10n).$1,
                    unit: '${homeCompact(d.collected, l10n).$2} $symbol'.trim(),
                    sub: l10n.rpCollectedSub,
                  ),
                  if (d.fees > 0)
                    HomeTile(label: l10n.rpFees, value: homeCompact(d.fees, l10n).$1, unit: '${homeCompact(d.fees, l10n).$2} $symbol'.trim(), sub: l10n.ahFees),
                ]),
                HomeSection(
                  icon: Icons.filter_alt_rounded,
                  title: l10n.ahFunnel,
                  child: HomeFunnel(rates: false, steps: [
                    HomeFunnelStep(label: l10n.ahFunnelLeads, value: d.funnel[0], colors: homeTaupe),
                    HomeFunnelStep(label: l10n.ahFunnelVisits, value: d.funnel[1], colors: homeNavy),
                    HomeFunnelStep(label: l10n.ahFunnelReservations, value: d.funnel[2], colors: homeGold),
                    HomeFunnelStep(label: l10n.ahFunnelContracts, value: d.funnel[3], colors: homeGreen),
                  ]),
                ),
                if (d.trend.any((t) => t.$2 > 0))
                  HomeSection(
                    icon: Icons.bar_chart_rounded,
                    title: l10n.rpTrend,
                    child: HomeBars(bars: d.trend),
                  ),
                if (d.reservations.isNotEmpty)
                  HomeSection(
                    icon: Icons.bookmark_rounded,
                    title: l10n.rpReservationStates,
                    child: _States(rows: d.reservations),
                  ),
                HomeSection(
                  icon: Icons.apartment_rounded,
                  title: l10n.rpProjects,
                  child: HomeRankList(
                    empty: l10n.rpNoSales,
                    rows: [
                      for (final p in d.projects)
                        HomeRankRow(
                          id: p.id,
                          title: p.name.isEmpty ? l10n.rpUnknownProject : p.name,
                          icon: Icons.apartment_rounded,
                          subtitle: l10n.ahContractsN(p.count),
                          value: homeCompact(p.value, l10n).$1,
                          unit: '${homeCompact(p.value, l10n).$2} $symbol'.trim(),
                          onTap: p.id.isEmpty ? null : () => context.push('/projects/${p.id}'),
                        ),
                    ],
                  ),
                ),
                HomeSection(
                  icon: Icons.handshake_rounded,
                  title: l10n.ahTopBrokers,
                  child: HomeRankList(
                    empty: l10n.ahNoBrokers,
                    rows: [
                      for (final b in d.brokers)
                        HomeRankRow(
                          id: b.id,
                          title: b.name,
                          icon: Icons.storefront_rounded,
                          subtitle: l10n.ahContractsN(b.count),
                          value: homeCompact(b.value, l10n).$1,
                          unit: '${homeCompact(b.value, l10n).$2} $symbol'.trim(),
                        ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// The bookings by state, a bar split and a legend with each share.
/// «+12% عن الفترة السابقة», or null without a comparison or a base.
String? _vs(AppLocalizations l10n, num now, num? before) {
  final c = before == null ? null : percentChange(now, before);
  return c == null ? null : l10n.frVsBefore(ltr('${c > 0 ? '+' : ''}$c%'));
}

class _States extends StatelessWidget {
  const _States({required this.rows});
  final List<(String, int)> rows;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final total = rows.fold<int>(0, (a, r) => a + r.$2);
    return Container(
      key: const Key('reports-states'),
      padding: const EdgeInsets.all(14),
      decoration: homeCard(context, radius: 24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: SizedBox(
            height: 12,
            child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              for (final r in rows)
                if (r.$2 > 0) Expanded(flex: r.$2, child: ColoredBox(color: _statusColor(r.$1, colors))),
            ]),
          ),
        ),
        const SizedBox(height: 12),
        for (final r in rows)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(children: [
              Container(width: 9, height: 9, decoration: BoxDecoration(color: _statusColor(r.$1, colors), shape: BoxShape.circle)),
              const SizedBox(width: 8),
              Expanded(child: Text(_statusLabel(l10n, r.$1), style: TextStyle(fontSize: 13, color: colors.ink))),
              Text(total > 0 ? '${(r.$2 / total * 100).round()}%' : '—', style: TextStyle(fontSize: 12, color: colors.inkMuted)),
              const SizedBox(width: 10),
              Text(ltr('${r.$2}'), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.inkStrong)),
            ]),
          ),
      ]),
    );
  }
}

class _PeriodSheet extends StatefulWidget {
  const _PeriodSheet({required this.selected, required this.compare, required this.onApply});
  final ReportPeriod selected;
  final bool compare;
  final void Function(ReportPeriod, bool) onApply;

  @override
  State<_PeriodSheet> createState() => _PeriodSheetState();
}

class _PeriodSheetState extends State<_PeriodSheet> {
  late ReportPeriod _p = widget.selected;
  late bool _c = widget.compare;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return FilterSheet(
      title: l10n.rpFilterTitle,
      active: (_p == ReportPeriod.thisMonth ? 0 : 1) + (_c ? 1 : 0),
      onClear: () => setState(() {
        _p = ReportPeriod.thisMonth;
        _c = false;
      }),
      applyLabel: l10n.rpFilterApply,
      onApply: () {
        widget.onApply(_p, _c);
        Navigator.of(context).pop();
      },
      sections: [
        FilterSection(
          icon: Icons.date_range_rounded,
          title: l10n.rpFilterPeriod,
          child: FilterRadioList<ReportPeriod>(
            keyPrefix: 'report-period',
            selected: _p,
            onSelect: (v) => setState(() => _p = v),
            options: [for (final p in ReportPeriod.values) FilterOption<ReportPeriod>(p, reportPeriodLabel(l10n, p))],
          ),
        ),
        FilterSection(
          icon: Icons.compare_arrows_rounded,
          title: l10n.frCompare,
          child: FilterRadioList<bool>(
            keyPrefix: 'report-compare',
            selected: _c,
            onSelect: (v) => setState(() => _c = v),
            options: [FilterOption<bool>(false, l10n.frCompareOff), FilterOption<bool>(true, l10n.frCompareOn)],
          ),
        ),
      ],
    );
  }
}
