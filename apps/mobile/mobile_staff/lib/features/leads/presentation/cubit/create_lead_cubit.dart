import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/lead.dart';
import '../../domain/repositories/leads_repository.dart';
import '../../domain/usecases/lead_use_cases.dart';

enum CreateLeadStatus { idle, submitting, success, failure }

class CreateLeadState extends Equatable {
  const CreateLeadState({
    this.status = CreateLeadStatus.idle,
    this.created,
    this.failure,
  });

  final CreateLeadStatus status;
  final Lead? created;
  final AppFailure? failure;

  CreateLeadState copyWith({
    CreateLeadStatus? status,
    Lead? created,
    AppFailure? failure,
  }) =>
      CreateLeadState(
        status: status ?? this.status,
        created: created ?? this.created,
        failure: failure ?? this.failure,
      );

  @override
  List<Object?> get props => [status, created, failure];
}

class CreateLeadCubit extends Cubit<CreateLeadState> {
  CreateLeadCubit(this._createLead) : super(const CreateLeadState());

  final CreateLead _createLead;

  Future<void> submit({
    required String fullName,
    String? phone,
    String? email,
    String? notes,
  }) async {
    emit(state.copyWith(status: CreateLeadStatus.submitting));
    final result = await _createLead(NewLead(
      fullName: fullName,
      phone: phone?.isEmpty == true ? null : phone,
      email: email?.isEmpty == true ? null : email,
      notes: notes?.isEmpty == true ? null : notes,
    ));
    result.when(
      ok: (lead) => emit(state.copyWith(status: CreateLeadStatus.success, created: lead)),
      err: (failure) => emit(state.copyWith(status: CreateLeadStatus.failure, failure: failure)),
    );
  }
}
