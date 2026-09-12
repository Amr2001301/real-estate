import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/auth/data/datasources/auth_remote_data_source.dart';
import 'package:mobile_customer/features/auth/domain/repositories/auth_repository.dart';

// ── Fake Dio ──────────────────────────────────────────────────────────────────

class _FakeDio extends Fake implements Dio {
  String? capturedPath;
  Map<String, dynamic>? capturedData;
  Options? capturedOptions;
  Map<String, dynamic> responseData = {
    'user': {'id': 'u1', 'role': 'CLIENT'},
    'tokens': {'accessToken': 'at', 'refreshToken': 'rt'},
  };

  @override
  Future<Response<T>> post<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    capturedPath = path;
    capturedData = data as Map<String, dynamic>?;
    capturedOptions = options;
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: responseData as T,
    );
  }

  @override
  Future<Response<T>> get<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
    ProgressCallback? onReceiveProgress,
  }) async {
    capturedPath = path;
    capturedOptions = options;
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: responseData as T,
    );
  }
}

AuthRemoteDataSourceImpl _ds(_FakeDio dio) => AuthRemoteDataSourceImpl(dio);

// ── Tests ─────────────────────────────────────────────────────────────────────

void main() {
  group('AuthRemoteDataSourceImpl — V2 endpoints', () {
    test('loginCustomer posts to /auth/tenant/customer/login with slug', () async {
      final dio = _FakeDio();
      await _ds(dio).loginCustomer('alpha', 'a@b.com', 'pass12345');
      expect(dio.capturedPath, '/auth/tenant/customer/login');
      expect(dio.capturedData!['slug'], 'alpha');
      expect(dio.capturedData!['email'], 'a@b.com');
      expect(dio.capturedData!['password'], 'pass12345');
      expect(dio.capturedData!.containsKey('companyId'), isFalse);
    });

    test('registerCustomer posts to /auth/tenant/customer/register with slug', () async {
      final dio = _FakeDio();
      final params = RegisterParams(
        fullName: 'Ali Hassan',
        phone: '+201001234567',
        email: 'ali@b.com',
        password: 'pass12345',
      );
      await _ds(dio).registerCustomer('alpha', params);
      expect(dio.capturedPath, '/auth/tenant/customer/register');
      expect(dio.capturedData!['slug'], 'alpha');
      expect(dio.capturedData!['fullName'], 'Ali Hassan');
      expect(dio.capturedData!.containsKey('companyId'), isFalse);
    });

    test('requestOtp posts to /auth/tenant/otp/request with slug', () async {
      final dio = _FakeDio()..responseData = {};
      await _ds(dio).requestOtp('alpha', '+201001234567');
      expect(dio.capturedPath, '/auth/tenant/otp/request');
      expect(dio.capturedData!['slug'], 'alpha');
      expect(dio.capturedData!['phone'], '+201001234567');
    });

    test('verifyOtp posts to /auth/tenant/otp/verify with slug', () async {
      final dio = _FakeDio();
      await _ds(dio).verifyOtp('alpha', '+201001234567', '123456', null);
      expect(dio.capturedPath, '/auth/tenant/otp/verify');
      expect(dio.capturedData!['slug'], 'alpha');
      expect(dio.capturedData!['phone'], '+201001234567');
      expect(dio.capturedData!['code'], '123456');
      expect(dio.capturedData!.containsKey('companyId'), isFalse);
    });

    test('forgotPassword posts to /auth/tenant/forgot-password with slug', () async {
      final dio = _FakeDio()..responseData = {};
      await _ds(dio).forgotPassword('alpha', 'a@b.com');
      expect(dio.capturedPath, '/auth/tenant/forgot-password');
      expect(dio.capturedData!['slug'], 'alpha');
      expect(dio.capturedData!['email'], 'a@b.com');
    });

    test('resetPassword posts to /auth/tenant/reset-password with no slug', () async {
      final dio = _FakeDio()..responseData = {};
      await _ds(dio).resetPassword('tok', 'newPass12');
      expect(dio.capturedPath, '/auth/tenant/reset-password');
      expect(dio.capturedData!['token'], 'tok');
      expect(dio.capturedData!['newPassword'], 'newPass12');
      expect(dio.capturedData!.containsKey('slug'), isFalse);
    });

    test('refresh uses /auth/refresh (token-only, unchanged)', () async {
      final dio = _FakeDio();
      await _ds(dio).refresh('rt123');
      expect(dio.capturedPath, '/auth/refresh');
      expect(dio.capturedData!['refreshToken'], 'rt123');
      expect(dio.capturedData!.containsKey('slug'), isFalse);
    });

    test('logout uses /auth/logout (token-only, unchanged)', () async {
      final dio = _FakeDio()..responseData = {};
      await _ds(dio).logout('rt123');
      expect(dio.capturedPath, '/auth/logout');
      expect(dio.capturedData!.containsKey('slug'), isFalse);
    });
  });
}
