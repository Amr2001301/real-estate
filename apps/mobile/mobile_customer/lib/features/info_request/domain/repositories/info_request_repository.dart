import 'package:core/core_domain.dart';

abstract interface class InfoRequestRepository {
  Future<Result<void>> submit({
    required String message,
    String? projectId,
    String? unitId,
  });
}
