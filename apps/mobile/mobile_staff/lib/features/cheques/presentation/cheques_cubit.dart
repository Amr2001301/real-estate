import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../domain/cheque.dart';

class ChequesState extends Equatable {
  const ChequesState({
    this.status = DataStatus.initial,
    this.filter = 'PENDING_CLEARANCE',
    this.items = const [],
    this.failure,
    this.page = 1,
    this.hasMore = false,
    this.isLoadingMore = false,
  });

  final DataStatus status;

  /// The status shown; null = all. Opens on the cheques still with the company.
  final String? filter;
  final List<Cheque> items;
  final AppFailure? failure;
  final int page;
  final bool hasMore;
  final bool isLoadingMore;

  ChequesState copyWith({
    DataStatus? status,
    String? filter,
    bool clearFilter = false,
    List<Cheque>? items,
    AppFailure? failure,
    int? page,
    bool? hasMore,
    bool? isLoadingMore,
  }) =>
      ChequesState(
        status: status ?? this.status,
        filter: clearFilter ? null : (filter ?? this.filter),
        items: items ?? this.items,
        failure: failure ?? this.failure,
        page: page ?? this.page,
        hasMore: hasMore ?? this.hasMore,
        isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      );

  @override
  List<Object?> get props => [status, filter, items, failure, page, hasMore, isLoadingMore];
}

/// FG-01 — the cheques list, a status at a time, soonest due first.
class ChequesCubit extends Cubit<ChequesState> {
  ChequesCubit(this._repo) : super(const ChequesState());
  final ChequesRepository _repo;

  Future<void> load() async {
    final filter = state.filter;
    emit(state.copyWith(status: DataStatus.loading));
    final result = await _repo.list(status: filter);
    if (filter != state.filter) return; // another tab was picked meanwhile
    result.when(
      ok: (page) => emit(state.copyWith(
        status: page.data.isEmpty ? DataStatus.empty : DataStatus.success,
        items: page.data,
        page: 1,
        hasMore: page.hasMore,
      )),
      err: (f) => emit(state.copyWith(status: DataStatus.failure, failure: f)),
    );
  }

  Future<void> setFilter(String? status) async {
    if (status == state.filter) return;
    emit(status == null ? state.copyWith(clearFilter: true, items: const []) : state.copyWith(filter: status, items: const []));
    await load();
  }

  Future<void> loadMore() async {
    if (!state.hasMore || state.isLoadingMore) return;
    final filter = state.filter;
    final next = state.page + 1;
    emit(state.copyWith(isLoadingMore: true));
    final result = await _repo.list(status: filter, page: next);
    if (filter != state.filter) return;
    result.when(
      ok: (page) => emit(state.copyWith(
        items: [...state.items, ...page.data],
        page: next,
        hasMore: page.hasMore,
        isLoadingMore: false,
      )),
      err: (_) => emit(state.copyWith(isLoadingMore: false)),
    );
  }
}

class ChequeDetailState extends Equatable {
  const ChequeDetailState({
    this.status = DataStatus.initial,
    this.cheque,
    this.failure,
    this.working = false,
    this.actionFailure,
    this.done,
  });

  final DataStatus status;
  final Cheque? cheque;
  final AppFailure? failure;

  /// A deposit / clearing is being recorded.
  final bool working;
  final AppFailure? actionFailure;

  /// What was just recorded: 'deposit' or 'clear' (for the confirmation).
  final String? done;

  ChequeDetailState copyWith({
    DataStatus? status,
    Cheque? cheque,
    AppFailure? failure,
    bool? working,
    AppFailure? actionFailure,
    bool clearAction = false,
    String? done,
  }) =>
      ChequeDetailState(
        status: status ?? this.status,
        cheque: cheque ?? this.cheque,
        failure: failure ?? this.failure,
        working: working ?? this.working,
        actionFailure: clearAction ? null : (actionFailure ?? this.actionFailure),
        done: clearAction ? null : (done ?? this.done),
      );

  @override
  List<Object?> get props => [status, cheque, failure, working, actionFailure, done];
}

/// One cheque, read fresh (the list row fills the customer and contract),
/// and the two steps the app records: deposited at the bank, then cleared.
class ChequeDetailCubit extends Cubit<ChequeDetailState> {
  ChequeDetailCubit(this._repo, {required this.id, this.row}) : super(const ChequeDetailState());
  final ChequesRepository _repo;
  final String id;
  final Cheque? row;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading));
    await _read();
  }

  Future<void> _read() async {
    final result = await _repo.get(id);
    result.when(
      ok: (c) => emit(state.copyWith(status: DataStatus.success, cheque: row == null ? c : c.withListContext(row!))),
      err: (f) => emit(state.copyWith(status: DataStatus.failure, failure: f)),
    );
  }

  Future<void> deposit() => _act('deposit', () => _repo.deposit(id));

  Future<void> clear({DateTime? clearingDate}) => _act('clear', () => _repo.clear(id, clearingDate: clearingDate));

  Future<void> _act(String what, Future<Result<void>> Function() call) async {
    if (state.working) return;
    emit(state.copyWith(working: true, clearAction: true));
    final failure = (await call()).failureOrNull;
    if (failure != null) {
      emit(state.copyWith(working: false, actionFailure: failure));
      return;
    }
    await _read();
    emit(state.copyWith(working: false, done: what));
  }
}
