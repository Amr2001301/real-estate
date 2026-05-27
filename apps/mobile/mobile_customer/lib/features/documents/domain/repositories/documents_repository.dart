import 'package:core/core_domain.dart';

import '../entities/customer_document.dart';

abstract interface class DocumentsRepository {
  Future<Result<List<CustomerDocument>>> listForOwner(
    DocumentOwnerType ownerType,
    String ownerId,
  );

  /// Mints a fresh short-lived signed download link (call just-in-time).
  Future<Result<DocumentDownloadLink>> getDownloadLink(String documentId);
}
