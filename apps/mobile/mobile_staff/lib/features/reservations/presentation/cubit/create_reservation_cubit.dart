import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../catalog/domain/entities/staff_project.dart';
import '../../../catalog/domain/usecases/staff_catalog_use_cases.dart';
import '../../../installments/domain/entities/installment.dart';
import '../../../installments/domain/usecases/installment_use_cases.dart';
import '../../../leads/domain/entities/lead.dart';
import '../../../leads/domain/repositories/leads_repository.dart';
import '../../../leads/domain/usecases/lead_use_cases.dart';
import '../../domain/entities/reservation.dart';
import '../../domain/usecases/reservation_use_cases.dart';

class CreateReservationState extends Equatable {
  const CreateReservationState({
    // Unit
    this.projectsStatus = DataStatus.initial,
    this.projects = const [],
    this.projectsFailure,
    this.selectedProjectId,
    this.unitsStatus = DataStatus.initial,
    this.units = const [],
    this.selectedUnitId,
    this.fixedUnit = false,
    // Leads
    this.leadsStatus = DataStatus.initial,
    this.leads = const [],
    this.leadsSearch = '',
    this.selectedLeadId,
    // Details
    this.expiresInHours = 72,
    this.notes = '',
    // Plan
    this.plansStatus = DataStatus.initial,
    this.plans = const [],
    this.selectedPlanId,
    this.bookingNotes = '',
    this.bookingAmountMode = 'PLAN',
    this.bookingAmount = '',
    this.bookingAmountPercent = '',
    // Submit
    this.submitting = false,
    this.submitFailure,
    this.submitted = false,
    this.showValidation = false,
  });

  // Unit
  final DataStatus projectsStatus;
  final List<StaffProject> projects;
  final AppFailure? projectsFailure;
  final String? selectedProjectId;
  final DataStatus unitsStatus;
  final List<StaffUnit> units;
  final String? selectedUnitId;
  final bool fixedUnit;
  // Leads
  final DataStatus leadsStatus;
  final List<Lead> leads;
  final String leadsSearch;
  final String? selectedLeadId;
  // Details
  final int expiresInHours;
  final String notes;
  // Plan
  final DataStatus plansStatus;
  final List<InstallmentPlanTemplate> plans;
  final String? selectedPlanId;
  final String bookingNotes;
  final String bookingAmountMode;
  final String bookingAmount;
  final String bookingAmountPercent;
  // Submit
  final bool submitting;
  final AppFailure? submitFailure;
  final bool submitted;
  final bool showValidation;

  bool get hasUnit => (selectedUnitId ?? '').isNotEmpty;
  bool get hasLead => (selectedLeadId ?? '').isNotEmpty;
  bool get isValid => hasUnit && hasLead;

  List<Lead> get filteredLeads {
    if (leadsSearch.trim().isEmpty) return leads;
    final q = leadsSearch.trim().toLowerCase();
    return leads.where((l) {
      final name = l.fullName.toLowerCase();
      final phone = (l.phone ?? '').toLowerCase();
      return name.contains(q) || phone.contains(q);
    }).toList();
  }

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
    DataStatus? leadsStatus,
    List<Lead>? leads,
    String? leadsSearch,
    String? selectedLeadId,
    bool clearSelectedLead = false,
    int? expiresInHours,
    String? notes,
    DataStatus? plansStatus,
    List<InstallmentPlanTemplate>? plans,
    String? selectedPlanId,
    bool clearSelectedPlan = false,
    String? bookingNotes,
    String? bookingAmountMode,
    String? bookingAmount,
    String? bookingAmountPercent,
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
        leadsStatus: leadsStatus ?? this.leadsStatus,
        leads: leads ?? this.leads,
        leadsSearch: leadsSearch ?? this.leadsSearch,
        selectedLeadId: clearSelectedLead ? null : (selectedLeadId ?? this.selectedLeadId),
        expiresInHours: expiresInHours ?? this.expiresInHours,
        notes: notes ?? this.notes,
        plansStatus: plansStatus ?? this.plansStatus,
        plans: plans ?? this.plans,
        selectedPlanId: clearSelectedPlan ? null : (selectedPlanId ?? this.selectedPlanId),
        bookingNotes: bookingNotes ?? this.bookingNotes,
        bookingAmountMode: bookingAmountMode ?? this.bookingAmountMode,
        bookingAmount: bookingAmount ?? this.bookingAmount,
        bookingAmountPercent: bookingAmountPercent ?? this.bookingAmountPercent,
        submitting: submitting ?? this.submitting,
        submitFailure: clearSubmitFailure ? null : (submitFailure ?? this.submitFailure),
        submitted: submitted ?? this.submitted,
        showValidation: showValidation ?? this.showValidation,
      );

  @override
  List<Object?> get props => [
        projectsStatus, projects, projectsFailure, selectedProjectId,
        unitsStatus, units, selectedUnitId, fixedUnit,
        leadsStatus, leads, leadsSearch, selectedLeadId,
        expiresInHours, notes,
        plansStatus, plans, selectedPlanId, bookingNotes,
        bookingAmountMode, bookingAmount, bookingAmountPercent,
        submitting, submitFailure, submitted, showValidation,
      ];
}

/// Drives the "reserve unit" form. When launched from a unit the unit is fixed;
/// otherwise the user picks a project, then one of its units.
class CreateReservationCubit extends Cubit<CreateReservationState> {
  CreateReservationCubit(
    this._getProjects,
    this._getProjectDetail,
    this._createReservation,
    this._getLeads,
    this._getPlanTemplates, {
    String? unitId,
    String? projectId,
    String? leadId,
    String? clientId,
  }) : super(CreateReservationState(
          fixedUnit: (unitId ?? '').isNotEmpty,
          selectedUnitId: unitId,
          selectedProjectId: projectId,
          selectedLeadId: leadId,
        )) {
    _clientId = clientId;
  }

  final GetStaffProjects _getProjects;
  final GetStaffProjectDetail _getProjectDetail;
  final CreateReservation _createReservation;
  final GetLeads _getLeads;
  final GetPlanTemplates _getPlanTemplates;
  String? _clientId;

  Future<void> init() async {
    // Always load leads (needed for client picker)
    _loadLeads();
    if (state.fixedUnit) {
      // If we already know the project, load its plans
      if ((state.selectedProjectId ?? '').isNotEmpty) {
        _loadPlans(state.selectedProjectId!);
      }
      return;
    }
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

  Future<void> _loadPlans(String projectId) async {
    emit(state.copyWith(plansStatus: DataStatus.loading));
    final result = await _getPlanTemplates(projectId);
    result.when(
      ok: (plans) => emit(state.copyWith(
        plansStatus: plans.isEmpty ? DataStatus.empty : DataStatus.success,
        plans: plans,
      )),
      err: (_) => emit(state.copyWith(plansStatus: DataStatus.failure, plans: const [])),
    );
  }

  Future<void> selectProject(String id) async {
    emit(state.copyWith(
      selectedProjectId: id,
      clearSelectedUnit: true,
      clearSelectedPlan: true,
      unitsStatus: DataStatus.loading,
      plansStatus: DataStatus.loading,
    ));
    final result = await _getProjectDetail(id);
    result.when(
      ok: (detail) {
        emit(state.copyWith(
          unitsStatus: detail.units.isEmpty ? DataStatus.empty : DataStatus.success,
          units: detail.units,
        ));
        _loadPlans(id);
      },
      err: (_) => emit(state.copyWith(unitsStatus: DataStatus.failure, units: const [])),
    );
  }

  void selectUnit(String id) => emit(state.copyWith(selectedUnitId: id));

  void selectLead(String? id) => emit(state.copyWith(
        selectedLeadId: id,
        clearSelectedLead: id == null,
      ));

  void setLeadsSearch(String v) => emit(state.copyWith(leadsSearch: v));

  void setExpiresInHours(int hours) => emit(state.copyWith(expiresInHours: hours));

  void setNotes(String v) => emit(state.copyWith(notes: v));

  void selectPlan(String? id) => emit(state.copyWith(
        selectedPlanId: id,
        clearSelectedPlan: id == null,
      ));

  void setBookingNotes(String v) => emit(state.copyWith(bookingNotes: v));

  void setBookingAmountMode(String mode) => emit(state.copyWith(
        bookingAmountMode: mode,
        bookingAmount: '',
        bookingAmountPercent: '',
      ));

  void setBookingAmount(String v) => emit(state.copyWith(bookingAmount: v));
  void setBookingAmountPercent(String v) => emit(state.copyWith(bookingAmountPercent: v));

  Future<void> submit() async {
    if (state.submitting) return;
    if (!state.isValid) {
      emit(state.copyWith(showValidation: true));
      return;
    }
    emit(state.copyWith(submitting: true, clearSubmitFailure: true));
    final result = await _createReservation(NewReservation(
      unitId: state.selectedUnitId!,
      leadId: state.selectedLeadId,
      clientId: _clientId,
      notes: state.notes.trim().isEmpty ? null : state.notes.trim(),
      expiresInHours: state.expiresInHours,
      installmentPlanTemplateId: state.selectedPlanId,
      bookingNotes: state.bookingNotes.trim().isEmpty ? null : state.bookingNotes.trim(),
      bookingAmountMode: state.bookingAmountMode == 'PLAN' ? null : state.bookingAmountMode,
      bookingAmount: state.bookingAmountMode == 'FIXED'
          ? double.tryParse(state.bookingAmount)
          : null,
      bookingAmountPercent: state.bookingAmountMode == 'PERCENTAGE'
          ? double.tryParse(state.bookingAmountPercent)
          : null,
    ));
    result.when(
      ok: (_) => emit(state.copyWith(submitting: false, submitted: true)),
      err: (failure) => emit(state.copyWith(submitting: false, submitFailure: failure)),
    );
  }
}
