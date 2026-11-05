import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

/// One booking on the list, as a row of the website's bookings page.
class ReservationRow extends Equatable {
  const ReservationRow({
    required this.id,
    required this.status,
    this.number,
    this.clientName,
    this.clientPhone,
    this.projectName,
    this.unitCode,
    this.salesId,
    this.salesName,
    this.viaBroker = false,
    this.bookingAmount = 0,
    this.bookingStatus,
    this.bookingPaidAt,
    this.months,
    this.monthly,
    this.expiresAt,
    this.createdAt,
    this.approvedAt,
    this.convertedAt,
    this.closedAt,
    this.reason,
  });

  final String id;

  /// PENDING, APPROVED, CONVERTED, REJECTED, CANCELLED, EXPIRED.
  final String status;
  final String? number;
  final String? clientName;
  final String? clientPhone;
  final String? projectName;
  final String? unitCode;
  final String? salesId;
  final String? salesName;
  final bool viaBroker;
  final double bookingAmount;

  /// UNPAID, PAID, WAIVED.
  final String? bookingStatus;
  final DateTime? bookingPaidAt;
  final int? months;
  final double? monthly;
  final DateTime? expiresAt;
  final DateTime? createdAt;
  final DateTime? approvedAt;
  final DateTime? convertedAt;

  /// When it was rejected or cancelled.
  final DateTime? closedAt;
  final String? reason;

  bool get open => status == 'PENDING' || status == 'APPROVED';
  bool get closed => status == 'REJECTED' || status == 'CANCELLED' || status == 'EXPIRED';

  /// The booking amount is settled (paid, waived, or there is none).
  bool get bookingSettled => bookingAmount <= 0 || bookingStatus == 'PAID' || bookingStatus == 'WAIVED';

  String get displayNumber => number ?? '#${id.substring(0, id.length < 8 ? id.length : 8).toUpperCase()}';

  /// Whole days from [today] to the expiry (negative once lapsed).
  int? daysLeft(DateTime today) {
    final e = expiresAt;
    if (e == null) return null;
    return DateTime(e.year, e.month, e.day).difference(DateTime(today.year, today.month, today.day)).inDays;
  }

  factory ReservationRow.fromJson(Map<String, dynamic> j) {
    final person = (j['client'] as Map?) ?? (j['lead'] as Map?);
    final unit = j['unit'] as Map<String, dynamic>?;
    final project = ((unit?['building'] as Map?)?['phase'] as Map?)?['project'] as Map?;
    DateTime? at(String k) => DateTime.tryParse('${j[k]}')?.toLocal();
    return ReservationRow(
      id: '${j['id']}',
      status: j['status'] as String? ?? 'PENDING',
      number: j['reservationNumber'] as String?,
      clientName: person?['fullName'] as String?,
      clientPhone: person?['phone'] as String?,
      projectName: project == null ? null : Translatable.fromJson(project['name']).resolve('ar'),
      unitCode: unit?['code'] as String?,
      salesId: j['salesId'] as String? ?? (j['sales'] as Map?)?['id'] as String?,
      salesName: (j['sales'] as Map?)?['fullName'] as String?,
      viaBroker: j['brokerId'] != null,
      bookingAmount: readAmount(j['bookingAmount']) ?? 0,
      bookingStatus: j['bookingPaymentStatus'] as String?,
      bookingPaidAt: at('bookingPaidAt'),
      months: (j['selectedDurationMonths'] as num?)?.toInt(),
      monthly: readAmount(j['snapshotMonthlyInstallment']),
      expiresAt: at('expiresAt'),
      createdAt: at('createdAt'),
      approvedAt: at('approvedAt'),
      convertedAt: at('convertedAt'),
      closedAt: at('rejectedAt') ?? at('cancelledAt'),
      reason: j['reason'] as String?,
    );
  }

  @override
  List<Object?> get props => [id, status, bookingStatus, expiresAt, convertedAt];
}

/// Who may approve or reject: the admin, or a sales manager on a booking
/// that is not their own (the API's rule).
bool canDecideBooking(ReservationRow r, {required AppRole? role, required String? userId}) {
  if (r.status != 'PENDING') return false;
  if (role == AppRole.admin) return true;
  return role == AppRole.salesManager && r.salesId != null && r.salesId != userId;
}

/// How many bookings in each state, over what the viewer may see.
class ReservationsCounts extends Equatable {
  const ReservationsCounts({this.all = 0, this.byStatus = const {}, this.awaitingPayment = 0});
  final int all;
  final Map<String, int> byStatus;

  /// Approved, with the booking amount still to pay.
  final int awaitingPayment;

  int of(String s) => byStatus[s] ?? 0;
  int get active => of('PENDING') + of('APPROVED');
  int get closed => of('REJECTED') + of('CANCELLED') + of('EXPIRED');

  @override
  List<Object?> get props => [all, byStatus, awaitingPayment];
}

/// What the list is narrowed by: the website's bookings filters.
class ReservationsQuery extends Equatable {
  const ReservationsQuery({this.filter, this.projectId, this.salesId, this.search = ''});

  /// PENDING, APPROVED, CONVERTED, CLOSED (rejected, cancelled, lapsed) or null.
  final String? filter;
  final String? projectId;
  final String? salesId;
  final String search;

  Map<String, dynamic> params(int page, int pageSize) => {
        'page': page,
        'pageSize': pageSize,
        if (filter == 'CLOSED') 'status': 'REJECTED,CANCELLED,EXPIRED' else 'status': ?filter,
        'projectId': ?projectId,
        'salesId': ?salesId,
        if (search.isNotEmpty) 'q': search,
      };

  ReservationsQuery copyWith({String? Function()? filter, String? Function()? projectId, String? Function()? salesId, String? search}) =>
      ReservationsQuery(
        filter: filter == null ? this.filter : filter(),
        projectId: projectId == null ? this.projectId : projectId(),
        salesId: salesId == null ? this.salesId : salesId(),
        search: search ?? this.search,
      );

  @override
  List<Object?> get props => [filter, projectId, salesId, search];
}

// ── A booking ────────────────────────────────────────────────────────────────

class ReservationEvent extends Equatable {
  const ReservationEvent({required this.type, this.at, this.by, this.note, this.isNote = false});

  /// CREATED, APPROVED, … or NOTE for a note.
  final String type;
  final DateTime? at;
  final String? by;
  final String? note;
  final bool isNote;

  @override
  List<Object?> get props => [type, at, by, note, isNote];
}

/// A booking as the website's booking page shows it.
class ReservationPage extends Equatable {
  const ReservationPage({
    required this.row,
    this.planName,
    this.down,
    this.total,
    this.unitPrice,
    this.contractId,
    this.contractNumber,
    this.events = const [],
  });

  final ReservationRow row;
  final String? planName;
  final double? down;
  final double? total;
  final double? unitPrice;
  final String? contractId;
  final String? contractNumber;

  /// Activities and notes, newest first.
  final List<ReservationEvent> events;

  static ReservationPage parse(Map<String, dynamic> j) {
    List<Map<String, dynamic>> maps(Object? v) => (v as List?)?.whereType<Map<String, dynamic>>().toList() ?? const [];
    final events = [
      for (final a in maps(j['activities']))
        if (a['type'] != 'NOTE_ADDED')
          ReservationEvent(
            type: a['type'] as String? ?? '',
            at: DateTime.tryParse('${a['createdAt']}')?.toLocal(),
            by: (a['actor'] as Map?)?['fullName'] as String?,
            note: a['note'] as String?,
          ),
      for (final n in maps(j['reservationNotes']))
        ReservationEvent(
          type: 'NOTE',
          isNote: true,
          at: DateTime.tryParse('${n['createdAt']}')?.toLocal(),
          by: (n['author'] as Map?)?['fullName'] as String?,
          note: n['body'] as String?,
        ),
    ]..sort((a, b) => (b.at ?? DateTime(0)).compareTo(a.at ?? DateTime(0)));
    final contract = j['contract'] as Map?;
    return ReservationPage(
      row: ReservationRow.fromJson(j),
      planName: (j['installmentPlanTemplate'] as Map?)?['name'] as String?,
      down: readAmount(j['snapshotDownPaymentAmount']),
      total: readAmount(j['snapshotTotalPayable']),
      unitPrice: readAmount((j['unit'] as Map?)?['price']),
      contractId: contract?['id'] as String?,
      contractNumber: contract?['contractNumber'] as String?,
      events: events,
    );
  }

  @override
  List<Object?> get props => [row, contractId, events];
}

class ReservationsViewRepository {
  ReservationsViewRepository(this._dio);
  final Dio _dio;
  static const pageSize = 20;

  /// The counts the list itself gives (scoped to the viewer, unlike
  /// /reservations/stats, which counts the whole company).
  Future<ReservationsCounts> counts({String? projectId, String? salesId}) async {
    final scope = {'projectId': ?projectId, 'salesId': ?salesId};
    final results = await Future.wait([
      _dio.get<Map<String, dynamic>>('/reservations', queryParameters: {...scope, 'pageSize': 1}),
      _dio.get<Map<String, dynamic>>('/reservations', queryParameters: {...scope, 'status': 'APPROVED', 'pageSize': 100}),
    ]);
    final meta = results[0].data?['meta'] as Map?;
    final byStatus = (((meta?['facets'] as Map?)?['counts'] as Map?)?['status'] as Map?) ?? const {};
    final approved = ((results[1].data?['data'] as List?) ?? const []).whereType<Map<String, dynamic>>().map(ReservationRow.fromJson);
    return ReservationsCounts(
      all: (meta?['total'] as num?)?.toInt() ?? 0,
      byStatus: {for (final e in byStatus.entries) '${e.key}': (e.value as num?)?.toInt() ?? 0},
      awaitingPayment: approved.where((r) => !r.bookingSettled).length,
    );
  }

  Future<Result<(List<ReservationRow>, int)>> page(ReservationsQuery q, int page) => guardApiCall(() async {
        final r = await _dio.get<Map<String, dynamic>>('/reservations', queryParameters: q.params(page, pageSize));
        final rows = ((r.data?['data'] as List?) ?? const []).whereType<Map<String, dynamic>>().map(ReservationRow.fromJson).toList();
        return (rows, ((r.data?['meta'] as Map?)?['total'] as num?)?.toInt() ?? rows.length);
      });

  /// How many bookings a choice gives, for the filter's apply label.
  Future<int?> count(ReservationsQuery q) => _dio
      .get<Map<String, dynamic>>('/reservations', queryParameters: q.params(1, 1))
      .then<int?>((r) => ((r.data?['meta'] as Map?)?['total'] as num?)?.toInt())
      .catchError((Object _) => null);

  /// The consultants and projects for the filter.
  Future<(List<(String, String)>, List<(String, String)>)> options({required bool consultants}) async {
    List<(String, String)> rows(Response<Map<String, dynamic>> r, String Function(Map<String, dynamic>) name) => [
          for (final o in ((r.data?['data'] as List?) ?? const []).whereType<Map<String, dynamic>>()) ('${o['id']}', name(o)),
        ];
    final results = await Future.wait([
      _dio.get<Map<String, dynamic>>('/projects/options'),
      if (consultants) _dio.get<Map<String, dynamic>>('/users/options', queryParameters: {'role': 'SALES,SALES_MANAGER'}),
    ]).catchError((Object _) => <Response<Map<String, dynamic>>>[]);
    if (results.isEmpty) return (const <(String, String)>[], const <(String, String)>[]);
    return (
      rows(results[0], (o) => Translatable.fromJson(o['name']).resolve('ar')),
      consultants && results.length > 1 ? rows(results[1], (o) => '${o['fullName'] ?? o['name'] ?? '—'}') : const <(String, String)>[],
    );
  }

  Future<Result<ReservationPage>> load(String id) => guardApiCall(() async {
        final r = await _dio.get<Map<String, dynamic>>('/reservations/$id');
        return ReservationPage.parse(r.data ?? const {});
      });

  Future<Result<void>> approve(String id) => guardApiCall(() => _dio.post<void>('/reservations/$id/approve', data: const <String, dynamic>{}));
  Future<Result<void>> reject(String id, String? reason) =>
      guardApiCall(() => _dio.post<void>('/reservations/$id/reject', data: {if ((reason ?? '').trim().isNotEmpty) 'reason': reason!.trim()}));
  Future<Result<void>> cancel(String id, String reason) => guardApiCall(() => _dio.post<void>('/reservations/$id/cancel', data: {'reason': reason}));
  Future<Result<void>> confirmPayment(String id, {required DateTime paidAt, required String method}) => guardApiCall(
        () => _dio.post<void>('/reservations/$id/booking-payment/confirm', data: {'paidAt': paidAt.toUtc().toIso8601String(), 'paymentMethod': method}),
      );
  Future<Result<void>> addNote(String id, String body) => guardApiCall(() => _dio.post<void>('/reservations/$id/notes', data: {'body': body}));
}

class ReservationsListState extends Equatable {
  const ReservationsListState({
    this.status = DataStatus.initial,
    this.rows = const [],
    this.total = 0,
    this.page = 1,
    this.loadingMore = false,
    this.counts,
    this.query = const ReservationsQuery(),
    this.failure,
    this.working = const {},
  });

  final DataStatus status;
  final List<ReservationRow> rows;
  final int total;
  final int page;
  final bool loadingMore;
  final ReservationsCounts? counts;
  final ReservationsQuery query;
  final AppFailure? failure;

  /// Bookings with an approve / reject on the way.
  final Set<String> working;

  bool get hasMore => rows.length < total;

  ReservationsListState copyWith({
    DataStatus? status,
    List<ReservationRow>? rows,
    int? total,
    int? page,
    bool? loadingMore,
    ReservationsCounts? counts,
    ReservationsQuery? query,
    AppFailure? failure,
    Set<String>? working,
  }) =>
      ReservationsListState(
        status: status ?? this.status,
        rows: rows ?? this.rows,
        total: total ?? this.total,
        page: page ?? this.page,
        loadingMore: loadingMore ?? this.loadingMore,
        counts: counts ?? this.counts,
        query: query ?? this.query,
        failure: failure ?? this.failure,
        working: working ?? this.working,
      );

  @override
  List<Object?> get props => [status, rows, total, page, loadingMore, counts, query, failure, working];
}

class ReservationsListCubit extends Cubit<ReservationsListState> {
  ReservationsListCubit(this._repo) : super(const ReservationsListState());
  final ReservationsViewRepository _repo;

  ReservationsViewRepository get repository => _repo;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading));
    final q = state.query;
    final results = await Future.wait<Object?>([
      _repo.page(q, 1),
      _repo.counts(projectId: q.projectId, salesId: q.salesId).then<Object?>((c) => c).catchError((Object _) => null),
    ]);
    if (isClosed) return;
    final counts = results[1] as ReservationsCounts?;
    (results[0]! as Result<(List<ReservationRow>, int)>).when(
      ok: (d) => emit(state.copyWith(
        status: d.$1.isEmpty ? DataStatus.empty : DataStatus.success,
        rows: d.$1,
        total: d.$2,
        page: 1,
        counts: counts,
      )),
      err: (f) => emit(state.copyWith(status: DataStatus.failure, failure: f, counts: counts)),
    );
  }

  Future<void> loadMore() async {
    if (state.loadingMore || !state.hasMore || state.status != DataStatus.success) return;
    emit(state.copyWith(loadingMore: true));
    final r = await _repo.page(state.query, state.page + 1);
    if (isClosed) return;
    r.when(
      ok: (d) => emit(state.copyWith(rows: [...state.rows, ...d.$1], page: state.page + 1, loadingMore: false)),
      err: (_) => emit(state.copyWith(loadingMore: false)),
    );
  }

  Future<void> apply(ReservationsQuery q) async {
    emit(state.copyWith(query: q));
    await load();
  }

  Future<void> setFilter(String? f) => apply(state.query.copyWith(filter: () => state.query.filter == f ? null : f));
  Future<void> setSearch(String q) => apply(state.query.copyWith(search: q.trim()));
  Future<int?> count(ReservationsQuery q) => _repo.count(q);

  /// Approve or reject from the card; the list reloads after.
  Future<AppFailure?> decide(String id, {required bool approve, String? reason}) async {
    emit(state.copyWith(working: {...state.working, id}));
    final r = approve ? await _repo.approve(id) : await _repo.reject(id, reason);
    if (isClosed) return null;
    emit(state.copyWith(working: {...state.working}..remove(id)));
    final failure = r.failureOrNull;
    if (failure == null) await load();
    return failure;
  }
}

class ReservationPageCubit extends Cubit<DataState<ReservationPage>> {
  ReservationPageCubit(this._repo, {required this.reservationId}) : super(const DataState.initial());
  final ReservationsViewRepository _repo;
  final String reservationId;

  Future<void> load() async {
    emit(DataState.loading(previousData: state.data));
    final r = await _repo.load(reservationId);
    if (isClosed) return;
    r.when(ok: (p) => emit(DataState.success(p)), err: (f) => emit(DataState.failure(f, previousData: state.data)));
  }

  /// Runs an action, then reloads; the failure, if any, for a message.
  Future<AppFailure?> act(Future<Result<void>> Function(ReservationsViewRepository repo, String id) action) async {
    final r = await action(_repo, reservationId);
    if (isClosed) return null;
    final failure = r.failureOrNull;
    if (failure == null) await load();
    return failure;
  }
}
