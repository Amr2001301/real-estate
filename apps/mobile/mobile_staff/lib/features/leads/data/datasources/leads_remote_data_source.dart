import 'package:core/core_domain.dart';
import 'package:dio/dio.dart';

import '../../domain/entities/lead.dart';
import '../../domain/repositories/leads_repository.dart';
import '../dtos/lead_dtos.dart';

abstract interface class LeadsRemoteDataSource {
  Future<Paginated<LeadRowDto>> list(LeadsQuery query);
  Future<LeadDetailDto> getOne(String id);
  Future<void> updateStage(String id, String stage, String? reason, {String? lostReasonId, String? lostNote});
  /// The company's active lost reasons (GET /lost-reasons).
  Future<List<LostReasonDto>> listLostReasons();
  /// Logs an activity (or a reply) on the lead — FU1.
  Future<void> addNote(String id, LeadNoteInput input);
  /// FU1 — one follow-up list (overdue / today / upcoming), a page at a time.
  Future<Paginated<FollowUpRowDto>> listFollowUps(FollowUpBucket bucket, {int page = 1});
  /// FU1 — how many leads wait in each list.
  Future<FollowUpSummaryDto> followUpSummary();
  Future<LeadRowDto> create(NewLead input);
  Future<List<LeadSourceDto>> listSources();
  Future<List<ClientSearchDto>> searchClients(String q);
  Future<Map<String, int>> pipeline();
  Future<int> countUnassigned();
  Future<List<StaffOption>> salesStaff();
  Future<String> openContact(String id, String kind);
}

class LeadsRemoteDataSourceImpl implements LeadsRemoteDataSource {
  LeadsRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<Paginated<LeadRowDto>> list(LeadsQuery query) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/leads',
      queryParameters: {
        'page': query.page,
        'pageSize': query.pageSize,
        'stage': ?query.stage,
        'q': ?(query.search?.isNotEmpty == true ? query.search : null),
        if (query.mine) 'mine': '1',
        'sourceId': ?query.sourceId,
        'dateFrom': ?query.dateFrom,
        'dateTo': ?query.dateTo,
        'salesId': ?query.salesId,
        if (query.unassigned) 'unassigned': '1',
      },
    );
    // The page envelope is { data, meta }.
    return Paginated.fromJson(res.data ?? const <String, dynamic>{}, LeadRowDto.fromJson);
  }

  @override
  Future<LeadDetailDto> getOne(String id) async {
    final res = await _dio.get<Map<String, dynamic>>('/leads/$id');
    return LeadDetailDto.fromJson(res.data ?? const {});
  }

  @override
  Future<void> updateStage(String id, String stage, String? reason, {String? lostReasonId, String? lostNote}) async {
    await _dio.patch<Map<String, dynamic>>(
      '/leads/$id/stage',
      data: {
        'stage': stage,
        'reason': ?reason,
        'lostReasonId': ?lostReasonId,
        'lostNote': ?(lostNote?.trim().isNotEmpty == true ? lostNote!.trim() : null),
      },
    );
  }

  @override
  Future<List<LostReasonDto>> listLostReasons() async {
    final res = await _dio.get<List<dynamic>>('/lost-reasons');
    return (res.data ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(LostReasonDto.fromJson)
        .toList();
  }

  @override
  Future<void> addNote(String id, LeadNoteInput input) async {
    await _dio.post<Map<String, dynamic>>(
      '/leads/$id/notes',
      data: input.toJson(),
    );
  }

  @override
  Future<Paginated<FollowUpRowDto>> listFollowUps(FollowUpBucket bucket, {int page = 1}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/leads/follow-ups',
      queryParameters: {'bucket': bucket.wire, 'page': page, 'pageSize': 20},
    );
    // The page envelope is { data, meta }.
    return Paginated.fromJson(res.data ?? const <String, dynamic>{}, FollowUpRowDto.fromJson);
  }

  @override
  Future<FollowUpSummaryDto> followUpSummary() async {
    final res = await _dio.get<Map<String, dynamic>>('/leads/follow-ups/summary');
    return FollowUpSummaryDto.fromJson(res.data ?? const {});
  }

  @override
  Future<LeadRowDto> create(NewLead input) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/leads',
      data: {
        'clientId': ?input.clientId,
        'fullName': ?input.fullName,
        'phone': ?input.phone,
        'email': ?input.email,
        'sourceId': ?input.sourceId,
        'projectInterestId': ?input.projectInterestId,
        'unitInterestId': ?input.unitInterestId,
        'notes': ?input.notes,
        'campaignId': ?input.campaignId,
        if (input.allowDuplicate) 'allowDuplicate': true,
      },
    );
    return LeadRowDto.fromJson(res.data ?? const {});
  }

  @override
  Future<List<LeadSourceDto>> listSources() async {
    final res = await _dio.get<List<dynamic>>('/lead-sources');
    return (res.data ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(LeadSourceDto.fromJson)
        .toList();
  }

  @override
  Future<List<ClientSearchDto>> searchClients(String q) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/users',
      queryParameters: {
        'role': 'CLIENT,CUSTOMER',
        'pageSize': 10,
        'q': q,
      },
    );
    return ((res.data?['data'] as List?) ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(ClientSearchDto.fromJson)
        .toList();
  }

  @override
  Future<Map<String, int>> pipeline() async {
    final res = await _dio.get<Map<String, dynamic>>('/leads/pipeline');
    return {for (final e in (res.data ?? const {}).entries) e.key: (e.value as num?)?.toInt() ?? 0};
  }

  @override
  Future<int> countUnassigned() async {
    final res = await _dio.get<Map<String, dynamic>>('/leads', queryParameters: {'unassigned': '1', 'pageSize': 1});
    return ((res.data?['meta'] as Map?)?['total'] as num?)?.toInt() ?? 0;
  }

  @override
  Future<List<StaffOption>> salesStaff() async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/users/options',
      queryParameters: {'role': 'SALES,SALES_MANAGER', 'active': 'true'},
    );
    return [
      for (final o in (res.data?['data'] as List? ?? const []).whereType<Map<String, dynamic>>())
        StaffOption(id: o['id'] as String? ?? '', name: o['fullName'] as String? ?? ''),
    ];
  }

  @override
  Future<String> openContact(String id, String kind) async {
    final res = await _dio.post<Map<String, dynamic>>('/leads/$id/contact', data: {'kind': kind});
    return res.data?['phone'] as String? ?? '';
  }
}
