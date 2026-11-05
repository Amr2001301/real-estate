import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

/// The groups the list is told apart by (the website's payment state).
enum PaymentGroup { review, cheque, collected, closed }

/// One payment, as the website's payments list shows it.
class PaymentRow extends Equatable {
  const PaymentRow({
    required this.id,
    this.type,
    this.amount = 0,
    this.paidAt,
    this.state = 'COLLECTED',
    this.method,
    this.rejectionReason,
    this.hasProof = false,
    this.instrumentId,
    this.chequeNumber,
    this.contractId,
    this.contractNumber,
    this.reservationNumber,
    this.clientName,
    this.unitCode,
    this.dueDate,
    this.installmentAmount,
    this.reversedAt,
    this.reversedBy,
    this.reversalReason,
  });

  final String id;

  /// BOOKING_AMOUNT, DOWN_PAYMENT, INSTALLMENT, FINAL_PAYMENT or FEE.
  final String? type;
  final double amount;
  final DateTime? paidAt;

  /// COLLECTED, PENDING_REVIEW, CHEQUE_PENDING, REJECTED, BOUNCED, REVERSED.
  final String state;

  /// CASH, BANK_TRANSFER, CHEQUE or OTHER.
  final String? method;
  final String? rejectionReason;
  final bool hasProof;
  final String? instrumentId;
  final String? chequeNumber;
  final String? contractId;
  final String? contractNumber;
  final String? reservationNumber;
  final String? clientName;
  final String? unitCode;
  final DateTime? dueDate;
  final double? installmentAmount;
  final DateTime? reversedAt;
  final String? reversedBy;
  final String? reversalReason;

  factory PaymentRow.fromJson(Map<String, dynamic> j) {
    final contract = j['contract'] as Map<String, dynamic>?;
    final reservation = j['reservation'] as Map<String, dynamic>?;
    final installment = j['installment'] as Map<String, dynamic>?;
    final instrument = j['paymentInstrument'] as Map<String, dynamic>?;
    String? name() =>
        ((contract?['customer'] as Map?)?['fullName'] ?? (reservation?['client'] as Map?)?['fullName'] ?? (reservation?['lead'] as Map?)?['fullName']) as String?;
    String? unit() => ((contract?['unit'] as Map?)?['code'] ?? (reservation?['unit'] as Map?)?['code']) as String?;
    DateTime? date(Object? v) => v is String ? DateTime.tryParse(v)?.toLocal() : null;
    return PaymentRow(
      id: '${j['id']}',
      type: j['type'] as String?,
      amount: readAmount(j['amount']) ?? 0,
      paidAt: date(j['paidAt']),
      state: (j['state'] as String?) ?? 'COLLECTED',
      method: j['paymentMethod'] as String?,
      rejectionReason: j['rejectionReason'] as String?,
      hasProof: j['proofDocumentId'] != null || j['receiptUrl'] != null,
      instrumentId: j['paymentInstrumentId'] as String?,
      chequeNumber: instrument?['chequeNumber'] as String?,
      contractId: j['contractId'] as String?,
      contractNumber: contract?['contractNumber'] as String?,
      reservationNumber: reservation?['reservationNumber'] as String?,
      clientName: name(),
      unitCode: unit(),
      dueDate: date(installment?['dueDate']),
      installmentAmount: readAmount(installment?['amount']),
      reversedAt: date(j['reversedAt']),
      reversedBy: j['reversedBy'] is String ? j['reversedBy'] as String : (j['reversedBy'] as Map?)?['fullName'] as String?,
      reversalReason: j['reversalReason'] as String?,
    );
  }

  PaymentGroup get group => switch (state) {
        'PENDING_REVIEW' => PaymentGroup.review,
        'CHEQUE_PENDING' => PaymentGroup.cheque,
        'COLLECTED' => PaymentGroup.collected,
        _ => PaymentGroup.closed,
      };

  /// The number the payment is made against (the contract, else the booking).
  String? get reference => contractNumber ?? reservationNumber;

  bool matches(String q) {
    final s = q.trim().toLowerCase();
    if (s.isEmpty) return true;
    return [clientName, contractNumber, reservationNumber, unitCode, chequeNumber].any((v) => (v ?? '').toLowerCase().contains(s));
  }

  @override
  List<Object?> get props => [id, state, amount, paidAt, method, hasProof, reversedAt];
}

class PaymentTotals extends Equatable {
  const PaymentTotals({this.amount = 0, this.count = 0});
  final double amount;
  final int count;

  @override
  List<Object?> get props => [amount, count];
}

class PaymentsRepository {
  PaymentsRepository(this._dio);
  final Dio _dio;

  /// Every payment the viewer may see, read whole (pages of 100) and told
  /// apart on the phone; with the website's collected total.
  Future<Result<(List<PaymentRow>, PaymentTotals)>> all({String? contractId}) => guardApiCall(() async {
        final out = <PaymentRow>[];
        var totals = const PaymentTotals();
        for (var page = 1; page <= 20; page++) {
          final r = await _dio.get<Map<String, dynamic>>('/deposits', queryParameters: {'page': page, 'pageSize': 100, 'contractId': ?contractId});
          final rows = ((r.data?['data'] as List?) ?? const []).whereType<Map<String, dynamic>>();
          out.addAll(rows.map(PaymentRow.fromJson));
          if (page == 1) {
            final t = r.data?['totals'] as Map<String, dynamic>?;
            totals = PaymentTotals(amount: readAmount(t?['totalAmount']) ?? 0, count: (t?['count'] as num?)?.toInt() ?? 0);
          }
          final total = ((r.data?['meta'] as Map?)?['total'] as num?)?.toInt() ?? out.length;
          if (rows.isEmpty || out.length >= total) break;
        }
        return (out, totals);
      });

  Future<Result<PaymentRow>> one(String id) => guardApiCall(() async {
        final r = await _dio.get<Map<String, dynamic>>('/deposits/$id');
        return PaymentRow.fromJson(r.data ?? const {});
      });

  Future<Result<void>> approve(String id) => guardApiCall(() async {
        await _dio.post<void>('/deposits/$id/approve', data: const {});
      });

  Future<Result<void>> reject(String id, String reason) => guardApiCall(() async {
        await _dio.post<void>('/deposits/$id/reject', data: {'reason': reason});
      });

  /// A fresh short-lived link to the proof (never kept).
  Future<Result<String>> proofLink(String id) => guardApiCall(() async {
        final r = await _dio.get<Map<String, dynamic>>('/deposits/$id/proof/download');
        return '${r.data?['url']}';
      });
}

class PaymentsListState extends Equatable {
  const PaymentsListState({this.data = const DataState.initial(), this.totals = const PaymentTotals(), this.filter, this.search = '', this.workingId});
  final DataState<List<PaymentRow>> data;
  final PaymentTotals totals;
  final PaymentGroup? filter;
  final String search;

  /// The payment being approved or rejected.
  final String? workingId;

  List<PaymentRow> get all => data.data ?? const [];
  int count(PaymentGroup g) => all.where((p) => p.group == g).length;
  List<PaymentRow> get shown => all.where((p) => filter == null || p.group == filter).where((p) => p.matches(search)).toList();

  PaymentsListState copyWith({
    DataState<List<PaymentRow>>? data,
    PaymentTotals? totals,
    PaymentGroup? Function()? filter,
    String? search,
    String? Function()? workingId,
  }) =>
      PaymentsListState(
        data: data ?? this.data,
        totals: totals ?? this.totals,
        filter: filter == null ? this.filter : filter(),
        search: search ?? this.search,
        workingId: workingId == null ? this.workingId : workingId(),
      );

  @override
  List<Object?> get props => [data, totals, filter, search, workingId];
}

class PaymentsListCubit extends Cubit<PaymentsListState> {
  PaymentsListCubit(this._repo, {this.contractId}) : super(const PaymentsListState());
  final PaymentsRepository _repo;

  /// Only this contract's payments (a link from the contract).
  final String? contractId;

  Future<void> load() async {
    emit(state.copyWith(data: DataState.loading(previousData: state.data.data)));
    final r = await _repo.all(contractId: contractId);
    if (isClosed) return;
    r.when(
      ok: (v) => emit(state.copyWith(data: v.$1.isEmpty ? const DataState.empty() : DataState.success(v.$1), totals: v.$2)),
      err: (f) => emit(state.copyWith(data: DataState.failure(f, previousData: state.data.data))),
    );
  }

  void setFilter(PaymentGroup? g) => emit(state.copyWith(filter: () => state.filter == g ? null : g));
  void setSearch(String q) => emit(state.copyWith(search: q));

  Future<Result<String>> proof(String id) => _repo.proofLink(id);

  /// Approves or rejects a proof; null on success, else why not.
  Future<AppFailure?> decide(String id, {required bool approve, String? reason}) async {
    emit(state.copyWith(workingId: () => id));
    final r = approve ? await _repo.approve(id) : await _repo.reject(id, reason ?? '');
    if (isClosed) return null;
    AppFailure? failure;
    r.when(ok: (_) {}, err: (f) => failure = f);
    emit(state.copyWith(workingId: () => null));
    if (failure == null) await load();
    return failure;
  }
}

/// One payment's page. It opens from the list's row; a reload (or an
/// admin's deep link) reads it again.
class PaymentCubit extends Cubit<DataState<PaymentRow>> {
  PaymentCubit(this._repo, {required this.paymentId, PaymentRow? initial})
      : super(initial == null ? const DataState.initial() : DataState.success(initial));
  final PaymentsRepository _repo;
  final String paymentId;

  Future<void> load() async {
    final before = state.data;
    if (before == null) emit(const DataState.loading());
    final r = await _repo.one(paymentId);
    if (isClosed) return;
    r.when(
      ok: (p) => emit(DataState.success(p)),
      // The row we opened from still stands if the reread is refused
      // (the single-payment read is for those who see the whole company).
      err: (f) => emit(before != null ? DataState.success(before) : DataState.failure(f)),
    );
  }

  Future<Result<String>> proof() => _repo.proofLink(paymentId);

  Future<AppFailure?> decide({required bool approve, String? reason}) async {
    final r = approve ? await _repo.approve(paymentId) : await _repo.reject(paymentId, reason ?? '');
    AppFailure? failure;
    r.when(ok: (_) {}, err: (f) => failure = f);
    if (failure == null) await load();
    return failure;
  }
}
