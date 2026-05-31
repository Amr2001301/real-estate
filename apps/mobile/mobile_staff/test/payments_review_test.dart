import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/payments_review/data/datasources/payments_review_remote_data_source.dart';
import 'package:mobile_staff/features/payments_review/data/dtos/payment_review_dto.dart';
import 'package:mobile_staff/features/payments_review/data/mappers/payment_review_mapper.dart';
import 'package:mobile_staff/features/payments_review/data/repositories/payments_review_repository_impl.dart';
import 'package:mobile_staff/features/payments_review/domain/entities/payment_review_item.dart';
import 'package:mobile_staff/features/payments_review/domain/repositories/payments_review_repository.dart';
import 'package:mobile_staff/features/payments_review/domain/usecases/payments_review_use_cases.dart';
import 'package:mobile_staff/features/payments_review/presentation/cubit/payments_review_cubit.dart';

// ── Fakes ────────────────────────────────────────────────────────────────

class _FakeRemote implements PaymentsReviewRemoteDataSource {
  _FakeRemote({this.rows = const [], this.error});
  final List<PaymentReviewDto> rows;
  final DioException? error;
  final List<String> approved = [];
  final List<String> rejected = [];
  String? lastReason;

  @override
  Future<List<PaymentReviewDto>> reviewQueue() async {
    if (error != null) throw error!;
    return rows;
  }

  @override
  Future<void> approve(String depositId, {String? note}) async {
    if (error != null) throw error!;
    approved.add(depositId);
  }

  @override
  Future<void> reject(String depositId, {required String reason}) async {
    if (error != null) throw error!;
    rejected.add(depositId);
    lastReason = reason;
  }
}

/// Repo fake for cubit tests: returns queued queue-results (so load→refresh can
/// differ) plus configurable approve/reject outcomes.
class _FakeRepo implements PaymentsReviewRepository {
  _FakeRepo({
    List<Result<List<PaymentReviewItem>>>? queue,
    this.approveResult = const Ok<void>(null),
    this.rejectResult = const Ok<void>(null),
  }) : _queue = queue ?? const [];

  final List<Result<List<PaymentReviewItem>>> _queue;
  int _i = 0;
  final Result<void> approveResult;
  final Result<void> rejectResult;
  String? approvedId;
  String? rejectedId;
  String? rejectedReason;

  @override
  Future<Result<List<PaymentReviewItem>>> getReviewQueue() async {
    final r = _i < _queue.length ? _queue[_i] : _queue.last;
    _i++;
    return r;
  }

  @override
  Future<Result<void>> approve(String depositId, {String? note}) async {
    approvedId = depositId;
    return approveResult;
  }

  @override
  Future<Result<void>> reject(String depositId, {required String reason}) async {
    rejectedId = depositId;
    rejectedReason = reason;
    return rejectResult;
  }
}

DioException _http(int status) => DioException(
      requestOptions: RequestOptions(path: '/deposits/review-queue'),
      type: DioExceptionType.badResponse,
      response: Response(requestOptions: RequestOptions(path: '/x'), statusCode: status),
    );

Map<String, dynamic> _row({
  String id = 'd1',
  String reviewStatus = 'PENDING_REVIEW',
  String method = 'BANK_TRANSFER',
}) =>
    {
      'id': id,
      'amount': '5000.00',
      'reviewStatus': reviewStatus,
      'paymentMethod': method,
      'paidAt': '2026-06-01T10:00:00.000Z',
      'createdAt': '2026-06-02T10:00:00.000Z',
      'contract': {
        'contractNumber': 'CON-1',
        'customer': {'fullName': 'Mona'},
        'unit': {'code': 'A-1'},
      },
      'installment': {'dueDate': '2026-07-01T00:00:00.000Z', 'type': 'INSTALLMENT'},
      'proofDocument': {
        'id': 'doc1',
        'fileName': 'receipt.pdf',
        'mimeType': 'application/pdf',
        // A persistent URL must NEVER be surfaced — the DTO ignores it.
        'fileUrl': 'https://r2.example.com/receipts/secret.pdf',
      },
    };

void main() {
  group('PaymentReviewDto envelope + mapper', () {
    test('parses the paginated {data, meta} envelope (data only)', () {
      final dtos = PaymentReviewDto.listFromEnvelope({
        'data': [_row(), _row(id: 'd2')],
        'meta': {'page': 1, 'pageSize': 50, 'total': 2, 'totalPages': 1},
      });
      expect(dtos, hasLength(2));
      expect(dtos.first.id, 'd1');
    });

    test('maps reviewStatus / paymentMethod / customer / contract / unit / due / proof', () {
      final e = PaymentReviewDto.fromJson(_row(reviewStatus: 'PENDING_REVIEW', method: 'CASH')).toEntity();
      expect(e.id, 'd1');
      expect(e.amount, '5000.00');
      expect(e.reviewStatus, PaymentReviewStatus.pendingReview);
      expect(e.paymentMethod, PaymentMethod.cash);
      expect(e.customerName, 'Mona');
      expect(e.contractNumber, 'CON-1');
      expect(e.unitCode, 'A-1');
      expect(e.installmentType, 'INSTALLMENT');
      expect(e.submittedAt, isNotNull);
      expect(e.dueDate, isNotNull);
      expect(e.hasProof, isTrue);
      expect(e.proofFileName, 'receipt.pdf');
    });

    test('unknown enum wires fall back to unknown (never throws)', () {
      final e = PaymentReviewDto.fromJson(_row(reviewStatus: 'WEIRD', method: 'BTC')).toEntity();
      expect(e.reviewStatus, PaymentReviewStatus.unknown);
      expect(e.paymentMethod, PaymentMethod.unknown);
    });

    test('SECURITY: the proof is metadata-only — no fileUrl is ever surfaced', () {
      final e = PaymentReviewDto.fromJson(_row()).toEntity();
      // The entity has no URL field at all; the raw R2 URL from the wire must
      // not leak through any property.
      expect(e.toString(), isNot(contains('r2.example.com')));
      expect(e.toString(), isNot(contains('secret.pdf')));
    });
  });

  group('PaymentsReviewRepositoryImpl', () {
    test('403 → forbidden failure (no raw error)', () async {
      final repo = PaymentsReviewRepositoryImpl(_FakeRemote(error: _http(403)));
      final r = await repo.getReviewQueue();
      expect(r.failureOrNull?.type, FailureType.forbidden);
    });

    test('success maps rows to entities', () async {
      final repo = PaymentsReviewRepositoryImpl(
        _FakeRemote(rows: [PaymentReviewDto.fromJson(_row())]),
      );
      final r = await repo.getReviewQueue();
      expect(r.dataOrNull, hasLength(1));
      expect(r.dataOrNull!.first.customerName, 'Mona');
    });

    test('approve / reject delegate to the right endpoint with the reason', () async {
      final remote = _FakeRemote();
      final repo = PaymentsReviewRepositoryImpl(remote);
      await repo.approve('d1');
      await repo.reject('d2', reason: 'blurry receipt');
      expect(remote.approved, ['d1']);
      expect(remote.rejected, ['d2']);
      expect(remote.lastReason, 'blurry receipt');
    });
  });

  group('PaymentsReviewCubit · load', () {
    PaymentReviewItem item({String id = 'd1'}) =>
        PaymentReviewItem(id: id, amount: '5000', reviewStatus: PaymentReviewStatus.pendingReview);

    test('success → success with items', () async {
      final cubit = _cubit(_FakeRepo(queue: [Ok([item()])]));
      await cubit.load();
      expect(cubit.state.status, DataStatus.success);
      expect(cubit.state.items, hasLength(1));
    });

    test('empty → empty', () async {
      final cubit = _cubit(_FakeRepo(queue: [const Ok([])]));
      await cubit.load();
      expect(cubit.state.status, DataStatus.empty);
    });

    test('failure → failure with AppFailure', () async {
      final f = AppFailure(type: FailureType.server, technicalMessage: 'boom');
      final cubit = _cubit(_FakeRepo(queue: [Err<List<PaymentReviewItem>>(f)]));
      await cubit.load();
      expect(cubit.state.status, DataStatus.failure);
      expect(cubit.state.failure?.type, FailureType.server);
    });

    test('forbidden 403 → failure surfaces forbidden (graceful)', () async {
      final cubit = PaymentsReviewCubit(
        GetPaymentReviewQueue(PaymentsReviewRepositoryImpl(_FakeRemote(error: _http(403)))),
        ApprovePayment(PaymentsReviewRepositoryImpl(_FakeRemote())),
        RejectPayment(PaymentsReviewRepositoryImpl(_FakeRemote())),
      );
      await cubit.load();
      expect(cubit.state.status, DataStatus.failure);
      expect(cubit.state.failure?.type, FailureType.forbidden);
    });
  });

  group('PaymentsReviewCubit · approve / reject', () {
    PaymentReviewItem item({String id = 'd1'}) =>
        PaymentReviewItem(id: id, amount: '5000', reviewStatus: PaymentReviewStatus.pendingReview);

    test('approve success refreshes the queue and removes the item', () async {
      final repo = _FakeRepo(queue: [Ok([item()]), const Ok([])]);
      final cubit = _cubit(repo);
      await cubit.load();
      await cubit.approve('d1');
      expect(repo.approvedId, 'd1');
      expect(cubit.state.items, isEmpty);
      expect(cubit.state.status, DataStatus.empty);
      expect(cubit.state.lastDecision, ReviewDecision.approved);
      expect(cubit.state.actionEpoch, 1);
      expect(cubit.state.workingId, isNull);
    });

    test('approve failure surfaces an AppFailure without dropping the item', () async {
      final f = AppFailure(type: FailureType.forbidden, technicalMessage: 'no');
      final repo = _FakeRepo(queue: [Ok([item()])], approveResult: Err<void>(f));
      final cubit = _cubit(repo);
      await cubit.load();
      await cubit.approve('d1');
      expect(cubit.state.actionFailure?.type, FailureType.forbidden);
      expect(cubit.state.items, hasLength(1)); // unchanged
      expect(cubit.state.lastDecision, isNull);
      expect(cubit.state.workingId, isNull);
    });

    test('reject success refreshes the queue, removes the item, passes the reason', () async {
      final repo = _FakeRepo(queue: [Ok([item()]), const Ok([])]);
      final cubit = _cubit(repo);
      await cubit.load();
      await cubit.reject('d1', 'illegible amount');
      expect(repo.rejectedId, 'd1');
      expect(repo.rejectedReason, 'illegible amount');
      expect(cubit.state.items, isEmpty);
      expect(cubit.state.lastDecision, ReviewDecision.rejected);
    });

    test('reject failure surfaces an AppFailure', () async {
      final f = AppFailure(type: FailureType.server, technicalMessage: 'x');
      final repo = _FakeRepo(queue: [Ok([item()])], rejectResult: Err<void>(f));
      final cubit = _cubit(repo);
      await cubit.load();
      await cubit.reject('d1', 'reason');
      expect(cubit.state.actionFailure?.type, FailureType.server);
      expect(cubit.state.lastDecision, isNull);
    });

    test('RejectPayment use case forwards the required reason', () async {
      final repo = _FakeRepo();
      final r = await RejectPayment(repo)(const RejectPaymentParams(depositId: 'd1', reason: 'bad'));
      expect(r.isOk, isTrue);
      expect(repo.rejectedReason, 'bad');
    });
  });
}

PaymentsReviewCubit _cubit(_FakeRepo repo) => PaymentsReviewCubit(
      GetPaymentReviewQueue(repo),
      ApprovePayment(repo),
      RejectPayment(repo),
    );
