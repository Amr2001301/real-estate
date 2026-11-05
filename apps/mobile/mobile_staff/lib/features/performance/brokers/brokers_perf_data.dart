import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

int _i(Object? v) => (v as num?)?.toInt() ?? 0;

/// The funnel and the money of the brokers (all of them, for the admin; the
/// broker's own, for the portal): the same shape on both sides.
class BrokersSummary extends Equatable {
  const BrokersSummary({
    this.totalBrokers,
    this.activeBrokers,
    this.leadsSubmitted = 0,
    this.leadsApproved = 0,
    this.reservations = 0,
    this.contractsSigned = 0,
    this.commissionPaidContracts = 0,
    this.salesGross = 0,
    this.commissionsNet = 0,
    this.commissionsPendingNet = 0,
    this.payoutsPaid = 0,
    this.payoutsTotalNet = 0,
  });

  /// Only the admin's report counts brokers.
  final int? totalBrokers;
  final int? activeBrokers;
  final int leadsSubmitted;
  final int leadsApproved;
  final int reservations;
  final int contractsSigned;
  final int commissionPaidContracts;
  final double salesGross;
  final double commissionsNet;
  final double commissionsPendingNet;
  final int payoutsPaid;
  final double payoutsTotalNet;

  factory BrokersSummary.fromJson(Map<String, dynamic> j) => BrokersSummary(
        totalBrokers: (j['totalBrokers'] as num?)?.toInt(),
        activeBrokers: (j['activeBrokers'] as num?)?.toInt(),
        leadsSubmitted: _i(j['leadsSubmitted']),
        leadsApproved: _i(j['leadsApproved']),
        reservations: _i(j['reservationsCreated']),
        contractsSigned: _i(j['contractsSigned']),
        commissionPaidContracts: _i(j['contractsCommissionPaid']),
        salesGross: readAmount(j['salesGross']) ?? 0,
        commissionsNet: readAmount(j['commissionsNet']) ?? 0,
        commissionsPendingNet: readAmount(j['commissionsPendingNet']) ?? 0,
        payoutsPaid: _i(j['payoutsPaid']),
        payoutsTotalNet: readAmount(j['payoutsTotalNet']) ?? 0,
      );

  @override
  List<Object?> get props => [totalBrokers, activeBrokers, leadsSubmitted, leadsApproved, reservations, contractsSigned, commissionPaidContracts, salesGross, commissionsNet, commissionsPendingNet, payoutsTotalNet];
}

class TrendBucket extends Equatable {
  const TrendBucket(this.label, this.commissionsNet, this.contractsSigned);
  final String label;
  final double commissionsNet;
  final int contractsSigned;

  factory TrendBucket.fromJson(Map<String, dynamic> j) => TrendBucket('${j['label']}', readAmount(j['commissionsNet']) ?? 0, _i(j['contractsSigned']));

  @override
  List<Object?> get props => [label, commissionsNet, contractsSigned];
}

class ProjectPerf extends Equatable {
  const ProjectPerf(this.name, this.city, this.contractsSigned, this.salesGross);
  final String name;
  final String? city;
  final int contractsSigned;
  final double salesGross;

  factory ProjectPerf.fromJson(Map<String, dynamic> j) => ProjectPerf('${j['projectName'] ?? '—'}', j['city'] as String?, _i(j['contractsSigned']), readAmount(j['salesGross']) ?? 0);

  @override
  List<Object?> get props => [name, contractsSigned, salesGross];
}

/// A broker company (admin) or one of the broker's own agents (portal).
class BrokerPerf extends Equatable {
  const BrokerPerf({required this.id, required this.name, this.code, this.status, this.leads = 0, this.reservations = 0, this.contracts = 0, this.salesGross = 0, this.commissionNet = 0, this.payoutNet = 0, this.conversionRate});
  final String id;
  final String name;
  final String? code;
  final String? status;
  final int leads;
  final int reservations;
  final int contracts;
  final double salesGross;
  final double commissionNet;
  final double payoutNet;
  final double? conversionRate;

  factory BrokerPerf.fromTop(Map<String, dynamic> j) => BrokerPerf(
        id: '${j['brokerId']}',
        name: '${j['companyName'] ?? '—'}',
        code: j['code'] as String?,
        status: j['status'] as String?,
        leads: _i(j['leads']),
        reservations: _i(j['reservations']),
        contracts: _i(j['contractsSigned']),
        salesGross: readAmount(j['salesGross']) ?? 0,
        commissionNet: readAmount(j['commissionNet']) ?? 0,
        payoutNet: readAmount(j['payoutNet']) ?? 0,
        conversionRate: (j['conversionRate'] as num?)?.toDouble(),
      );

  factory BrokerPerf.fromAgent(Map<String, dynamic> j) => BrokerPerf(
        id: '${j['brokerAgentId']}',
        name: '${j['fullName'] ?? '—'}',
        leads: _i(j['leadsSubmitted']),
        reservations: _i(j['reservations']),
        contracts: _i(j['contractsSigned']),
        salesGross: readAmount(j['salesGross']) ?? 0,
        commissionNet: readAmount(j['commissionNet']) ?? 0,
        payoutNet: readAmount(j['payoutNet']) ?? 0,
      );

  @override
  List<Object?> get props => [id, name, salesGross, commissionNet, payoutNet];
}

class BrokersPerf extends Equatable {
  const BrokersPerf({required this.summary, this.trend = const [], this.projects = const [], this.brokers = const [], this.brokerName});
  final BrokersSummary summary;
  final List<TrendBucket> trend;
  final List<ProjectPerf> projects;

  /// Top brokers (admin) or the broker's agents (portal).
  final List<BrokerPerf> brokers;

  /// The broker company's own name (portal).
  final String? brokerName;

  @override
  List<Object?> get props => [summary, trend, projects, brokers, brokerName];
}

class BrokersPerfRepository {
  BrokersPerfRepository(this._dio);
  final Dio _dio;

  List<Map<String, dynamic>> _rows(Object? v) => ((v as List?) ?? const []).whereType<Map<String, dynamic>>().toList();

  /// The admin's report over all brokers.
  Future<Result<BrokersPerf>> all() => guardApiCall(() async {
        final r = await Future.wait([
          _dio.get<Map<String, dynamic>>('/broker-reports/summary'),
          _dio.get<Map<String, dynamic>>('/broker-reports/top-brokers', queryParameters: {'limit': 20}),
          _dio.get<List<dynamic>>('/broker-reports/monthly-trend'),
          _dio.get<Map<String, dynamic>>('/broker-reports/projects'),
        ]);
        return BrokersPerf(
          summary: BrokersSummary.fromJson((r[0].data as Map<String, dynamic>?) ?? const {}),
          brokers: _rows((r[1].data as Map?)?['data']).map(BrokerPerf.fromTop).toList(),
          trend: _rows(r[2].data).map(TrendBucket.fromJson).toList(),
          projects: _rows((r[3].data as Map?)?['data']).map(ProjectPerf.fromJson).toList(),
        );
      });

  /// The broker's own performance (the portal).
  Future<Result<BrokersPerf>> mine() => guardApiCall(() async {
        final r = await _dio.get<Map<String, dynamic>>('/portal/performance');
        final d = r.data ?? const <String, dynamic>{};
        return BrokersPerf(
          summary: BrokersSummary.fromJson((d['summary'] as Map<String, dynamic>?) ?? const {}),
          trend: _rows(d['monthlyTrend']).map(TrendBucket.fromJson).toList(),
          projects: _rows(d['projectBreakdown']).map(ProjectPerf.fromJson).toList(),
          brokers: _rows(d['agentBreakdown']).map(BrokerPerf.fromAgent).toList(),
          brokerName: ((d['broker'] as Map?)?['commercialName'] ?? (d['broker'] as Map?)?['companyName']) as String?,
        );
      });
}

class BrokersPerfCubit extends Cubit<DataState<BrokersPerf>> {
  BrokersPerfCubit(this._load) : super(const DataState.initial());
  final Future<Result<BrokersPerf>> Function() _load;

  Future<void> load() async {
    emit(DataState.loading(previousData: state.data));
    final r = await _load();
    if (isClosed) return;
    r.when(
      ok: (p) => emit(p.summary == const BrokersSummary() && p.brokers.isEmpty ? const DataState.empty() : DataState.success(p)),
      err: (f) => emit(DataState.failure(f, previousData: state.data)),
    );
  }
}
