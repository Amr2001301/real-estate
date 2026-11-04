import 'package:dio/dio.dart';

import '../../domain/entities/broker_lead.dart';
import '../../domain/repositories/broker_leads_repository.dart';
import '../dtos/broker_lead_dtos.dart';

abstract interface class BrokerLeadsRemoteDataSource {
  Future<List<BrokerLeadDto>> list(BrokerLeadsQuery query);
  Future<BrokerLeadDetailDto> getOne(String id);
  Future<BrokerLeadDto> create(NewBrokerLead input);
  Future<BrokerLeadCounts> counts();
}

class BrokerLeadsRemoteDataSourceImpl implements BrokerLeadsRemoteDataSource {
  BrokerLeadsRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<List<BrokerLeadDto>> list(BrokerLeadsQuery query) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/portal/leads',
      queryParameters: {
        'page': 1,
        'pageSize': 50,
        'brokerApprovalStatus': ?query.approvalStatus,
        'stage': ?query.stage,
        'q': ?(query.search?.isNotEmpty == true ? query.search : null),
      },
    );
    final data = (res.data?['data'] as List?) ?? const [];
    return data.whereType<Map<String, dynamic>>().map(BrokerLeadDto.fromJson).toList();
  }

  @override
  Future<BrokerLeadDetailDto> getOne(String id) async {
    final res = await _dio.get<Map<String, dynamic>>('/portal/leads/$id');
    return BrokerLeadDetailDto.fromJson(res.data ?? const {});
  }

  @override
  Future<BrokerLeadDto> create(NewBrokerLead input) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/portal/leads',
      data: {
        'fullName': input.fullName,
        'phone': input.phone,
        'email': ?input.email,
        'projectInterestId': ?input.projectInterestId,
        'unitInterestId': ?input.unitInterestId,
        'note': ?input.note,
      },
    );
    return BrokerLeadDto.fromJson(res.data ?? const {});
  }

  @override
  Future<BrokerLeadCounts> counts() async {
    Future<int> count([String? status]) async {
      final res = await _dio.get<Map<String, dynamic>>(
        '/portal/leads',
        queryParameters: {'page': 1, 'pageSize': 1, 'brokerApprovalStatus': ?status},
      );
      return ((res.data?['meta'] as Map?)?['total'] as num?)?.toInt() ?? 0;
    }

    final r = await Future.wait([count(), count('PENDING'), count('APPROVED'), count('REJECTED')]);
    return BrokerLeadCounts(total: r[0], pending: r[1], approved: r[2], rejected: r[3]);
  }
}
