import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../leads/data/dtos/lead_dtos.dart';
import '../leads/data/mappers/lead_mapper.dart';
import '../leads/domain/entities/lead.dart';

/// The company's clients, for admins only — as on the website, whose client
/// pages read `/users` (ADMIN-only on the API).

DateTime? _at(Object? v) => DateTime.tryParse(v as String? ?? '')?.toLocal();

/// One client account (a browsing client, or a unit owner).
class ClientRow extends Equatable {
  const ClientRow({
    required this.id,
    required this.name,
    required this.role,
    required this.active,
    this.phone,
    this.email,
    this.createdAt,
    this.lastLoginAt,
  });

  final String id;
  final String name;

  /// CLIENT browses; CUSTOMER owns a unit.
  final String role;
  final bool active;
  final String? phone;
  final String? email;
  final DateTime? createdAt;
  final DateTime? lastLoginAt;

  bool get owner => role == 'CUSTOMER';

  factory ClientRow.fromJson(Map<String, dynamic> j) => ClientRow(
        id: j['id'] as String? ?? '',
        name: j['fullName'] as String? ?? '',
        role: j['role'] as String? ?? 'CLIENT',
        active: j['active'] as bool? ?? true,
        phone: j['phone'] as String?,
        email: j['email'] as String?,
        createdAt: _at(j['createdAt']),
        lastLoginAt: _at(j['lastLoginAt']),
      );

  @override
  List<Object?> get props => [id, name, role, active, phone, email, createdAt, lastLoginAt];
}

class ClientCounts extends Equatable {
  const ClientCounts({this.browsers = 0, this.owners = 0, this.suspended = 0});
  final int browsers;
  final int owners;
  final int suspended;
  int get total => browsers + owners;

  @override
  List<Object?> get props => [browsers, owners, suspended];
}

/// The fixed extra details every client can carry (the website's
/// FIXED_DETAILS), in its order.
const kClientDetails = [
  'nationalId',
  'address',
  'birthDate',
  'birthPlace',
  'occupation',
  'employer',
  'nationalIdIssueDate',
  'nationalIdIssuePlace',
  'homePhone',
];
const kClientDateDetails = {'birthDate', 'nationalIdIssueDate'};

/// One of the company's own client fields (`/customer-fields`).
class ClientFieldDef extends Equatable {
  const ClientFieldDef({required this.key, required this.label, required this.type, this.order = 0});
  final String key;
  final Translatable label;
  final String type;
  final int order;

  @override
  List<Object?> get props => [key, label, type, order];
}

/// A booking, visit, contract, maintenance request or document of the
/// client: a title, a line under it, when, and a status.
class ClientItem extends Equatable {
  const ClientItem({required this.id, this.number, this.project, this.unitCode, this.at, this.status, this.amount, this.extra, this.url});
  final String id;
  final String? number;
  final Translatable? project;
  final String? unitCode;
  final DateTime? at;
  final String? status;
  final double? amount;

  /// A maintenance category, a document category or uploader.
  final String? extra;

  /// A document's file.
  final String? url;

  @override
  List<Object?> get props => [id, number, project, unitCode, at, status, amount, extra, url];
}

class ClientProfile extends Equatable {
  const ClientProfile({
    required this.client,
    this.locale,
    this.details = const {},
    this.custom = const {},
    this.fieldDefs = const [],
    this.leads = const [],
    this.reservations = const [],
    this.visits = const [],
    this.contracts = const [],
    this.maintenance = const [],
    this.documents = const [],
    this.updatedAt,
  });

  final ClientRow client;
  final String? locale;

  /// The filled fixed details (key → value).
  final Map<String, String> details;

  /// The filled company fields (key → value).
  final Map<String, String> custom;
  final List<ClientFieldDef> fieldDefs;
  final List<Lead> leads;
  final List<ClientItem> reservations;
  final List<ClientItem> visits;
  final List<ClientItem> contracts;
  final List<ClientItem> maintenance;
  final List<ClientItem> documents;

  /// When the account last changed (the website's "suspended since").
  final DateTime? updatedAt;

  ClientProfile copyWith({ClientRow? client}) => ClientProfile(
        client: client ?? this.client,
        locale: locale,
        details: details,
        custom: custom,
        fieldDefs: fieldDefs,
        leads: leads,
        reservations: reservations,
        visits: visits,
        contracts: contracts,
        maintenance: maintenance,
        documents: documents,
        updatedAt: updatedAt,
      );

  @override
  List<Object?> get props => [client, details, custom, leads, reservations, visits, contracts, maintenance, documents];
}

Translatable? _project(Map<String, dynamic> r) {
  final unit = r['unit'] as Map?;
  final n = (((unit?['building'] as Map?)?['phase'] as Map?)?['project'] as Map?)?['name'] ?? (r['project'] as Map?)?['name'];
  return n == null ? null : Translatable.fromJson(n);
}

class AdminClientsRepository {
  AdminClientsRepository(this._dio);
  final Dio _dio;

  Future<Map<String, dynamic>> _get(String path, [Map<String, dynamic>? q]) async =>
      (await _dio.get<Map<String, dynamic>>(path, queryParameters: q)).data ?? const {};

  static List<Map<String, dynamic>> _rows(Object? data) =>
      ((data is Map ? data['data'] : data) as List? ?? const []).whereType<Map<String, dynamic>>().toList();

  static int _total(Map<String, dynamic> page) => ((page['meta'] as Map?)?['total'] as num?)?.toInt() ?? 0;

  /// A page of clients: [role] CLIENT or CUSTOMER (null both), [q] a name,
  /// phone or e-mail.
  Future<Result<Paginated<ClientRow>>> list({String? role, String? q, int page = 1}) => guardApiCall(() async {
        final res = await _get('/users', {
          'role': role ?? 'CLIENT,CUSTOMER',
          'page': page,
          'pageSize': 20,
          if ((q ?? '').trim().isNotEmpty) 'q': q!.trim(),
        });
        return Paginated.fromJson(res, ClientRow.fromJson);
      });

  Future<Result<ClientCounts>> counts() => guardApiCall(() async {
        final r = await Future.wait([
          _get('/users', {'role': 'CLIENT', 'pageSize': 1}),
          _get('/users', {'role': 'CUSTOMER', 'pageSize': 1}),
          _get('/users', {'role': 'CLIENT,CUSTOMER', 'active': 'false', 'pageSize': 1}),
        ]);
        return ClientCounts(browsers: _total(r[0]), owners: _total(r[1]), suspended: _total(r[2]));
      });

  Future<Result<ClientProfile>> profile(String id) => guardApiCall(() async {
        final user = await _get('/users/$id');
        // The rest is best-effort: the page shows without any of it.
        Future<Object?> soft(String path, Map<String, dynamic> q) =>
            _dio.get<Object?>(path, queryParameters: q).then<Object?>((r) => r.data).catchError((Object _) => null);
        final r = await Future.wait([
          soft('/leads', {'clientId': id, 'pageSize': 20}),
          soft('/reservations', {'clientId': id, 'pageSize': 10}),
          soft('/visits/appointments', {'clientId': id, 'pageSize': 10}),
          soft('/contracts', {'customerId': id, 'pageSize': 20}),
          soft('/maintenance-requests', {'customerId': id, 'pageSize': 20}),
          soft('/documents', {'ownerType': 'USER', 'ownerId': id, 'pageSize': 20}),
          soft('/customer-fields', const {}),
        ]);
        final details = <String, String>{
          for (final k in kClientDetails)
            if ('${user[k] ?? ''}'.trim().isNotEmpty) k: '${user[k]}'.trim(),
        };
        final rawCustom = user['customFields'];
        final custom = <String, String>{
          if (rawCustom is Map)
            for (final e in rawCustom.entries)
              if ('${e.value ?? ''}'.trim().isNotEmpty) '${e.key}': '${e.value}'.trim(),
        };
        final defs = [
          for (final d in _rows(r[6]))
            if (d['active'] != false)
              ClientFieldDef(
                key: d['key'] as String? ?? '',
                label: Translatable.fromJson(d['label']),
                type: d['type'] as String? ?? 'TEXT',
                order: (d['order'] as num?)?.toInt() ?? 0,
              ),
        ]..sort((a, b) => a.order.compareTo(b.order));
        return ClientProfile(
          client: ClientRow.fromJson(user),
          locale: user['locale'] as String?,
          details: details,
          custom: custom,
          fieldDefs: defs,
          updatedAt: _at(user['updatedAt']),
          leads: [for (final l in _rows(r[0])) LeadRowDto.fromJson(l).toEntity()],
          reservations: [
            for (final x in _rows(r[1]))
              ClientItem(
                id: x['id'] as String? ?? '',
                number: x['reservationNumber'] as String?,
                project: _project(x),
                unitCode: (x['unit'] as Map?)?['code'] as String?,
                at: _at(x['expiresAt'] ?? x['createdAt']),
                status: x['status'] as String?,
              ),
          ],
          visits: [
            for (final x in _rows(r[2]))
              ClientItem(
                id: x['id'] as String? ?? '',
                number: x['visitNumber'] as String?,
                project: (x['project'] as Map?)?['name'] == null ? null : Translatable.fromJson((x['project'] as Map)['name']),
                at: _at(x['scheduledAt']),
                status: x['status'] as String?,
              ),
          ],
          contracts: [
            for (final x in _rows(r[3]))
              ClientItem(
                id: x['id'] as String? ?? '',
                number: x['contractNumber'] as String?,
                project: _project(x),
                unitCode: (x['unit'] as Map?)?['code'] as String?,
                at: _at(x['createdAt']),
                status: x['signedAt'] == null ? 'PENDING' : 'SIGNED',
                amount: readAmount(x['totalAmount']),
              ),
          ],
          maintenance: [
            for (final x in _rows(r[4]))
              ClientItem(
                id: x['id'] as String? ?? '',
                unitCode: (x['unit'] as Map?)?['code'] as String?,
                at: _at(x['createdAt']),
                status: x['status'] as String?,
                extra: (x['category'] as Map?)?['name'] == null
                    ? null
                    : Translatable.fromJson((x['category'] as Map)['name']).resolve('ar'),
                number: (x['description'] as String?)?.trim(),
              ),
          ],
          documents: [
            for (final x in _rows(r[5]))
              ClientItem(
                id: x['id'] as String? ?? '',
                number: x['title'] as String?,
                at: _at(x['createdAt']),
                status: x['category'] as String?,
                extra: (x['uploadedBy'] as Map?)?['fullName'] as String?,
                url: x['fileUrl'] as String?,
              ),
          ],
        );
      });

  /// Suspend or restore the account (`PATCH /users/:id/deactivate|activate`).
  Future<Result<void>> setActive(String id, bool active) =>
      guardApiCall(() => _dio.patch<Object?>('/users/$id/${active ? 'activate' : 'deactivate'}'));
}

// ── List ─────────────────────────────────────────────────────────────────────

class ClientsState extends Equatable {
  const ClientsState({
    this.status = DataStatus.initial,
    this.clients = const [],
    this.failure,
    this.role,
    this.search = '',
    this.page = 1,
    this.hasMore = false,
    this.loadingMore = false,
    this.counts,
  });

  final DataStatus status;
  final List<ClientRow> clients;
  final AppFailure? failure;
  final String? role;
  final String search;
  final int page;
  final bool hasMore;
  final bool loadingMore;
  final ClientCounts? counts;

  ClientsState copyWith({
    DataStatus? status,
    List<ClientRow>? clients,
    AppFailure? failure,
    String? role,
    bool clearRole = false,
    String? search,
    int? page,
    bool? hasMore,
    bool? loadingMore,
    ClientCounts? counts,
  }) =>
      ClientsState(
        status: status ?? this.status,
        clients: clients ?? this.clients,
        failure: failure ?? this.failure,
        role: clearRole ? null : (role ?? this.role),
        search: search ?? this.search,
        page: page ?? this.page,
        hasMore: hasMore ?? this.hasMore,
        loadingMore: loadingMore ?? this.loadingMore,
        counts: counts ?? this.counts,
      );

  @override
  List<Object?> get props => [status, clients, failure, role, search, page, hasMore, loadingMore, counts];
}

class ClientsCubit extends Cubit<ClientsState> {
  ClientsCubit(this._repo) : super(const ClientsState());
  final AdminClientsRepository _repo;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading, page: 1, hasMore: false));
    _repo.counts().then((r) {
      final c = r.dataOrNull;
      if (!isClosed && c != null) emit(state.copyWith(counts: c));
    });
    final r = await _repo.list(role: state.role, q: state.search);
    if (isClosed) return;
    r.when(
      ok: (p) => emit(state.copyWith(
        status: p.data.isEmpty ? DataStatus.empty : DataStatus.success,
        clients: p.data,
        page: 1,
        hasMore: p.hasMore,
      )),
      err: (f) => emit(state.copyWith(status: DataStatus.failure, failure: f)),
    );
  }

  Future<void> loadMore() async {
    if (!state.hasMore || state.loadingMore) return;
    emit(state.copyWith(loadingMore: true));
    final r = await _repo.list(role: state.role, q: state.search, page: state.page + 1);
    if (isClosed) return;
    r.when(
      ok: (p) => emit(state.copyWith(clients: [...state.clients, ...p.data], page: state.page + 1, hasMore: p.hasMore, loadingMore: false)),
      err: (_) => emit(state.copyWith(loadingMore: false)),
    );
  }

  Future<void> setRole(String? role) async {
    emit(role == null ? state.copyWith(clearRole: true) : state.copyWith(role: role));
    await load();
  }

  Future<void> setSearch(String q) async {
    emit(state.copyWith(search: q));
    await load();
  }
}

// ── Detail ───────────────────────────────────────────────────────────────────

class ClientDetailState extends Equatable {
  const ClientDetailState({this.status = DataStatus.initial, this.profile, this.failure, this.working = false, this.actionFailure});
  final DataStatus status;
  final ClientProfile? profile;
  final AppFailure? failure;
  final bool working;
  final AppFailure? actionFailure;

  @override
  List<Object?> get props => [status, profile, failure, working, actionFailure];
}

class ClientDetailCubit extends Cubit<ClientDetailState> {
  ClientDetailCubit(this._repo, {required this.clientId}) : super(const ClientDetailState());
  final AdminClientsRepository _repo;
  final String clientId;

  Future<void> load() async {
    if (state.profile == null) emit(const ClientDetailState(status: DataStatus.loading));
    final r = await _repo.profile(clientId);
    if (isClosed) return;
    r.when(
      ok: (p) => emit(ClientDetailState(status: DataStatus.success, profile: p)),
      err: (f) => emit(ClientDetailState(
        status: state.profile == null ? DataStatus.failure : DataStatus.success,
        profile: state.profile,
        failure: f,
      )),
    );
  }

  /// Suspend or restore the client's account.
  Future<void> setActive(bool active) async {
    final p = state.profile;
    if (p == null || state.working) return;
    emit(ClientDetailState(status: state.status, profile: p, working: true));
    final r = await _repo.setActive(clientId, active);
    if (isClosed) return;
    final failure = r.failureOrNull;
    if (failure != null) {
      emit(ClientDetailState(status: state.status, profile: p, actionFailure: failure));
      return;
    }
    await load();
  }
}
