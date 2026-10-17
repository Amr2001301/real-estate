import 'package:core/core_domain.dart';

import '../repositories/profile_repository.dart';

/// Deletes the signed-in customer's account (personal data removed; the
/// contract and payment records stay with the company).
class DeleteMyAccount implements UseCase<void, NoParams> {
  const DeleteMyAccount(this._repo);
  final ProfileRepository _repo;

  @override
  Future<Result<void>> call(NoParams params) => _repo.deleteAccount();
}
