import 'package:core/core_domain.dart';

import '../entities/staff_document.dart';
import '../repositories/documents_repository.dart';

class ListDocumentsParams {
  const ListDocumentsParams({required this.ownerType, required this.ownerId});
  final String ownerType;
  final String ownerId;
}

class ListStaffDocuments implements UseCase<List<StaffDocument>, ListDocumentsParams> {
  const ListStaffDocuments(this._repo);
  final StaffDocumentsRepository _repo;

  @override
  Future<Result<List<StaffDocument>>> call(ListDocumentsParams params) =>
      _repo.listDocuments(ownerType: params.ownerType, ownerId: params.ownerId);
}

class GetDocumentDownloadUrl implements UseCase<String, String> {
  const GetDocumentDownloadUrl(this._repo);
  final StaffDocumentsRepository _repo;

  @override
  Future<Result<String>> call(String documentId) => _repo.getDownloadUrl(documentId);
}
