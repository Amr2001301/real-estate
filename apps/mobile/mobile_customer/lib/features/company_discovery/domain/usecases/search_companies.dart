import 'package:core/core.dart';

import '../entities/discovered_company.dart';
import '../repositories/company_discovery_repository.dart';

class SearchCompanies implements UseCase<List<DiscoveredCompany>, String> {
  const SearchCompanies(this._repository);

  final CompanyDiscoveryRepository _repository;

  @override
  Future<Result<List<DiscoveredCompany>>> call(String query) =>
      _repository.search(query);
}
