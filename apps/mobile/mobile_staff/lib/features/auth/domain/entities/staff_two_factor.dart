import 'package:core/core_domain.dart';

/// What a correct password leads to: a session, or (TFA1) the second step —
/// a code from the authenticator app, or setting it up where the company
/// requires it.
sealed class StaffLoginOutcome extends Equatable {
  const StaffLoginOutcome();
}

final class StaffSignedIn extends StaffLoginOutcome {
  const StaffSignedIn(this.session);
  final Session session;

  @override
  List<Object?> get props => [session];
}

final class StaffTwoFactorStep extends StaffLoginOutcome {
  const StaffTwoFactorStep({required this.challenge, required this.setupRequired});

  /// Short-lived (5 min) token from the password step; it is not a session.
  final String challenge;

  /// The company requires two-step sign-in and this account has not set it up.
  final bool setupRequired;

  @override
  List<Object?> get props => [challenge, setupRequired];
}

/// The secret to add to the authenticator app (by link or by hand).
class StaffTwoFactorSetup extends Equatable {
  const StaffTwoFactorSetup({required this.secret, required this.otpauthUrl});
  final String secret;
  final String otpauthUrl;

  @override
  List<Object?> get props => [secret, otpauthUrl];
}

/// Set up while signing in: the session, and the recovery codes shown once.
class StaffTwoFactorEnabled extends Equatable {
  const StaffTwoFactorEnabled({required this.session, required this.recoveryCodes});
  final Session session;
  final List<String> recoveryCodes;

  @override
  List<Object?> get props => [session, recoveryCodes];
}
