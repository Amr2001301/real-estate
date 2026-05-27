import 'package:core/core.dart';

import '../../domain/entities/customer_document.dart';
import '../../domain/repositories/documents_repository.dart';
import '../datasources/documents_remote_data_source.dart';
import '../mappers/document_mapper.dart';

class DocumentsRepositoryImpl implements DocumentsRepository {
  DocumentsRepositoryImpl(this._remote);
  final DocumentsRemoteDataSource _remote;

  @override
  Future<Result<List<CustomerDocument>>> listForOwner(
    DocumentOwnerType ownerType,
    String ownerId,
  ) {
    return guardApiCall(() async {
      final dtos = await _remote.listForOwner(ownerType.wire, ownerId);
      return dtos.map((d) => d.toEntity()).toList();
    });
  }

  @override
  Future<Result<DocumentDownloadLink>> getDownloadLink(String documentId) {
    return guardApiCall(
      () async => (await _remote.downloadLink(documentId)).toEntity(),
    );
  }
}
