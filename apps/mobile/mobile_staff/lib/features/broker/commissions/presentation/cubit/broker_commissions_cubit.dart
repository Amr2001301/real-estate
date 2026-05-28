import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/broker_commission.dart';
import '../../domain/repositories/broker_commissions_repository.dart';
import '../../domain/usecases/get_broker_commissions.dart';

class BrokerCommissionsState extends Equatable {
  const BrokerCommissionsState({
    this.status = DataStatus.initial,
    this.commissions = const [],
    this.failure,
    this.statusFilter,
    this.approvedTotal = 0,
    this.pendingTotal = 0,
  });

  final DataStatus status;
  final List<BrokerCommission> commissions;
  final AppFailure? failure;
  final String? statusFilter;
  final double approvedTotal;
  final double pendingTotal;

  BrokerCommissionsState copyWith({
    DataStatus? status,
    List<BrokerCommission>? commissions,
    AppFailure? failure,
    String? statusFilter,
    bool clearStatusFilter = false,
    double? approvedTotal,
    double? pendingTotal,
  }) =>
      BrokerCommissionsState(
        status: status ?? this.status,
        commissions: commissions ?? this.commissions,
        failure: failure ?? this.failure,
        statusFilter: clearStatusFilter ? null : (statusFilter ?? this.statusFilter),
        approvedTotal: approvedTotal ?? this.approvedTotal,
        pendingTotal: pendingTotal ?? this.pendingTotal,
      );

  @override
  List<Object?> get props => [status, commissions, failure, statusFilter, approvedTotal, pendingTotal];
}

class BrokerCommissionsCubit extends Cubit<BrokerCommissionsState> {
  BrokerCommissionsCubit(this._getCommissions) : super(const BrokerCommissionsState());

  final GetBrokerCommissions _getCommissions;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading));
    final result = await _getCommissions(BrokerCommissionsQuery(status: state.statusFilter));
    result.when(
      ok: (items) {
        final totals = brokerCommissionTotals(items);
        emit(state.copyWith(
          status: items.isEmpty ? DataStatus.empty : DataStatus.success,
          commissions: items,
          approvedTotal: totals.approved,
          pendingTotal: totals.pending,
        ));
      },
      err: (failure) => emit(state.copyWith(status: DataStatus.failure, failure: failure)),
    );
  }

  Future<void> setStatus(String? status) async {
    emit(status == null
        ? state.copyWith(clearStatusFilter: true)
        : state.copyWith(statusFilter: status));
    await load();
  }
}
