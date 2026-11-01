import 'package:core/core.dart';
import 'package:dio/dio.dart';

import '../domain/campaign.dart';

class CampaignsRepositoryImpl implements CampaignsRepository {
  CampaignsRepositoryImpl(this._dio);
  final Dio _dio;

  @override
  Future<Result<List<CampaignOption>>> options() {
    return guardApiCall(() async {
      final res = await _dio.get<List<dynamic>>('/campaigns/options');
      return (res.data ?? const []).whereType<Map<String, dynamic>>().map(CampaignOption.fromJson).toList();
    });
  }

  @override
  Future<Result<CampaignsPage>> list({String? status}) {
    return guardApiCall(() async {
      final res = await _dio.get<Map<String, dynamic>>('/campaigns', queryParameters: {'status': ?status});
      return CampaignsPage.fromJson(res.data ?? const {});
    });
  }

  @override
  Future<Result<Campaign>> get(String id) {
    return guardApiCall(() async {
      final res = await _dio.get<Map<String, dynamic>>('/campaigns/$id');
      return Campaign.fromJson(res.data ?? const {});
    });
  }
}
