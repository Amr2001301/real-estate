import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../domain/usecases/get_document_download_link.dart';

class DocumentDownloadState extends Equatable {
  const DocumentDownloadState({this.downloadingId, this.failure});
  final String? downloadingId;
  final AppFailure? failure;

  @override
  List<Object?> get props => [downloadingId, failure];
}

/// Opens customer documents by minting a **fresh** signed URL on every tap
/// (so expiry is never an issue) and launching it externally. A 403/404 (e.g.
/// access revoked) surfaces as a localized [AppFailure].
class DocumentDownloadCubit extends Cubit<DocumentDownloadState> {
  DocumentDownloadCubit(this._getLink) : super(const DocumentDownloadState());

  final GetDocumentDownloadLink _getLink;

  Future<void> open(String documentId) async {
    if (state.downloadingId != null) return; // ignore double taps
    emit(DocumentDownloadState(downloadingId: documentId));
    final result = await _getLink(documentId);
    await result.when(
      ok: (link) async {
        final opened = await ContactActions.openExternal(link.url);
        emit(DocumentDownloadState(
          failure: opened
              ? null
              : AppFailure(type: FailureType.unknown, technicalMessage: 'launch failed'),
        ));
      },
      err: (failure) async => emit(DocumentDownloadState(failure: failure)),
    );
  }
}
