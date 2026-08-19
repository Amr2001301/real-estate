import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/staff_deposit.dart';
import '../../domain/usecases/deposit_use_cases.dart';

class DepositsListState extends Equatable {
  const DepositsListState({
    this.status = DataStatus.initial,
    this.deposits = const [],
    this.failure,
    this.search = '',
  });

  final DataStatus status;
  final List<StaffDeposit> deposits;
  final AppFailure? failure;
  final String search;

  DepositsListState copyWith({
    DataStatus? status,
    List<StaffDeposit>? deposits,
    AppFailure? failure,
    String? search,
  }) =>
      DepositsListState(
        status: status ?? this.status,
        deposits: deposits ?? this.deposits,
        failure: failure ?? this.failure,
        search: search ?? this.search,
      );

  @override
  List<Object?> get props => [status, deposits, failure, search];
}

class DepositsCubit extends Cubit<DepositsListState> {
  DepositsCubit(this._listDeposits) : super(const DepositsListState());

  final ListDeposits _listDeposits;

  Future<void> load({String? contractId}) async {
    emit(state.copyWith(status: DataStatus.loading));
    final result = await _listDeposits(
      ListDepositsParams(
        q: state.search.isEmpty ? null : state.search,
        contractId: contractId,
      ),
    );
    result.when(
      ok: (deposits) => emit(state.copyWith(
        status: deposits.isEmpty ? DataStatus.empty : DataStatus.success,
        deposits: deposits,
      )),
      err: (failure) => emit(state.copyWith(status: DataStatus.failure, failure: failure)),
    );
  }

  Future<void> setSearch(String search) async {
    emit(state.copyWith(search: search));
    await load();
  }
}
