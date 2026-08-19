import 'package:core/core.dart';

import '../../domain/entities/staff_document.dart';
import '../../domain/repositories/documents_repository.dart';
import '../datasources/documents_remote_data_source.dart';
import '../mappers/document_mapper.dart';

class StaffDocumentsRepositoryImpl implements StaffDocumentsRepository {
  StaffDocumentsRepositoryImpl(this._ds);
  final StaffDocumentsRemoteDataSource _ds;

  @override
  Future<Result<List<StaffDocument>>> listDocuments({
    required String ownerType,
    required String ownerId,
  }) =>
      guardApiCall(() async {
        final dtos = await _ds.listDocuments(ownerType: ownerType, ownerId: ownerId);
        return dtos.map((d) => d.toEntity()).toList();
      });

  @override
  Future<Result<String>> getDownloadUrl(String documentId) =>
      guardApiCall(() async {
        final dto = await _ds.getDownloadUrl(documentId);
        return dto.url;
      });
}
