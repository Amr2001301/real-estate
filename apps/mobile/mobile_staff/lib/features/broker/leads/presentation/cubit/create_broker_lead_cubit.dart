import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/broker_lead.dart';
import '../../domain/usecases/broker_lead_use_cases.dart';

class CreateBrokerLeadState extends Equatable {
  const CreateBrokerLeadState({
    this.fullName = '',
    this.phone = '',
    this.email = '',
    this.note = '',
    this.submitting = false,
    this.submitFailure,
    this.submitted = false,
    this.showValidation = false,
  });

  final String fullName;
  final String phone;
  final String email;
  final String note;
  final bool submitting;
  final AppFailure? submitFailure;
  final bool submitted;
  final bool showValidation;

  bool get hasName => fullName.trim().length >= 2;
  bool get hasPhone => phone.trim().length >= 4;
  bool get isValid => hasName && hasPhone;

  CreateBrokerLeadState copyWith({
    String? fullName,
    String? phone,
    String? email,
    String? note,
    bool? submitting,
    AppFailure? submitFailure,
    bool? submitted,
    bool? showValidation,
    bool clearSubmitFailure = false,
  }) =>
      CreateBrokerLeadState(
        fullName: fullName ?? this.fullName,
        phone: phone ?? this.phone,
        email: email ?? this.email,
        note: note ?? this.note,
        submitting: submitting ?? this.submitting,
        submitFailure: clearSubmitFailure ? null : (submitFailure ?? this.submitFailure),
        submitted: submitted ?? this.submitted,
        showValidation: showValidation ?? this.showValidation,
      );

  @override
  List<Object?> get props =>
      [fullName, phone, email, note, submitting, submitFailure, submitted, showValidation];
}

/// Drives the broker "add lead" form. Project/unit interest is fixed by the
/// launching context (passed in), so the form only collects contact + note.
class CreateBrokerLeadCubit extends Cubit<CreateBrokerLeadState> {
  CreateBrokerLeadCubit(this._createLead, {this.projectInterestId, this.unitInterestId})
      : super(const CreateBrokerLeadState());

  final CreateBrokerLead _createLead;
  final String? projectInterestId;
  final String? unitInterestId;

  void setFullName(String v) => emit(state.copyWith(fullName: v));
  void setPhone(String v) => emit(state.copyWith(phone: v));
  void setEmail(String v) => emit(state.copyWith(email: v));
  void setNote(String v) => emit(state.copyWith(note: v));

  Future<void> submit() async {
    if (state.submitting) return;
    if (!state.isValid) {
      emit(state.copyWith(showValidation: true));
      return;
    }
    emit(state.copyWith(submitting: true, clearSubmitFailure: true));
    final result = await _createLead(NewBrokerLead(
      fullName: state.fullName.trim(),
      phone: state.phone.trim(),
      email: state.email.trim().isEmpty ? null : state.email.trim(),
      projectInterestId: projectInterestId,
      unitInterestId: unitInterestId,
      note: state.note.trim().isEmpty ? null : state.note.trim(),
    ));
    result.when(
      ok: (_) => emit(state.copyWith(submitting: false, submitted: true)),
      err: (failure) => emit(state.copyWith(submitting: false, submitFailure: failure)),
    );
  }
}
