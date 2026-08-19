import 'package:dio/dio.dart';

import '../../domain/entities/installment.dart';
import '../dtos/plan_template_dto.dart';

abstract interface class InstallmentsRemoteDataSource {
  Future<List<PlanTemplateDto>> listTemplates({String? projectId});
  Future<InstallmentResult> calculateInstallment(InstallmentInput input);
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
    final monthly = (json['monthlyInstallment'] as num).toDouble();
    return InstallmentResult(
      remainingAmount: (json['remainingAmount'] as num).toDouble(),
      financedAmount: (json['financedAmount'] as num).toDouble(),
      monthlyInstallment: monthly,
      totalPayable: (json['totalPayable'] as num).toDouble(),
      downPayment: input.downPayment,
      reservationAmount: input.reservationAmount,
      durationMonths: input.durationMonths,
      schedule: List<double>.filled(input.durationMonths, monthly),
    );
  }
}
