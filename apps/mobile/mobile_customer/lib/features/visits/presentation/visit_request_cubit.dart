import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../domain/repositories/visits_repository.dart';
import '../domain/usecases/create_visit_request.dart';

enum VisitFormStatus { idle, submitting, success, failure }

class VisitFormState extends Equatable {
  const VisitFormState({this.status = VisitFormStatus.idle, this.failure});
  final VisitFormStatus status;
  final AppFailure? failure;

  bool get isSubmitting => status == VisitFormStatus.submitting;

  @override
  List<Object?> get props => [status, failure];
}

class VisitRequestCubit extends Cubit<VisitFormState> {
  VisitRequestCubit(this._create) : super(const VisitFormState());

  final CreateVisitRequest _create;

  Future<void> submit(CreateVisitParams params) async {
    emit(const VisitFormState(status: VisitFormStatus.submitting));
    final result = await _create(params);
    result.when(
      ok: (_) => emit(const VisitFormState(status: VisitFormStatus.success)),
      err: (failure) =>
          emit(VisitFormState(status: VisitFormStatus.failure, failure: failure)),
    );
  }
}
