import 'package:dio/dio.dart';

import '../dtos/plan_template_dto.dart';

abstract interface class InstallmentsRemoteDataSource {
  Future<List<PlanTemplateDto>> listTemplates({String? projectId});
}

class InstallmentsRemoteDataSourceImpl implements InstallmentsRemoteDataSource {
  InstallmentsRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<List<PlanTemplateDto>> listTemplates({String? projectId}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/installment-plan-templates',
      queryParameters: {
        'page': 1,
        'pageSize': 50,
        'projectId': ?projectId,
      },
    );
    final data = (res.data?['data'] as List?) ?? const [];
    return data.whereType<Map<String, dynamic>>().map(PlanTemplateDto.fromJson).toList();
  }
}
