import 'package:core/core_domain.dart';

import '../entities/property.dart';
import '../entities/unit_value.dart';

abstract interface class MyPropertyRepository {
  Future<Result<List<Property>>> getMyProperties();

  /// «قيمة وحدتك»: owned units valued today; empty when the company has it off.
  Future<Result<List<UnitValue>>> getUnitValues();
}
