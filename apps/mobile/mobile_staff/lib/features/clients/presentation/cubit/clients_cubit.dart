import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/staff_client.dart';
import '../../domain/usecases/client_use_cases.dart';

class ClientsListState extends Equatable {
  const ClientsListState({
    this.status = DataStatus.initial,
    this.clients = const [],
    this.failure,
    this.search = '',
  });

  final DataStatus status;
  final List<StaffClient> clients;
  final AppFailure? failure;
  final String search;

  ClientsListState copyWith({
    DataStatus? status,
    List<StaffClient>? clients,
    AppFailure? failure,
    String? search,
  }) =>
      ClientsListState(
        status: status ?? this.status,
        clients: clients ?? this.clients,
        failure: failure ?? this.failure,
        search: search ?? this.search,
      );

  @override
  List<Object?> get props => [status, clients, failure, search];
}

class ClientsCubit extends Cubit<ClientsListState> {
  ClientsCubit(this._getMyClients) : super(const ClientsListState());

  final GetMyClients _getMyClients;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading));
    final result = await _getMyClients(state.search.isEmpty ? null : state.search);
    result.when(
      ok: (clients) => emit(state.copyWith(
        status: clients.isEmpty ? DataStatus.empty : DataStatus.success,
        clients: clients,
      )),
      err: (failure) => emit(state.copyWith(status: DataStatus.failure, failure: failure)),
    );
  }

  Future<void> setSearch(String search) async {
    emit(state.copyWith(search: search));
    await load();
  }
}
