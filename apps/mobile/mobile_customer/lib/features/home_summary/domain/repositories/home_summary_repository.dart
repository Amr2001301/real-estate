import 'package:core/core.dart';

import '../entities/home_summary.dart';

abstract interface class HomeSummaryRepository {
  Future<Result<HomeSummary>> getHomeSummary();
}
