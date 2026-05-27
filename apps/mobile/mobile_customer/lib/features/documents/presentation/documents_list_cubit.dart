import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../domain/entities/customer_document.dart';
import '../domain/usecases/get_customer_documents.dart';

typedef DocumentsListState = DataState<List<CustomerDocument>>;

/// Loads the customer-visible documents attached to one owner (a contract,
/// deposit, or maintenance request). Reused by every detail screen that lists
/// documents. Downloads are handled separately by [DocumentDownloadCubit].
class DocumentsListCubit extends Cubit<DocumentsListState> {
  DocumentsListCubit(this._getDocuments, {required this.ownerType, required this.ownerId})
      : super(const DocumentsListState.initial());

  final GetCustomerDocuments _getDocuments;
  final DocumentOwnerType ownerType;
  final String ownerId;

  Future<void> load() async {
    emit(state.toLoading());
    final result = await _getDocuments(
      DocumentsForOwner(ownerType: ownerType, ownerId: ownerId),
    );
    result.when(
      ok: (docs) => emit(
        docs.isEmpty ? const DocumentsListState.empty() : DocumentsListState.success(docs),
      ),
      err: (failure) => emit(state.toFailure(failure)),
    );
  }
}
