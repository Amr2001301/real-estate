import 'package:core/core_domain.dart';
import 'package:dio/dio.dart';

import '../../domain/entities/lead.dart';
import '../../domain/repositories/leads_repository.dart';
import '../dtos/lead_dtos.dart';

abstract interface class LeadsRemoteDataSource {
  Future<Paginated<LeadRowDto>> list(LeadsQuery query);
  Future<LeadDetailDto> getOne(String id);
  Future<void> updateStage(String id, String stage, String? reason, {String? lostReasonId, String? lostNote});
  /// The company's active lost reasons (GET /leads/lost-reasons).
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
        'pageSize': 20,
        'stage': ?query.stage,
        'q': ?(query.search?.isNotEmpty == true ? query.search : null),
        if (query.mine) 'mine': '1',
        'sourceId': ?query.sourceId,
        'dateFrom': ?query.dateFrom,
        'dateTo': ?query.dateTo,
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
    final res = await _dio.get<List<dynamic>>('/leads/lost-reasons');
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
}
