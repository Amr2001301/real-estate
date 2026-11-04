import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/broker_lead.dart';
import '../../domain/repositories/broker_leads_repository.dart';
import '../../domain/usecases/broker_lead_use_cases.dart';

class BrokerLeadsListState extends Equatable {
  const BrokerLeadsListState({
    this.status = DataStatus.initial,
    this.leads = const [],
    this.failure,
    this.approvalStatus,
    this.search = '',
    this.stage,
    this.counts,
  });

  final DataStatus status;
  final List<BrokerLead> leads;
  final AppFailure? failure;
  final String? approvalStatus;
  final String search;
  final String? stage;

  /// Leads per approval status, for the whole list (not the loaded page).
  final BrokerLeadCounts? counts;

  BrokerLeadsListState copyWith({
    DataStatus? status,
    List<BrokerLead>? leads,
    AppFailure? failure,
    String? approvalStatus,
    bool clearApprovalStatus = false,
    String? search,
    String? stage,
    bool clearStage = false,
    BrokerLeadCounts? counts,
  }) =>
      BrokerLeadsListState(
        status: status ?? this.status,
        leads: leads ?? this.leads,
        failure: failure ?? this.failure,
        approvalStatus: clearApprovalStatus ? null : (approvalStatus ?? this.approvalStatus),
        search: search ?? this.search,
        stage: clearStage ? null : (stage ?? this.stage),
        counts: counts ?? this.counts,
      );

  @override
  List<Object?> get props => [status, leads, failure, approvalStatus, search, stage, counts];
}

class BrokerLeadsCubit extends Cubit<BrokerLeadsListState> {
  BrokerLeadsCubit(this._getLeads, [this._repo]) : super(const BrokerLeadsListState());

  final GetBrokerLeads _getLeads;

  /// For the figures above the list (null in older tests).
  final BrokerLeadsRepository? _repo;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading));
    _repo?.getCounts().then((r) {
      final c = r.dataOrNull;
      if (!isClosed && c != null) emit(state.copyWith(counts: c));
    });
    final result = await _getLeads(
      BrokerLeadsQuery(approvalStatus: state.approvalStatus, search: state.search, stage: state.stage),
    );
    result.when(
      ok: (leads) => emit(state.copyWith(
        status: leads.isEmpty ? DataStatus.empty : DataStatus.success,
        leads: leads,
      )),
      err: (failure) => emit(state.copyWith(status: DataStatus.failure, failure: failure)),
    );
  }

  Future<void> setApprovalStatus(String? status) async {
    emit(status == null
        ? state.copyWith(clearApprovalStatus: true)
        : state.copyWith(approvalStatus: status));
    await load();
  }

  Future<void> setStage(String? stage) async {
    emit(stage == null ? state.copyWith(clearStage: true) : state.copyWith(stage: stage));
    await load();
  }

  Future<void> setSearch(String search) async {
    emit(state.copyWith(search: search));
    await load();
  }
}
