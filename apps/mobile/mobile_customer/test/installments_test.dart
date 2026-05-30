import 'dart:typed_data';

import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/installments/data/datasources/installments_remote_data_source.dart';
import 'package:mobile_customer/features/installments/data/dtos/installment_dto.dart';
import 'package:mobile_customer/features/installments/data/dtos/presign_response_dto.dart';
import 'package:mobile_customer/features/installments/data/dtos/proof_deposit_dto.dart';
import 'package:mobile_customer/features/installments/data/mappers/installment_mapper.dart';
import 'package:mobile_customer/features/installments/data/repositories/installments_repository_impl.dart';
import 'package:mobile_customer/features/installments/domain/entities/installment.dart';
import 'package:mobile_customer/features/installments/domain/repositories/installments_repository.dart';
import 'package:mobile_customer/features/installments/domain/usecases/get_my_installments.dart';
import 'package:mobile_customer/features/installments/domain/usecases/submit_payment_proof.dart';
import 'package:mobile_customer/features/installments/presentation/cubit/installments_cubit.dart';
import 'package:mobile_customer/features/installments/presentation/cubit/submit_proof_cubit.dart';

// ── Test doubles ─────────────────────────────────────────────────────────

// Lean fake — only covers the list/merge paths actually exercised by the
// repository tests below. The 3-step submit flow is tested end-to-end via
// the real InstallmentsRemoteDataSourceImpl with two Dio instances (see the
// CRITICAL no-auth-on-PUT test).
class _FakeDataSource implements InstallmentsRemoteDataSource {
  _FakeDataSource({
    this.installments = const [],
    this.deposits = const [],
    this.installmentsError,
  });

  final List<InstallmentDto> installments;
  final List<ProofDepositDto> deposits;
  final DioException? installmentsError;

  @override
  Future<List<InstallmentDto>> listMyInstallments() async {
    if (installmentsError != null) throw installmentsError!;
    return installments;
  }

  @override
  Future<List<ProofDepositDto>> listMyDeposits() async => deposits;

  @override
  Future<PresignResponseDto> presign({
    required String contentType,
    required int sizeBytes,
    required String fileName,
  }) async =>
      throw UnimplementedError('Use InstallmentsRemoteDataSourceImpl directly');

  @override
  Future<void> putToSignedUrl({
    required String uploadUrl,
    required Uint8List bytes,
    required String contentType,
    void Function(double progress)? onProgress,
  }) async =>
      throw UnimplementedError('Use InstallmentsRemoteDataSourceImpl directly');

  @override
  Future<SubmittedProofDto> submitProof({
    required String installmentId,
    required num amount,
    required String paidAtIso,
    required String paymentMethod,
    required String receiptUrl,
    String? fileName,
    String? mimeType,
    int? sizeBytes,
    String? note,
  }) async =>
      throw UnimplementedError('Use InstallmentsRemoteDataSourceImpl directly');

  @override
  Future<SubmittedProofDto> resubmitProof({
    required String depositId,
    required String paymentMethod,
    required String receiptUrl,
    String? fileName,
    String? mimeType,
    int? sizeBytes,
    String? paidAtIso,
    String? note,
  }) async =>
      throw UnimplementedError('Use InstallmentsRemoteDataSourceImpl directly');
}

class _FakeRepo implements InstallmentsRepository {
  _FakeRepo({this.list, this.submit, this.resubmit});
  final Result<List<Installment>>? list;
  final Result<void>? submit;
  final Result<void>? resubmit;

  @override
  Future<Result<List<Installment>>> getMyInstallments() async =>
      list ?? const Ok([]);

  @override
  Future<Result<void>> submitProof(SubmitProofParams params) async =>
      submit ?? const Ok(null);

  @override
  Future<Result<void>> resubmitProof(ResubmitProofParams params) async =>
      resubmit ?? const Ok(null);
}

Map<String, dynamic> _installmentJson({
  String id = 'i1',
  String status = 'PENDING',
  String type = 'INSTALLMENT',
}) =>
    {
      'id': id,
      'amount': '5000.00',
      'dueDate': '2026-06-01T00:00:00.000Z',
      'status': status,
      'type': type,
      'paidAt': null,
      'plan': {
        'contract': {
          'id': 'c1',
          'contractNumber': 'CT-1',
          'unit': {
            'id': 'u1',
            'code': 'A-101',
            'type': 'APARTMENT',
            'building': {
              'phase': {
                'project': {
                  'id': 'p1',
                  'name': {'ar': 'مشروع 1', 'en': 'Project 1'},
                },
              },
            },
          },
        },
      },
    };

Installment _installmentEntity({
  String id = 'i1',
  InstallmentStatus status = InstallmentStatus.pending,
  PaymentProofSummary? proof,
}) =>
    Installment(
      id: id,
      amount: '5000.00',
      dueDate: DateTime.parse('2026-06-01T00:00:00.000Z'),
      status: status,
      type: InstallmentPaymentType.installment,
      latestProof: proof,
    );

DioException _dio(int status) => DioException(
      requestOptions: RequestOptions(path: '/me/installments'),
      type: DioExceptionType.badResponse,
      response: Response(
        requestOptions: RequestOptions(path: '/me/installments'),
        statusCode: status,
      ),
    );

// ── Tests ────────────────────────────────────────────────────────────────

void main() {
  group('P11.5 — InstallmentDto → entity', () {
    test('parses backend response shape (project name / unit / status)', () {
      final dto = InstallmentDto.fromJson(_installmentJson(status: 'OVERDUE'));
      final entity = dto.toEntity();
      expect(entity.status, InstallmentStatus.overdue);
      expect(entity.type, InstallmentPaymentType.installment);
      expect(entity.contractNumber, 'CT-1');
      expect(entity.unitCode, 'A-101');
      expect(entity.projectNameAr, 'مشروع 1');
      expect(entity.projectNameEn, 'Project 1');
      expect(entity.latestProof, isNull);
    });

    test('unknown enums fall back to .unknown without throwing', () {
      final entity = InstallmentDto.fromJson(
        _installmentJson(status: 'WHO_KNOWS', type: 'WHAT_NOW'),
      ).toEntity();
      expect(entity.status, InstallmentStatus.unknown);
      expect(entity.type, InstallmentPaymentType.unknown);
    });
  });

  group('P11.5 — repository: merge /me/installments with /me/deposits', () {
    test('attaches latestProof to the matching installment by installmentId', () async {
      final repo = InstallmentsRepositoryImpl(_FakeDataSource(
        installments: [InstallmentDto.fromJson(_installmentJson(id: 'i1'))],
        deposits: [
          const ProofDepositDto(
            id: 'dep-9',
            installmentId: 'i1',
            reviewStatus: 'REJECTED',
            paymentMethod: 'BANK_TRANSFER',
            rejectionReason: 'Amount mismatch',
            createdAt: '2026-05-30T10:00:00.000Z',
          ),
        ],
      ));
      final result = await repo.getMyInstallments();
      final rows = result.dataOrNull;
      expect(rows, hasLength(1));
      expect(rows!.single.latestProof?.reviewStatus, PaymentProofStatus.rejected);
      expect(rows.single.latestProof?.rejectionReason, 'Amount mismatch');
      expect(rows.single.isResubmit, isTrue);
    });

    test('keeps installment latestProof null when no matching deposit exists', () async {
      final repo = InstallmentsRepositoryImpl(_FakeDataSource(
        installments: [InstallmentDto.fromJson(_installmentJson(id: 'i1'))],
        deposits: const [
          ProofDepositDto(
            id: 'dep-9',
            installmentId: 'other-installment',
            reviewStatus: 'APPROVED',
          ),
        ],
      ));
      final result = await repo.getMyInstallments();
      expect(result.dataOrNull?.single.latestProof, isNull);
    });

    test('500 on /me/installments → Err(server, retryable)', () async {
      final repo = InstallmentsRepositoryImpl(
        _FakeDataSource(installmentsError: _dio(500)),
      );
      final result = await repo.getMyInstallments();
      expect(result.failureOrNull?.type, FailureType.server);
      expect(result.failureOrNull?.isRetryable, isTrue);
    });
  });

  group('P11.5 — InstallmentsCubit', () {
    test('initial → loading → empty when no installments', () async {
      final cubit = InstallmentsCubit(GetMyInstallments(_FakeRepo(list: const Ok([]))));
      await cubit.load();
      expect(cubit.state.status, DataStatus.empty);
    });

    test('failure → failure state', () async {
      final cubit = InstallmentsCubit(GetMyInstallments(
        _FakeRepo(list: Result.err(AppFailure(type: FailureType.network))),
      ));
      await cubit.load();
      expect(cubit.state.status, DataStatus.failure);
      expect(cubit.state.failure?.type, FailureType.network);
    });

    test('success emits the rows', () async {
      final cubit = InstallmentsCubit(GetMyInstallments(_FakeRepo(list: Ok([
        _installmentEntity(),
      ]))));
      await cubit.load();
      expect(cubit.state.status, DataStatus.success);
      expect(cubit.state.data, hasLength(1));
    });
  });

  group('P11.5 — SubmitProofCubit', () {
    SubmitProofCubit makeCubit({
      Installment? installment,
      _FakeRepo? repo,
    }) {
      final r = repo ?? _FakeRepo();
      return SubmitProofCubit(
        submit: SubmitPaymentProof(r),
        resubmit: ResubmitPaymentProof(r),
        installment: installment ?? _installmentEntity(),
      );
    }

    test('rejects oversized files client-side without hitting the network', () async {
      final cubit = makeCubit();
      final huge = Uint8List(kPaymentProofMaxBytes + 1);
      final ok = cubit.attachFile(
        bytes: huge,
        fileName: 'big.pdf',
        mimeType: 'application/pdf',
      );
      expect(ok, isFalse);
      expect(cubit.state.clientError, 'paymentProofFileTooLarge');
      expect(cubit.state.hasFile, isFalse);
    });

    test('rejects unsupported MIME types client-side', () async {
      final cubit = makeCubit();
      final ok = cubit.attachFile(
        bytes: Uint8List(10),
        fileName: 'evil.exe',
        mimeType: 'application/octet-stream',
      );
      expect(ok, isFalse);
      expect(cubit.state.clientError, 'paymentProofUnsupportedType');
    });

    test('submit without a file emits a no-file client error', () async {
      final cubit = makeCubit();
      await cubit.submit();
      expect(cubit.state.clientError, 'paymentProofNoFile');
      expect(cubit.state.status, SubmitProofStatus.idle);
    });

    test('happy path: attach + submit → SubmitProofStatus.success', () async {
      final cubit = makeCubit();
      cubit.attachFile(
        bytes: Uint8List.fromList([1, 2, 3]),
        fileName: 'receipt.pdf',
        mimeType: 'application/pdf',
      );
      await cubit.submit();
      expect(cubit.state.status, SubmitProofStatus.success);
      expect(cubit.state.failure, isNull);
    });

    test('repo failure → SubmitProofStatus.failure with the AppFailure', () async {
      final cubit = makeCubit(
        repo: _FakeRepo(
          submit: Result.err(AppFailure(type: FailureType.server)),
        ),
      );
      cubit.attachFile(
        bytes: Uint8List.fromList([1, 2, 3]),
        fileName: 'receipt.pdf',
        mimeType: 'application/pdf',
      );
      await cubit.submit();
      expect(cubit.state.status, SubmitProofStatus.failure);
      expect(cubit.state.failure?.type, FailureType.server);
    });

    test('REJECTED installment routes through the resubmit use-case', () async {
      var resubmitCalled = false;
      var submitCalled = false;
      final repo = _FakeRepo(
        submit: const Ok(null),
        resubmit: const Ok(null),
      );
      final cubit = SubmitProofCubit(
        submit: _TrackingSubmit(repo, () => submitCalled = true),
        resubmit: _TrackingResubmit(repo, () => resubmitCalled = true),
        installment: _installmentEntity(
          proof: const PaymentProofSummary(
            depositId: 'dep-1',
            reviewStatus: PaymentProofStatus.rejected,
            rejectionReason: 'try again',
          ),
        ),
      );
      cubit.attachFile(
        bytes: Uint8List.fromList([1]),
        fileName: 'receipt.pdf',
        mimeType: 'application/pdf',
      );
      await cubit.submit();
      expect(resubmitCalled, isTrue);
      expect(submitCalled, isFalse);
      expect(cubit.state.status, SubmitProofStatus.success);
    });
  });

  group('P11.5 — 3-step submission flow (CRITICAL: no auth on PUT)', () {
    test(
        'PUT goes through the interceptor-free Dio instance — NOT the shared client — '
        'so the bearer header NEVER reaches object storage',
        () async {
      // Auth Dio: simulates the production shared client with an
      // Authorization interceptor. If the data source ever uses it for the
      // PUT, the test fails (because this captures every header set on
      // any outgoing request).
      final authDio = Dio();
      authDio.options.headers['Authorization'] = 'Bearer SECRET-TEST-TOKEN';

      final authHeadersSeen = <Map<String, dynamic>>[];
      authDio.interceptors.add(InterceptorsWrapper(
        onRequest: (options, handler) {
          authHeadersSeen.add({...options.headers});
          // Return canned responses for the API calls we expect on this
          // client (presign + submit). Reject everything else with 418
          // so a misrouted PUT is loud.
          if (options.method == 'POST' && options.path == '/me/payments/presign') {
            return handler.resolve(Response<Map<String, dynamic>>(
              requestOptions: options,
              statusCode: 201,
              data: {
                'uploadUrl': 'https://r2.example/u/abc?sig=xyz',
                'publicUrl': 'https://r2.example/o/abc',
                'key': 'abc',
              },
            ));
          }
          if (options.method == 'POST' && options.path == '/me/deposits') {
            return handler.resolve(Response<Map<String, dynamic>>(
              requestOptions: options,
              statusCode: 201,
              data: {'id': 'dep-1', 'reviewStatus': 'PENDING_REVIEW'},
            ));
          }
          return handler.reject(DioException(
            requestOptions: options,
            type: DioExceptionType.badResponse,
            response: Response(requestOptions: options, statusCode: 418),
          ));
        },
      ));

      // Upload Dio: separate instance with its own interceptor that
      // records the request headers on the PUT. Production wires this
      // identically — a fresh `Dio()` with NO interceptors. The test
      // intercepts only to capture and short-circuit; it doesn't add
      // auth.
      final putHeadersSeen = <Map<String, dynamic>>[];
      final putUrls = <String>[];
      final uploadDio = Dio();
      uploadDio.interceptors.add(InterceptorsWrapper(
        onRequest: (options, handler) {
          if (options.method == 'PUT') {
            putHeadersSeen.add({...options.headers});
            putUrls.add(options.uri.toString());
            return handler.resolve(Response<void>(
              requestOptions: options,
              statusCode: 200,
            ));
          }
          return handler.next(options);
        },
      ));

      final ds = InstallmentsRemoteDataSourceImpl(authDio, uploadClient: uploadDio);
      final repo = InstallmentsRepositoryImpl(ds);

      final result = await repo.submitProof(SubmitProofParams(
        installmentId: 'i1',
        amount: 5000,
        paidAt: DateTime.parse('2026-06-01T00:00:00.000Z'),
        method: PaymentMethod.bankTransfer,
        bytes: Uint8List.fromList([1, 2, 3, 4]),
        fileName: 'receipt.pdf',
        mimeType: 'application/pdf',
      ));
      expect(result.isOk, isTrue);

      // Exactly one PUT happened.
      expect(putHeadersSeen, hasLength(1));
      final putHeaders = putHeadersSeen.single;
      // CRITICAL: no auth on the storage PUT, neither cased variant.
      expect(putHeaders.containsKey('Authorization'), isFalse,
          reason: 'Bearer must NEVER reach object storage');
      expect(putHeaders.containsKey('authorization'), isFalse);
      // Defensive: a token value never appears anywhere in the headers.
      for (final v in putHeaders.values) {
        expect('$v'.contains('SECRET-TEST-TOKEN'), isFalse,
            reason: 'No token substring may appear on the storage PUT');
      }

      // Sanity: the presign POST DID carry the bearer (auth path healthy).
      expect(authHeadersSeen, isNotEmpty);
      expect(
        authHeadersSeen.first['Authorization'],
        'Bearer SECRET-TEST-TOKEN',
      );

      // The PUT actually targeted the signed URL, not the API host.
      expect(putUrls.single, startsWith('https://r2.example/u/abc'));
    });

    test('PUT error is rethrown with the signed URL redacted', () async {
      // Auth Dio short-circuits the presign + a dummy submit (we won't
      // reach submit because PUT fails). Upload Dio rejects the PUT.
      final authDio = Dio();
      authDio.interceptors.add(InterceptorsWrapper(
        onRequest: (options, handler) {
          if (options.path == '/me/payments/presign') {
            return handler.resolve(Response<Map<String, dynamic>>(
              requestOptions: options,
              statusCode: 201,
              data: {
                'uploadUrl': 'https://r2.example/u/SECRET-SIG',
                'publicUrl': 'https://r2.example/o/abc',
              },
            ));
          }
          return handler.reject(DioException(
            requestOptions: options,
            response: Response(requestOptions: options, statusCode: 418),
          ));
        },
      ));
      final uploadDio = Dio();
      uploadDio.interceptors.add(InterceptorsWrapper(
        onRequest: (options, handler) {
          if (options.method == 'PUT') {
            return handler.reject(DioException(
              requestOptions: options,
              type: DioExceptionType.connectionError,
            ));
          }
          return handler.next(options);
        },
      ));

      final ds = InstallmentsRemoteDataSourceImpl(authDio, uploadClient: uploadDio);
      final repo = InstallmentsRepositoryImpl(ds);
      final result = await repo.submitProof(SubmitProofParams(
        installmentId: 'i1',
        amount: 5000,
        paidAt: DateTime.now(),
        method: PaymentMethod.bankTransfer,
        bytes: Uint8List.fromList([1, 2, 3]),
        fileName: 'r.pdf',
        mimeType: 'application/pdf',
      ));
      expect(result.isErr, isTrue);
      // The signed URL must not be embedded in the failure's
      // technicalMessage (we redact at the data source). technicalMessage
      // may be null — the important guarantee is the SUBSTRING absence.
      final tech = result.failureOrNull?.technicalMessage ?? '';
      expect(tech.contains('SECRET-SIG'), isFalse,
          reason: 'Signed URL must never leak into AppFailure');
      expect(tech.contains('r2.example'), isFalse);
    });
  });
}

// Light tracking wrappers around the real use cases — let one test confirm
// that REJECTED installments route to resubmit, not submit.
class _TrackingSubmit extends SubmitPaymentProof {
  _TrackingSubmit(super.repo, this.onCall);
  final void Function() onCall;
  @override
  Future<Result<void>> call(SubmitProofParams params) {
    onCall();
    return super.call(params);
  }
}

class _TrackingResubmit extends ResubmitPaymentProof {
  _TrackingResubmit(super.repo, this.onCall);
  final void Function() onCall;
  @override
  Future<Result<void>> call(ResubmitProofParams params) {
    onCall();
    return super.call(params);
  }
}
