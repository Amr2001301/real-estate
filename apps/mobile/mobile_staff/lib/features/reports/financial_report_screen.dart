import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:go_router/go_router.dart';

import '../../common/staff_list_skeleton.dart';
import '../dashboard/home_kit/filter_kit.dart';
import '../dashboard/home_kit/home_kit.dart';
import '../ledger/presentation/ledger_labels.dart';
import 'reports_screen.dart' show ReportPeriod, reportPeriodLabel, reportRange;

/// The financial report, as on the website's «التقارير ← المالي»: the period's
/// money in and what is due, the month, aging, what each kind of payment
/// collected, bookings, what the company owes, the late and the coming
/// installments and the latest payments — with the change against the period
/// before when asked for.

/// The period to compare [from]..[to] (both `yyyy-MM-dd`) with: the same
/// dates [months] earlier (a month before for a month, a quarter before for a
/// quarter, a year before for the year), clipped to the shorter month. With no
/// [months], the equal-length period right before.
({String from, String to}) previousRange(String from, String to, {int months = 0}) {
  String d(DateTime x) => '${x.year.toString().padLeft(4, '0')}-${x.month.toString().padLeft(2, '0')}-${x.day.toString().padLeft(2, '0')}';
  final a = DateTime.parse(from);
  final b = DateTime.parse(to);
  if (months > 0) {
    DateTime shift(DateTime x) {
      final first = DateTime(x.year, x.month - months, 1);
      final last = DateTime(first.year, first.month + 1, 0).day;
      return DateTime(first.year, first.month, x.day > last ? last : x.day);
    }

    return (from: d(shift(a)), to: d(shift(b)));
  }
  final days = b.difference(a).inDays + 1;
  final prevTo = a.subtract(const Duration(days: 1));
  return (from: d(prevTo.subtract(Duration(days: days - 1))), to: d(prevTo));
}

/// How many months back each period compares with.
int comparisonMonths(ReportPeriod p) => switch (p) {
      ReportPeriod.thisMonth || ReportPeriod.lastMonth => 1,
      ReportPeriod.quarter => 3,
      ReportPeriod.year => 12,
    };

/// +12% / −5%, or null when there is nothing before to compare with.
int? percentChange(num now, num before) => before <= 0 ? null : ((now - before) / before * 100).round();

class FinInstallment {
  const FinInstallment({required this.id, required this.contractId, required this.customer, required this.unit, required this.type, required this.amount, this.dueDate});
  final String id;
  final String contractId;
  final String customer;
  final String unit;
  final String type;
  final double amount;
  final DateTime? dueDate;
}

class FinDeposit {
  const FinDeposit({required this.id, required this.who, required this.type, required this.amount, required this.verified, this.paidAt});
  final String id;
  final String who;
  final String type;
  final double amount;
  final bool verified;
  final DateTime? paidAt;
}

class FinancialReport {
  const FinancialReport({
    this.contractValue = 0,
    this.collected = 0,
    this.remaining = 0,
    this.overdue = 0,
    this.dueToDate,
    this.collectedAgainstDue = 0,
    this.collectedThisMonth = 0,
    this.dueThisMonth = 0,
    this.refundsOwed = 0,
    this.month = const {},
    this.aging = const [],
    this.byType = const [],
    this.booking = const {},
    this.liabilities = const {},
    this.overdueRows = const [],
    this.upcoming = const [],
    this.deposits = const [],
  });

  final double contractValue;
  final double collected;
  final double remaining;
  final double overdue;
  final double? dueToDate;
  final double collectedAgainstDue;
  final double collectedThisMonth;
  final double dueThisMonth;
  final double refundsOwed;

  /// due, paid, awaiting, overdue, upcoming, cashIn.
  final Map<String, double> month;
  final List<(String, int, double)> aging;

  /// (type, collected, awaiting).
  final List<(String, double, double)> byType;
  final Map<String, double> booking;

  /// salesBonusUnpaid, brokerCommissionsUnpaid, brokerPayoutsOpen, clawbacksOwed, total.
  final Map<String, double> liabilities;
  final List<FinInstallment> overdueRows;
  final List<FinInstallment> upcoming;
  final List<FinDeposit> deposits;

  /// Collected against what is due by today, 0–100; null when nothing is due.
  int? get collectionRate => dueToDate == null || dueToDate! <= 0 ? null : (collectedAgainstDue / dueToDate! * 100).round().clamp(0, 100);

  factory FinancialReport.fromJson(Map<String, dynamic> j) {
    Map<String, dynamic> m(Object? v) => v is Map<String, dynamic> ? v : const {};
    List<Map<String, dynamic>> l(Object? v) => v is List ? v.whereType<Map<String, dynamic>>().toList() : const [];
    double d(Map<String, dynamic> o, String k) => readAmount(o[k]) ?? 0;
    final s = m(j['summary']);
    final mo = m(j['month']);
    final liab = m(j['liabilities']);
    final payouts = m(liab['brokerPayouts']);
    FinInstallment inst(Map<String, dynamic> r) {
      final c = m(m(r['plan'])['contract']);
      return FinInstallment(
        id: r['id'] as String? ?? '',
        contractId: c['id'] as String? ?? '',
        customer: m(c['customer'])['fullName'] as String? ?? '',
        unit: m(c['unit'])['code'] as String? ?? '',
        type: r['type'] as String? ?? '',
        amount: readAmount(r['amount']) ?? 0,
        dueDate: DateTime.tryParse(r['dueDate'] as String? ?? '')?.toLocal(),
      );
    }

    return FinancialReport(
      contractValue: d(s, 'totalContractValue'),
      collected: readAmount(s['collectedTowardsPrice']) ?? d(s, 'totalCollected'),
      remaining: d(s, 'totalRemaining'),
      overdue: readAmount(s['overdueAmountComputed']) ?? d(s, 'totalOverdue'),
      dueToDate: readAmount(s['dueToDate']),
      collectedAgainstDue: d(s, 'collectedAgainstDue'),
      collectedThisMonth: d(s, 'collectedThisMonth'),
      dueThisMonth: d(s, 'dueThisMonth'),
      refundsOwed: d(s, 'refundsOwed'),
      month: {for (final k in const ['due', 'paid', 'awaiting', 'overdue', 'upcoming', 'cashIn']) k: d(mo, k)},
      aging: [for (final a in l(j['aging'])) (a['label'] as String? ?? '', (a['count'] as num?)?.toInt() ?? 0, d(a, 'amount'))],
      byType: [for (final t in l(j['collectionByType'])) (t['type'] as String? ?? '', d(t, 'totalCollected'), d(t, 'totalAwaiting'))],
      booking: {
        'pending': d(m(j['booking']), 'pendingReservationsBookingAmount'),
        'approved': d(m(j['booking']), 'approvedReservationsBookingAmount'),
        'collected': d(m(j['booking']), 'bookingCollectedVerified'),
        'uncollected': d(m(j['booking']), 'bookingUncollectedEstimate'),
      },
      liabilities: {
        'bonus': d(m(liab['salesBonus']), 'unpaidAmount'),
        'commissions': d(m(liab['brokerCommissions']), 'unpaidAmount'),
        'payouts': d(payouts, 'draftAmount') + d(payouts, 'approvedAmount') + d(payouts, 'processingAmount'),
        'clawbacks': d(m(liab['clawbacksOwed']), 'totalAmount'),
        'total': d(liab, 'totalUnpaidLiabilities'),
      },
      overdueRows: [for (final r in l(j['overdue']).take(6)) inst(r)],
      upcoming: [for (final r in l(j['upcomingThisWeek']).take(6)) inst(r)],
      deposits: [
        for (final r in l(j['recentDeposits']).take(6))
          FinDeposit(
            id: r['id'] as String? ?? '',
            who: m(m(r['contract'])['customer'])['fullName'] as String? ??
                m(m(r['reservation'])['client'])['fullName'] as String? ??
                m(m(r['reservation'])['lead'])['fullName'] as String? ??
                '',
            type: r['type'] as String? ?? '',
            amount: readAmount(r['amount']) ?? 0,
            verified: r['verified'] == true,
            paidAt: DateTime.tryParse(r['paidAt'] as String? ?? '')?.toLocal(),
          ),
      ],
    );
  }
}

class FinancialReportRepository {
  FinancialReportRepository(this._dio);
  final Dio _dio;

  Future<FinancialReport> _one(String from, String to) async {
    final res = await _dio.get<Map<String, dynamic>>('/reports/financial-dashboard', queryParameters: {'dateFrom': from, 'dateTo': to});
    return FinancialReport.fromJson(res.data ?? const {});
  }

  /// The report for [p], and the period before it when [compare].
  Future<Result<(FinancialReport, FinancialReport?)>> load(ReportPeriod p, {bool compare = false, DateTime? now}) => guardApiCall(() async {
        final r = reportRange(p, now ?? DateTime.now());
        final prev = previousRange(r.from, r.to, months: comparisonMonths(p));
        final out = await Future.wait([
          _one(r.from, r.to),
          if (compare) _one(prev.from, prev.to).then<FinancialReport?>((v) => v).catchError((Object _) => null),
        ]);
        return (out[0]!, compare ? out[1] : null);
      });
}

class FinancialReportScreen extends StatefulWidget {
  const FinancialReportScreen({super.key, required this.repository});
  final FinancialReportRepository repository;

  @override
  State<FinancialReportScreen> createState() => _FinancialReportScreenState();
}

class _FinancialReportScreenState extends State<FinancialReportScreen> {
  ReportPeriod _period = ReportPeriod.thisMonth;
  bool _compare = false;
  FinancialReport? _now;
  FinancialReport? _before;
  AppFailure? _failure;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = _now == null;
      _failure = null;
    });
    final r = await widget.repository.load(_period, compare: _compare);
    if (!mounted) return;
    setState(() {
      _loading = false;
      switch (r) {
        case Ok(data: final v):
          _now = v.$1;
          _before = v.$2;
        case Err(failure: final f):
          _failure = f;
      }
    });
  }

  void _filters() => showFilterSheet(
        context,
        (_) => _Sheet(
          period: _period,
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
    final d = _now;
    final symbol = PriceFormatter.symbol(Localizations.localeOf(context).languageCode);
    String money(double v) => '${homeCompactText(v, l10n)} $symbol';
    String unitOf(double v) => '${homeCompact(v, l10n).$2} $symbol'.trim();
    String change(double now, double? before) {
      final c = before == null ? null : percentChange(now, before);
      return c == null ? '' : l10n.frVsBefore(ltr('${c > 0 ? '+' : ''}$c%'));
    }

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            key: const Key('financial-report'),
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 100),
            children: [
              HomeListHero(
                back: true,
                title: l10n.frTitle,
                subtitle: '${reportPeriodLabel(l10n, _period)}${_compare ? ' · ${l10n.frCompareOn}' : ''}',
                actions: [
                  HomeHeroButton(
                    key: const Key('financial-filters'),
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
                    HomeFigure(
                      id: 'value',
                      value: homeCompact(d.contractValue, l10n).$1,
                      label: '${l10n.frContractValue} · ${homeCompact(d.contractValue, l10n).$2}'.replaceAll(RegExp(r' · $'), ''),
                      hint: symbol,
                    ),
                    HomeFigure(
                      id: 'collected',
                      value: homeCompact(d.collectedThisMonth, l10n).$1,
                      label: '${l10n.frCollectedMonth} · ${homeCompact(d.collectedThisMonth, l10n).$2}'.replaceAll(RegExp(r' · $'), ''),
                      hint: change(d.collectedThisMonth, _before?.collectedThisMonth).isEmpty ? l10n.frDueMonth(money(d.dueThisMonth)) : change(d.collectedThisMonth, _before?.collectedThisMonth),
                      warn: _before != null && d.collectedThisMonth < _before!.collectedThisMonth,
                    ),
                    HomeFigure(
                      id: 'rate',
                      value: d.collectionRate == null ? '—' : '${d.collectionRate}%',
                      label: l10n.ahCollectionRate,
                      hint: d.collectionRate == null ? l10n.ahNothingDue : l10n.frRateHint,
                      warn: d.collectionRate != null && d.collectionRate! < 70,
                    ),
                  ]),
                ),
                HomeTiles(tiles: [
                  HomeTile(label: l10n.frCollected, value: homeCompact(d.collected, l10n).$1, unit: unitOf(d.collected), sub: change(d.collected, _before?.collected)),
                  HomeTile(label: l10n.frRemaining, value: homeCompact(d.remaining, l10n).$1, unit: unitOf(d.remaining), sub: ''),
                  HomeTile(label: l10n.ahPfOverdue, value: homeCompact(d.overdue, l10n).$1, unit: unitOf(d.overdue), sub: change(d.overdue, _before?.overdue)),
                ]),
                if (d.aging.any((a) => a.$3 > 0))
                  HomeSection(
                    icon: Icons.hourglass_bottom_rounded,
                    title: l10n.frAging,
                    child: _Rows(
                      key: const Key('fr-aging'),
                      rows: [for (final a in d.aging) (a.$1, money(a.$3), l10n.ahContractsN(a.$2))],
                      bars: [for (final a in d.aging) a.$3],
                    ),
                  ),
                if (d.byType.isNotEmpty)
                  HomeSection(
                    icon: Icons.category_rounded,
                    title: l10n.frByType,
                    child: _Rows(
                      key: const Key('fr-by-type'),
                      rows: [for (final t in d.byType) (ledgerTypeLabel(l10n, t.$1), money(t.$2), t.$3 > 0 ? l10n.frAwaiting(money(t.$3)) : '')],
                      bars: [for (final t in d.byType) t.$2],
                    ),
                  ),
                if (d.booking.values.any((v) => v > 0))
                  HomeSection(
                    icon: Icons.bookmark_rounded,
                    title: l10n.frBooking,
                    child: _Rows(
                      key: const Key('fr-booking'),
                      rows: [
                        (l10n.frBookingCollected, money(d.booking['collected'] ?? 0), ''),
                        (l10n.frBookingUncollected, money(d.booking['uncollected'] ?? 0), ''),
                        (l10n.frBookingPending, money(d.booking['pending'] ?? 0), ''),
                        (l10n.frBookingApproved, money(d.booking['approved'] ?? 0), ''),
                      ],
                    ),
                  ),
                if ((d.liabilities['total'] ?? 0) > 0 || d.refundsOwed > 0)
                  HomeSection(
                    icon: Icons.account_balance_rounded,
                    title: l10n.frLiabilities,
                    action: l10n.ledgerTitle,
                    onAction: () => context.push('/ledger'),
                    child: _Rows(
                      key: const Key('fr-liabilities'),
                      rows: [
                        (l10n.frLiabBonus, money(d.liabilities['bonus'] ?? 0), ''),
                        (l10n.frLiabCommissions, money(d.liabilities['commissions'] ?? 0), ''),
                        (l10n.frLiabPayouts, money(d.liabilities['payouts'] ?? 0), ''),
                        if (d.refundsOwed > 0) (l10n.frLiabRefunds, money(d.refundsOwed), ''),
                        if ((d.liabilities['clawbacks'] ?? 0) > 0) (l10n.frLiabClawbacks, money(d.liabilities['clawbacks']!), ''),
                        (l10n.frLiabTotal, money(d.liabilities['total'] ?? 0), ''),
                      ],
                    ),
                  ),
                if (d.overdueRows.isNotEmpty)
                  HomeSection(
                    icon: Icons.warning_amber_rounded,
                    title: l10n.frOverdueList,
                    child: _InstallmentList(rows: d.overdueRows, late: true),
                  ),
                if (d.upcoming.isNotEmpty)
                  HomeSection(
                    icon: Icons.event_available_rounded,
                    title: l10n.frUpcomingWeek,
                    child: _InstallmentList(rows: d.upcoming, late: false),
                  ),
                if (d.deposits.isNotEmpty)
                  HomeSection(
                    icon: Icons.payments_rounded,
                    title: l10n.frRecentPayments,
                    action: l10n.navDeposits,
                    onAction: () => context.push('/deposits'),
                    child: Container(
                      key: const Key('fr-deposits'),
                      decoration: homeCard(context, radius: 22),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                      child: Column(children: [
                        for (var i = 0; i < d.deposits.length; i++) ...[
                          if (i > 0) Divider(height: 1, color: context.appColors.hairline),
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            child: Row(children: [
                              Expanded(
                                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Text(d.deposits[i].who.isEmpty ? '—' : d.deposits[i].who,
                                      maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: context.appColors.inkStrong)),
                                  const SizedBox(height: 2),
                                  Text(
                                    [ledgerTypeLabel(l10n, d.deposits[i].type), if (!d.deposits[i].verified) l10n.frUnverified].join(' · '),
                                    style: TextStyle(fontSize: 11.5, color: d.deposits[i].verified ? context.appColors.inkMuted : context.appColors.warning),
                                  ),
                                ]),
                              ),
                              Text(ltr(money(d.deposits[i].amount)), style: homeDisplay(14.5, context.appColors.inkStrong)),
                            ]),
                          ),
                        ],
                      ]),
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

/// Label / figure / small note rows in one card, with an optional share bar.
class _Rows extends StatelessWidget {
  const _Rows({super.key, required this.rows, this.bars});
  final List<(String, String, String)> rows;
  final List<double>? bars;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final max = (bars ?? const []).fold<double>(0, (m, v) => v > m ? v : m);
    return Container(
      decoration: homeCard(context, radius: 22),
      padding: const EdgeInsets.fromLTRB(14, 8, 14, 8),
      child: Column(children: [
        for (var i = 0; i < rows.length; i++)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 7),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                Expanded(child: Text(rows[i].$1, style: TextStyle(fontSize: 13, color: colors.ink))),
                if (rows[i].$3.isNotEmpty) ...[
                  Text(rows[i].$3, style: TextStyle(fontSize: 11, color: colors.inkMuted)),
                  const SizedBox(width: 10),
                ],
                Text(ltr(rows[i].$2), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.inkStrong)),
              ]),
              if (bars != null && max > 0) ...[
                const SizedBox(height: 5),
                ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: LinearProgressIndicator(value: bars![i] / max, minHeight: 6, color: AppPalette.gold500, backgroundColor: colors.hairline),
                ),
              ],
            ]),
          ),
      ]),
    );
  }
}

class _InstallmentList extends StatelessWidget {
  const _InstallmentList({required this.rows, required this.late});
  final List<FinInstallment> rows;
  final bool late;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final symbol = PriceFormatter.symbol(Localizations.localeOf(context).languageCode);
    return Container(
      key: Key(late ? 'fr-overdue' : 'fr-upcoming'),
      decoration: homeCard(context, radius: 22),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      child: Column(children: [
        for (var i = 0; i < rows.length; i++) ...[
          if (i > 0) Divider(height: 1, color: colors.hairline),
          InkWell(
            onTap: rows[i].contractId.isEmpty ? null : () => context.push('/contracts/${rows[i].contractId}'),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Row(children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(color: (late ? colors.error : colors.info).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
                  child: Icon(late ? Icons.alarm_rounded : Icons.event_rounded, size: 19, color: late ? colors.error : colors.info),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(rows[i].customer.isEmpty ? '—' : rows[i].customer,
                        maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                    const SizedBox(height: 2),
                    Text(
                      [ledgerTypeLabel(l10n, rows[i].type), if (rows[i].unit.isNotEmpty) ltr(rows[i].unit), if (rows[i].dueDate != null) DateFormatter.dayMonth(rows[i].dueDate!, languageCode: Localizations.localeOf(context).languageCode)].join(' · '),
                      style: TextStyle(fontSize: 11.5, color: colors.inkMuted),
                    ),
                  ]),
                ),
                Text('${homeCompactText(rows[i].amount, l10n)} $symbol', style: homeDisplay(14, late ? colors.error : colors.inkStrong)),
              ]),
            ),
          ),
        ],
      ]),
    );
  }
}

class _Sheet extends StatefulWidget {
  const _Sheet({required this.period, required this.compare, required this.onApply});
  final ReportPeriod period;
  final bool compare;
  final void Function(ReportPeriod, bool) onApply;

  @override
  State<_Sheet> createState() => _SheetState();
}

class _SheetState extends State<_Sheet> {
  late ReportPeriod _p = widget.period;
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
