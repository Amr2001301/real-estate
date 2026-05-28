import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../catalog/domain/entities/staff_project.dart';
import '../../../catalog/domain/usecases/staff_catalog_use_cases.dart';
import '../../domain/entities/visit.dart';
import '../../domain/usecases/visit_use_cases.dart';

class CreateVisitState extends Equatable {
  const CreateVisitState({
    this.projectsStatus = DataStatus.initial,
    this.projects = const [],
    this.projectsFailure,
    this.selectedProjectId,
    this.fixedProject = false,
    this.scheduledAt,
    this.location = '',
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
  final bool fixedProject;
  final DateTime? scheduledAt;
  final String location;
  final String notes;
  final bool submitting;
  final AppFailure? submitFailure;
  final bool submitted;
  final bool showValidation;

  bool get hasProject => (selectedProjectId ?? '').isNotEmpty;
  bool get hasSchedule => scheduledAt != null;
  bool get isValid => hasProject && hasSchedule;

  CreateVisitState copyWith({
    DataStatus? projectsStatus,
    List<StaffProject>? projects,
    AppFailure? projectsFailure,
    String? selectedProjectId,
    bool? fixedProject,
    DateTime? scheduledAt,
    String? location,
    String? notes,
    bool? submitting,
    AppFailure? submitFailure,
    bool? submitted,
    bool? showValidation,
    bool clearSubmitFailure = false,
  }) =>
      CreateVisitState(
        projectsStatus: projectsStatus ?? this.projectsStatus,
        projects: projects ?? this.projects,
        projectsFailure: projectsFailure ?? this.projectsFailure,
        selectedProjectId: selectedProjectId ?? this.selectedProjectId,
        fixedProject: fixedProject ?? this.fixedProject,
        scheduledAt: scheduledAt ?? this.scheduledAt,
        location: location ?? this.location,
        notes: notes ?? this.notes,
        submitting: submitting ?? this.submitting,
        submitFailure: clearSubmitFailure ? null : (submitFailure ?? this.submitFailure),
        submitted: submitted ?? this.submitted,
        showValidation: showValidation ?? this.showValidation,
      );

  @override
  List<Object?> get props => [
        projectsStatus,
        projects,
        projectsFailure,
        selectedProjectId,
        fixedProject,
        scheduledAt,
        location,
        notes,
        submitting,
        submitFailure,
        submitted,
        showValidation,
      ];
}

/// Drives the "schedule visit" form. When launched from a unit/lead the project
/// is fixed (no picker); otherwise it loads the staff projects for selection.
class CreateVisitCubit extends Cubit<CreateVisitState> {
  CreateVisitCubit(
    this._getProjects,
    this._createVisit, {
    String? projectId,
    String? unitId,
    String? leadId,
    String? clientId,
  }) : super(CreateVisitState(
          fixedProject: (projectId ?? '').isNotEmpty,
          selectedProjectId: projectId,
        )) {
    _unitId = unitId;
    _leadId = leadId;
    _clientId = clientId;
  }

  final GetStaffProjects _getProjects;
  final CreateVisit _createVisit;
  String? _unitId;
  String? _leadId;
  String? _clientId;

  Future<void> init() async {
    if (state.fixedProject) return;
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

  void selectProject(String id) => emit(state.copyWith(selectedProjectId: id));
  void setSchedule(DateTime when) => emit(state.copyWith(scheduledAt: when));
  void setLocation(String v) => emit(state.copyWith(location: v));
  void setNotes(String v) => emit(state.copyWith(notes: v));

  Future<void> submit() async {
    if (state.submitting) return;
    if (!state.isValid) {
      emit(state.copyWith(showValidation: true));
      return;
    }
    emit(state.copyWith(submitting: true, clearSubmitFailure: true));
    final result = await _createVisit(NewVisit(
      projectId: state.selectedProjectId!,
      scheduledAt: state.scheduledAt!,
      unitId: _unitId,
      leadId: _leadId,
      clientId: _clientId,
      location: state.location.trim().isEmpty ? null : state.location.trim(),
      salesNotes: state.notes.trim().isEmpty ? null : state.notes.trim(),
    ));
    result.when(
      ok: (_) => emit(state.copyWith(submitting: false, submitted: true)),
      err: (failure) => emit(state.copyWith(submitting: false, submitFailure: failure)),
    );
  }
}
