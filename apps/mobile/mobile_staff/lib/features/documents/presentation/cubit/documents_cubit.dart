import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/staff_document.dart';
import '../../domain/usecases/document_use_cases.dart';

class DocumentsState extends Equatable {
  const DocumentsState({
    this.status = DataStatus.initial,
    this.documents = const [],
    this.failure,
    this.downloadingId,
    this.downloadFailure,
  });

  final DataStatus status;
  final List<StaffDocument> documents;
  final AppFailure? failure;
  final String? downloadingId;
  final AppFailure? downloadFailure;

  DocumentsState copyWith({
    DataStatus? status,
    List<StaffDocument>? documents,
    AppFailure? failure,
    String? downloadingId,
    bool clearDownloadingId = false,
    AppFailure? downloadFailure,
    bool clearDownloadFailure = false,
  }) =>
      DocumentsState(
        status: status ?? this.status,
        documents: documents ?? this.documents,
        failure: failure ?? this.failure,
        downloadingId: clearDownloadingId ? null : (downloadingId ?? this.downloadingId),
        downloadFailure:
            clearDownloadFailure ? null : (downloadFailure ?? this.downloadFailure),
      );

  @override
  List<Object?> get props =>
      [status, documents, failure, downloadingId, downloadFailure];
}

class DocumentsCubit extends Cubit<DocumentsState> {
  DocumentsCubit(this._list, this._download) : super(const DocumentsState());

  final ListStaffDocuments _list;
  final GetDocumentDownloadUrl _download;

  Future<void> load(String ownerType, String ownerId) async {
    emit(state.copyWith(status: DataStatus.loading));
    final result = await _list(ListDocumentsParams(ownerType: ownerType, ownerId: ownerId));
    result.when(
      ok: (docs) => emit(state.copyWith(
        status: docs.isEmpty ? DataStatus.empty : DataStatus.success,
        documents: docs,
      )),
      err: (failure) => emit(state.copyWith(status: DataStatus.failure, failure: failure)),
    );
  }

  Future<void> open(String documentId) async {
    if (state.downloadingId != null) return;
    emit(state.copyWith(downloadingId: documentId, clearDownloadFailure: true));
    final result = await _download(documentId);
    result.when(
      ok: (url) async {
        emit(state.copyWith(clearDownloadingId: true));
        await ContactActions.openExternal(url);
      },
      err: (failure) => emit(state.copyWith(
        clearDownloadingId: true,
        downloadFailure: failure,
      )),
    );
  }
}
