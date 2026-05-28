import 'package:core/core_domain.dart';

import '../entities/bonus_entry.dart';

class BonusQuery {
  const BonusQuery({this.status, this.period});
  final String? status;
  final String? period;
}

abstract interface class BonusRepository {
  Future<Result<List<BonusEntry>>> getEntries(BonusQuery query);
}
