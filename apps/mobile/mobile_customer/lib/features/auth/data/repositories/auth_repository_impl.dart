import 'dart:convert';

import 'package:core/core.dart';

import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_remote_data_source.dart';
import '../dtos/auth_dtos.dart';
import '../mappers/auth_mapper.dart';

/// Auth/session lifecycle authority: calls the remote source, maps to a
/// [Session], and **owns token persistence** in secure storage. Errors are
/// normalized to [AppFailure] via [guardApiCall].
class AuthRepositoryImpl implements AuthRepository {
  AuthRepositoryImpl(this._remote, this._tokenStorage);

  final AuthRemoteDataSource _remote;
  final TokenStorage _tokenStorage;

  Future<Session> _persist(AuthBundleDto bundle) async {
    final session = bundle.toSession();
    await _tokenStorage.saveTokens(
      accessToken: bundle.tokens.accessToken,
      refreshToken: bundle.tokens.refreshToken,
    );
    await _tokenStorage.saveSessionJson(jsonEncode(session.toJson()));
    return session;
  }

  @override
  Future<Result<Session>> loginWithEmail(String email, String password) {
    return guardApiCall(() async => _persist(await _remote.loginCustomer(email, password)));
  }

  @override
  Future<Result<Session>> registerCustomer(RegisterParams params) {
    return guardApiCall(() async => _persist(await _remote.registerCustomer(params)));
  }

  @override
  Future<Result<void>> requestOtp(String phone) {
    return guardApiCall(() => _remote.requestOtp(phone));
  }

  @override
  Future<Result<Session>> verifyOtp(String phone, String code, {String? fullName}) {
    return guardApiCall(
      () async => _persist(await _remote.verifyOtp(phone, code, fullName)),
    );
  }

  @override
  Future<Result<Session>> refreshSession() {
    return guardApiCall(() async {
      final refreshToken = await _tokenStorage.readRefreshToken();
      if (refreshToken == null || refreshToken.isEmpty) {
        throw const _NoRefreshToken();
      }
      return _persist(await _remote.refresh(refreshToken));
    });
  }

  @override
  Future<Result<void>> logout() async {
    final refreshToken = await _tokenStorage.readRefreshToken();
    if (refreshToken != null && refreshToken.isNotEmpty) {
      // Best-effort server-side revoke; ignore failures.
      await guardApiCall(() => _remote.logout(refreshToken));
    }
    await _tokenStorage.clear();
    return const Ok(null);
  }

  @override
  Future<Result<void>> forgotPassword(String email) =>
      guardApiCall(() => _remote.forgotPassword(email));

  @override
  Future<Result<void>> resetPassword(String token, String newPassword) =>
      guardApiCall(() => _remote.resetPassword(token, newPassword));
}

/// Sentinel so a missing refresh token maps to an unauthorized AppFailure.
class _NoRefreshToken implements Exception {
  const _NoRefreshToken();
}
