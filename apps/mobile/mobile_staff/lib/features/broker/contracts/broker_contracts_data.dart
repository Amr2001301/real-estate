import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../contracts/view/contracts_data.dart';

/// The broker's commission on a contract, when the agent may see money
/// (the portal sends none otherwise).
class BrokerCommissionInfo extends Equatable {
  const BrokerCommissionInfo({required this.status, this.pct, this.gross, this.net});
  final String status;
  final double? pct;
  final double? gross;
  final double? net;

  @override
  List<Object?> get props => [status, pct, gross, net];
}

/// One of the broker's contracts, as the portal's contracts page.
class BrokerContract extends Equatable {
  const BrokerContract({
    required this.row,
    this.commission,
    this.unitType,
    this.area,
    this.buildingName,
    this.delivery,
    this.planStarts,
    this.payments = 0,
  });

  final ContractRow row;
  final BrokerCommissionInfo? commission;
  final String? unitType;
  final double? area;
  final String? buildingName;
  final DateTime? delivery;
  final DateTime? planStarts;

  /// How many payments are recorded on it.
  final int payments;

  factory BrokerContract.fromJson(Map<String, dynamic> j) {
    final c = j['brokerCommission'] as Map<String, dynamic>?;
    final unit = j['unit'] as Map<String, dynamic>?;
    final plan = j['installmentPlan'] as Map<String, dynamic>?;
    return BrokerContract(
      row: ContractRow.fromJson(j),
      commission: c == null
          ? null
          : BrokerCommissionInfo(
              status: c['status'] as String? ?? 'PENDING',
              pct: readAmount(c['commissionPct']),
              gross: readAmount(c['grossAmount']),
              net: readAmount(c['netAmount']),
            ),
      unitType: unit?['type'] as String?,
      area: readAmount(unit?['area']),
      buildingName: (unit?['building'] as Map?)?['name'] as String?,
      delivery: DateTime.tryParse('${j['deliveryDate']}'),
      planStarts: DateTime.tryParse('${plan?['startsAt']}'),
      payments: ((j['deposits'] as List?) ?? const []).length,
    );
  }

  /// Search by the client's name or phone, the number or the unit.
  bool matches(String q) {
    final s = q.trim().toLowerCase();
    if (s.isEmpty) return true;
    return [row.customerName, row.customerPhone, row.number, row.unitCode].any((v) => (v ?? '').toLowerCase().contains(s));
  }

  @override
  List<Object?> get props => [row, commission, payments];
}

class BrokerContractsRepository {
  BrokerContractsRepository(this._dio);
  final Dio _dio;

  /// Every contract the broker may see: a broker's book is short, so the
  /// list is read whole and searched on the phone (the portal has no text
  /// search).
  Future<Result<List<BrokerContract>>> all() => guardApiCall(() async {
        final out = <BrokerContract>[];
        for (var page = 1; page <= 20; page++) {
          final r = await _dio.get<Map<String, dynamic>>('/portal/contracts', queryParameters: {'page': page, 'pageSize': 100});
          final rows = ((r.data?['data'] as List?) ?? const []).whereType<Map<String, dynamic>>();
          out.addAll(rows.map(BrokerContract.fromJson));
          final total = ((r.data?['meta'] as Map?)?['total'] as num?)?.toInt() ?? out.length;
          if (rows.isEmpty || out.length >= total) break;
        }
        return out;
      });

  Future<Result<BrokerContract>> one(String id) => guardApiCall(() async {
        final r = await _dio.get<Map<String, dynamic>>('/portal/contracts/$id');
        return BrokerContract.fromJson(r.data ?? const {});
      });
}

class BrokerContractsState extends Equatable {
  const BrokerContractsState({this.data = const DataState.initial(), this.filter, this.search = ''});
  final DataState<List<BrokerContract>> data;

  /// SIGNED, UNSIGNED or null.
  final String? filter;
  final String search;

  List<BrokerContract> get all => data.data ?? const [];
  int get signed => all.where((c) => c.row.signedAt != null).length;
  double get value => all.fold(0, (s, c) => s + (c.row.total ?? 0));

  List<BrokerContract> get shown => all
      .where((c) => switch (filter) {
            'SIGNED' => c.row.signedAt != null,
            'UNSIGNED' => c.row.signedAt == null,
            _ => true,
          })
      .where((c) => c.matches(search))
      .toList();

  BrokerContractsState copyWith({DataState<List<BrokerContract>>? data, String? Function()? filter, String? search}) =>
      BrokerContractsState(data: data ?? this.data, filter: filter == null ? this.filter : filter(), search: search ?? this.search);

  @override
  List<Object?> get props => [data, filter, search];
}

class BrokerContractsCubit extends Cubit<BrokerContractsState> {
  BrokerContractsCubit(this._repo) : super(const BrokerContractsState());
  final BrokerContractsRepository _repo;

  Future<void> load() async {
    emit(state.copyWith(data: DataState.loading(previousData: state.data.data)));
    final r = await _repo.all();
    if (isClosed) return;
    r.when(
      ok: (l) => emit(state.copyWith(data: l.isEmpty ? const DataState.empty() : DataState.success(l))),
      err: (f) => emit(state.copyWith(data: DataState.failure(f, previousData: state.data.data))),
    );
  }

  void setFilter(String? f) => emit(state.copyWith(filter: () => state.filter == f ? null : f));
  void setSearch(String q) => emit(state.copyWith(search: q));
}

class BrokerContractCubit extends Cubit<DataState<BrokerContract>> {
  BrokerContractCubit(this._repo, {required this.contractId}) : super(const DataState.initial());
  final BrokerContractsRepository _repo;
  final String contractId;

  Future<void> load() async {
    emit(DataState.loading(previousData: state.data));
    final r = await _repo.one(contractId);
    if (isClosed) return;
    r.when(ok: (c) => emit(DataState.success(c)), err: (f) => emit(DataState.failure(f, previousData: state.data)));
  }
}
