import 'package:core/core_domain.dart';

import '../repositories/info_request_repository.dart';

class SubmitInfoRequestParams {
  const SubmitInfoRequestParams({
    required this.message,
    this.projectId,
    this.unitId,
  });
  final String message;
  final String? projectId;
  final String? unitId;
}

class SubmitInfoRequest implements UseCase<void, SubmitInfoRequestParams> {
  const SubmitInfoRequest(this._repo);
  final InfoRequestRepository _repo;

  @override
  Future<Result<void>> call(SubmitInfoRequestParams params) => _repo.submit(
        message: params.message,
        projectId: params.projectId,
        unitId: params.unitId,
      );
}
