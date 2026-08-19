import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/staff_contract.dart';
import '../../domain/usecases/contract_use_cases.dart';

class ContractDetailState extends Equatable {
  const ContractDetailState({
    this.status = DataStatus.initial,
    this.contract,
    this.failure,
  });

  final DataStatus status;
  final StaffContractDetail? contract;
  final AppFailure? failure;

  ContractDetailState copyWith({
    DataStatus? status,
    StaffContractDetail? contract,
    AppFailure? failure,
  }) =>
      ContractDetailState(
        status: status ?? this.status,
        contract: contract ?? this.contract,
        failure: failure ?? this.failure,
      );

  @override
  List<Object?> get props => [status, contract, failure];
}

class ContractDetailCubit extends Cubit<ContractDetailState> {
  ContractDetailCubit(this._getDetail, {required this.contractId})
      : super(const ContractDetailState());

  final GetContractDetail _getDetail;
  final String contractId;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading));
    final result = await _getDetail(contractId);
    result.when(
      ok: (contract) => emit(state.copyWith(status: DataStatus.success, contract: contract)),
      err: (failure) => emit(state.copyWith(status: DataStatus.failure, failure: failure)),
    );
  }
}
