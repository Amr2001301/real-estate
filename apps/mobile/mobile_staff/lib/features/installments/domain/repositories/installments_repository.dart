import 'package:core/core_domain.dart';

import '../entities/installment.dart';

abstract interface class InstallmentsRepository {
  Future<Result<List<InstallmentPlanTemplate>>> getPlanTemplates({String? projectId});
  Future<Result<InstallmentResult>> calculateInstallment(InstallmentInput input);

  /// The ACTIVE plans of one unit, ready to show (price card, plan table, calculator).
  Future<Result<List<InstallmentOffer>>> unitOffers({required String projectId, required String unitId});

  /// Every ACTIVE plan of a project (for its offers: lowest down payment, longest term).
  Future<Result<List<InstallmentOffer>>> projectOffers(String projectId);
}
