import 'package:core/core.dart';

import '../entities/discovered_company.dart';
import '../repositories/company_discovery_repository.dart';

class ResolveCompany implements UseCase<DiscoveredCompany?, String> {
  const ResolveCompany(this._repository);

  final CompanyDiscoveryRepository _repository;

  @override
  Future<Result<DiscoveredCompany?>> call(String slug) =>
      _repository.resolveBySlug(slug);
}
