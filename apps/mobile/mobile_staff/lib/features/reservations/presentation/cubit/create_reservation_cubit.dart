import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../catalog/domain/entities/staff_project.dart';
import '../../../catalog/domain/usecases/staff_catalog_use_cases.dart';
import '../../domain/entities/reservation.dart';
import '../../domain/usecases/reservation_use_cases.dart';

class CreateReservationState extends Equatable {
  const CreateReservationState({
    this.projectsStatus = DataStatus.initial,
    this.projects = const [],
    this.projectsFailure,
    this.selectedProjectId,
    this.unitsStatus = DataStatus.initial,
    this.units = const [],
    this.selectedUnitId,
    this.fixedUnit = false,
    this.notes = '',
    this.submitting = false,
    this.submitFailure,
    this.submitted = false,
    this.showValidation = false,
  });

  final DataStatus projectsStatus;
  final List<StaffProject> projects;
  final AppFailure? projectsFailure;
  final String? selectedProjectId;
  final DataStatus unitsStatus;
  final List<StaffUnit> units;
  final String? selectedUnitId;
  final bool fixedUnit;
  final String notes;
  final bool submitting;
  final AppFailure? submitFailure;
  final bool submitted;
  final bool showValidation;

  bool get hasUnit => (selectedUnitId ?? '').isNotEmpty;
  bool get isValid => hasUnit;

  CreateReservationState copyWith({
    DataStatus? projectsStatus,
    List<StaffProject>? projects,
    AppFailure? projectsFailure,
    String? selectedProjectId,
    DataStatus? unitsStatus,
    List<StaffUnit>? units,
    String? selectedUnitId,
    bool clearSelectedUnit = false,
    bool? fixedUnit,
    String? notes,
    bool? submitting,
    AppFailure? submitFailure,
    bool? submitted,
    bool? showValidation,
    bool clearSubmitFailure = false,
  }) =>
      CreateReservationState(
        projectsStatus: projectsStatus ?? this.projectsStatus,
        projects: projects ?? this.projects,
        projectsFailure: projectsFailure ?? this.projectsFailure,
        selectedProjectId: selectedProjectId ?? this.selectedProjectId,
        unitsStatus: unitsStatus ?? this.unitsStatus,
        units: units ?? this.units,
        selectedUnitId: clearSelectedUnit ? null : (selectedUnitId ?? this.selectedUnitId),
        fixedUnit: fixedUnit ?? this.fixedUnit,
        notes: notes ?? this.notes,
        submitting: submitting ?? this.submitting,
        submitFailure: clearSubmitFailure ? null : (submitFailure ?? this.submitFailure),
        submitted: submitted ?? this.submitted,
        showValidation: showValidation ?? this.showValidation,
      );

  @override
  List<Object?> get props => [
        projectsStatus, projects, projectsFailure, selectedProjectId,
        unitsStatus, units, selectedUnitId, fixedUnit, notes,
        submitting, submitFailure, submitted, showValidation,
      ];
}

/// Drives the "reserve unit" form. When launched from a unit the unit is fixed;
/// otherwise the user picks a project, then one of its units.
class CreateReservationCubit extends Cubit<CreateReservationState> {
  CreateReservationCubit(
    this._getProjects,
    this._getProjectDetail,
    this._createReservation, {
    String? unitId,
    String? leadId,
    String? clientId,
  }) : super(CreateReservationState(
          fixedUnit: (unitId ?? '').isNotEmpty,
          selectedUnitId: unitId,
        )) {
    _leadId = leadId;
    _clientId = clientId;
  }

  final GetStaffProjects _getProjects;
  final GetStaffProjectDetail _getProjectDetail;
  final CreateReservation _createReservation;
  String? _leadId;
  String? _clientId;

  Future<void> init() async {
    if (state.fixedUnit) return;
    emit(state.copyWith(projectsStatus: DataStatus.loading));
    final result = await _getProjects(null);
    result.when(
      ok: (projects) => emit(state.copyWith(
        projectsStatus: projects.isEmpty ? DataStatus.empty : DataStatus.success,
        projects: projects,
      )),
      err: (failure) => emit(state.copyWith(
        projectsStatus: DataStatus.failure,
        projectsFailure: failure,
      )),
    );
  }

  Future<void> selectProject(String id) async {
    emit(state.copyWith(
      selectedProjectId: id,
      clearSelectedUnit: true,
      unitsStatus: DataStatus.loading,
    ));
    final result = await _getProjectDetail(id);
    result.when(
      ok: (detail) => emit(state.copyWith(
        unitsStatus: detail.units.isEmpty ? DataStatus.empty : DataStatus.success,
        units: detail.units,
      )),
      err: (_) => emit(state.copyWith(unitsStatus: DataStatus.failure, units: const [])),
    );
  }

  void selectUnit(String id) => emit(state.copyWith(selectedUnitId: id));
  void setNotes(String v) => emit(state.copyWith(notes: v));

  Future<void> submit() async {
    if (state.submitting) return;
    if (!state.isValid) {
      emit(state.copyWith(showValidation: true));
      return;
    }
    emit(state.copyWith(submitting: true, clearSubmitFailure: true));
    final result = await _createReservation(NewReservation(
      unitId: state.selectedUnitId!,
      leadId: _leadId,
      clientId: _clientId,
      notes: state.notes.trim().isEmpty ? null : state.notes.trim(),
    ));
    result.when(
      ok: (_) => emit(state.copyWith(submitting: false, submitted: true)),
      err: (failure) => emit(state.copyWith(submitting: false, submitFailure: failure)),
    );
  }
}
