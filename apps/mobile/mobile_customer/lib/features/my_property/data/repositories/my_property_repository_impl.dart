import 'package:core/core.dart';

import '../../domain/entities/property.dart';
import '../../domain/repositories/my_property_repository.dart';
import '../datasources/my_property_remote_data_source.dart';
import '../mappers/property_mapper.dart';

class MyPropertyRepositoryImpl implements MyPropertyRepository {
  MyPropertyRepositoryImpl(this._remote);
  final MyPropertyRemoteDataSource _remote;

  @override
  Future<Result<List<Property>>> getMyProperties() {
    return guardApiCall(() async {
      final rows = await _remote.listContracts();
      return rows.map((r) => r.toEntity()).toList();
    });
  }
}
