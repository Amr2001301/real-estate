import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../catalog/domain/entities/staff_project.dart';
import '../../../catalog/domain/usecases/staff_catalog_use_cases.dart';
import '../../../clients/domain/entities/staff_client.dart';
import '../../../clients/domain/usecases/client_use_cases.dart';
import '../../../leads/domain/entities/lead.dart';
import '../../../leads/domain/repositories/leads_repository.dart';
import '../../../leads/domain/usecases/lead_use_cases.dart';
import '../../domain/entities/visit.dart';
import '../../domain/usecases/visit_use_cases.dart';

/// Mirrors the dashboard's three client-type options.
enum VisitClientType { lead, registered, walkin }

class CreateVisitState extends Equatable {
  const CreateVisitState({
    // Project
    this.projectsStatus = DataStatus.initial,
    this.projects = const [],
    this.projectsFailure,
    this.selectedProjectId,
    this.fixedProject = false,
    // Units (optional, loaded after project)
    this.unitsStatus = DataStatus.initial,
    this.units = const [],
    this.selectedUnitId,
    // Client type
    this.clientType = VisitClientType.lead,
    // CRM Leads
    this.leadsStatus = DataStatus.initial,
    this.leads = const [],
    this.leadsSearch = '',
    this.selectedLeadId,
    // Registered clients
    this.clientsStatus = DataStatus.initial,
    this.clients = const [],
    this.clientsSearch = '',
    this.selectedClientId,
    // Walk-in
    this.walkInName = '',
    this.walkInPhone = '',
    // Schedule
    this.scheduledAt,
    this.location = '',
    this.notes = '',
    // Submit
    this.submitting = false,
    this.submitFailure,
    this.submitted = false,
    this.showValidation = false,
  });

  // Project
  final DataStatus projectsStatus;
  final List<StaffProject> projects;
  final AppFailure? projectsFailure;
  final String? selectedProjectId;
  final bool fixedProject;
  // Units
  final DataStatus unitsStatus;
  final List<StaffUnit> units;
  final String? selectedUnitId;
  // Client type
  final VisitClientType clientType;
  // CRM Leads
  final DataStatus leadsStatus;
  final List<Lead> leads;
  final String leadsSearch;
  final String? selectedLeadId;
  // Registered clients
  final DataStatus clientsStatus;
  final List<StaffClient> clients;
  final String clientsSearch;
  final String? selectedClientId;
  // Walk-in
  final String walkInName;
  final String walkInPhone;
  // Schedule
  final DateTime? scheduledAt;
  final String location;
  final String notes;
  // Submit
  final bool submitting;
  final AppFailure? submitFailure;
  final bool submitted;
  final bool showValidation;

  bool get hasProject  => (selectedProjectId ?? '').isNotEmpty;
  bool get hasSchedule => scheduledAt != null;
  bool get hasClient {
    switch (clientType) {
      case VisitClientType.lead:
        return (selectedLeadId ?? '').isNotEmpty;
      case VisitClientType.registered:
        return (selectedClientId ?? '').isNotEmpty;
      case VisitClientType.walkin:
        return walkInName.trim().isNotEmpty && walkInPhone.trim().isNotEmpty;
    }
  }

  bool get isValid => hasProject && hasSchedule && hasClient;

  List<Lead> get filteredLeads {
    if (leadsSearch.trim().isEmpty) return leads;
    final q = leadsSearch.trim().toLowerCase();
    return leads.where((l) {
      final name  = l.fullName.toLowerCase();
      final phone = (l.phone ?? '').toLowerCase();
      return name.contains(q) || phone.contains(q);
    }).toList();
  }

  List<StaffClient> get filteredClients {
    if (clientsSearch.trim().isEmpty) return clients;
    final q = clientsSearch.trim().toLowerCase();
    return clients.where((c) {
      final name  = c.fullName.toLowerCase();
      final phone = (c.phone ?? '').toLowerCase();
      return name.contains(q) || phone.contains(q);
    }).toList();
  }

  CreateVisitState copyWith({
    DataStatus? projectsStatus,
    List<StaffProject>? projects,
    AppFailure? projectsFailure,
    String? selectedProjectId,
    bool? fixedProject,
    DataStatus? unitsStatus,
    List<StaffUnit>? units,
    String? selectedUnitId,
    bool clearSelectedUnit = false,
    VisitClientType? clientType,
    DataStatus? leadsStatus,
    List<Lead>? leads,
    String? leadsSearch,
    String? selectedLeadId,
    bool clearSelectedLead = false,
    DataStatus? clientsStatus,
    List<StaffClient>? clients,
    String? clientsSearch,
    String? selectedClientId,
    bool clearSelectedClient = false,
    String? walkInName,
    String? walkInPhone,
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
        unitsStatus: unitsStatus ?? this.unitsStatus,
        units: units ?? this.units,
        selectedUnitId: clearSelectedUnit ? null : (selectedUnitId ?? this.selectedUnitId),
        clientType: clientType ?? this.clientType,
        leadsStatus: leadsStatus ?? this.leadsStatus,
        leads: leads ?? this.leads,
        leadsSearch: leadsSearch ?? this.leadsSearch,
        selectedLeadId: clearSelectedLead ? null : (selectedLeadId ?? this.selectedLeadId),
        clientsStatus: clientsStatus ?? this.clientsStatus,
        clients: clients ?? this.clients,
        clientsSearch: clientsSearch ?? this.clientsSearch,
        selectedClientId: clearSelectedClient ? null : (selectedClientId ?? this.selectedClientId),
        walkInName: walkInName ?? this.walkInName,
        walkInPhone: walkInPhone ?? this.walkInPhone,
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
        projectsStatus, projects, projectsFailure, selectedProjectId, fixedProject,
        unitsStatus, units, selectedUnitId,
        clientType,
        leadsStatus, leads, leadsSearch, selectedLeadId,
        clientsStatus, clients, clientsSearch, selectedClientId,
        walkInName, walkInPhone,
        scheduledAt, location, notes,
        submitting, submitFailure, submitted, showValidation,
      ];
}

/// Drives the "schedule visit" form — mirrors the dashboard 3-type flow:
///   Lead (CRM) → registered client → walk-in (name + phone).
class CreateVisitCubit extends Cubit<CreateVisitState> {
  CreateVisitCubit(
    this._getProjects,
    this._getProjectDetail,
    this._createVisit,
    this._getLeads,
    this._getClients, {
    String? projectId,
    String? unitId,
    String? leadId,
    String? clientId,
  }) : super(CreateVisitState(
          fixedProject: (projectId ?? '').isNotEmpty,
          selectedProjectId: projectId,
          selectedUnitId: unitId,
          selectedLeadId: leadId,
          selectedClientId: clientId,
          clientType: (leadId ?? '').isNotEmpty
              ? VisitClientType.lead
              : (clientId ?? '').isNotEmpty
                  ? VisitClientType.registered
                  : VisitClientType.lead,
        ));

  final GetStaffProjects _getProjects;
  final GetStaffProjectDetail _getProjectDetail;
  final CreateVisit _createVisit;
  final GetLeads _getLeads;
  final GetMyClients _getClients;

  Future<void> init() async {
    _loadLeads();
    _loadClients();
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

  Future<void> _loadLeads() async {
    emit(state.copyWith(leadsStatus: DataStatus.loading));
    final result = await _getLeads(const LeadsQuery());
    result.when(
      ok: (paginated) => emit(state.copyWith(
        leadsStatus: paginated.data.isEmpty ? DataStatus.empty : DataStatus.success,
        leads: paginated.data,
      )),
      err: (_) => emit(state.copyWith(leadsStatus: DataStatus.failure)),
    );
  }

  Future<void> _loadClients() async {
    emit(state.copyWith(clientsStatus: DataStatus.loading));
    final result = await _getClients(null);
    result.when(
      ok: (clients) => emit(state.copyWith(
        clientsStatus: clients.isEmpty ? DataStatus.empty : DataStatus.success,
        clients: clients,
      )),
      err: (_) => emit(state.copyWith(clientsStatus: DataStatus.failure)),
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

  void selectUnit(String? id) =>
      emit(state.copyWith(selectedUnitId: id, clearSelectedUnit: id == null));

  void setClientType(VisitClientType t) => emit(state.copyWith(
        clientType: t,
        clearSelectedLead: true,
        clearSelectedClient: true,
        walkInName: '',
        walkInPhone: '',
      ));

  // CRM Lead
  void selectLead(String? id) =>
      emit(state.copyWith(selectedLeadId: id, clearSelectedLead: id == null));
  void setLeadsSearch(String v) => emit(state.copyWith(leadsSearch: v));

  // Registered client
  void selectClient(String? id) =>
      emit(state.copyWith(selectedClientId: id, clearSelectedClient: id == null));
  void setClientsSearch(String v) => emit(state.copyWith(clientsSearch: v));

  // Walk-in
  void setWalkInName(String v)  => emit(state.copyWith(walkInName: v));
  void setWalkInPhone(String v) => emit(state.copyWith(walkInPhone: v));

  // Schedule
  void setSchedule(DateTime when) => emit(state.copyWith(scheduledAt: when));
  void setLocation(String v)      => emit(state.copyWith(location: v));
  void setNotes(String v)         => emit(state.copyWith(notes: v));

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
      unitId: state.selectedUnitId,
      leadId: state.clientType == VisitClientType.lead ? state.selectedLeadId : null,
      clientId: state.clientType == VisitClientType.registered ? state.selectedClientId : null,
      customerName: state.clientType == VisitClientType.walkin
          ? state.walkInName.trim()
          : null,
      customerPhone: state.clientType == VisitClientType.walkin
          ? state.walkInPhone.trim()
          : null,
      location: state.location.trim().isEmpty ? null : state.location.trim(),
      salesNotes: state.notes.trim().isEmpty ? null : state.notes.trim(),
    ));
    result.when(
      ok: (_) => emit(state.copyWith(submitting: false, submitted: true)),
      err: (failure) => emit(state.copyWith(submitting: false, submitFailure: failure)),
    );
  }
}
