import 'package:core/core_domain.dart';

import '../entities/staff_two_factor.dart';
import '../repositories/staff_auth_repository.dart';

/// TFA1 — the second sign-in step and setting it up while signing in.
class TwoFactorParams {
  const TwoFactorParams({required this.challenge, this.code = '', this.slug = ''});
  final String challenge;
  final String code;
  final String slug;
}

class VerifyStaffTwoFactor implements UseCase<Session, TwoFactorParams> {
  const VerifyStaffTwoFactor(this._repo);
  final StaffAuthRepository _repo;

  @override
  Future<Result<Session>> call(TwoFactorParams p) => _repo.verifyTwoFactor(p.challenge, p.code, p.slug);
}

class StartStaffTwoFactorSetup implements UseCase<StaffTwoFactorSetup, TwoFactorParams> {
  const StartStaffTwoFactorSetup(this._repo);
  final StaffAuthRepository _repo;

  @override
  Future<Result<StaffTwoFactorSetup>> call(TwoFactorParams p) => _repo.startTwoFactorSetup(p.challenge);
}

class FinishStaffTwoFactorSetup implements UseCase<StaffTwoFactorEnabled, TwoFactorParams> {
  const FinishStaffTwoFactorSetup(this._repo);
  final StaffAuthRepository _repo;

  @override
  Future<Result<StaffTwoFactorEnabled>> call(TwoFactorParams p) =>
      _repo.finishTwoFactorSetup(p.challenge, p.code, p.slug);
}
