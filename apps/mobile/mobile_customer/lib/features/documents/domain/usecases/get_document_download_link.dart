import 'package:core/core_domain.dart';

import '../entities/customer_document.dart';
import '../repositories/documents_repository.dart';

class GetDocumentDownloadLink implements UseCase<DocumentDownloadLink, String> {
  const GetDocumentDownloadLink(this._repo);
  final DocumentsRepository _repo;

  @override
  Future<Result<DocumentDownloadLink>> call(String documentId) =>
      _repo.getDownloadLink(documentId);
}
