import 'package:core/core_domain.dart';
import 'package:dio/dio.dart';

import '../../domain/entities/installment.dart';
import '../dtos/plan_template_dto.dart';

abstract interface class InstallmentsRemoteDataSource {
  Future<List<PlanTemplateDto>> listTemplates({String? projectId});
  Future<InstallmentResult> calculateInstallment(InstallmentInput input);

  /// The project's plan templates as the API sends them (for a unit's offers).
  Future<List<Map<String, dynamic>>> listTemplatesJson({required String projectId});

  /// The plans a unit takes (its own, else its type's, else the project's), already
  /// worked out on its price (`GET /installment-plan-templates/applicable/:unitId`).
  Future<List<Map<String, dynamic>>> applicableTemplatesJson({required String unitId});
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

  @override
  Future<InstallmentResult> calculateInstallment(InstallmentInput input) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/installment-plan-templates/calculate',
      data: {
        'netPrice': input.netPrice,
        'reservationAmount': input.reservationAmount,
        'downPaymentAmount': input.downPayment,
        'durationMonths': input.durationMonths,
        'increasePercentage': input.increasePercentage,
      },
    );
    final json = res.data!;
    final monthly = readAmount(json['monthlyInstallment']) ?? 0;
    return InstallmentResult(
      remainingAmount: readAmount(json['remainingAmount']) ?? 0,
      financedAmount: readAmount(json['financedAmount']) ?? 0,
      monthlyInstallment: monthly,
      totalPayable: readAmount(json['totalPayable']) ?? 0,
      downPayment: input.downPayment,
      reservationAmount: input.reservationAmount,
      durationMonths: input.durationMonths,
      schedule: List<double>.filled(input.durationMonths, monthly),
    );
  }

  @override
  Future<List<Map<String, dynamic>>> listTemplatesJson({required String projectId}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/installment-plan-templates',
      queryParameters: {'page': 1, 'pageSize': 100, 'projectId': projectId, 'status': 'ACTIVE'},
    );
    return ((res.data?['data'] as List?) ?? const []).whereType<Map<String, dynamic>>().toList();
  }

  @override
  Future<List<Map<String, dynamic>>> applicableTemplatesJson({required String unitId}) async {
    final res = await _dio.get<Map<String, dynamic>>('/installment-plan-templates/applicable/$unitId');
    return ((res.data?['plans'] as List?) ?? const []).whereType<Map<String, dynamic>>().toList();
  }
}
