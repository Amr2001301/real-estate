import 'package:freezed_annotation/freezed_annotation.dart';

import 'app_role.dart';
import 'session.dart';

part 'session_state.freezed.dart';

/// Authentication state emitted by [SessionCubit].
/// [unknown] = still resolving the persisted session (show splash); the router
/// must not redirect yet.
@freezed
class SessionState with _$SessionState {
  const SessionState._();

  const factory SessionState.unknown() = SessionUnknown;
  const factory SessionState.authenticated(Session session) =
      SessionAuthenticated;
  const factory SessionState.unauthenticated() = SessionUnauthenticated;

  bool get isResolved => this is! SessionUnknown;
  bool get isAuthenticated => this is SessionAuthenticated;

  /// The active role, defaulting to [AppRole.guest] when not authenticated.
  AppRole get role => switch (this) {
        SessionAuthenticated(:final session) => session.role,
        _ => AppRole.guest,
      };

  Session? get sessionOrNull => switch (this) {
        SessionAuthenticated(:final session) => session,
        _ => null,
      };
}
