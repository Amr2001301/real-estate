import 'package:core/core.dart';

import '../../domain/entities/home_summary.dart';
import '../../domain/repositories/home_summary_repository.dart';
import '../datasources/home_summary_remote_data_source.dart';

class HomeSummaryRepositoryImpl implements HomeSummaryRepository {
  HomeSummaryRepositoryImpl(this._remote);
  final HomeSummaryRemoteDataSource _remote;

  @override
  Future<Result<HomeSummary>> getHomeSummary() {
    return guardApiCall(_remote.getHomeSummary);
  }
}
