import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../units_list/units_list_data.dart';

class BuildingRow extends Equatable {
  const BuildingRow({required this.id, required this.name, this.floors, this.units = 0, this.available, this.sold});
  final String id;
  final String name;
  final int? floors;
  final int units;

  /// From the inventory matrix; null when it did not load.
  final int? available;
  final int? sold;

  @override
  List<Object?> get props => [id, name, floors, units, available, sold];
}

class PhaseRow extends Equatable {
  const PhaseRow({required this.id, required this.name, this.delivery, this.buildings = const []});
  final String id;
  final String name;
  final DateTime? delivery;
  final List<BuildingRow> buildings;
  int get units => buildings.fold(0, (s, b) => s + b.units);

  @override
  List<Object?> get props => [id, name, delivery, buildings];
}

/// A project as the website's project page shows it: the cover, status and
/// place; the units by status and the occupancy; phases and buildings; the
/// description, facts and services; the free units; and the map.
class ProjectPage extends Equatable {
  const ProjectPage({
    required this.id,
    required this.name,
    required this.status,
    this.featured = false,
    this.type,
    this.city,
    this.district,
    this.totalArea,
    this.license,
    this.description,
    this.services = const [],
    this.photos = const [],
    this.floorPlans = const [],
    this.lat,
    this.lng,
    this.available = 0,
    this.reserved = 0,
    this.sold = 0,
    this.total = 0,
    this.phases = const [],
    this.startingPrice,
    this.freeUnits = const [],
  });

  final String id;
  final Translatable name;
  final String status;
  final bool featured;
  final String? type;
  final String? city;
  final String? district;
  final double? totalArea;
  final String? license;
  final Translatable? description;
  final List<String> services;
  final List<String> photos;
  final List<String> floorPlans;
  final double? lat;
  final double? lng;
  final int available;
  final int reserved;
  final int sold;
  final int total;
  final List<PhaseRow> phases;

  /// The cheapest free unit's price.
  final double? startingPrice;

  /// The cheapest free units, first ones.
  final List<CatalogUnitRow> freeUnits;

  int get taken => reserved + sold;
  int get other => (total - available - taken).clamp(0, total);
  int? get occupancy => total == 0 ? null : (taken * 100 / total).round();
  int get buildings => phases.fold(0, (s, p) => s + p.buildings.length);

  /// The earliest phase delivery still to come, else the last one.
  DateTime? get delivery {
    final dates = [for (final p in phases) ?p.delivery]..sort();
    return dates.isEmpty ? null : dates.first;
  }

  int? get maxFloors {
    final f = [for (final p in phases) for (final b in p.buildings) ?b.floors];
    return f.isEmpty ? null : f.reduce((a, b) => a > b ? a : b);
  }

  String place() => [if ((district ?? '').isNotEmpty) district!, if ((city ?? '').isNotEmpty) city!].join(' · ');

  bool get hasLocation => lat != null && lng != null && (lat != 0 || lng != 0);

  static ProjectPage parse(
    Map<String, dynamic> p, {
    Map<String, dynamic>? unitsMeta,
    Map<String, dynamic>? free,
    Map<String, dynamic>? matrix,
  }) {
    List<Map<String, dynamic>> maps(Object? v) => (v as List?)?.whereType<Map<String, dynamic>>().toList() ?? const [];
    int i(Object? v) => (v as num?)?.toInt() ?? 0;
    final id = '${p['id']}';
    final m = maps(matrix?['projects']).where((x) => x['id'] == id).firstOrNull;
    final byBuilding = {
      for (final ph in maps(m?['phases']))
        for (final b in maps(ph['buildings'])) '${b['id']}': b,
    };
    final media = maps(p['media']);
    final counts = ((unitsMeta?['facets'] as Map?)?['counts'] as Map?)?['status'] as Map? ?? const {};
    final freeRows = maps(free?['data']).map(CatalogUnitRow.fromJson).toList();
    return ProjectPage(
      id: id,
      name: Translatable.fromJson(p['name']),
      status: p['status'] as String? ?? 'DRAFT',
      featured: p['featured'] == true,
      type: p['type'] as String?,
      city: p['city'] as String?,
      district: p['district'] as String?,
      totalArea: readAmount(p['totalArea']),
      license: p['licenseNumber'] as String?,
      description: p['description'] == null ? null : Translatable.fromJson(p['description']),
      services: [
        for (final s in (p['services'] as List?) ?? const [])
          if (Translatable.fromJson(s).resolve('ar').isNotEmpty) Translatable.fromJson(s).resolve('ar'),
      ],
      photos: [
        for (final x in media)
          if (x['type'] == 'IMAGE' && (x['url'] as String? ?? '').isNotEmpty) x['url'] as String,
      ],
      floorPlans: [
        for (final x in media)
          if (x['type'] == 'FLOORPLAN' && (x['url'] as String? ?? '').isNotEmpty) x['url'] as String,
      ],
      lat: (p['lat'] as num?)?.toDouble(),
      lng: (p['lng'] as num?)?.toDouble(),
      available: i(counts['AVAILABLE']),
      reserved: i(counts['RESERVED']),
      sold: i(counts['SOLD']),
      total: i(unitsMeta?['total']),
      phases: [
        for (final ph in maps(p['phases']))
          PhaseRow(
            id: '${ph['id']}',
            name: Translatable.fromJson(ph['name']).resolve('ar'),
            delivery: DateTime.tryParse('${ph['deliveryDate']}'),
            buildings: [
              for (final b in maps(ph['buildings']))
                BuildingRow(
                  id: '${b['id']}',
                  name: '${b['name'] ?? ''}',
                  floors: (b['totalFloors'] as num?)?.toInt(),
                  units: i((b['_count'] as Map?)?['units']),
                  available: byBuilding['${b['id']}'] == null ? null : i(byBuilding['${b['id']}']!['available']),
                  sold: byBuilding['${b['id']}'] == null ? null : i(byBuilding['${b['id']}']!['sold']),
                ),
            ],
          ),
      ],
      startingPrice: freeRows.isEmpty ? null : freeRows.first.price,
      freeUnits: freeRows,
    );
  }

  @override
  List<Object?> get props => [id, name, status, available, reserved, sold, total, phases, freeUnits];
}

class ProjectPageRepository {
  ProjectPageRepository(this._dio);
  final Dio _dio;
  static const freeShown = 5;

  Future<Result<ProjectPage>> load(String id) => guardApiCall(() async {
        Future<Object?> soft(Future<Object?> f) => f.catchError((Object _) => null);
        final results = await Future.wait<Object?>([
          _dio.get<Map<String, dynamic>>('/projects/$id').then((r) => r.data ?? const <String, dynamic>{}),
          // Over every unit of the project (the facets count by status).
          soft(_dio.get<Map<String, dynamic>>('/units', queryParameters: {'projectId': id, 'pageSize': 1}).then<Object?>((r) => r.data?['meta'])),
          soft(_dio
              .get<Map<String, dynamic>>('/units',
                  queryParameters: {'projectId': id, 'status': 'AVAILABLE', 'sort': 'price_asc', 'pageSize': freeShown})
              .then<Object?>((r) => r.data)),
          soft(_dio.get<Map<String, dynamic>>('/units/inventory-matrix').then<Object?>((r) => r.data)),
        ]);
        return ProjectPage.parse(
          results[0]! as Map<String, dynamic>,
          unitsMeta: results[1] as Map<String, dynamic>?,
          free: results[2] as Map<String, dynamic>?,
          matrix: results[3] as Map<String, dynamic>?,
        );
      });
}

class ProjectPageCubit extends Cubit<DataState<ProjectPage>> {
  ProjectPageCubit(this._repo, {required this.projectId}) : super(const DataState.initial());
  final ProjectPageRepository _repo;
  final String projectId;

  Future<void> load() async {
    if (state.data == null) emit(state.toLoading());
    final r = await _repo.load(projectId);
    if (isClosed) return;
    r.when(ok: (d) => emit(DataState.success(d)), err: (f) => emit(state.data == null ? state.toFailure(f) : state));
  }
}
