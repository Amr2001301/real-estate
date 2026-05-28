import 'package:dio/dio.dart';

import '../dtos/client_lead_dto.dart';

/// Clients are derived from the leads endpoint (no dedicated sales clients API).
abstract interface class ClientsRemoteDataSource {
  Future<List<ClientLeadDto>> listLeads({String? search});
  Future<List<ClientLeadDto>> listLeadsForClient(String clientId);
}

class ClientsRemoteDataSourceImpl implements ClientsRemoteDataSource {
  ClientsRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  Future<List<ClientLeadDto>> _query(Map<String, dynamic> params) async {
    final res = await _dio.get<Map<String, dynamic>>('/leads', queryParameters: params);
    final data = (res.data?['data'] as List?) ?? const [];
    return data.whereType<Map<String, dynamic>>().map(ClientLeadDto.fromJson).toList();
  }

  @override
  Future<List<ClientLeadDto>> listLeads({String? search}) => _query({
        'page': 1,
        'pageSize': 100,
        'q': ?(search?.isNotEmpty == true ? search : null),
      });

  @override
  Future<List<ClientLeadDto>> listLeadsForClient(String clientId) =>
      _query({'page': 1, 'pageSize': 100, 'clientId': clientId});
}
