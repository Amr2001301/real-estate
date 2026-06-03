import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../domain/entities/maintenance_request.dart';
import '../domain/usecases/maintenance_use_cases.dart';

/// Holds the current maintenance request and an in-flight flag. Seeded with the
/// request passed from the list; confirm/complaint actions replace it with the
/// updated row returned by the API (so the UI flips to read-only after a
/// successful confirm without a separate fetch).
class MaintenanceDetailState extends Equatable {
  const MaintenanceDetailState({required this.request, this.submitting = false});

  final MaintenanceRequest request;
  final bool submitting;

  MaintenanceDetailState copyWith({MaintenanceRequest? request, bool? submitting}) =>
      MaintenanceDetailState(
        request: request ?? this.request,
        submitting: submitting ?? this.submitting,
      );

  @override
  List<Object?> get props => [request, submitting];
}

class MaintenanceDetailCubit extends Cubit<MaintenanceDetailState> {
  MaintenanceDetailCubit({
    required MaintenanceRequest initial,
    required ConfirmMaintenanceResolution confirmResolution,
    required SubmitMaintenanceComplaint submitComplaint,
  })  : _confirm = confirmResolution,
        _complaint = submitComplaint,
        super(MaintenanceDetailState(request: initial));

  final ConfirmMaintenanceResolution _confirm;
  final SubmitMaintenanceComplaint _complaint;

  /// Returns null on success (state updated with the new request), or the
  /// failure to surface as a snackbar.
  Future<AppFailure?> confirmResolution({required int rating, String? note}) async {
    if (state.submitting) return null;
    emit(state.copyWith(submitting: true));
    final res = await _confirm(
      ConfirmMaintenanceResolutionParams(requestId: state.request.id, rating: rating, note: note),
    );
    AppFailure? failure;
    res.when(
      ok: (req) => emit(MaintenanceDetailState(request: req)),
      err: (f) {
        failure = f;
        emit(state.copyWith(submitting: false));
      },
    );
    return failure;
  }

  Future<AppFailure?> submitComplaint() async {
    if (state.submitting) return null;
    emit(state.copyWith(submitting: true));
    final res = await _complaint(state.request.id);
    AppFailure? failure;
    res.when(
      ok: (req) => emit(MaintenanceDetailState(request: req)),
      err: (f) {
        failure = f;
        emit(state.copyWith(submitting: false));
      },
    );
    return failure;
  }
}
