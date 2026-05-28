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
  });

  final DataStatus status;
  final List<BrokerLead> leads;
  final AppFailure? failure;
  final String? approvalStatus;
  final String search;

  BrokerLeadsListState copyWith({
    DataStatus? status,
    List<BrokerLead>? leads,
    AppFailure? failure,
    String? approvalStatus,
    bool clearApprovalStatus = false,
    String? search,
  }) =>
      BrokerLeadsListState(
        status: status ?? this.status,
        leads: leads ?? this.leads,
        failure: failure ?? this.failure,
        approvalStatus: clearApprovalStatus ? null : (approvalStatus ?? this.approvalStatus),
        search: search ?? this.search,
      );

  @override
  List<Object?> get props => [status, leads, failure, approvalStatus, search];
}

class BrokerLeadsCubit extends Cubit<BrokerLeadsListState> {
  BrokerLeadsCubit(this._getLeads) : super(const BrokerLeadsListState());

  final GetBrokerLeads _getLeads;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading));
    final result = await _getLeads(
      BrokerLeadsQuery(approvalStatus: state.approvalStatus, search: state.search),
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

  Future<void> setSearch(String search) async {
    emit(state.copyWith(search: search));
    await load();
  }
}
