import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/installments/data/datasources/installments_remote_data_source.dart';
import 'package:mobile_customer/features/installments/data/repositories/installments_repository_impl.dart';
import 'package:mobile_customer/features/installments/domain/entities/installment.dart';
import 'package:mobile_customer/features/installments/domain/repositories/installments_repository.dart';

/// QA run 1, F-029. Receipts are stored in the private bucket, so the presign
/// answer holds only the object `key`. The app used to post `publicUrl` (empty)
/// and the API refused every payment proof with «fileUrl is required».
void main() {
  Future<Object?> postedReceipt({required Map<String, dynamic> presign}) async {
    Object? posted;
    final authDio = Dio();
    authDio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (options.path == '/me/payments/presign') {
            return handler.resolve(Response<Map<String, dynamic>>(
              requestOptions: options,
              statusCode: 201,
              data: presign,
            ));
          }
          if (options.path == '/me/deposits') {
            posted = (options.data as Map)['receiptUrl'];
            return handler.resolve(Response<Map<String, dynamic>>(
              requestOptions: options,
              statusCode: 201,
              data: {'id': 'dep-1', 'reviewStatus': 'PENDING_REVIEW'},
            ));
          }
          return handler.reject(DioException(requestOptions: options));
        },
      ),
    );
    final uploadDio = Dio();
    uploadDio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) => handler.resolve(
          Response<void>(requestOptions: options, statusCode: 200),
        ),
      ),
    );
    final repo = InstallmentsRepositoryImpl(
      InstallmentsRemoteDataSourceImpl(authDio, uploadClient: uploadDio),
    );
    final result = await repo.submitProof(
      SubmitProofParams(
        installmentId: 'i1',
        amount: 5000,
        paidAt: DateTime.parse('2026-06-01T00:00:00.000Z'),
        method: PaymentMethod.bankTransfer,
        bytes: Uint8List.fromList([1, 2, 3]),
        fileName: 'receipt.png',
        mimeType: 'image/png',
      ),
    );
    expect(result.isOk, isTrue);
    return posted;
  }

  const key = 'receipts/2026-11-06/3f1c2a4e-9b7d-4c1a-8e2f-0a1b2c3d4e5f.png';

  test('a private-bucket presign (key only) posts the key', () async {
    final sent = await postedReceipt(presign: {
      'uploadUrl': 'https://r2.example/u/abc?sig=xyz',
      'key': key,
    });
    expect(sent, key);
  });

  test('a presign with a public URL still posts the key', () async {
    final sent = await postedReceipt(presign: {
      'uploadUrl': 'https://r2.example/u/abc?sig=xyz',
      'publicUrl': 'https://r2.example/o/abc',
      'key': key,
    });
    expect(sent, key);
  });

  test('without a key the public URL is used', () async {
    final sent = await postedReceipt(presign: {
      'uploadUrl': 'https://r2.example/u/abc?sig=xyz',
      'publicUrl': 'https://r2.example/o/abc',
    });
    expect(sent, 'https://r2.example/o/abc');
  });
}
