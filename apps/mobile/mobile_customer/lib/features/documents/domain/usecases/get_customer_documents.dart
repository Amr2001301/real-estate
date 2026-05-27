import 'package:core/core_domain.dart';

import '../entities/customer_document.dart';
import '../repositories/documents_repository.dart';

class DocumentsForOwner {
  const DocumentsForOwner({required this.ownerType, required this.ownerId});
  final DocumentOwnerType ownerType;
  final String ownerId;
}

class GetCustomerDocuments implements UseCase<List<CustomerDocument>, DocumentsForOwner> {
  const GetCustomerDocuments(this._repo);
  final DocumentsRepository _repo;

  @override
  Future<Result<List<CustomerDocument>>> call(DocumentsForOwner params) =>
      _repo.listForOwner(params.ownerType, params.ownerId);
}
