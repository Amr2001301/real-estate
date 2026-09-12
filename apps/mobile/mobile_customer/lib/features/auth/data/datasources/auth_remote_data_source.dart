import 'package:core/core.dart';
import 'package:dio/dio.dart';

import '../../domain/repositories/auth_repository.dart';
import '../dtos/auth_dtos.dart';

/// Raw network access to the V2 tenant-aware auth endpoints.
/// All are @PlatformPublic on the backend — no bearer token required.
/// The [slug] in each method body identifies the tenant; the backend resolves
/// slug → companyId. No companyId is ever sent from the client.
///
/// Tenant-neutral operations (refresh, logout, reset-password) are unchanged:
/// they are token-only and require no slug.
abstract interface class AuthRemoteDataSource {
  Future<AuthBundleDto> loginCustomer(String slug, String email, String password);
  Future<AuthBundleDto> registerCustomer(String slug, RegisterParams params);
  Future<void> requestOtp(String slug, String phone);
  Future<AuthBundleDto> verifyOtp(String slug, String phone, String code, String? fullName);
  Future<AuthBundleDto> refresh(String refreshToken);
  Future<void> logout(String refreshToken);
  Future<void> forgotPassword(String slug, String email);
  Future<void> resetPassword(String token, String newPassword);
}

class AuthRemoteDataSourceImpl implements AuthRemoteDataSource {
  AuthRemoteDataSourceImpl(this._dio);

  final Dio _dio;
  // V2 auth endpoints are @PlatformPublic — no bearer injection needed.
  static final Options _public =
      Options(extra: const {AuthInterceptor.skipAuthExtra: true});

  @override
  Future<AuthBundleDto> loginCustomer(String slug, String email, String password) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/auth/tenant/customer/login',
      data: {'slug': slug, 'email': email, 'password': password},
      options: _public,
    );
    return AuthBundleDto.fromJson(res.data!);
  }

  @override
  Future<AuthBundleDto> registerCustomer(String slug, RegisterParams p) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/auth/tenant/customer/register',
      data: {
        'slug': slug,
        'fullName': p.fullName,
        'phone': p.phone,
        'email': p.email,
        'password': p.password,
        'acceptTerms': true,
        'city': ?p.city,
        'interestType': ?p.interestType,
        'budgetRange': ?p.budgetRange,
        'preferredContactMethod': ?p.preferredContactMethod,
      },
      options: _public,
    );
    return AuthBundleDto.fromJson(res.data!);
  }

  @override
  Future<void> requestOtp(String slug, String phone) async {
    await _dio.post<Map<String, dynamic>>(
      '/auth/tenant/otp/request',
      data: {'slug': slug, 'phone': phone},
      options: _public,
    );
  }

  @override
  Future<AuthBundleDto> verifyOtp(String slug, String phone, String code, String? fullName) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/auth/tenant/otp/verify',
      data: {'slug': slug, 'phone': phone, 'code': code, 'fullName': ?fullName},
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
  Future<void> forgotPassword(String slug, String email) async {
    await _dio.post<void>(
      '/auth/tenant/forgot-password',
      data: {'slug': slug, 'email': email},
      options: _public,
    );
  }

  // Reset password is token-only — no slug needed; the opaque token
  // already identifies the user and their tenant.
  @override
  Future<void> resetPassword(String token, String newPassword) async {
    await _dio.post<void>(
      '/auth/tenant/reset-password',
      data: {'token': token, 'newPassword': newPassword},
      options: _public,
    );
  }
}
