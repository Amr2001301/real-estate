import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../data/dtos/staff_catalog_dtos.dart';
import '../data/mappers/staff_catalog_mapper.dart';
import '../domain/entities/staff_project.dart';

class UnitReservationRow extends Equatable {
  const UnitReservationRow({required this.id, required this.status, this.number, this.client, this.sales, this.expiresAt, this.createdAt});
  final String id;
  final String status;
  final String? number;
  final String? client;
  final String? sales;
  final DateTime? expiresAt;
  final DateTime? createdAt;

  bool get live => status == 'PENDING' || status == 'APPROVED';

  factory UnitReservationRow.fromJson(Map<String, dynamic> j) => UnitReservationRow(
        id: '${j['id']}',
        status: j['status'] as String? ?? '',
        number: j['reservationNumber'] as String?,
        client: ((j['client'] as Map?)?['fullName'] ?? (j['lead'] as Map?)?['fullName']) as String?,
        sales: (j['sales'] as Map?)?['fullName'] as String?,
        expiresAt: DateTime.tryParse('${j['expiresAt']}')?.toLocal(),
        createdAt: DateTime.tryParse('${j['createdAt']}')?.toLocal(),
      );

  @override
  List<Object?> get props => [id, status, number, client, sales, expiresAt];
}

class UnitHistoryRow extends Equatable {
  const UnitHistoryRow({required this.from, required this.to, this.reason, this.by, this.at});
  final String from;
  final String to;
  final String? reason;
  final String? by;
  final DateTime? at;

  @override
  List<Object?> get props => [from, to, reason, by, at];
}

/// A unit as the website's unit page shows it: the unit (photos, price,
/// facts, specs, floor plans, maintenance items), where it sits (project,
/// phase, building), the live reservation and the past ones, and the
/// status history.
class UnitPage extends Equatable {
  const UnitPage({
    required this.unit,
    this.typeName,
    this.phaseName,
    this.buildingName,
    this.updatedAt,
    this.pricePerMeter,
    this.history = const [],
    this.reservations = const [],
  });

  final StaffUnit unit;
  final String? typeName;
  final String? phaseName;
  final String? buildingName;
  final DateTime? updatedAt;
  final double? pricePerMeter;
  final List<UnitHistoryRow> history;
  final List<UnitReservationRow> reservations;

  UnitReservationRow? get active => reservations.where((r) => r.live).firstOrNull;
  List<UnitReservationRow> get past => reservations.where((r) => r.id != active?.id).toList();

  static UnitPage parse(Map<String, dynamic> j, {List<dynamic>? reservations}) {
    final building = j['building'] as Map<String, dynamic>?;
    final phase = building?['phase'] as Map<String, dynamic>?;
    final type = j['typeName'] == null ? '' : Translatable.fromJson(j['typeName']).resolve('ar');
    return UnitPage(
      unit: StaffUnitDto.fromJson(j).toEntity(),
      typeName: type.isEmpty ? j['type'] as String? : type,
      phaseName: phase == null ? null : Translatable.fromJson(phase['name']).resolve('ar'),
      buildingName: building?['name'] as String?,
      updatedAt: DateTime.tryParse('${j['updatedAt']}')?.toLocal(),
      pricePerMeter: readAmount(j['pricePerMeter']),
      history: [
        for (final h in (j['history'] as List?)?.whereType<Map<String, dynamic>>() ?? const <Map<String, dynamic>>[])
          UnitHistoryRow(
            from: h['oldStatus'] as String? ?? '',
            to: h['newStatus'] as String? ?? '',
            reason: h['reason'] as String?,
            by: (h['changedBy'] as Map?)?['fullName'] as String?,
            at: DateTime.tryParse('${h['changedAt']}')?.toLocal(),
          ),
      ],
      reservations: [
        for (final r in reservations?.whereType<Map<String, dynamic>>() ?? const <Map<String, dynamic>>[]) UnitReservationRow.fromJson(r),
      ],
    );
  }

  @override
  List<Object?> get props => [unit, typeName, phaseName, buildingName, updatedAt, history, reservations];
}

class UnitPageRepository {
  UnitPageRepository(this._dio);
  final Dio _dio;

  Future<Result<UnitPage>> load(String id) => guardApiCall(() async {
        final results = await Future.wait<Object?>([
          _dio.get<Map<String, dynamic>>('/units/$id').then((r) => r.data ?? const <String, dynamic>{}),
          // Best-effort, as on the website: the page shows without them.
          _dio
              .get<Map<String, dynamic>>('/reservations', queryParameters: {'unitId': id, 'pageSize': 20})
              .then<Object?>((r) => r.data?['data'])
              .catchError((Object _) => null),
        ]);
        return UnitPage.parse(results[0]! as Map<String, dynamic>, reservations: results[1] as List<dynamic>?);
      });
}

class UnitPageCubit extends Cubit<DataState<UnitPage>> {
  UnitPageCubit(this._repo, {required this.unitId}) : super(const DataState.initial());
  final UnitPageRepository _repo;
  final String unitId;

  Future<void> load() async {
    if (state.data == null) emit(state.toLoading());
    final r = await _repo.load(unitId);
    if (isClosed) return;
    r.when(ok: (d) => emit(DataState.success(d)), err: (f) => emit(state.data == null ? state.toFailure(f) : state));
  }
}
