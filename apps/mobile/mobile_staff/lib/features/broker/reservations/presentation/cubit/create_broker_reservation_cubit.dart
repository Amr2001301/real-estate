import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../catalog/domain/entities/broker_project.dart';
import '../../../catalog/domain/usecases/broker_catalog_use_cases.dart';
import '../../../leads/domain/entities/broker_lead.dart';
import '../../../leads/domain/repositories/broker_leads_repository.dart';
import '../../../leads/domain/usecases/broker_lead_use_cases.dart';
import '../../domain/entities/broker_reservation.dart';
import '../../domain/usecases/broker_reservation_use_cases.dart';

class CreateBrokerReservationState extends Equatable {
  const CreateBrokerReservationState({
    this.leadsStatus = DataStatus.initial,
    this.leads = const [],
    this.fixedLead = false,
    this.selectedLeadId,
    this.projectsStatus = DataStatus.initial,
    this.projects = const [],
    this.selectedProjectId,
    this.unitsStatus = DataStatus.initial,
    this.units = const [],
    this.selectedUnitId,
    this.notes = '',
    this.submitting = false,
    this.submitFailure,
    this.submitted = false,
    this.showValidation = false,
  });

  final DataStatus leadsStatus;
  final List<BrokerLead> leads;
  final bool fixedLead;
  final String? selectedLeadId;
  final DataStatus projectsStatus;
  final List<BrokerProject> projects;
  final String? selectedProjectId;
  final DataStatus unitsStatus;
  final List<BrokerUnit> units;
  final String? selectedUnitId;
  final String notes;
  final bool submitting;
  final AppFailure? submitFailure;
  final bool submitted;
  final bool showValidation;

  bool get hasLead => (selectedLeadId ?? '').isNotEmpty;
  bool get hasUnit => (selectedUnitId ?? '').isNotEmpty;
  bool get isValid => hasLead && hasUnit;

  CreateBrokerReservationState copyWith({
    DataStatus? leadsStatus,
    List<BrokerLead>? leads,
    bool? fixedLead,
    String? selectedLeadId,
    DataStatus? projectsStatus,
    List<BrokerProject>? projects,
    String? selectedProjectId,
    DataStatus? unitsStatus,
    List<BrokerUnit>? units,
    String? selectedUnitId,
    bool clearSelectedUnit = false,
    String? notes,
    bool? submitting,
    AppFailure? submitFailure,
    bool? submitted,
    bool? showValidation,
    bool clearSubmitFailure = false,
  }) =>
      CreateBrokerReservationState(
        leadsStatus: leadsStatus ?? this.leadsStatus,
        leads: leads ?? this.leads,
        fixedLead: fixedLead ?? this.fixedLead,
        selectedLeadId: selectedLeadId ?? this.selectedLeadId,
        projectsStatus: projectsStatus ?? this.projectsStatus,
        projects: projects ?? this.projects,
        selectedProjectId: selectedProjectId ?? this.selectedProjectId,
        unitsStatus: unitsStatus ?? this.unitsStatus,
        units: units ?? this.units,
        selectedUnitId: clearSelectedUnit ? null : (selectedUnitId ?? this.selectedUnitId),
        notes: notes ?? this.notes,
        submitting: submitting ?? this.submitting,
        submitFailure: clearSubmitFailure ? null : (submitFailure ?? this.submitFailure),
        submitted: submitted ?? this.submitted,
        showValidation: showValidation ?? this.showValidation,
      );

  @override
  List<Object?> get props => [
        leadsStatus, leads, fixedLead, selectedLeadId, projectsStatus, projects,
        selectedProjectId, unitsStatus, units, selectedUnitId, notes,
        submitting, submitFailure, submitted, showValidation,
      ];
}

/// Drives the broker reservation request form: pick lead (unless prefilled) +
/// project → unit, optional notes. Submits POST /portal/reservations.
class CreateBrokerReservationCubit extends Cubit<CreateBrokerReservationState> {
  CreateBrokerReservationCubit(
    this._getLeads,
    this._getProjects,
    this._getUnits,
    this._create, {
    String? leadId,
  }) : super(CreateBrokerReservationState(
          fixedLead: (leadId ?? '').isNotEmpty,
          selectedLeadId: leadId,
        ));

  final GetBrokerLeads _getLeads;
  final GetBrokerProjects _getProjects;
  final GetBrokerProjectUnits _getUnits;
  final CreateBrokerReservation _create;

  Future<void> init() async {
    await Future.wait([if (!state.fixedLead) _loadLeads(), _loadProjects()]);
  }

  Future<void> _loadLeads() async {
    emit(state.copyWith(leadsStatus: DataStatus.loading));
    final result = await _getLeads(const BrokerLeadsQuery());
    result.when(
      ok: (leads) => emit(state.copyWith(
        leadsStatus: leads.isEmpty ? DataStatus.empty : DataStatus.success,
        leads: leads,
      )),
      err: (_) => emit(state.copyWith(leadsStatus: DataStatus.failure)),
    );
  }

  Future<void> _loadProjects() async {
    emit(state.copyWith(projectsStatus: DataStatus.loading));
    final result = await _getProjects(const NoParams());
    result.when(
      ok: (projects) => emit(state.copyWith(
        projectsStatus: projects.isEmpty ? DataStatus.empty : DataStatus.success,
        projects: projects,
      )),
      err: (_) => emit(state.copyWith(projectsStatus: DataStatus.failure)),
    );
  }

  void selectLead(String id) => emit(state.copyWith(selectedLeadId: id));
  void setNotes(String v) => emit(state.copyWith(notes: v));

  Future<void> selectProject(String id) async {
    emit(state.copyWith(selectedProjectId: id, clearSelectedUnit: true, unitsStatus: DataStatus.loading));
    final result = await _getUnits(id);
    result.when(
      ok: (units) => emit(state.copyWith(
        unitsStatus: units.isEmpty ? DataStatus.empty : DataStatus.success,
        units: units,
      )),
      err: (_) => emit(state.copyWith(unitsStatus: DataStatus.failure, units: const [])),
    );
  }

  void selectUnit(String id) => emit(state.copyWith(selectedUnitId: id));

  Future<void> submit() async {
    if (state.submitting) return;
    if (!state.isValid) {
      emit(state.copyWith(showValidation: true));
      return;
    }
    emit(state.copyWith(submitting: true, clearSubmitFailure: true));
    final result = await _create(NewBrokerReservation(
      leadId: state.selectedLeadId!,
      unitId: state.selectedUnitId!,
      notes: state.notes.trim().isEmpty ? null : state.notes.trim(),
    ));
    result.when(
      ok: (_) => emit(state.copyWith(submitting: false, submitted: true)),
      err: (failure) => emit(state.copyWith(submitting: false, submitFailure: failure)),
    );
  }
}
