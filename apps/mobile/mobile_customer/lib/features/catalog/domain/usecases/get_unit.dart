import 'package:core/core_domain.dart';

import '../entities/unit.dart';
import '../repositories/catalog_repository.dart';

/// Returns a single unit's detail by id.
class GetUnit implements UseCase<Unit, String> {
  const GetUnit(this._repo);
  final CatalogRepository _repo;

  @override
  Future<Result<Unit>> call(String id) => _repo.getUnit(id);
}
