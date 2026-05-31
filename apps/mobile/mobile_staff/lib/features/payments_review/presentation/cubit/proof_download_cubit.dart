import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/usecases/payments_review_use_cases.dart';

class ProofDownloadState extends Equatable {
  const ProofDownloadState({this.openingId, this.failure, this.launchFailed = false});

  /// The deposit whose proof is being opened (disables its button).
  final String? openingId;

  /// Repo-level failure (e.g. 404 proof unavailable / 403 forbidden) — already
  /// a friendly, localized [AppFailure]; the UI never shows a raw error.
  final AppFailure? failure;

  /// The signed URL was obtained but the device couldn't open it externally.
  final bool launchFailed;

  // NOTE: the signed URL is deliberately NOT a field here — it is used to open
  // the file and then dropped, never persisted in state.

  @override
  List<Object?> get props => [openingId, failure, launchFailed];
}

/// Opens a payment proof by minting a **fresh** short-lived signed URL on every
/// tap (so expiry is never an issue) and launching it externally. The URL is
/// never stored. A 403/404 surfaces as a localized [AppFailure].
class ProofDownloadCubit extends Cubit<ProofDownloadState> {
  ProofDownloadCubit(this._getLink) : super(const ProofDownloadState());

  final GetProofDownloadLink _getLink;

  Future<void> open(String depositId) async {
    if (state.openingId != null) return; // ignore double taps
    emit(ProofDownloadState(openingId: depositId));
    final result = await _getLink(depositId);
    await result.when(
      ok: (link) async {
        final opened = await ContactActions.openExternal(link.url);
        // Reset to idle; flag a launch failure so the UI can show a friendly
        // "couldn't open" message. The url is intentionally not retained.
        emit(ProofDownloadState(launchFailed: !opened));
      },
      err: (failure) async => emit(ProofDownloadState(failure: failure)),
    );
  }
}
