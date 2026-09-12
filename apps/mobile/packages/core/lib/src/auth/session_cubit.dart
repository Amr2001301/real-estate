import 'dart:convert';

import 'package:flutter_bloc/flutter_bloc.dart';

import 'session.dart';
import 'session_state.dart';
import 'token_storage.dart';

/// Owns authentication state. Session is simple, mostly-derived state, so it's
/// a Cubit (a Bloc would only be warranted if a multi-step login flow with
/// many events/side-effects is added later).
///
/// On creation it restores any persisted session. Phase 1 exposes
/// [signIn]/[signOut] for the placeholder auth screens; the real `/auth/*`
/// flows are wired in a later phase.
class SessionCubit extends Cubit<SessionState> {
  SessionCubit(this._tokenStorage) : super(const SessionState.unknown());

  final TokenStorage _tokenStorage;

  /// Restores a persisted session from secure storage. Call once at startup.
  ///
  /// [additionalCheck] is an optional async predicate evaluated after the
  /// tokens + session JSON are confirmed present. Apps that require extra
  /// session context (e.g. the staff app requiring a persisted tenant slug)
  /// pass a check here; on failure the session is cleared and the user must
  /// re-authenticate. Customer app callers omit this parameter.
  Future<void> restore({Future<bool?> Function()? additionalCheck}) async {
    if (!await _tokenStorage.hasSession) {
      emit(const SessionState.unauthenticated());
      return;
    }
    final json = await _tokenStorage.readSessionJson();
    if (json == null) {
      emit(const SessionState.unauthenticated());
      return;
    }
    if (additionalCheck != null) {
      final pass = await additionalCheck();
      if (pass != true) {
        // false  → clear tokens (invalid company / no slug)
        // null   → preserve tokens (network failure; retry can restore the session)
        if (pass == false) await _tokenStorage.clear();
        emit(const SessionState.unauthenticated());
        return;
      }
    }
    try {
      final session = Session.fromJson(jsonDecode(json) as Map<String, dynamic>);
      emit(SessionState.authenticated(session));
    } catch (_) {
      await _tokenStorage.clear();
      emit(const SessionState.unauthenticated());
    }
  }

  Future<void> signIn({
    required Session session,
    required String accessToken,
    required String refreshToken,
  }) async {
    await _tokenStorage.saveTokens(
      accessToken: accessToken,
      refreshToken: refreshToken,
    );
    await _tokenStorage.saveSessionJson(jsonEncode(session.toJson()));
    emit(SessionState.authenticated(session));
  }

  Future<void> signOut() async {
    await _tokenStorage.clear();
    emit(const SessionState.unauthenticated());
  }

  /// Emit-only state updates for when persistence is owned elsewhere (the auth
  /// feature's repository writes/clears secure storage; the cubit just mirrors).
  void adopt(Session session) => emit(SessionState.authenticated(session));

  void adoptSignedOut() => emit(const SessionState.unauthenticated());
}
