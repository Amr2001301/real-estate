import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/staff_contract.dart';
import '../../domain/usecases/contract_use_cases.dart';

class ContractsListState extends Equatable {
  const ContractsListState({
    this.status = DataStatus.initial,
    this.contracts = const [],
    this.failure,
    this.statusFilter,
    this.search = '',
  });

  final DataStatus status;
  final List<StaffContract> contracts;
  final AppFailure? failure;
  final String? statusFilter;
  final String search;

  ContractsListState copyWith({
    DataStatus? status,
    List<StaffContract>? contracts,
    AppFailure? failure,
    String? statusFilter,
    bool clearStatusFilter = false,
    String? search,
  }) =>
      ContractsListState(
        status: status ?? this.status,
        contracts: contracts ?? this.contracts,
        failure: failure ?? this.failure,
        statusFilter: clearStatusFilter ? null : (statusFilter ?? this.statusFilter),
        search: search ?? this.search,
      );

  @override
  List<Object?> get props => [status, contracts, failure, statusFilter, search];
}

class ContractsCubit extends Cubit<ContractsListState> {
  ContractsCubit(this._listContracts) : super(const ContractsListState());

  final ListContracts _listContracts;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading));
    final result = await _listContracts(
      ListContractsParams(
        q: state.search.isEmpty ? null : state.search,
        status: state.statusFilter,
      ),
    );
    result.when(
      ok: (contracts) => emit(state.copyWith(
        status: contracts.isEmpty ? DataStatus.empty : DataStatus.success,
        contracts: contracts,
      )),
      err: (failure) => emit(state.copyWith(status: DataStatus.failure, failure: failure)),
    );
  }

  Future<void> setStatus(String? status) async {
    emit(status == null
        ? state.copyWith(clearStatusFilter: true)
        : state.copyWith(statusFilter: status));
    await load();
  }

  Future<void> setSearch(String search) async {
    emit(state.copyWith(search: search));
    await load();
  }
}
