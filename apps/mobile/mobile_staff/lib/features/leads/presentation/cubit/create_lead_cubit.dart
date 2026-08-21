import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/lead.dart';
import '../../domain/repositories/leads_repository.dart';
import '../../domain/usecases/lead_use_cases.dart';

enum CreateLeadStatus { idle, submitting, success, failure }

enum ClientPickerMode { pick, create }

class CreateLeadState extends Equatable {
  const CreateLeadState({
    this.status = CreateLeadStatus.idle,
    this.created,
    this.failure,
    this.sources = const [],
    this.sourcesLoading = false,
    this.selectedSourceId,
    this.clientMode = ClientPickerMode.create,
    this.clientSearchLoading = false,
    this.clientSearchResults = const [],
    this.selectedClient,
  });

  final CreateLeadStatus status;
  final Lead? created;
  final AppFailure? failure;
  final List<LeadSource> sources;
  final bool sourcesLoading;
  final String? selectedSourceId;
  final ClientPickerMode clientMode;
  final bool clientSearchLoading;
  final List<ClientSearchResult> clientSearchResults;
  final ClientSearchResult? selectedClient;

  CreateLeadState copyWith({
    CreateLeadStatus? status,
    Lead? created,
    AppFailure? failure,
    List<LeadSource>? sources,
    bool? sourcesLoading,
    String? selectedSourceId,
    bool clearSource = false,
    ClientPickerMode? clientMode,
    bool? clientSearchLoading,
    List<ClientSearchResult>? clientSearchResults,
    ClientSearchResult? selectedClient,
    bool clearSelectedClient = false,
  }) =>
      CreateLeadState(
        status: status ?? this.status,
        created: created ?? this.created,
        failure: failure ?? this.failure,
        sources: sources ?? this.sources,
        sourcesLoading: sourcesLoading ?? this.sourcesLoading,
        selectedSourceId:
            clearSource ? null : (selectedSourceId ?? this.selectedSourceId),
        clientMode: clientMode ?? this.clientMode,
        clientSearchLoading: clientSearchLoading ?? this.clientSearchLoading,
        clientSearchResults: clientSearchResults ?? this.clientSearchResults,
        selectedClient:
            clearSelectedClient ? null : (selectedClient ?? this.selectedClient),
      );

  @override
  List<Object?> get props => [
        status,
        created,
        failure,
        sources,
        sourcesLoading,
        selectedSourceId,
        clientMode,
        clientSearchLoading,
        clientSearchResults,
        selectedClient,
      ];
}

class CreateLeadCubit extends Cubit<CreateLeadState> {
  CreateLeadCubit(this._createLead, this._repo) : super(const CreateLeadState()) {
    _loadSources();
  }

  final CreateLead _createLead;
  final LeadsRepository _repo;

  Future<void> _loadSources() async {
    emit(state.copyWith(sourcesLoading: true));
    final result = await _repo.getSources();
    result.when(
      ok: (sources) =>
          emit(state.copyWith(sources: sources, sourcesLoading: false)),
      err: (_) => emit(state.copyWith(sourcesLoading: false)),
    );
  }

  void selectSource(String? id) => emit(
      id == null ? state.copyWith(clearSource: true) : state.copyWith(selectedSourceId: id));

  void switchToPickMode() => emit(state.copyWith(
        clientMode: ClientPickerMode.pick,
        clientSearchResults: [],
        clearSelectedClient: true,
      ));

  void switchToCreateMode() => emit(state.copyWith(
        clientMode: ClientPickerMode.create,
        clientSearchResults: [],
        clearSelectedClient: true,
      ));

  void selectClient(ClientSearchResult client) =>
      emit(state.copyWith(selectedClient: client, clientSearchResults: []));

  void clearClient() =>
      emit(state.copyWith(clearSelectedClient: true, clientSearchResults: []));

  Future<void> searchClients(String q) async {
    if (q.trim().isEmpty) {
      emit(state.copyWith(clientSearchResults: [], clientSearchLoading: false));
      return;
    }
    emit(state.copyWith(clientSearchLoading: true));
    final result = await _repo.searchClients(q.trim());
    result.when(
      ok: (results) =>
          emit(state.copyWith(clientSearchResults: results, clientSearchLoading: false)),
      err: (_) => emit(state.copyWith(clientSearchLoading: false)),
    );
  }

  Future<void> submit({
    String? fullName,
    String? phone,
    String? email,
    String? notes,
    String? projectInterestId,
    String? unitInterestId,
  }) async {
    emit(state.copyWith(status: CreateLeadStatus.submitting));
    final isPick = state.clientMode == ClientPickerMode.pick;
    final result = await _createLead(NewLead(
      clientId: isPick ? state.selectedClient?.id : null,
      fullName: isPick ? null : fullName,
      phone: isPick ? null : (phone?.isEmpty == true ? null : phone),
      email: isPick ? null : (email?.isEmpty == true ? null : email),
      sourceId: state.selectedSourceId,
      projectInterestId: projectInterestId,
      unitInterestId: unitInterestId,
      notes: notes?.isEmpty == true ? null : notes,
    ));
    result.when(
      ok: (lead) =>
          emit(state.copyWith(status: CreateLeadStatus.success, created: lead)),
      err: (failure) =>
          emit(state.copyWith(status: CreateLeadStatus.failure, failure: failure)),
    );
  }
}
