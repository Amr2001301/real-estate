import 'dart:convert';

import 'package:core/core.dart';

import '../../domain/repositories/staff_auth_repository.dart';
import '../datasources/staff_auth_remote_data_source.dart';
import '../dtos/staff_auth_dtos.dart';
import '../mappers/staff_auth_mapper.dart';

/// Staff auth/session lifecycle authority: calls the remote source, maps to a
/// [Session], and **owns token + slug persistence** in secure storage. Errors
/// are normalized to [AppFailure] via [guardApiCall].
class StaffAuthRepositoryImpl implements StaffAuthRepository {
  StaffAuthRepositoryImpl(this._remote, this._tokenStorage);

  final StaffAuthRemoteDataSource _remote;
  final TokenStorage _tokenStorage;

  Future<Session> _persist(AuthBundleDto bundle, {String? slug}) async {
    final session = bundle.toSession();
    await _tokenStorage.saveTokens(
      accessToken: bundle.tokens.accessToken,
      refreshToken: bundle.tokens.refreshToken,
    );
    await _tokenStorage.saveSessionJson(jsonEncode(session.toJson()));
    if (slug != null && slug.isNotEmpty) {
      // Both active context and UX hint are updated on successful login.
      await _tokenStorage.saveSelectedCompanySlug(slug);
      await _tokenStorage.saveLastCompanySlug(slug);
    }
    return session;
  }

  @override
  Future<Result<Session>> loginWithSlug(
      String slug, String email, String password) {
    return guardApiCall(
      () async => _persist(
        await _remote.loginWithSlug(slug, email, password),
        slug: slug,
      ),
    );
  }

  @override
  Future<Result<Session>> refreshSession() {
    return guardApiCall(() async {
      final refreshToken = await _tokenStorage.readRefreshToken();
      if (refreshToken == null || refreshToken.isEmpty) {
        throw const _NoRefreshToken();
      }
      // slug is NOT re-derived from the refresh response — it stays as
      // previously persisted. Do not read companyId from JWT.
      return _persist(await _remote.refresh(refreshToken));
    });
  }

  @override
  Future<Result<void>> logout() async {
    final refreshToken = await _tokenStorage.readRefreshToken();
    if (refreshToken != null && refreshToken.isNotEmpty) {
      await guardApiCall(() => _remote.logout(refreshToken));
    }
    // clear() removes tokens, session JSON, and selectedCompanySlug.
    // lastCompanySlug is preserved for UX pre-fill on next login.
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
