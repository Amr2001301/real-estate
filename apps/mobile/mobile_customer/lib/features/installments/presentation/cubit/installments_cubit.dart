import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/installment.dart';
import '../../domain/usecases/get_my_installments.dart';

typedef InstallmentsState = DataState<List<Installment>>;

class InstallmentsCubit extends Cubit<InstallmentsState> {
  InstallmentsCubit(this._getMyInstallments)
      : super(const InstallmentsState.initial());

  final GetMyInstallments _getMyInstallments;

  Future<void> load() async {
    emit(state.toLoading());
    final result = await _getMyInstallments(const NoParams());
    result.when(
      ok: (items) => emit(
        items.isEmpty
            ? const InstallmentsState.empty()
            : InstallmentsState.success(items),
      ),
      err: (failure) => emit(state.toFailure(failure)),
    );
  }
}
