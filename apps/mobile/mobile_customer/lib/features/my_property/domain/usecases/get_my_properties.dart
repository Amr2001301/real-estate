import 'package:core/core_domain.dart';

import '../entities/property.dart';
import '../repositories/my_property_repository.dart';

class GetMyProperties implements UseCase<List<Property>, NoParams> {
  const GetMyProperties(this._repo);
  final MyPropertyRepository _repo;

  @override
  Future<Result<List<Property>>> call(NoParams params) => _repo.getMyProperties();
}
