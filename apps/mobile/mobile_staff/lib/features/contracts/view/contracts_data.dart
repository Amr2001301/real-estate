import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

/// One contract on the list, as a row of the website's contracts page.
class ContractRow extends Equatable {
  const ContractRow({
    required this.id,
    required this.status,
    this.number,
    this.customerName,
    this.customerPhone,
    this.projectName,
    this.unitCode,
    this.total,
    this.downPayment,
    this.signedAt,
    this.reservationNumber,
    this.planMonths,
    this.planMonthly,
  });

  final String id;

  /// ACTIVE, UNSIGNED, CANCELLED…
  final String status;
  final String? number;
  final String? customerName;
  final String? customerPhone;
  final String? projectName;
  final String? unitCode;
  final double? total;
  final double? downPayment;
  final DateTime? signedAt;

  /// The booking it came from; null for a manual contract.
  final String? reservationNumber;
  final int? planMonths;
  final double? planMonthly;

  bool get cancelled => status == 'CANCELLED';
  String get displayNumber => number ?? '#${id.substring(0, id.length < 8 ? id.length : 8).toUpperCase()}';

  factory ContractRow.fromJson(Map<String, dynamic> j) {
    final customer = j['customer'] as Map<String, dynamic>?;
    final unit = j['unit'] as Map<String, dynamic>?;
    final project = ((unit?['building'] as Map?)?['phase'] as Map?)?['project'] as Map?;
    final plan = j['installmentPlan'] as Map<String, dynamic>?;
    return ContractRow(
      id: '${j['id']}',
      status: j['status'] as String? ?? (j['signedAt'] == null ? 'UNSIGNED' : 'ACTIVE'),
      number: j['contractNumber'] as String?,
      customerName: customer?['fullName'] as String?,
      customerPhone: customer?['phone'] as String?,
      projectName: project == null ? null : Translatable.fromJson(project['name']).resolve('ar'),
      unitCode: unit?['code'] as String?,
      total: readAmount(j['totalAmount']),
      downPayment: readAmount(j['downPayment']),
      signedAt: DateTime.tryParse('${j['signedAt']}')?.toLocal(),
      reservationNumber: (j['reservation'] as Map?)?['reservationNumber'] as String?,
      planMonths: (plan?['totalMonths'] as num?)?.toInt(),
      planMonthly: readAmount(plan?['monthlyAmount']),
    );
  }

  @override
  List<Object?> get props => [id, status, number, total, signedAt];
}

class ContractsCounts extends Equatable {
  const ContractsCounts({this.all = 0, this.signed = 0, this.unsigned = 0, this.delayed = 0});
  final int all;
  final int signed;
  final int unsigned;
  final int delayed;

  @override
  List<Object?> get props => [all, signed, unsigned, delayed];
}

/// What the list is narrowed by: the website's contracts filters.
class ContractsQuery extends Equatable {
  const ContractsQuery({this.filter, this.source, this.search = ''});

  /// SIGNED, UNSIGNED, DELAYED, or null for all.
  final String? filter;

  /// RESERVATION, MANUAL, or null for both.
  final String? source;
  final String search;

  Map<String, dynamic> params(int page, int pageSize) => {
        'page': page,
        'pageSize': pageSize,
        if (filter == 'SIGNED') 'signed': 'yes',
        if (filter == 'UNSIGNED') 'signed': 'no',
        if (filter == 'DELAYED') 'deliveryDelayed': 'true',
        if (source == 'RESERVATION') 'hasReservation': 'yes',
        if (source == 'MANUAL') 'hasReservation': 'no',
        if (search.isNotEmpty) 'q': search,
      };

  ContractsQuery copyWith({String? Function()? filter, String? Function()? source, String? search}) => ContractsQuery(
        filter: filter == null ? this.filter : filter(),
        source: source == null ? this.source : source(),
        search: search ?? this.search,
      );

  @override
  List<Object?> get props => [filter, source, search];
}

// ── A contract ──────────────────────────────────────────────────────────────

class ContractInstallment extends Equatable {
  const ContractInstallment({
    required this.id,
    required this.type,
    required this.status,
    this.dueDate,
    this.amount,
    this.paidAt,
    this.awaiting = false,
  });

  final String id;

  /// DOWN_PAYMENT, INSTALLMENT, FINAL_PAYMENT, FEE…
  final String type;

  /// PAID, PENDING, OVERDUE…
  final String status;
  final DateTime? dueDate;
  final double? amount;
  final DateTime? paidAt;

  /// A payment for it waits for review.
  final bool awaiting;

  bool get paid => status == 'PAID';
  bool late(DateTime today) => !paid && (status == 'OVERDUE' || (dueDate != null && dueDate!.isBefore(today)));

  @override
  List<Object?> get props => [id, type, status, dueDate, amount, paidAt, awaiting];
}

class ContractStatementLine extends Equatable {
  const ContractStatementLine({required this.kind, this.rowType, this.date, this.debit = 0, this.credit = 0, this.balance = 0, this.method});
  final String kind;
  final String? rowType;
  final DateTime? date;
  final double debit;
  final double credit;
  final double balance;
  final String? method;

  @override
  List<Object?> get props => [kind, rowType, date, debit, credit, balance];
}

class ContractPayment extends Equatable {
  const ContractPayment({required this.id, this.type, this.amount, this.paidAt, this.method, this.review});
  final String id;
  final String? type;
  final double? amount;
  final DateTime? paidAt;
  final String? method;

  /// NO_PROOF, PENDING_REVIEW, APPROVED, REJECTED.
  final String? review;

  @override
  List<Object?> get props => [id, type, amount, paidAt, method, review];
}

/// A contract as the website's contract page shows it.
class ContractPage extends Equatable {
  const ContractPage({
    required this.row,
    this.expectedDelivery,
    this.delayDays = 0,
    this.planStarts,
    this.planFrequency,
    this.salesName,
    this.brokerName,
    this.brokerAgentName,
    this.pdfUrl,
    this.installments = const [],
    this.lines = const [],
    this.payments = const [],
    this.contractValue,
    this.paid = 0,
    this.balance,
    this.overdue = 0,
    this.openFees = 0,
    this.upcoming = 0,
  });

  final ContractRow row;
  final DateTime? expectedDelivery;
  final int delayDays;
  final DateTime? planStarts;
  final String? planFrequency;
  final String? salesName;
  final String? brokerName;
  final String? brokerAgentName;
  final String? pdfUrl;
  final List<ContractInstallment> installments;
  final List<ContractStatementLine> lines;
  final List<ContractPayment> payments;

  /// The statement's totals (`/contracts/:id/statement`), as the website.
  final double? contractValue;
  final double paid;
  final double? balance;
  final double overdue;
  final double openFees;
  final double upcoming;

  double get value => contractValue ?? row.total ?? 0;
  double get remaining => balance ?? (value - paid);
  int get collectedPct => value <= 0 ? 0 : (paid * 100 / value).clamp(0, 100).round();

  int lateCount(DateTime today) => installments.where((i) => i.late(today)).length;

  /// The first instalment still to pay, by due date.
  ContractInstallment? get nextUnpaid {
    final open = installments.where((i) => !i.paid && !i.awaiting).toList()
      ..sort((a, b) => (a.dueDate ?? DateTime(9999)).compareTo(b.dueDate ?? DateTime(9999)));
    return open.firstOrNull;
  }

  /// The plan's instalments only (not the down payment or fees), for "n of N".
  int get planCount => installments.where((i) => i.type == 'INSTALLMENT').length;

  static ContractPage parse(Map<String, dynamic> j, {Map<String, dynamic>? statement}) {
    List<Map<String, dynamic>> maps(Object? v) => (v as List?)?.whereType<Map<String, dynamic>>().toList() ?? const [];
    final plan = j['installmentPlan'] as Map<String, dynamic>?;
    final totals = (statement?['totals'] as Map?) ?? const {};
    final broker = j['broker'] as Map<String, dynamic>?;
    final installments = [
      for (final i in maps(plan?['installments']))
        ContractInstallment(
          id: '${i['id']}',
          type: i['type'] as String? ?? 'INSTALLMENT',
          status: i['status'] as String? ?? 'PENDING',
          dueDate: DateTime.tryParse('${i['dueDate']}'),
          amount: readAmount(i['amount']),
          paidAt: DateTime.tryParse('${i['paidAt']}')?.toLocal(),
          awaiting: i['awaitingPayment'] == true,
        ),
    ]..sort((a, b) => (a.dueDate ?? DateTime(9999)).compareTo(b.dueDate ?? DateTime(9999)));
    return ContractPage(
      row: ContractRow.fromJson(j),
      expectedDelivery: DateTime.tryParse('${j['expectedDeliveryDate'] ?? j['deliveryDate']}'),
      delayDays: (j['deliveryDelayDays'] as num?)?.toInt() ?? 0,
      planStarts: DateTime.tryParse('${plan?['startsAt']}'),
      planFrequency: plan?['frequency'] as String?,
      salesName: ((j['reservation'] as Map?)?['sales'] as Map?)?['fullName'] as String?,
      brokerName: (broker?['companyName'] ?? broker?['name']) as String?,
      brokerAgentName: (j['brokerAgent'] as Map?)?['fullName'] as String?,
      pdfUrl: j['pdfUrl'] as String?,
      installments: installments,
      lines: [
        for (final l in maps(statement?['lines']))
          ContractStatementLine(
            kind: l['kind'] as String? ?? '',
            rowType: l['rowType'] as String?,
            date: DateTime.tryParse('${l['date']}'),
            debit: readAmount(l['debit']) ?? 0,
            credit: readAmount(l['credit']) ?? 0,
            balance: readAmount(l['balance']) ?? 0,
            method: l['method'] as String?,
          ),
      ],
      payments: [
        for (final d in maps(j['deposits']))
          ContractPayment(
            id: '${d['id']}',
            type: d['type'] as String?,
            amount: readAmount(d['amount']),
            paidAt: DateTime.tryParse('${d['paidAt']}')?.toLocal(),
            method: d['paymentMethod'] as String?,
            review: d['reviewStatus'] as String?,
          ),
      ],
      contractValue: readAmount(totals['contractValue']),
      paid: readAmount(totals['paid']) ?? 0,
      balance: readAmount(totals['balance']),
      overdue: readAmount(totals['overdue']) ?? 0,
      openFees: readAmount(totals['openFees']) ?? 0,
      upcoming: readAmount(totals['upcoming']) ?? 0,
    );
  }

  @override
  List<Object?> get props => [row, installments, lines, payments, paid, balance, overdue];
}

class ContractsViewRepository {
  ContractsViewRepository(this._dio);
  final Dio _dio;
  static const pageSize = 20;

  Future<int?> _count(Map<String, dynamic> q) => _dio
      .get<Map<String, dynamic>>('/contracts', queryParameters: {...q, 'pageSize': 1})
      .then<int?>((r) => ((r.data?['meta'] as Map?)?['total'] as num?)?.toInt())
      .catchError((Object _) => null);

  /// Over every contract the user may see (the server scopes a rep to their
  /// own, a manager to the team's), as the website's strip.
  /// How many contracts a choice gives, for the filter's apply label.
  Future<int?> count(ContractsQuery q) => _count(q.params(1, 1));

  Future<ContractsCounts> counts() async {
    final c = await Future.wait([
      _count(const {}),
      _count(const {'signed': 'yes'}),
      _count(const {'signed': 'no'}),
      _count(const {'deliveryDelayed': 'true'}),
    ]);
    return ContractsCounts(all: c[0] ?? 0, signed: c[1] ?? 0, unsigned: c[2] ?? 0, delayed: c[3] ?? 0);
  }

  Future<Result<(List<ContractRow>, int)>> page(ContractsQuery q, int page) => guardApiCall(() async {
        final r = await _dio.get<Map<String, dynamic>>('/contracts', queryParameters: q.params(page, pageSize));
        final rows = ((r.data?['data'] as List?) ?? const []).whereType<Map<String, dynamic>>().map(ContractRow.fromJson).toList();
        return (rows, ((r.data?['meta'] as Map?)?['total'] as num?)?.toInt() ?? rows.length);
      });

  Future<Result<ContractPage>> load(String id) => guardApiCall(() async {
        final results = await Future.wait<Object?>([
          _dio.get<Map<String, dynamic>>('/contracts/$id').then((r) => r.data ?? const <String, dynamic>{}),
          _dio
              .get<Map<String, dynamic>>('/contracts/$id/statement')
              .then<Object?>((r) => r.data)
              .catchError((Object _) => null),
        ]);
        return ContractPage.parse(results[0]! as Map<String, dynamic>, statement: results[1] as Map<String, dynamic>?);
      });
}

// ── The list ────────────────────────────────────────────────────────────────

class ContractsListState extends Equatable {
  const ContractsListState({
    this.status = DataStatus.initial,
    this.rows = const [],
    this.total = 0,
    this.page = 1,
    this.loadingMore = false,
    this.counts,
    this.query = const ContractsQuery(),
    this.failure,
  });
  final DataStatus status;
  final List<ContractRow> rows;
  final int total;
  final int page;
  final bool loadingMore;
  final ContractsCounts? counts;
  final ContractsQuery query;
  final AppFailure? failure;

  bool get hasMore => rows.length < total;

  ContractsListState copyWith({
    DataStatus? status,
    List<ContractRow>? rows,
    int? total,
    int? page,
    bool? loadingMore,
    ContractsCounts? counts,
    ContractsQuery? query,
    AppFailure? failure,
  }) =>
      ContractsListState(
        status: status ?? this.status,
        rows: rows ?? this.rows,
        total: total ?? this.total,
        page: page ?? this.page,
        loadingMore: loadingMore ?? this.loadingMore,
        counts: counts ?? this.counts,
        query: query ?? this.query,
        failure: failure ?? this.failure,
      );

  @override
  List<Object?> get props => [status, rows, total, page, loadingMore, counts, query, failure];
}

class ContractsListCubit extends Cubit<ContractsListState> {
  ContractsListCubit(this._repo) : super(const ContractsListState());
  final ContractsViewRepository _repo;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading));
    final results = await Future.wait<Object?>([
      _repo.page(state.query, 1),
      if (state.counts == null) _repo.counts(),
    ]);
    if (isClosed) return;
    final counts = state.counts ?? results[1] as ContractsCounts;
    (results[0]! as Result<(List<ContractRow>, int)>).when(
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

  Future<void> apply(ContractsQuery q) async {
    emit(state.copyWith(query: q));
    await load();
  }

  Future<int?> count(ContractsQuery q) => _repo.count(q);

  Future<void> setFilter(String? f) => apply(state.query.copyWith(filter: () => state.query.filter == f ? null : f));
  Future<void> setSource(String? s) => apply(state.query.copyWith(source: () => s));
  Future<void> setSearch(String q) => apply(state.query.copyWith(search: q.trim()));
}

class ContractPageCubit extends Cubit<DataState<ContractPage>> {
  ContractPageCubit(this._repo, {required this.contractId}) : super(const DataState.initial());
  final ContractsViewRepository _repo;
  final String contractId;

  Future<void> load() async {
    if (state.data == null) emit(state.toLoading());
    final r = await _repo.load(contractId);
    if (isClosed) return;
    r.when(ok: (d) => emit(DataState.success(d)), err: (f) => emit(state.data == null ? state.toFailure(f) : state));
  }
}
