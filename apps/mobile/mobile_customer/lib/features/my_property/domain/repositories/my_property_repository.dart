import 'package:core/core_domain.dart';

import '../entities/property.dart';

abstract interface class MyPropertyRepository {
  Future<Result<List<Property>>> getMyProperties();
}
