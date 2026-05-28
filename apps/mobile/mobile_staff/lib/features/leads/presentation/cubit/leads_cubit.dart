import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/lead.dart';
import '../../domain/repositories/leads_repository.dart';
import '../../domain/usecases/lead_use_cases.dart';

class LeadsListState extends Equatable {
  const LeadsListState({
    this.status = DataStatus.initial,
    this.leads = const [],
    this.failure,
    this.stage,
    this.search = '',
    this.mine = false,
  });

  final DataStatus status;
  final List<Lead> leads;
  final AppFailure? failure;
  final String? stage;
  final String search;
  final bool mine;

  LeadsListState copyWith({
    DataStatus? status,
    List<Lead>? leads,
    AppFailure? failure,
    String? stage,
    bool clearStage = false,
    String? search,
    bool? mine,
  }) =>
      LeadsListState(
        status: status ?? this.status,
        leads: leads ?? this.leads,
        failure: failure ?? this.failure,
        stage: clearStage ? null : (stage ?? this.stage),
        search: search ?? this.search,
        mine: mine ?? this.mine,
      );

  @override
  List<Object?> get props => [status, leads, failure, stage, search, mine];
}

class LeadsCubit extends Cubit<LeadsListState> {
  LeadsCubit(this._getLeads) : super(const LeadsListState());

  final GetLeads _getLeads;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading));
    final result = await _getLeads(
      LeadsQuery(stage: state.stage, search: state.search, mine: state.mine),
    );
    result.when(
      ok: (leads) => emit(state.copyWith(
        status: leads.isEmpty ? DataStatus.empty : DataStatus.success,
        leads: leads,
      )),
      err: (failure) => emit(state.copyWith(status: DataStatus.failure, failure: failure)),
    );
  }

  Future<void> setStage(String? stage) async {
    emit(stage == null ? state.copyWith(clearStage: true) : state.copyWith(stage: stage));
    await load();
  }

  Future<void> setSearch(String search) async {
    emit(state.copyWith(search: search));
    await load();
  }

  Future<void> toggleMine() async {
    emit(state.copyWith(mine: !state.mine));
    await load();
  }
}
