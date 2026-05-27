import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../domain/entities/deposit.dart';
import '../domain/usecases/get_my_deposits.dart';

typedef DepositsState = DataState<List<Deposit>>;

class DepositsCubit extends Cubit<DepositsState> {
  DepositsCubit(this._getMyDeposits) : super(const DepositsState.initial());

  final GetMyDeposits _getMyDeposits;

  Future<void> load() async {
    emit(state.toLoading());
    final result = await _getMyDeposits(const NoParams());
    result.when(
      ok: (deposits) => emit(
        deposits.isEmpty
            ? const DepositsState.empty()
            : DepositsState.success(deposits),
      ),
      err: (failure) => emit(state.toFailure(failure)),
    );
  }
}
