import 'package:core/core.dart';
import 'package:dio/dio.dart';

import '../../domain/repositories/auth_repository.dart';
import '../dtos/auth_dtos.dart';

/// Raw network access to the auth endpoints. All are public (no bearer).
/// Returns DTOs; may throw `DioException`.
abstract interface class AuthRemoteDataSource {
  Future<AuthBundleDto> loginCustomer(String email, String password);
  Future<AuthBundleDto> registerCustomer(RegisterParams params);
  Future<void> requestOtp(String phone);
  Future<AuthBundleDto> verifyOtp(String phone, String code, String? fullName);
  Future<AuthBundleDto> refresh(String refreshToken);
  Future<void> logout(String refreshToken);
}

class AuthRemoteDataSourceImpl implements AuthRemoteDataSource {
  AuthRemoteDataSourceImpl(this._dio);

  final Dio _dio;
  static final Options _public =
      Options(extra: const {AuthInterceptor.skipAuthExtra: true});

  @override
  Future<AuthBundleDto> loginCustomer(String email, String password) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/auth/customer/login',
      data: {'email': email, 'password': password},
      options: _public,
    );
    return AuthBundleDto.fromJson(res.data!);
  }

  @override
  Future<AuthBundleDto> registerCustomer(RegisterParams p) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/auth/customer/register',
      data: {
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
  Future<void> requestOtp(String phone) async {
    await _dio.post<Map<String, dynamic>>(
      '/auth/otp/request',
      data: {'phone': phone},
      options: _public,
    );
  }

  @override
  Future<AuthBundleDto> verifyOtp(String phone, String code, String? fullName) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/auth/otp/verify',
      data: {'phone': phone, 'code': code, 'fullName': ?fullName},
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
}
