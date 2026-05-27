import 'package:core/core_domain.dart';

import '../repositories/auth_repository.dart';

/// Registers a new customer (email + password) and signs them in.
class RegisterCustomer implements UseCase<Session, RegisterParams> {
  const RegisterCustomer(this._repo);
  final AuthRepository _repo;

  @override
  Future<Result<Session>> call(RegisterParams params) =>
      _repo.registerCustomer(params);
}
