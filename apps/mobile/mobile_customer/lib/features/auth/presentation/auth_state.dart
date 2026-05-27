import 'package:core/core.dart';

enum AuthStatus { idle, submitting, otpSent, success, failure }

class AuthState extends Equatable {
  const AuthState({
    this.status = AuthStatus.idle,
    this.failure,
    this.otpPhone,
  });

  final AuthStatus status;
  final AppFailure? failure;

  /// The phone an OTP was sent to (drives the verify step).
  final String? otpPhone;

  bool get isSubmitting => status == AuthStatus.submitting;

  AuthState copyWith({
    AuthStatus? status,
    AppFailure? failure,
    String? otpPhone,
    bool clearFailure = false,
  }) {
    return AuthState(
      status: status ?? this.status,
      failure: clearFailure ? null : (failure ?? this.failure),
      otpPhone: otpPhone ?? this.otpPhone,
    );
  }

  @override
  List<Object?> get props => [status, failure, otpPhone];
}
