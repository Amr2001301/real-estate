import 'package:core/core_domain.dart';

import '../repositories/auth_repository.dart';

class RegisterWithSlugParams {
  const RegisterWithSlugParams({required this.slug, required this.params});
  final String slug;
  final RegisterParams params;
}

/// Registers a new customer (email + password) against the selected company.
class RegisterCustomer implements UseCase<Session, RegisterWithSlugParams> {
  const RegisterCustomer(this._repo);
  final AuthRepository _repo;

  @override
  Future<Result<Session>> call(RegisterWithSlugParams p) =>
      _repo.registerCustomer(p.slug, p.params);
}
