import 'package:core/core_domain.dart';

import '../entities/installment.dart';

abstract interface class InstallmentsRepository {
  Future<Result<List<InstallmentPlanTemplate>>> getPlanTemplates({String? projectId});
  Future<Result<InstallmentResult>> calculateInstallment(InstallmentInput input);
}
