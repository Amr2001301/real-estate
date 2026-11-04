import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../catalog/units_list/units_list_data.dart';

/// A project the broker may sell, as the portal's projects page: the
/// project, the grant (ready to market or paused, its dates, its rate), and
/// how many of its units are free for the broker.
class PortalProjectRow extends Equatable {
  const PortalProjectRow({
    required this.id,
    required this.name,
    required this.status,
    this.city,
    this.description,
    this.services = const [],
    this.coverUrl,
    this.featured = false,
    this.lat,
    this.lng,
    this.active = true,
    this.startsAt,
    this.endsAt,
    this.commissionPct,
    this.fixedPerUnit,
    this.available,
  });

  final String id;
  final Translatable name;
  final String status;
  final String? city;
  final Translatable? description;
  final List<String> services;
  final String? coverUrl;
  final bool featured;
  final double? lat;
  final double? lng;

  /// The grant: on or paused, and its window.
  final bool active;
  final DateTime? startsAt;
  final DateTime? endsAt;

  /// The grant's rate; both null means the firm's default applies.
  final double? commissionPct;
  final double? fixedPerUnit;

  /// Free units for the broker in the project.
  final int? available;

  bool get hasLocation => lat != null && lng != null && (lat != 0 || lng != 0);

  factory PortalProjectRow.fromJson(Map<String, dynamic> j, {int? available}) {
    final p = (j['project'] as Map<String, dynamic>?) ?? const {};
    final a = (j['access'] as Map<String, dynamic>?) ?? const {};
    final media = (p['media'] as List?)?.whereType<Map<String, dynamic>>().where((m) => m['type'] != 'FLOORPLAN').toList() ?? const [];
    return PortalProjectRow(
      id: '${p['id']}',
      name: Translatable.fromJson(p['name']),
      status: p['status'] as String? ?? 'PUBLISHED',
      city: p['city'] as String?,
      description: p['description'] == null ? null : Translatable.fromJson(p['description']),
      services: [
        for (final s in (p['services'] as List?) ?? const [])
          if (Translatable.fromJson(s).resolve('ar').isNotEmpty) Translatable.fromJson(s).resolve('ar'),
      ],
      coverUrl: media.isEmpty ? null : media.first['url'] as String?,
      featured: p['featured'] == true,
      lat: (p['lat'] as num?)?.toDouble(),
      lng: (p['lng'] as num?)?.toDouble(),
      active: a['active'] != false,
      startsAt: DateTime.tryParse('${a['startsAt']}'),
      endsAt: DateTime.tryParse('${a['endsAt']}'),
      commissionPct: readAmount(a['commissionPct']),
      fixedPerUnit: readAmount(a['fixedAmountPerUnit']),
      available: available,
    );
  }

  @override
  List<Object?> get props => [id, name, status, active, commissionPct, fixedPerUnit, available, featured];
}

/// "2.50%", "50,000 ج.م" per unit, or the firm's default — as the portal's
/// project card.
({String text, bool isDefault})? portalCommission(PortalProjectRow p, double? defaultPct, String currency) {
  String pct(double v) => '${v.toStringAsFixed(2)}%';
  if (p.commissionPct != null) return (text: pct(p.commissionPct!), isDefault: false);
  if (p.fixedPerUnit != null) {
    final s = p.fixedPerUnit!.round().toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',');
    return (text: '$s $currency', isDefault: false);
  }
  if (defaultPct != null) return (text: pct(defaultPct), isDefault: true);
  return null;
}

/// A unit the broker may see, as a row of the portal's units page, with
/// what the unit page needs.
class PortalUnit extends Equatable {
  const PortalUnit({
    required this.row,
    this.accessSource,
    this.phaseName,
    this.projectCity,
    this.specs = const UnitSpecs(),
    this.photos = const [],
    this.floorPlans = const [],
    this.lat,
    this.lng,
  });

  /// The row the unit cards read (code, status, type's name, place, specs,
  /// price).
  final CatalogUnitRow row;

  /// PROJECT_ACCESS or UNIT_ACCESS.
  final String? accessSource;
  final String? phaseName;
  final String? projectCity;
  final UnitSpecs specs;
  final List<String> photos;
  final List<String> floorPlans;
  final double? lat;
  final double? lng;

  bool get hasLocation => lat != null && lng != null && (lat != 0 || lng != 0);

  factory PortalUnit.fromJson(Map<String, dynamic> j, {String lang = 'ar'}) {
    final r = CatalogUnitRow.fromJson(j);
    final building = j['building'] as Map<String, dynamic>?;
    final phase = building?['phase'] as Map<String, dynamic>?;
    final project = phase?['project'] as Map<String, dynamic>?;
    final media = (j['media'] as List?)?.whereType<Map<String, dynamic>>().toList() ?? const [];
    String? url(Map<String, dynamic> m) => (m['url'] as String?)?.isNotEmpty == true ? m['url'] as String : null;
    return PortalUnit(
      // The portal sends the type's code only: its name from the codes.
      row: CatalogUnitRow(
        id: r.id,
        code: r.code,
        status: r.status,
        typeName: j['type'] == null ? r.typeName : unitTypeLabel(j['type'] as String, languageCode: lang),
        projectId: r.projectId,
        projectName: r.projectName,
        buildingName: r.buildingName,
        area: r.area,
        bedrooms: r.bedrooms,
        bathrooms: r.bathrooms,
        floor: r.floor,
        price: r.price,
        reservedUntil: r.reservedUntil,
      ),
      accessSource: j['accessSource'] as String?,
      phaseName: phase == null ? null : Translatable.fromJson(phase['name']).resolve(lang),
      projectCity: project?['city'] as String?,
      specs: UnitSpecs.fromJson(j),
      photos: [for (final m in media) if (m['type'] != 'FLOORPLAN' && m['type'] != 'VIDEO') ?url(m)],
      floorPlans: [for (final m in media) if (m['type'] == 'FLOORPLAN') ?url(m)],
      lat: (j['latitude'] as num?)?.toDouble(),
      lng: (j['longitude'] as num?)?.toDouble(),
    );
  }

  @override
  List<Object?> get props => [row, accessSource, phaseName];
}

class PortalUnitCounts extends Equatable {
  const PortalUnitCounts({this.available = 0, this.reserved = 0, this.sold = 0});
  final int available;
  final int reserved;
  final int sold;
  int get total => available + reserved + sold;

  @override
  List<Object?> get props => [available, reserved, sold];
}

class PortalCatalogRepository {
  PortalCatalogRepository(this._dio);
  final Dio _dio;
  static const pageSize = 20;

  Future<int?> _count(Map<String, dynamic> q) => _dio
      .get<Map<String, dynamic>>('/portal/units', queryParameters: {...q, 'page': 1, 'pageSize': 1})
      .then<int?>((r) => ((r.data?['meta'] as Map?)?['total'] as num?)?.toInt())
      .catchError((Object _) => null);

  /// The broker's projects, each with its free units, and the firm's
  /// default rate — the portal's projects page.
  Future<Result<(List<PortalProjectRow>, double?)>> projects() => guardApiCall(() async {
        final results = await Future.wait<Object?>([
          _dio.get<List<dynamic>>('/portal/projects').then((r) => r.data ?? const []),
          _dio.get<Map<String, dynamic>>('/portal/me').then<Object?>((r) => r.data).catchError((Object _) => null),
        ]);
        final raw = (results[0]! as List).whereType<Map<String, dynamic>>().toList();
        final me = results[1] as Map<String, dynamic>?;
        final counts = await Future.wait([
          for (final p in raw) _count({'status': 'AVAILABLE', 'projectId': (p['project'] as Map?)?['id']}),
        ]);
        return (
          [for (final (i, p) in raw.indexed) PortalProjectRow.fromJson(p, available: counts[i])],
          readAmount((me?['broker'] as Map?)?['defaultCommissionPct']),
        );
      });

  /// How many units a choice gives, for the filter's apply label.
  Future<int?> count(UnitsQuery q) => _count({
        'status': ?q.status,
        'projectId': ?q.projectId,
        'bedrooms': ?q.bedrooms,
        'minPrice': ?q.priceMin,
        'maxPrice': ?q.priceMax,
        if (q.search.isNotEmpty) 'q': q.search,
      });

  /// Free, reserved and sold units over everything the broker may see.
  Future<PortalUnitCounts> counts() async {
    final c = await Future.wait([for (final s in ['AVAILABLE', 'RESERVED', 'SOLD']) _count({'status': s})]);
    return PortalUnitCounts(available: c[0] ?? 0, reserved: c[1] ?? 0, sold: c[2] ?? 0);
  }

  Future<Result<(List<PortalUnit>, int)>> units(UnitsQuery q, int page, {String lang = 'ar'}) => guardApiCall(() async {
        final r = await _dio.get<Map<String, dynamic>>('/portal/units', queryParameters: {
          'page': page,
          'pageSize': pageSize,
          'status': ?q.status,
          'projectId': ?q.projectId,
          'bedrooms': ?q.bedrooms,
          'minPrice': ?q.priceMin,
          'maxPrice': ?q.priceMax,
          if (q.search.isNotEmpty) 'q': q.search,
        });
        final rows = ((r.data?['data'] as List?) ?? const [])
            .whereType<Map<String, dynamic>>()
            .map((j) => PortalUnit.fromJson(j, lang: lang))
            .toList();
        return (rows, ((r.data?['meta'] as Map?)?['total'] as num?)?.toInt() ?? rows.length);
      });
}

// ── The projects tab ────────────────────────────────────────────────────────

class PortalProjectsState extends Equatable {
  const PortalProjectsState({this.status = DataStatus.initial, this.rows = const [], this.defaultPct, this.filter, this.search = '', this.failure});
  final DataStatus status;
  final List<PortalProjectRow> rows;
  final double? defaultPct;

  /// READY, FEATURED, or null for all.
  final String? filter;
  final String search;
  final AppFailure? failure;

  List<PortalProjectRow> get visible {
    final q = search.trim().toLowerCase();
    return rows.where((p) {
      if (filter == 'READY' && !p.active) return false;
      if (filter == 'FEATURED' && !p.featured) return false;
      if (q.isEmpty) return true;
      return p.name.ar.toLowerCase().contains(q) || p.name.en.toLowerCase().contains(q) || (p.city ?? '').toLowerCase().contains(q);
    }).toList();
  }

  int get ready => rows.where((p) => p.active).length;
  int get featured => rows.where((p) => p.featured).length;
  int get published => rows.where((p) => p.status == 'PUBLISHED').length;
  int get available => rows.fold(0, (s, p) => s + (p.available ?? 0));

  PortalProjectsState copyWith({
    DataStatus? status,
    List<PortalProjectRow>? rows,
    double? defaultPct,
    String? Function()? filter,
    String? search,
    AppFailure? failure,
  }) =>
      PortalProjectsState(
        status: status ?? this.status,
        rows: rows ?? this.rows,
        defaultPct: defaultPct ?? this.defaultPct,
        filter: filter == null ? this.filter : filter(),
        search: search ?? this.search,
        failure: failure ?? this.failure,
      );

  @override
  List<Object?> get props => [status, rows, defaultPct, filter, search, failure];
}

class PortalProjectsCubit extends Cubit<PortalProjectsState> {
  PortalProjectsCubit(this._repo) : super(const PortalProjectsState());
  final PortalCatalogRepository _repo;

  Future<void> load() async {
    if (state.rows.isEmpty) emit(state.copyWith(status: DataStatus.loading));
    final r = await _repo.projects();
    if (isClosed) return;
    r.when(
      ok: (d) => emit(state.copyWith(status: d.$1.isEmpty ? DataStatus.empty : DataStatus.success, rows: d.$1, defaultPct: d.$2)),
      err: (f) => emit(state.copyWith(status: state.rows.isEmpty ? DataStatus.failure : DataStatus.success, failure: f)),
    );
  }

  void setFilter(String? f) => emit(state.copyWith(filter: () => state.filter == f ? null : f));
  void setSearch(String q) => emit(state.copyWith(search: q));
}

// ── The units list ──────────────────────────────────────────────────────────

class PortalUnitsState extends Equatable {
  const PortalUnitsState({
    this.status = DataStatus.initial,
    this.rows = const [],
    this.total = 0,
    this.page = 1,
    this.loadingMore = false,
    this.counts,
    this.projects = const [],
    this.query = const UnitsQuery(),
    this.failure,
  });

  final DataStatus status;
  final List<PortalUnit> rows;
  final int total;
  final int page;
  final bool loadingMore;
  final PortalUnitCounts? counts;
  final List<(String, String)> projects;
  final UnitsQuery query;
  final AppFailure? failure;

  bool get hasMore => rows.length < total;
  String? projectName(String? id) => projects.where((p) => p.$1 == id).map((p) => p.$2).firstOrNull;

  PortalUnitsState copyWith({
    DataStatus? status,
    List<PortalUnit>? rows,
    int? total,
    int? page,
    bool? loadingMore,
    PortalUnitCounts? counts,
    List<(String, String)>? projects,
    UnitsQuery? query,
    AppFailure? failure,
  }) =>
      PortalUnitsState(
        status: status ?? this.status,
        rows: rows ?? this.rows,
        total: total ?? this.total,
        page: page ?? this.page,
        loadingMore: loadingMore ?? this.loadingMore,
        counts: counts ?? this.counts,
        projects: projects ?? this.projects,
        query: query ?? this.query,
        failure: failure ?? this.failure,
      );

  @override
  List<Object?> get props => [status, rows, total, page, loadingMore, counts, projects, query, failure];
}

class PortalUnitsCubit extends Cubit<PortalUnitsState> {
  PortalUnitsCubit(this._repo, {String? projectId, this.lang = 'ar'})
      : super(PortalUnitsState(query: UnitsQuery(projectId: projectId)));
  final PortalCatalogRepository _repo;
  final String lang;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading));
    final results = await Future.wait<Object?>([
      _repo.units(state.query, 1, lang: lang),
      if (state.counts == null) _repo.counts(),
      if (state.projects.isEmpty) _repo.projects(),
    ]);
    if (isClosed) return;
    var i = 1;
    final counts = state.counts ?? results[i++] as PortalUnitCounts;
    final projects = state.projects.isNotEmpty
        ? state.projects
        : [
            for (final p in (results[i] as Result<(List<PortalProjectRow>, double?)>).dataOrNull?.$1 ?? const <PortalProjectRow>[])
              (p.id, p.name.resolve(lang)),
          ];
    (results[0]! as Result<(List<PortalUnit>, int)>).when(
      ok: (d) => emit(state.copyWith(
        status: d.$1.isEmpty ? DataStatus.empty : DataStatus.success,
        rows: d.$1,
        total: d.$2,
        page: 1,
        counts: counts,
        projects: projects,
      )),
      err: (f) => emit(state.copyWith(status: DataStatus.failure, failure: f, counts: counts, projects: projects)),
    );
  }

  Future<void> loadMore() async {
    if (state.loadingMore || !state.hasMore || state.status != DataStatus.success) return;
    emit(state.copyWith(loadingMore: true));
    final r = await _repo.units(state.query, state.page + 1, lang: lang);
    if (isClosed) return;
    r.when(
      ok: (d) => emit(state.copyWith(rows: [...state.rows, ...d.$1], page: state.page + 1, loadingMore: false)),
      err: (_) => emit(state.copyWith(loadingMore: false)),
    );
  }

  Future<int?> count(UnitsQuery q) => _repo.count(q);

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
