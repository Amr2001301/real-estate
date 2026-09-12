import 'package:core/core.dart';
import 'package:dio/dio.dart';

import '../dtos/staff_auth_dtos.dart';

/// Raw network access to the staff auth endpoints. All are public (no bearer).
/// Returns DTOs; may throw `DioException`.
abstract interface class StaffAuthRemoteDataSource {
  /// Tenant-aware staff login. Calls POST /auth/login-staff with
  /// {slug, email, password}. Never calls the legacy /auth/login endpoint.
  Future<AuthBundleDto> loginWithSlug(String slug, String email, String password);
  Future<AuthBundleDto> refresh(String refreshToken);
  Future<void> logout(String refreshToken);
  Future<void> forgotPassword(String email);
  Future<void> resetPassword(String token, String newPassword);
}

class StaffAuthRemoteDataSourceImpl implements StaffAuthRemoteDataSource {
  StaffAuthRemoteDataSourceImpl(this._dio);

  final Dio _dio;
  static final Options _public =
      Options(extra: const {AuthInterceptor.skipAuthExtra: true});

  @override
  Future<AuthBundleDto> loginWithSlug(
      String slug, String email, String password) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/auth/login-staff',
      data: {'slug': slug, 'email': email, 'password': password},
      options: _public,
    );
    return AuthBundleDto.fromJson(res.data!);
  }

  @override
  Future<AuthBundleDto> refresh(String refreshToken) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/auth/refresh',
      data: {'refreshToken': refreshToken},
      options: _public,
    );
    return AuthBundleDto.fromJson(res.data!);
  }

  @override
  Future<void> logout(String refreshToken) async {
    await _dio.post<Map<String, dynamic>>(
      '/auth/logout',
      data: {'refreshToken': refreshToken},
      options: _public,
    );
  }

  @override
  Future<void> forgotPassword(String email) async {
    await _dio.post<void>(
      '/auth/forgot-password',
      data: {'email': email},
      options: _public,
    );
  }

  @override
  Future<void> resetPassword(String token, String newPassword) async {
    await _dio.post<void>(
      '/auth/reset-password',
      data: {'token': token, 'newPassword': newPassword},
      options: _public,
    );
  }
}
