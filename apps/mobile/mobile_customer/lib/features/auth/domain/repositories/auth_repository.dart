import 'package:core/core_domain.dart';

/// Parameters for customer registration.
class RegisterParams {
  const RegisterParams({
    required this.fullName,
    required this.phone,
    required this.email,
    required this.password,
    this.city,
    this.interestType,
    this.budgetRange,
    this.preferredContactMethod,
  });

  final String fullName;
  final String phone;
  final String email;
  final String password;
  final String? city;
  final String? interestType;
  final String? budgetRange;
  final String? preferredContactMethod;
}

/// Domain contract for authentication. Returns the authenticated [Session] on
/// success (the implementation persists tokens to secure storage). Returns
/// [Result] with [AppFailure] — never raw exceptions.
abstract interface class AuthRepository {
  Future<Result<Session>> loginWithEmail(String email, String password);
  Future<Result<Session>> registerCustomer(RegisterParams params);
  Future<Result<void>> requestOtp(String phone);
  Future<Result<Session>> verifyOtp(String phone, String code, {String? fullName});

  /// Refreshes tokens using the stored refresh token (rotates it). Used by the
  /// 401 interceptor. Fails if no refresh token is stored.
  Future<Result<Session>> refreshSession();

  /// Revokes the refresh token server-side (best-effort) and clears storage.
  Future<Result<void>> logout();
}
