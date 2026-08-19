import 'package:core/core.dart';

import '../../domain/repositories/info_request_repository.dart';
import '../datasources/info_request_remote_data_source.dart';

class InfoRequestRepositoryImpl implements InfoRequestRepository {
  InfoRequestRepositoryImpl(this._remote);
  final InfoRequestRemoteDataSource _remote;

  @override
  Future<Result<void>> submit({
    required String message,
    String? projectId,
    String? unitId,
  }) =>
      guardApiCall(() => _remote.create(
            message: message,
            projectId: projectId,
            unitId: unitId,
          ));
}
