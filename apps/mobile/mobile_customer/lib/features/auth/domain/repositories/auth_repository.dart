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
///
/// All tenant-aware methods require a [slug] (the selected company's public
/// identifier). The backend resolves slug → companyId server-side; no
/// companyId is ever passed from the client.
abstract interface class AuthRepository {
  Future<Result<Session>> loginWithEmail(String slug, String email, String password);
  Future<Result<Session>> registerCustomer(String slug, RegisterParams params);
  Future<Result<void>> requestOtp(String slug, String phone);
  Future<Result<Session>> verifyOtp(String slug, String phone, String code, {String? fullName});

  /// Refreshes tokens using the stored refresh token (rotates it). Used by the
  /// 401 interceptor. Fails if no refresh token is stored.
  Future<Result<Session>> refreshSession();

  /// Revokes the refresh token server-side (best-effort) and clears storage.
  Future<Result<void>> logout();

  /// Tenant-aware forgot-password. [slug] identifies which company's user
  /// database to search. Token-only reset (no slug) follows in [resetPassword].
  Future<Result<void>> forgotPassword(String slug, String email);
  Future<Result<void>> resetPassword(String token, String newPassword);
}
