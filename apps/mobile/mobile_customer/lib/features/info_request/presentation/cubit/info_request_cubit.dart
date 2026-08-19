import 'package:core/core_domain.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/usecases/submit_info_request.dart';

enum InfoRequestStatus { idle, submitting, success, failure }

class InfoRequestState extends Equatable {
  const InfoRequestState({
    this.status = InfoRequestStatus.idle,
    this.failure,
  });
  final InfoRequestStatus status;
  final AppFailure? failure;

  bool get isSubmitting => status == InfoRequestStatus.submitting;

  @override
  List<Object?> get props => [status, failure];
}

class InfoRequestCubit extends Cubit<InfoRequestState> {
  InfoRequestCubit(this._submit) : super(const InfoRequestState());

  final SubmitInfoRequest _submit;

  Future<void> submit({
    required String message,
    String? projectId,
    String? unitId,
  }) async {
    emit(const InfoRequestState(status: InfoRequestStatus.submitting));
    final result = await _submit(SubmitInfoRequestParams(
      message: message,
      projectId: projectId,
      unitId: unitId,
    ));
    result.when(
      ok: (_) => emit(const InfoRequestState(status: InfoRequestStatus.success)),
      err: (f) => emit(InfoRequestState(status: InfoRequestStatus.failure, failure: f)),
    );
  }
}
