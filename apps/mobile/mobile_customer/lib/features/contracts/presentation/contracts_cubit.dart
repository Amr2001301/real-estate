import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../domain/entities/contract.dart';
import '../domain/usecases/get_my_contracts.dart';

typedef ContractsState = DataState<List<Contract>>;

class ContractsCubit extends Cubit<ContractsState> {
  ContractsCubit(this._getMyContracts) : super(const ContractsState.initial());

  final GetMyContracts _getMyContracts;

  Future<void> load() async {
    emit(state.toLoading());
    final result = await _getMyContracts(const NoParams());
    result.when(
      ok: (contracts) => emit(
        contracts.isEmpty
            ? const ContractsState.empty()
            : ContractsState.success(contracts),
      ),
      err: (failure) => emit(state.toFailure(failure)),
    );
  }
}
