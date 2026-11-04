import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../catalog/domain/entities/broker_project.dart';
import '../catalog/domain/repositories/broker_catalog_repository.dart';

/// The broker's home, the same figures as the broker portal's dashboard on
/// the website (`web-admin` `portal/page.tsx`): `/portal/performance`, the
/// available units, the latest leads, the bookings waiting for review and
/// the latest activity.
class BrokerHome {
  const BrokerHome({
    required this.leadsSubmitted,
    required this.leadsApproved,
    required this.leadsPending,
    required this.reservations,
    required this.reservationsPending,
    required this.contractsSigned,
    required this.payoutsPaid,
    required this.salesGross,
    required this.commissionsNet,
    required this.commissionsPendingNet,
    required this.commissionsPending,
    required this.payoutsNet,
    required this.availableUnits,
    required this.projects,
    required this.recentLeads,
    required this.activity,
  });

  final int leadsSubmitted;
  final int leadsApproved;

  /// Leads still waiting for the company's approval.
  final int leadsPending;
  final int reservations;

  /// Bookings waiting for the company's review.
  final int reservationsPending;
  final int contractsSigned;

  /// Commission payouts paid.
  final int payoutsPaid;
  final double salesGross;
  final double commissionsNet;
  final double commissionsPendingNet;

  /// How many commissions are still pending.
  final int commissionsPending;

  /// Paid out so far.
  final double payoutsNet;
  final int availableUnits;

  /// The broker's projects, each with its available units.
  final List<(BrokerProject, int)> projects;
  final List<BrokerHomeLead> recentLeads;
  final List<BrokerHomeActivity> activity;

  /// Approved leads over leads sent (the website's approval rate).
  int? get approvalRate => homeRate(leadsApproved, leadsSubmitted);

  /// Contracts over bookings (the website's closing rate).
  int? get contractRate => homeRate(contractsSigned, reservations);

  /// Payouts paid over contracts signed (the website's payout rate).
  int? get payoutRate => homeRate(payoutsPaid, contractsSigned);

  factory BrokerHome.fromJson({
    required Map<String, dynamic> performance,
    Map<String, dynamic> units = const {},
    Map<String, dynamic> leads = const {},
    Map<String, dynamic> pendingReservations = const {},
    Map<String, dynamic> activity = const {},
    List<BrokerProject> projects = const [],
  }) {
    final s = (performance['summary'] as Map?)?.cast<String, dynamic>() ?? const {};
    int n(String k) => (s[k] as num?)?.toInt() ?? 0;
    double d(String k) => readAmount(s[k]) ?? 0;
    int total(Map<String, dynamic> page) => ((page['meta'] as Map?)?['total'] as num?)?.toInt() ?? 0;
    List<Map<String, dynamic>> rows(Map<String, dynamic> page) =>
        (page['data'] as List? ?? const []).whereType<Map<String, dynamic>>().toList();

    // Available units per project, from the units the broker may sell.
    final perProject = <String, int>{};
    for (final u in rows(units)) {
      final id = ((u['building'] as Map?)?['phase'] as Map?)?['projectId'] as String?;
      if (id != null) perProject[id] = (perProject[id] ?? 0) + 1;
    }

    return BrokerHome(
      leadsSubmitted: n('leadsSubmitted'),
      leadsApproved: n('leadsApproved'),
      leadsPending: (n('leadsSubmitted') - n('leadsApproved') - n('leadsRejected') - n('leadsDuplicate')).clamp(0, 1 << 30),
      reservations: n('reservationsCreated'),
      reservationsPending: total(pendingReservations),
      contractsSigned: n('contractsSigned'),
      payoutsPaid: n('payoutsPaid'),
      salesGross: d('salesGross'),
      commissionsNet: d('commissionsNet'),
      commissionsPendingNet: d('commissionsPendingNet'),
      commissionsPending: n('commissionsPending'),
      payoutsNet: d('payoutsTotalNet'),
      availableUnits: total(units),
      projects: [for (final p in projects) (p, perProject[p.id] ?? 0)],
      recentLeads: [
        for (final l in rows(leads))
          BrokerHomeLead(
            id: l['id'] as String? ?? '',
            name: l['fullName'] as String? ?? '',
            status: l['brokerApprovalStatus'] as String?,
            at: DateTime.tryParse(l['createdAt'] as String? ?? '')?.toLocal(),
          ),
      ],
      activity: [
        for (final a in rows(activity))
          if (DateTime.tryParse(a['createdAt'] as String? ?? '') case final at?)
            BrokerHomeActivity(
              type: a['type'] as String? ?? '',
              at: at.toLocal(),
              lead: (a['lead'] as Map?)?['fullName'] as String?,
              reference: ((a['payload'] as Map?)?['reference'] ?? (a['payload'] as Map?)?['payoutNumber']) as String?,
              method: (a['payload'] as Map?)?['paymentMethod'] as String?,
            ),
      ],
    );
  }
}

int? homeRate(int part, int whole) => whole <= 0 ? null : (part / whole * 100).round();

class BrokerHomeLead {
  const BrokerHomeLead({required this.id, required this.name, this.status, this.at});
  final String id;
  final String name;

  /// PENDING, APPROVED, REJECTED, DUPLICATE, EXPIRED.
  final String? status;
  final DateTime? at;
}

class BrokerHomeActivity {
  const BrokerHomeActivity({required this.type, required this.at, this.lead, this.reference, this.method});

  /// The portal's activity type (LEAD_SUBMITTED, PAYOUT_PAID …).
  final String type;
  final DateTime at;
  final String? lead;

  /// A payout's number.
  final String? reference;

  /// How a payout was paid (BANK_TRANSFER …).
  final String? method;
}

class BrokerHomeRepository {
  BrokerHomeRepository(this._dio, this._catalog);
  final Dio _dio;
  final BrokerCatalogRepository _catalog;

  Future<Result<BrokerHome>> load() => guardApiCall(() async {
        Future<Map<String, dynamic>> get(String path, [Map<String, dynamic>? q]) async =>
            (await _dio.get<Map<String, dynamic>>(path, queryParameters: q)).data ?? const {};
        // Everything but the figures is best-effort: the page shows without it.
        Future<Map<String, dynamic>> soft(String path, [Map<String, dynamic>? q]) =>
            get(path, q).catchError((Object _) => const <String, dynamic>{});

        final results = await Future.wait<Object?>([
          get('/portal/performance'),
          soft('/portal/units', {'status': 'AVAILABLE', 'pageSize': 200}),
          soft('/portal/leads', {'pageSize': 4}),
          soft('/portal/reservations', {'status': 'PENDING', 'pageSize': 1}),
          soft('/portal/activity', {'pageSize': 6}),
          _catalog.getProjects(),
        ]);
        return BrokerHome.fromJson(
          performance: results[0]! as Map<String, dynamic>,
          units: results[1]! as Map<String, dynamic>,
          leads: results[2]! as Map<String, dynamic>,
          pendingReservations: results[3]! as Map<String, dynamic>,
          activity: results[4]! as Map<String, dynamic>,
          projects: (results[5]! as Result<List<BrokerProject>>).dataOrNull ?? const [],
        );
      });
}

class BrokerHomeState extends Equatable {
  const BrokerHomeState({this.status = DataStatus.initial, this.data, this.failure});
  final DataStatus status;
  final BrokerHome? data;
  final AppFailure? failure;

  @override
  List<Object?> get props => [status, data, failure];
}

class BrokerHomeCubit extends Cubit<BrokerHomeState> {
  BrokerHomeCubit(this._repo) : super(const BrokerHomeState());
  final BrokerHomeRepository _repo;

  Future<void> load() async {
    if (state.data == null) emit(const BrokerHomeState(status: DataStatus.loading));
    final r = await _repo.load();
    if (isClosed) return;
    r.when(
      ok: (data) => emit(BrokerHomeState(status: DataStatus.success, data: data)),
      err: (f) => emit(BrokerHomeState(
        status: state.data == null ? DataStatus.failure : DataStatus.success,
        data: state.data,
        failure: f,
      )),
    );
  }
}
