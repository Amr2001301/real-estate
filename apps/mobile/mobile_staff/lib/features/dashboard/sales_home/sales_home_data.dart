import 'package:core/core.dart';
import 'package:dio/dio.dart';

/// The sales rep's home, the same figures as their dashboard on the website
/// (`web-admin` `sales-home.tsx`): open leads, leads gone stale, active and
/// lapsing reservations, the week's visits, the month's target and results.
class SalesHome {
  const SalesHome({
    required this.openLeads,
    required this.staleLeads,
    required this.stages,
    required this.activeReservations,
    required this.expiring,
    required this.visits,
    required this.unconfirmedVisits,
    required this.performance,
    this.team = const [],
    this.pendingReservations = 0,
    this.companyName,
    this.companyLogoUrl,
  });

  final int openLeads;

  /// NEW / INTERESTED leads older than [kStaleAfterDays] (the website's "follow up").
  final int staleLeads;
  final Map<String, int> stages;
  final int activeReservations;

  /// Booked units lapsing in the agenda's week, soonest first.
  final List<AgendaEvent> expiring;
  final List<AgendaEvent> visits;

  /// Visits still SCHEDULED (not confirmed by the customer) from now on.
  final int unconfirmedVisits;
  final SalesPerformanceRow? performance;

  /// The manager's team, highest sales first (`/sales-targets/performance`).
  final List<TeamRow> team;

  /// Reservations waiting for the manager's approval.
  final int pendingReservations;
  final String? companyName;
  final String? companyLogoUrl;

  /// Reservations lapsing within seven days (the website's "expiring soon").
  int expiringWithin7(DateTime now) =>
      expiring.where((e) => e.at.isBefore(now.add(const Duration(days: 7)))).length;
}

const kStaleAfterDays = 3;
const kAgendaDays = 7;

enum AgendaKind { visit, expiry }

/// One entry on the week's agenda: a visit, or a reservation lapsing.
class AgendaEvent {
  const AgendaEvent({
    required this.kind,
    required this.id,
    required this.at,
    required this.title,
    this.project,
    this.unitCode,
    this.place,
    this.who,
    this.confirmed = false,
  });

  final AgendaKind kind;
  final String id;
  final DateTime at;
  final String title;
  /// The visit's project.
  final Translatable? project;

  /// The lapsing reservation's unit.
  final String? unitCode;
  final String? place;

  /// The rep a visit is with (the manager's team agenda).
  final String? who;
  final bool confirmed;
}

/// One rep on the manager's home, as the website's team list.
class TeamRow {
  const TeamRow({
    required this.salesId,
    required this.name,
    required this.performance,
    required this.active,
  });
  final String salesId;
  final String name;
  final SalesPerformanceRow performance;

  /// Did anything this month (a lead, a visit, a booking or a contract).
  final bool active;

  factory TeamRow.fromJson(Map<String, dynamic> j) {
    int n(String k) => (j[k] as num?)?.toInt() ?? 0;
    return TeamRow(
      salesId: j['salesId'] as String? ?? '',
      name: j['salesName'] as String? ?? '',
      performance: SalesPerformanceRow.fromJson(j),
      active: n('leadsCount') + n('visitsCount') + n('reservationsCount') + n('signedContractsCount') > 0,
    );
  }
}

/// `GET /sales-targets/performance`, the rep's own row.
class SalesPerformanceRow {
  const SalesPerformanceRow({
    required this.achievedAmount,
    required this.achievedUnits,
    required this.signedContracts,
    required this.realizedValue,
    this.targetAmount,
    this.targetUnits,
    this.targetPercent,
  });

  final double achievedAmount;
  final int achievedUnits;
  final int signedContracts;
  final double realizedValue;
  final double? targetAmount;
  final int? targetUnits;
  final int? targetPercent;

  bool get hasTarget => (targetAmount ?? 0) > 0;
  double? get averageDeal => signedContracts > 0 ? realizedValue / signedContracts : null;

  factory SalesPerformanceRow.fromJson(Map<String, dynamic> j) => SalesPerformanceRow(
        achievedAmount: readAmount(j['achievedAmount']) ?? 0,
        achievedUnits: (j['achievedUnits'] as num?)?.toInt() ?? 0,
        signedContracts: (j['signedContractsCount'] as num?)?.toInt() ?? 0,
        realizedValue: readAmount(j['realizedValue']) ?? 0,
        targetAmount: readAmount(j['targetAmount']),
        targetUnits: (j['targetUnits'] as num?)?.toInt(),
        targetPercent: (j['targetAmountPercent'] as num?)?.round(),
      );
}

class SalesHomeRepository {
  SalesHomeRepository(this._dio, this._storage);
  final Dio _dio;
  final TokenStorage _storage;

  /// [team]: the manager's view — every visit of the team (with its rep), the
  /// team's rows and the bookings waiting for approval, as on the website.
  Future<Result<SalesHome>> load({required String userId, DateTime? now, bool team = false}) => guardApiCall(() async {
        final at = (now ?? DateTime.now()).toUtc();
        String iso(DateTime d) => d.toUtc().toIso8601String();
        final stale = at.subtract(const Duration(days: kStaleAfterDays));
        // A day back keeps this morning's visits on today.
        final from = at.subtract(const Duration(days: 1));
        final to = at.add(const Duration(days: kAgendaDays + 1));
        final local = at.toLocal();
        final period = '${local.year}-${local.month.toString().padLeft(2, '0')}';

        Future<Map<String, dynamic>> get(String path, Map<String, dynamic> q) async =>
            (await _dio.get<Map<String, dynamic>>(path, queryParameters: q)).data ?? const {};

        final results = await Future.wait<Object?>([
          get('/leads', {'pageSize': 1}),
          get('/leads', {'stage': 'NEW,INTERESTED', 'createdBefore': iso(stale), 'pageSize': 1}),
          get('/reservations', {'pageSize': 1}),
          get('/reservations', {
            'status': 'PENDING,APPROVED',
            'expiresFrom': iso(at),
            'expiresTo': iso(to),
            'sort': 'expiresAt',
            'pageSize': 100,
          }),
          get('/visits/appointments', {
            if (!team) 'assignedSalesId': userId,
            'scheduledFrom': iso(from),
            'scheduledTo': iso(to),
            'open': true,
            'pageSize': 100,
          }),
          get('/visits/appointments', {
            if (!team) 'assignedSalesId': userId,
            'status': 'SCHEDULED',
            'scheduledFrom': iso(at),
            'pageSize': 1,
          }),
          _dio
              .get<List<dynamic>>('/sales-targets/performance', queryParameters: {'period': period})
              .then((r) => r.data ?? const []),
          _branding(),
        ]);

        final leads = results[0]! as Map<String, dynamic>;
        final stages = _facet(leads, 'stage');
        final total = _total(leads);
        final resv = _facet(results[2]! as Map<String, dynamic>, 'status');
        final perfRows = (results[6]! as List).whereType<Map<String, dynamic>>().toList();
        final mine = perfRows.where((r) => r['salesId'] == userId).firstOrNull ?? perfRows.firstOrNull;
        final brand = results[7] as BrandTokens?;
        final rows = team
            ? (perfRows.map(TeamRow.fromJson).toList()
              ..sort((a, b) => b.performance.realizedValue.compareTo(a.performance.realizedValue)))
            : const <TeamRow>[];

        return SalesHome(
          openLeads: total - (stages['WON'] ?? 0) - (stages['LOST'] ?? 0),
          staleLeads: _total(results[1]! as Map<String, dynamic>),
          stages: stages,
          activeReservations: (resv['PENDING'] ?? 0) + (resv['APPROVED'] ?? 0),
          expiring: _rows(results[3]! as Map<String, dynamic>).map(_expiry).whereType<AgendaEvent>().toList(),
          visits: _rows(results[4]! as Map<String, dynamic>).map(_visit).whereType<AgendaEvent>().toList()
            ..sort((a, b) => a.at.compareTo(b.at)),
          unconfirmedVisits: _total(results[5]! as Map<String, dynamic>),
          performance: team
              ? _teamTotal(rows)
              : (mine == null ? null : SalesPerformanceRow.fromJson(mine)),
          team: rows,
          pendingReservations: resv['PENDING'] ?? 0,
          companyName: brand?.displayName,
          companyLogoUrl: brand?.logoUrl,
        );
      });

  /// The team's month: only the sales of reps who have a target count toward
  /// it (as on the website — a rep with none pushed the team past 100%).
  static SalesPerformanceRow _teamTotal(List<TeamRow> rows) {
    double sum(double Function(SalesPerformanceRow p) f) => rows.fold(0, (a, r) => a + f(r.performance));
    final target = sum((p) => p.targetAmount ?? 0);
    final onTarget = sum((p) => p.hasTarget ? p.achievedAmount : 0);
    return SalesPerformanceRow(
      achievedAmount: onTarget,
      achievedUnits: rows.fold(0, (a, r) => a + r.performance.achievedUnits),
      signedContracts: rows.fold(0, (a, r) => a + r.performance.signedContracts),
      realizedValue: sum((p) => p.realizedValue),
      targetAmount: target > 0 ? target : null,
      targetUnits: rows.fold<int>(0, (a, r) => a + (r.performance.targetUnits ?? 0)),
      targetPercent: target > 0 ? (onTarget / target * 100).round() : null,
    );
  }

  // Best-effort: the page shows without the company's name and logo.
  Future<BrandTokens?> _branding() async {
    final slug = await _storage.readSelectedCompanySlug();
    if (slug == null || slug.isEmpty) return null;
    return BrandingRepository(_dio).fetchBranding(slug);
  }

  static int _total(Map<String, dynamic> page) => ((page['meta'] as Map?)?['total'] as num?)?.toInt() ?? 0;

  static Map<String, int> _facet(Map<String, dynamic> page, String key) {
    final counts = (((page['meta'] as Map?)?['facets'] as Map?)?['counts'] as Map?)?[key];
    if (counts is! Map) return const {};
    return {for (final e in counts.entries) '${e.key}': (e.value as num?)?.toInt() ?? 0};
  }

  static Iterable<Map<String, dynamic>> _rows(Map<String, dynamic> page) =>
      (page['data'] as List? ?? const []).whereType<Map<String, dynamic>>();

  static String? _name(Object? person) => person is Map ? person['fullName'] as String? : null;

  static AgendaEvent? _visit(Map<String, dynamic> v) {
    final at = DateTime.tryParse(v['scheduledAt'] as String? ?? '');
    if (at == null) return null;
    return AgendaEvent(
      kind: AgendaKind.visit,
      id: v['id'] as String? ?? '',
      at: at.toLocal(),
      title: _name(v['lead']) ??
          _name(v['client']) ??
          ((v['visitRequest'] as Map?)?['customerName'] as String?) ??
          '',
      project: (v['project'] as Map?) == null ? null : Translatable.fromJson((v['project'] as Map)['name']),
      place: v['location'] as String?,
      who: _name(v['assignedSales']),
      confirmed: v['status'] == 'CONFIRMED',
    );
  }

  static AgendaEvent? _expiry(Map<String, dynamic> r) {
    final at = DateTime.tryParse(r['expiresAt'] as String? ?? '');
    if (at == null) return null;
    return AgendaEvent(
      kind: AgendaKind.expiry,
      id: r['id'] as String? ?? '',
      at: at.toLocal(),
      title: _name(r['client']) ?? _name(r['lead']) ?? (r['reservationNumber'] as String? ?? ''),
      unitCode: (r['unit'] as Map?)?['code'] as String?,
      place: r['reservationNumber'] as String?,
    );
  }
}
