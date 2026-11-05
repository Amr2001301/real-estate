import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../leads/domain/entities/lead.dart';
import '../../leads/domain/repositories/leads_repository.dart';

/// The company admin's home, the same figures as the admin dashboard on the
/// website (`web-admin` `dashboard/page.tsx`): `/reports/admin-summary`, the
/// month's sales ranking and the top broker firms.
class AdminHome {
  const AdminHome({
    required this.contractValue,
    required this.contractsCount,
    required this.collected,
    required this.overdue,
    required this.collectionRate,
    required this.collectedThisMonth,
    required this.prevMonthCollected,
    required this.signedThisMonth,
    required this.prevMonthSigned,
    required this.newLeadsThisMonth,
    required this.prevMonthNewLeads,
    required this.totalUnits,
    required this.availableUnits,
    required this.soldUnits,
    required this.reservedUnits,
    required this.brokerPayoutsDue,
    required this.expectedNext30,
    required this.alerts,
    required this.funnel,
    required this.trend,
    required this.topSales,
    required this.topBrokers,
    required this.activity,
    this.overdueFollowUps = 0,
    this.projects = const [],
    this.leadSources = const [],
    this.forecast = const [0, 0, 0],
    this.fees = 0,
    this.portfolio,
    this.companyName,
    this.companyLogoUrl,
  });

  /// Signed and live contracts' value, and how many there are.
  final double contractValue;
  final int contractsCount;

  /// Collected towards the price, and what is overdue towards it.
  final double collected;
  final double overdue;

  /// What was collected against what is due by today, 0–100; null when
  /// nothing is due yet (as on the website).
  final int? collectionRate;

  final double collectedThisMonth;
  final double prevMonthCollected;
  final int signedThisMonth;
  final int prevMonthSigned;
  final int newLeadsThisMonth;
  final int prevMonthNewLeads;

  final int totalUnits;
  final int availableUnits;
  final int soldUnits;
  final int reservedUnits;

  /// Broker payouts waiting to be paid.
  final double brokerPayoutsDue;

  /// Installments falling due in the next 30 days.
  final double expectedNext30;

  final AdminAlerts alerts;

  /// Leads, visits, bookings, contracts.
  final List<int> funnel;

  /// The last six months' bookings: (month, count), oldest first.
  final List<(DateTime, int)> trend;
  final List<AdminRankRow> topSales;
  final List<AdminRankRow> topBrokers;
  final List<AdminActivity> activity;

  /// The admin's own follow-ups past their date.
  final int overdueFollowUps;

  /// The projects' stock and signed contracts (`topProjects`).
  final List<AdminProject> projects;

  /// Where the leads come from: (source, count), most first.
  final List<(String, int)> leadSources;

  /// What falls due in 30, 31–60 and 61–90 days.
  final List<double> forecast;

  /// Fees and penalties collected, kept apart from the price.
  final double fees;

  /// The signed contracts' value split by state.
  final AdminPortfolio? portfolio;
  final String? companyName;
  final String? companyLogoUrl;

  factory AdminHome.fromJson(
    Map<String, dynamic> j, {
    List<dynamic> sales = const [],
    List<dynamic> brokers = const [],
    int overdueFollowUps = 0,
    BrandTokens? brand,
  }) {
    Map<String, dynamic> m(Object? v) => v is Map<String, dynamic> ? v : const {};
    double d(Map<String, dynamic> o, String k) => readAmount(o[k]) ?? 0;
    int n(Map<String, dynamic> o, String k) => (o[k] as num?)?.toInt() ?? 0;

    final kpis = m(j['kpis']);
    final fin = m(j['financial']);
    final funnel = m(j['funnel']);
    final collected = readAmount(fin['collectedTowardsPrice']) ?? d(fin, 'totalCollectedVerified');
    final due = readAmount(fin['dueToDate']);
    final againstDue = readAmount(fin['collectedAgainstDue']) ?? collected;

    return AdminHome(
      contractValue: d(fin, 'totalContractValue'),
      contractsCount: n(kpis, 'signedContracts'),
      collected: collected,
      overdue: readAmount(fin['overdueTowardsPrice']) ?? d(fin, 'overdueTotal'),
      collectionRate: due != null && due > 0 ? (againstDue / due * 100).round().clamp(0, 100) : null,
      collectedThisMonth: d(fin, 'collectedThisMonth'),
      prevMonthCollected: d(fin, 'prevMonthCollected'),
      signedThisMonth: n(fin, 'signedContractsThisMonth'),
      prevMonthSigned: n(fin, 'prevMonthSignedContracts'),
      newLeadsThisMonth: n(kpis, 'newLeadsThisMonth'),
      prevMonthNewLeads: n(fin, 'prevMonthNewLeads'),
      totalUnits: n(kpis, 'totalUnits'),
      availableUnits: n(kpis, 'availableUnits'),
      soldUnits: n(kpis, 'soldUnits'),
      reservedUnits: n(kpis, 'reservedUnits'),
      brokerPayoutsDue: d(fin, 'pendingBrokerPayouts'),
      expectedNext30: d(m(j['cashflowForecast']), 'next30'),
      alerts: AdminAlerts.fromJson(m(j['alerts'])),
      funnel: [n(funnel, 'leads'), n(funnel, 'visits'), n(funnel, 'reservations'), n(funnel, 'contracts')],
      trend: [
        for (final t in (j['reservationTrend'] as List? ?? const []).whereType<Map<String, dynamic>>())
          if (_month(t['month']) case final month?) (month, n(t, 'value')),
      ],
      // Highest sales first, the top five — as the website's leaderboard.
      topSales: ([
        for (final r in sales.whereType<Map<String, dynamic>>())
          AdminRankRow(
            id: r['salesId'] as String? ?? '',
            name: r['salesName'] as String? ?? '',
            contracts: n(r, 'signedContractsCount'),
            value: d(r, 'achievedAmount'),
          ),
      ]..sort((a, b) => b.value.compareTo(a.value)))
          .take(5)
          .toList(),
      topBrokers: [
        for (final b in brokers.whereType<Map<String, dynamic>>().take(5))
          AdminRankRow(
            id: b['brokerId'] as String? ?? '',
            name: b['companyName'] as String? ?? '',
            contracts: n(b, 'contractsSigned'),
            value: d(b, 'salesGross'),
            commission: readAmount(b['commissionNet']),
          ),
      ],
      activity: [
        for (final a in (j['recentActivity'] as List? ?? const []).whereType<Map<String, dynamic>>())
          if (DateTime.tryParse(a['createdAt'] as String? ?? '') case final at?)
            AdminActivity(
              type: a['type'] as String? ?? '',
              title: a['title'] as String? ?? '',
              context: a['context'] as String?,
              at: at.toLocal(),
              amount: readAmount(a['amount']),
            ),
      ],
      overdueFollowUps: overdueFollowUps,
      projects: [
        for (final p in (j['topProjects'] as List? ?? const []).whereType<Map<String, dynamic>>())
          AdminProject(
            id: p['id'] as String? ?? '',
            name: p['name'] as String? ?? '',
            total: n(p, 'totalUnits'),
            available: n(p, 'availableUnits'),
            reserved: n(p, 'reservedUnits'),
            sold: n(p, 'soldUnits'),
            contracts: n(p, 'signedContracts'),
            value: d(p, 'contractValue'),
          ),
      ],
      leadSources: [
        for (final l in (j['leadSources'] as List? ?? const []).whereType<Map<String, dynamic>>())
          (l['source'] as String? ?? '', n(l, 'count')),
      ]..sort((a, b) => b.$2.compareTo(a.$2)),
      forecast: [
        d(m(j['cashflowForecast']), 'next30'),
        d(m(j['cashflowForecast']), 'next3160'),
        d(m(j['cashflowForecast']), 'next6190'),
      ],
      fees: d(fin, 'feesCollected'),
      portfolio: j['portfolio'] is Map<String, dynamic>
          ? AdminPortfolio(
              paid: d(m(j['portfolio']), 'paid'),
              awaiting: d(m(j['portfolio']), 'awaiting'),
              overdue: d(m(j['portfolio']), 'overdue'),
              notYetDue: d(m(j['portfolio']), 'notYetDue'),
              unscheduled: d(m(j['portfolio']), 'unscheduled'),
            )
          : null,
      companyName: brand?.displayName,
      companyLogoUrl: brand?.logoUrl,
    );
  }

  /// "2026-10" → 1 Oct 2026.
  static DateTime? _month(Object? key) {
    final parts = '${key ?? ''}'.split('-');
    if (parts.length < 2) return null;
    final y = int.tryParse(parts[0]);
    final mo = int.tryParse(parts[1]);
    return y == null || mo == null ? null : DateTime(y, mo);
  }
}

/// What waits on the admin (`alerts` on the admin summary).
class AdminAlerts {
  const AdminAlerts({
    this.contractsAwaitingSignature = 0,
    this.visitsAwaitingConfirmation = 0,
    this.openMaintenance = 0,
    this.infoRequestsOpen = 0,
    this.depositsPendingReview = 0,
    this.contractsDueBeforeSigning = 0,
  });

  final int contractsAwaitingSignature;
  final int visitsAwaitingConfirmation;
  final int openMaintenance;
  final int infoRequestsOpen;
  final int depositsPendingReview;

  /// Unsigned contracts whose first payment has already fallen due.
  final int contractsDueBeforeSigning;

  factory AdminAlerts.fromJson(Map<String, dynamic> j) {
    int n(String k) => (j[k] as num?)?.toInt() ?? 0;
    return AdminAlerts(
      contractsAwaitingSignature: n('contractsAwaitingSignature'),
      visitsAwaitingConfirmation: n('visitsAwaitingConfirmation'),
      openMaintenance: n('openMaintenance'),
      infoRequestsOpen: n('infoRequestsOpen'),
      depositsPendingReview: n('depositsPendingReview'),
      contractsDueBeforeSigning: n('contractsDueBeforeSigning'),
    );
  }
}

/// One project's stock and contracts on the home.
class AdminProject {
  const AdminProject({
    required this.id,
    required this.name,
    required this.total,
    required this.available,
    required this.reserved,
    required this.sold,
    required this.contracts,
    required this.value,
  });
  final String id;
  final String name;
  final int total;
  final int available;
  final int reserved;
  final int sold;
  final int contracts;
  final double value;
}

/// The signed contracts' value split: paid, awaiting, late, not due yet,
/// not scheduled.
class AdminPortfolio {
  const AdminPortfolio({
    required this.paid,
    required this.awaiting,
    required this.overdue,
    required this.notYetDue,
    required this.unscheduled,
  });
  final double paid;
  final double awaiting;
  final double overdue;
  final double notYetDue;
  final double unscheduled;
  double get total => paid + awaiting + overdue + notYetDue + unscheduled;
}

/// A sales rep or a broker firm on the rankings.
class AdminRankRow {
  const AdminRankRow({required this.id, required this.name, required this.contracts, required this.value, this.commission});
  final String id;
  final String name;
  final int contracts;
  final double value;

  /// Broker firms: their net commission.
  final double? commission;
}

/// One entry of the company's latest activity.
class AdminActivity {
  const AdminActivity({required this.type, required this.title, required this.at, this.context, this.amount});

  /// lead, reservation, contract, visit, maintenance, deposit, info_request.
  final String type;
  final String title;
  final String? context;
  final DateTime at;
  final double? amount;
}

class AdminHomeRepository {
  AdminHomeRepository(this._dio, this._storage, this._leads);
  final Dio _dio;
  final TokenStorage _storage;
  final LeadsRepository _leads;

  Future<Result<AdminHome>> load({DateTime? now}) => guardApiCall(() async {
        final local = (now ?? DateTime.now()).toLocal();
        final period = '${local.year}-${local.month.toString().padLeft(2, '0')}';
        final results = await Future.wait<Object?>([
          _dio.get<Map<String, dynamic>>('/reports/admin-summary').then((r) => r.data ?? const <String, dynamic>{}),
          // The rankings and the follow-ups are best-effort: the page shows
          // without them, as on the website.
          _dio
              .get<List<dynamic>>('/sales-targets/performance', queryParameters: {'period': period})
              .then<List<dynamic>>((r) => r.data ?? const [])
              .catchError((Object _) => const <dynamic>[]),
          _dio
              .get<Map<String, dynamic>>('/broker-reports/top-brokers',
                  queryParameters: {'limit': 5, 'metric': 'salesGross'})
              .then<List<dynamic>>((r) => (r.data?['data'] as List?) ?? const [])
              .catchError((Object _) => const <dynamic>[]),
          _leads.getFollowUpSummary(),
          _branding(),
        ]);
        return AdminHome.fromJson(
          results[0]! as Map<String, dynamic>,
          sales: results[1]! as List<dynamic>,
          brokers: results[2]! as List<dynamic>,
          overdueFollowUps: (results[3]! as Result<FollowUpSummary>).dataOrNull?.overdue ?? 0,
          brand: results[4] as BrandTokens?,
        );
      });

  Future<BrandTokens?> _branding() async {
    try {
      final slug = await _storage.readSelectedCompanySlug();
      if (slug == null || slug.isEmpty) return null;
      return await BrandingRepository(_dio).fetchBranding(slug);
    } catch (_) {
      return null;
    }
  }
}

class AdminHomeState extends Equatable {
  const AdminHomeState({this.status = DataStatus.initial, this.data, this.failure});
  final DataStatus status;
  final AdminHome? data;
  final AppFailure? failure;

  @override
  List<Object?> get props => [status, data, failure];
}

class AdminHomeCubit extends Cubit<AdminHomeState> {
  AdminHomeCubit(this._repo) : super(const AdminHomeState());
  final AdminHomeRepository _repo;

  Future<void> load() async {
    if (state.data == null) emit(const AdminHomeState(status: DataStatus.loading));
    final r = await _repo.load();
    if (isClosed) return;
    r.when(
      ok: (data) => emit(AdminHomeState(status: DataStatus.success, data: data)),
      err: (f) => emit(AdminHomeState(
        status: state.data == null ? DataStatus.failure : DataStatus.success,
        data: state.data,
        failure: f,
      )),
    );
  }
}
