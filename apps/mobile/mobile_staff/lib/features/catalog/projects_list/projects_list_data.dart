import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

/// One project on the list, with the website's projects page figures: the
/// units by status (`/units/inventory-matrix`), the starting price, the unit
/// types, and — for the admin — the contract value (`/reports/admin-summary`).
class CatalogProjectRow extends Equatable {
  const CatalogProjectRow({
    required this.id,
    required this.name,
    required this.status,
    this.city,
    this.district,
    this.type,
    this.featured = false,
    this.coverUrl,
    this.available = 0,
    this.reserved = 0,
    this.sold = 0,
    this.total = 0,
    this.startingPrice,
    this.unitTypes = const [],
    this.contractValue,
    this.signedContracts,
  });

  final String id;
  final Translatable name;
  final String status;
  final String? city;
  final String? district;
  final String? type;
  final bool featured;
  final String? coverUrl;
  final int available;
  final int reserved;
  final int sold;
  final int total;
  final double? startingPrice;

  /// The unit types' names (from the company's unit types), else their codes.
  final List<String> unitTypes;

  /// The admin only, as on the website.
  final double? contractValue;
  final int? signedContracts;

  int get other => (total - available - reserved - sold).clamp(0, total);

  String place(String lang) => [if ((district ?? '').isNotEmpty) district!, if ((city ?? '').isNotEmpty) city!].join(' · ');

  @override
  List<Object?> get props => [id, name, status, featured, available, reserved, sold, total, startingPrice, contractValue];
}

class ProjectsOverview extends Equatable {
  const ProjectsOverview({
    required this.rows,
    this.published = 0,
    this.drafts = 0,
    this.archived = 0,
    this.featured = 0,
    this.unitsTotal = 0,
    this.unitsAvailable = 0,
    this.unitsReserved = 0,
    this.unitsSold = 0,
    this.inventoryValue = 0,
    this.admin = false,
  });

  final List<CatalogProjectRow> rows;

  /// Over every project of the company (`/projects/options`), not the page.
  final int published;
  final int drafts;
  final int archived;
  final int featured;
  int get projects => published + drafts + archived;

  /// Over every unit of the company (`/units` facets), as the website's strip.
  final int unitsTotal;
  final int unitsAvailable;
  final int unitsReserved;
  final int unitsSold;
  final double inventoryValue;
  final bool admin;

  @override
  List<Object?> get props => [rows, published, drafts, archived, featured, unitsTotal, unitsAvailable, inventoryValue, admin];
}

class ProjectsListRepository {
  ProjectsListRepository(this._dio, {this.admin = false});
  final Dio _dio;
  final bool admin;

  Future<Result<ProjectsOverview>> load({String? search}) => guardApiCall(() async {
        Future<Object?> soft(Future<Object?> f) => f.catchError((Object _) => null);
        final results = await Future.wait<Object?>([
          _dio
              .get<Map<String, dynamic>>('/projects', queryParameters: {
                'page': 1,
                'pageSize': 50,
                if ((search ?? '').isNotEmpty) 'q': search,
              })
              .then((r) => r.data ?? const <String, dynamic>{}),
          soft(_dio.get<Map<String, dynamic>>('/projects/options').then<Object?>((r) => r.data)),
          soft(_dio.get<Map<String, dynamic>>('/units/inventory-matrix').then<Object?>((r) => r.data)),
          soft(_dio.get<Map<String, dynamic>>('/units', queryParameters: {'pageSize': 1}).then<Object?>((r) => r.data)),
          soft(_dio.get<List<dynamic>>('/unit-types').then<Object?>((r) => r.data)),
          if (admin) soft(_dio.get<Map<String, dynamic>>('/reports/admin-summary').then<Object?>((r) => r.data)),
        ]);
        return parse(
          results[0]! as Map<String, dynamic>,
          options: results[1] as Map<String, dynamic>?,
          matrix: results[2] as Map<String, dynamic>?,
          units: results[3] as Map<String, dynamic>?,
          unitTypes: results[4] as List<dynamic>?,
          summary: admin ? results[5] as Map<String, dynamic>? : null,
          admin: admin,
        );
      });

  static ProjectsOverview parse(
    Map<String, dynamic> projects, {
    Map<String, dynamic>? options,
    Map<String, dynamic>? matrix,
    Map<String, dynamic>? units,
    List<dynamic>? unitTypes,
    Map<String, dynamic>? summary,
    bool admin = false,
  }) {
    List<Map<String, dynamic>> maps(Object? v) => (v as List?)?.whereType<Map<String, dynamic>>().toList() ?? const [];
    int i(Object? v) => (v as num?)?.toInt() ?? 0;

    final typeNames = {
      for (final t in maps(unitTypes)) '${t['code']}': Translatable.fromJson(t['name']).resolve('ar'),
    };
    final byMatrix = {for (final p in maps(matrix?['projects'])) '${p['id']}': p};
    final allOptions = maps(options?['data']);
    final featuredIds = {for (final o in allOptions) if (o['featured'] == true) '${o['id']}'};
    final value = {for (final p in maps(summary?['topProjects'])) '${p['id']}': p};

    final rows = maps(projects['data']).map((p) {
      final id = '${p['id']}';
      final m = byMatrix[id];
      final media = maps(p['media']).where((x) => x['type'] != 'FLOORPLAN' && x['type'] != 'VIDEO');
      final cover = (p['coverImageUrl'] as String?) ?? (media.isEmpty ? null : media.first['url'] as String?);
      final v = value[id];
      return CatalogProjectRow(
        id: id,
        name: Translatable.fromJson(p['name']),
        status: p['status'] as String? ?? 'DRAFT',
        city: p['city'] as String?,
        district: p['district'] as String?,
        type: p['type'] as String?,
        featured: p['featured'] == true || featuredIds.contains(id),
        coverUrl: cover,
        available: m == null ? i(p['availableUnitsCount']) : i(m['available']),
        reserved: m == null ? 0 : i(m['reserved']),
        sold: m == null ? i(p['soldUnitsCount']) : i(m['sold']),
        total: m == null ? i(p['totalUnitsCount']) : i(m['total']),
        startingPrice: readAmount(p['startingPrice']),
        unitTypes: [for (final t in (p['unitTypes'] as List?)?.whereType<String>() ?? const <String>[]) typeNames[t] ?? t],
        contractValue: admin ? (v == null ? 0 : readAmount(v['contractValue']) ?? 0) : null,
        signedContracts: admin ? (v == null ? 0 : i(v['signedContracts'])) : null,
      );
    }).toList();

    final all = allOptions.isEmpty ? maps(projects['data']) : allOptions;
    final facets = (units?['meta'] as Map<String, dynamic>?) ?? const {};
    final byStatus = ((facets['facets'] as Map?)?['counts'] as Map?)?['status'] as Map? ?? const {};
    return ProjectsOverview(
      rows: rows,
      published: all.where((p) => p['status'] == 'PUBLISHED').length,
      drafts: all.where((p) => p['status'] == 'DRAFT').length,
      archived: all.where((p) => p['status'] == 'ARCHIVED').length,
      featured: allOptions.isEmpty ? rows.where((r) => r.featured).length : featuredIds.length,
      unitsTotal: i(facets['total']),
      unitsAvailable: i(byStatus['AVAILABLE']),
      unitsReserved: i(byStatus['RESERVED']),
      unitsSold: i(byStatus['SOLD']),
      inventoryValue: readAmount(((facets['facets'] as Map?)?['sums'] as Map?)?['price']) ?? 0,
      admin: admin,
    );
  }
}

class ProjectsListState extends Equatable {
  const ProjectsListState({this.status = DataStatus.initial, this.data, this.failure, this.filter, this.search = ''});
  final DataStatus status;
  final ProjectsOverview? data;
  final AppFailure? failure;

  /// A status (PUBLISHED, DRAFT, ARCHIVED), "FEATURED", or null for all.
  final String? filter;
  final String search;

  List<CatalogProjectRow> get visible {
    final rows = data?.rows ?? const <CatalogProjectRow>[];
    return switch (filter) {
      null => rows,
      'FEATURED' => rows.where((r) => r.featured).toList(),
      final s => rows.where((r) => r.status == s).toList(),
    };
  }

  ProjectsListState copyWith({DataStatus? status, ProjectsOverview? data, AppFailure? failure, String? Function()? filter, String? search}) =>
      ProjectsListState(
        status: status ?? this.status,
        data: data ?? this.data,
        failure: failure ?? this.failure,
        filter: filter == null ? this.filter : filter(),
        search: search ?? this.search,
      );

  @override
  List<Object?> get props => [status, data, failure, filter, search];
}

class ProjectsListCubit extends Cubit<ProjectsListState> {
  ProjectsListCubit(this._repo) : super(const ProjectsListState());
  final ProjectsListRepository _repo;

  Future<void> load() async {
    if (state.data == null) emit(state.copyWith(status: DataStatus.loading));
    final r = await _repo.load(search: state.search);
    if (isClosed) return;
    r.when(
      ok: (d) => emit(state.copyWith(status: DataStatus.success, data: d)),
      err: (f) => emit(state.copyWith(status: state.data == null ? DataStatus.failure : DataStatus.success, failure: f)),
    );
  }

  Future<void> setSearch(String q) async {
    emit(state.copyWith(search: q.trim()));
    await load();
  }

  void setFilter(String? f) => emit(state.copyWith(filter: () => state.filter == f ? null : f));
}
