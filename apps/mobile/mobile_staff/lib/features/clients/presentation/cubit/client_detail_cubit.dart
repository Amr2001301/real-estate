import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/staff_client.dart';
import '../../domain/usecases/client_use_cases.dart';

typedef ClientDetailState = DataState<ClientDetail>;

class ClientDetailCubit extends Cubit<ClientDetailState> {
  ClientDetailCubit(this._getDetail, {required this.clientId})
      : super(const ClientDetailState.initial());

  final GetClientDetail _getDetail;
  final String clientId;

  Future<void> load() async {
    emit(state.toLoading());
    final result = await _getDetail(clientId);
    result.when(
      ok: (detail) => emit(ClientDetailState.success(detail)),
      err: (failure) => emit(state.toFailure(failure)),
    );
  }
}
