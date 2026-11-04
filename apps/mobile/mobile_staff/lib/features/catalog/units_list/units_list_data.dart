import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

/// One unit on the list, as a row of the website's units page.
class CatalogUnitRow extends Equatable {
  const CatalogUnitRow({
    required this.id,
    required this.code,
    required this.status,
    this.typeName,
    this.projectId,
    this.projectName,
    this.buildingName,
    this.area,
    this.bedrooms,
    this.bathrooms,
    this.floor,
    this.price,
    this.reservedUntil,
  });

  final String id;
  final String code;
  final String status;
  final String? typeName;
  final String? projectId;
  final String? projectName;
  final String? buildingName;
  final double? area;
  final int? bedrooms;
  final int? bathrooms;
  final int? floor;
  final double? price;

  /// When the reservation holding it lapses.
  final DateTime? reservedUntil;

  factory CatalogUnitRow.fromJson(Map<String, dynamic> j) {
    final building = j['building'] as Map<String, dynamic>?;
    final project = (building?['phase'] as Map<String, dynamic>?)?['project'] as Map<String, dynamic>?;
    final type = j['typeName'] == null ? null : Translatable.fromJson(j['typeName']).resolve('ar');
    return CatalogUnitRow(
      id: '${j['id']}',
      code: j['code'] as String? ?? '',
      status: j['status'] as String? ?? 'AVAILABLE',
      typeName: (type ?? '').isEmpty ? j['type'] as String? : type,
      projectId: project?['id'] as String?,
      projectName: project == null ? null : Translatable.fromJson(project['name']).resolve('ar'),
      buildingName: building?['name'] as String?,
      area: readAmount(j['area']),
      bedrooms: (j['bedrooms'] as num?)?.toInt(),
      bathrooms: (j['bathrooms'] as num?)?.toInt(),
      floor: (j['floor'] as num?)?.toInt(),
      price: readAmount(j['price']),
      reservedUntil: j['status'] == 'RESERVED' ? DateTime.tryParse('${j['reservationExpiresAt']}')?.toLocal() : null,
    );
  }

  @override
  List<Object?> get props => [id, code, status, price, reservedUntil];
}

/// The website's units-page strip, over every unit of the company.
class UnitsStrip extends Equatable {
  const UnitsStrip({this.total = 0, this.available = 0, this.reserved = 0, this.sold = 0, this.value = 0});
  final int total;
  final int available;
  final int reserved;
  final int sold;
  final double value;

  factory UnitsStrip.fromMeta(Map<String, dynamic>? meta) {
    final facets = meta?['facets'] as Map?;
    final byStatus = (facets?['counts'] as Map?)?['status'] as Map? ?? const {};
    int i(Object? v) => (v as num?)?.toInt() ?? 0;
    return UnitsStrip(
      total: i(meta?['total']),
      available: i(byStatus['AVAILABLE']),
      reserved: i(byStatus['RESERVED']),
      sold: i(byStatus['SOLD']),
      value: readAmount((facets?['sums'] as Map?)?['price']) ?? 0,
    );
  }

  @override
  List<Object?> get props => [total, available, reserved, sold, value];
}

/// What the list is narrowed by, as the website's units filters.
class UnitsQuery extends Equatable {
  const UnitsQuery({this.status, this.projectId, this.bedrooms, this.priceMin, this.priceMax, this.search = ''});
  final String? status;
  final String? projectId;
  final int? bedrooms;
  final num? priceMin;
  final num? priceMax;
  final String search;

  /// The same query with a filter-sheet choice dropped.
  UnitsQuery without({bool project = false, bool bedrooms = false, bool price = false}) => UnitsQuery(
        status: status,
        search: search,
        projectId: project ? null : projectId,
        bedrooms: bedrooms ? null : this.bedrooms,
        priceMin: price ? null : priceMin,
        priceMax: price ? null : priceMax,
      );

  bool get advanced => projectId != null || bedrooms != null || priceMin != null || priceMax != null;

  Map<String, dynamic> params(int page, int pageSize) => {
        'page': page,
        'pageSize': pageSize,
        'status': ?status,
        'projectId': ?projectId,
        'bedrooms': ?bedrooms,
        'priceMin': ?priceMin,
        'priceMax': ?priceMax,
        if (search.isNotEmpty) 'q': search,
      };

  @override
  List<Object?> get props => [status, projectId, bedrooms, priceMin, priceMax, search];
}

class UnitsPage {
  const UnitsPage({required this.rows, required this.total});
  final List<CatalogUnitRow> rows;
  final int total;
}

class UnitsListRepository {
  UnitsListRepository(this._dio);
  final Dio _dio;
  static const pageSize = 20;

  Future<Result<UnitsPage>> page(UnitsQuery q, int page) => guardApiCall(() async {
        final r = await _dio.get<Map<String, dynamic>>('/units', queryParameters: q.params(page, pageSize));
        final rows = ((r.data?['data'] as List?) ?? const []).whereType<Map<String, dynamic>>().map(CatalogUnitRow.fromJson).toList();
        return UnitsPage(rows: rows, total: ((r.data?['meta'] as Map?)?['total'] as num?)?.toInt() ?? rows.length);
      });

  /// Deliberately unfiltered: the strip describes the whole portfolio, as on
  /// the website.
  Future<Result<UnitsStrip>> strip() => guardApiCall(() async {
        final r = await _dio.get<Map<String, dynamic>>('/units', queryParameters: {'pageSize': 1});
        return UnitsStrip.fromMeta(r.data?['meta'] as Map<String, dynamic>?);
      });

  /// Every project, for the filter.
  Future<Result<List<(String, String)>>> projects() => guardApiCall(() async {
        final r = await _dio.get<Map<String, dynamic>>('/projects/options');
        return [
          for (final p in ((r.data?['data'] as List?) ?? const []).whereType<Map<String, dynamic>>())
            ('${p['id']}', Translatable.fromJson(p['name']).resolve('ar')),
        ];
      });
}

class UnitsListState extends Equatable {
  const UnitsListState({
    this.status = DataStatus.initial,
    this.rows = const [],
    this.total = 0,
    this.page = 1,
    this.loadingMore = false,
    this.strip,
    this.projects = const [],
    this.query = const UnitsQuery(),
    this.failure,
  });

  final DataStatus status;
  final List<CatalogUnitRow> rows;
  final int total;
  final int page;
  final bool loadingMore;
  final UnitsStrip? strip;
  final List<(String, String)> projects;
  final UnitsQuery query;
  final AppFailure? failure;

  bool get hasMore => rows.length < total;

  String? projectName(String? id) => projects.where((p) => p.$1 == id).map((p) => p.$2).firstOrNull;

  UnitsListState copyWith({
    DataStatus? status,
    List<CatalogUnitRow>? rows,
    int? total,
    int? page,
    bool? loadingMore,
    UnitsStrip? strip,
    List<(String, String)>? projects,
    UnitsQuery? query,
    AppFailure? failure,
  }) =>
      UnitsListState(
        status: status ?? this.status,
        rows: rows ?? this.rows,
        total: total ?? this.total,
        page: page ?? this.page,
        loadingMore: loadingMore ?? this.loadingMore,
        strip: strip ?? this.strip,
        projects: projects ?? this.projects,
        query: query ?? this.query,
        failure: failure ?? this.failure,
      );

  @override
  List<Object?> get props => [status, rows, total, page, loadingMore, strip, projects, query, failure];
}

class UnitsListCubit extends Cubit<UnitsListState> {
  UnitsListCubit(this._repo, {String? projectId}) : super(UnitsListState(query: UnitsQuery(projectId: projectId)));
  final UnitsListRepository _repo;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading));
    final results = await Future.wait<Object>([
      _repo.page(state.query, 1),
      if (state.strip == null) _repo.strip(),
      if (state.projects.isEmpty) _repo.projects(),
    ]);
    if (isClosed) return;
    final page = results[0] as Result<UnitsPage>;
    var i = 1;
    final strip = state.strip ?? (results[i++] as Result<UnitsStrip>).dataOrNull;
    final projects = state.projects.isEmpty ? (results[i] as Result<List<(String, String)>>).dataOrNull : state.projects;
    page.when(
      ok: (p) => emit(state.copyWith(
        status: p.rows.isEmpty ? DataStatus.empty : DataStatus.success,
        rows: p.rows,
        total: p.total,
        page: 1,
        strip: strip,
        projects: projects,
      )),
      err: (f) => emit(state.copyWith(status: DataStatus.failure, failure: f, strip: strip, projects: projects)),
    );
  }

  Future<void> loadMore() async {
    if (state.loadingMore || !state.hasMore || state.status != DataStatus.success) return;
    emit(state.copyWith(loadingMore: true));
    final r = await _repo.page(state.query, state.page + 1);
    if (isClosed) return;
    r.when(
      ok: (p) => emit(state.copyWith(rows: [...state.rows, ...p.rows], page: state.page + 1, loadingMore: false)),
      err: (_) => emit(state.copyWith(loadingMore: false)),
    );
  }

  Future<void> apply(UnitsQuery q) async {
    emit(state.copyWith(query: q));
    await load();
  }

  Future<void> setStatus(String? s) => apply(UnitsQuery(
        status: state.query.status == s ? null : s,
        projectId: state.query.projectId,
        bedrooms: state.query.bedrooms,
        priceMin: state.query.priceMin,
        priceMax: state.query.priceMax,
        search: state.query.search,
      ));

  Future<void> setSearch(String q) => apply(UnitsQuery(
        status: state.query.status,
        projectId: state.query.projectId,
        bedrooms: state.query.bedrooms,
        priceMin: state.query.priceMin,
        priceMax: state.query.priceMax,
        search: q.trim(),
      ));
}
