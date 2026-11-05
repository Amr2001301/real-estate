import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

/// A payout statement: the commissions the company transferred to the broker
/// for a period.
class BrokerPayout extends Equatable {
  const BrokerPayout({required this.id, this.number, this.period, this.status = 'DRAFT', this.totalNet = 0, this.paidAt, this.method});
  final String id;
  final String? number;
  final String? period;

  /// DRAFT · APPROVED · PROCESSING · PAID · CANCELLED
  final String status;
  final double totalNet;
  final DateTime? paidAt;
  final String? method;

  factory BrokerPayout.fromJson(Map<String, dynamic> j) => BrokerPayout(
        id: '${j['id']}',
        number: j['payoutNumber'] as String?,
        period: j['period'] as String?,
        status: j['status'] as String? ?? 'DRAFT',
        totalNet: readAmount(j['totalNet']) ?? 0,
        paidAt: DateTime.tryParse('${j['paidAt'] ?? ''}')?.toLocal(),
        method: j['paymentMethod'] as String?,
      );

  @override
  List<Object?> get props => [id, status, totalNet, paidAt];
}

class BrokerPayoutsRepository {
  BrokerPayoutsRepository(this._dio);
  final Dio _dio;

  Future<Result<List<BrokerPayout>>> all() => guardApiCall(() async {
        final r = await _dio.get<Map<String, dynamic>>('/portal/payouts', queryParameters: {'pageSize': 50});
        return [for (final m in ((r.data?['data'] as List?) ?? const []).whereType<Map<String, dynamic>>()) BrokerPayout.fromJson(m)];
      });
}

/// The payout statements are a side section of the page: a failure shows nothing.
class BrokerPayoutsCubit extends Cubit<List<BrokerPayout>> {
  BrokerPayoutsCubit(this._repo) : super(const []);
  final BrokerPayoutsRepository _repo;

  Future<void> load() async {
    final r = await _repo.all();
    if (isClosed) return;
    r.when(ok: emit, err: AppLog.failure);
  }

  double get paidTotal => state.where((p) => p.status == 'PAID').fold(0, (s, p) => s + p.totalNet);
}
