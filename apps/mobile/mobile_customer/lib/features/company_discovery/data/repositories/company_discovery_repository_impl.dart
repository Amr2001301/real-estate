import 'package:core/core.dart';

import '../../domain/entities/discovered_company.dart';
import '../../domain/repositories/company_discovery_repository.dart';
import '../datasources/company_discovery_remote_data_source.dart';

class CompanyDiscoveryRepositoryImpl implements CompanyDiscoveryRepository {
  CompanyDiscoveryRepositoryImpl(this._dataSource);

  final CompanyDiscoveryRemoteDataSource _dataSource;

  @override
  Future<Result<List<DiscoveredCompany>>> search(String query) =>
      guardApiCall(() async {
        final dtos = await _dataSource.search(query);
        return dtos.map((d) => d.toDomain()).toList();
      });

  @override
  Future<Result<DiscoveredCompany?>> resolveBySlug(String slug) =>
      guardApiCall(() async {
        final dto = await _dataSource.resolveBySlug(slug);
        return dto?.toDomain();
      });
}
