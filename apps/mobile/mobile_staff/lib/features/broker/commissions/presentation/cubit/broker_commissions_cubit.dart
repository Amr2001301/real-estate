import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/broker_commission.dart';
import '../../domain/repositories/broker_commissions_repository.dart';
import '../../domain/usecases/get_broker_commissions.dart';

class BrokerCommissionsState extends Equatable {
  const BrokerCommissionsState({
    this.status = DataStatus.initial,
    this.allCommissions = const [],
    this.commissions = const [],
    this.failure,
    this.statusFilter,
    this.approvedTotal = 0,
    this.pendingTotal = 0,
  });

  final DataStatus status;
  /// Full unfiltered list — used for count badges and totals.
  final List<BrokerCommission> allCommissions;
  /// View after applying [statusFilter].
  final List<BrokerCommission> commissions;
  final AppFailure? failure;
  final String? statusFilter;
  final double approvedTotal;
  final double pendingTotal;

  int get totalCount => allCommissions.length;

  Map<String, int> get statusCounts {
    final counts = <String, int>{};
    for (final c in allCommissions) {
      counts[c.status] = (counts[c.status] ?? 0) + 1;
    }
    return counts;
  }

  BrokerCommissionsState copyWith({
    DataStatus? status,
    List<BrokerCommission>? allCommissions,
    List<BrokerCommission>? commissions,
    AppFailure? failure,
    String? statusFilter,
    bool clearStatusFilter = false,
    double? approvedTotal,
    double? pendingTotal,
  }) =>
      BrokerCommissionsState(
        status: status ?? this.status,
        allCommissions: allCommissions ?? this.allCommissions,
        commissions: commissions ?? this.commissions,
        failure: failure ?? this.failure,
        statusFilter: clearStatusFilter ? null : (statusFilter ?? this.statusFilter),
        approvedTotal: approvedTotal ?? this.approvedTotal,
        pendingTotal: pendingTotal ?? this.pendingTotal,
      );

  @override
  List<Object?> get props =>
      [status, allCommissions, commissions, failure, statusFilter, approvedTotal, pendingTotal];
}

class BrokerCommissionsCubit extends Cubit<BrokerCommissionsState> {
  BrokerCommissionsCubit(this._getCommissions) : super(const BrokerCommissionsState());

  final GetBrokerCommissions _getCommissions;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading));
    // Always load ALL — filter client-side so count badges stay accurate.
    final result = await _getCommissions(const BrokerCommissionsQuery());
    result.when(
      ok: (items) {
        final totals = brokerCommissionTotals(items);
        final filtered = _applyFilter(items, state.statusFilter);
        emit(state.copyWith(
          status: items.isEmpty ? DataStatus.empty : DataStatus.success,
          allCommissions: items,
          commissions: filtered,
          approvedTotal: totals.approved,
          pendingTotal: totals.pending,
        ));
      },
      err: (failure) => emit(state.copyWith(status: DataStatus.failure, failure: failure)),
    );
  }

  /// Instant client-side filter — no network call.
  void setStatus(String? status) {
    if (state.status != DataStatus.success && state.status != DataStatus.empty) return;
    final filtered = _applyFilter(state.allCommissions, status);
    emit(state.copyWith(
      statusFilter: status,
      clearStatusFilter: status == null,
      commissions: filtered,
      status: filtered.isEmpty ? DataStatus.empty : DataStatus.success,
    ));
  }

  List<BrokerCommission> _applyFilter(List<BrokerCommission> all, String? filter) =>
      filter == null ? all : all.where((c) => c.status == filter).toList();
}
