import 'package:core/core_domain.dart';

import '../entities/staff_document.dart';

abstract interface class StaffDocumentsRepository {
  Future<Result<List<StaffDocument>>> listDocuments({
    required String ownerType,
    required String ownerId,
  });
  Future<Result<String>> getDownloadUrl(String documentId);
}
