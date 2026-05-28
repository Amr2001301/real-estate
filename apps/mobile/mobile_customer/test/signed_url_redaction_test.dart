import 'dart:typed_data';

import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/maintenance/data/datasources/maintenance_remote_data_source.dart';

/// A Dio whose every request is rejected with a DioException that embeds the
/// (secret) signed upload URL in its requestOptions — simulating a failed R2 PUT.
Dio _throwingUploadClient() {
  final dio = Dio();
  dio.interceptors.add(InterceptorsWrapper(
    onRequest: (options, handler) => handler.reject(
      DioException(
        requestOptions: options, // options.path == the signed URL
        type: DioExceptionType.connectionError,
        message: 'failed to connect to ${options.path}',
      ),
    ),
  ));
  return dio;
}

void main() {
  const signedUrl = 'https://r2.example.com/bucket/key?X-Amz-Signature=SECRETSIG&token=abc';

  test('putToSignedUrl redacts the signed URL from the thrown DioException', () async {
    final ds = MaintenanceRemoteDataSourceImpl(Dio(), uploadClient: _throwingUploadClient());

    Object? caught;
    try {
      await ds.putToSignedUrl(
        uploadUrl: signedUrl,
        bytes: Uint8List.fromList([1, 2, 3]),
        contentType: 'image/jpeg',
      );
    } catch (e) {
      caught = e;
    }

    expect(caught, isA<DioException>());
    final e = caught! as DioException;
    expect(e.type, DioExceptionType.connectionError); // type preserved
    expect(e.requestOptions.path, '[r2-upload]'); // URL redacted
    expect(e.toString(), isNot(contains('SECRETSIG')));
    expect(e.toString(), isNot(contains('r2.example.com')));
  });

  test('the mapped AppFailure never leaks the signed URL in its log line', () async {
    final ds = MaintenanceRemoteDataSourceImpl(Dio(), uploadClient: _throwingUploadClient());

    AppFailure? failure;
    final result = await guardApiCall(() => ds.putToSignedUrl(
          uploadUrl: signedUrl,
          bytes: Uint8List.fromList([1]),
          contentType: 'image/png',
        ));
    result.when(ok: (_) {}, err: (f) => failure = f);

    expect(failure, isNotNull);
    expect(failure!.type, FailureType.network);
    expect(failure!.logLine, isNot(contains('SECRETSIG')));
    expect(failure!.logLine, isNot(contains('r2.example.com')));
  });
}
