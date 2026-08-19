import 'package:core/core_domain.dart';

import '../entities/installment.dart';
import '../repositories/installments_repository.dart';

class GetPlanTemplates implements UseCase<List<InstallmentPlanTemplate>, String?> {
  const GetPlanTemplates(this._repo);
  final InstallmentsRepository _repo;

  @override
  Future<Result<List<InstallmentPlanTemplate>>> call(String? projectId) =>
      _repo.getPlanTemplates(projectId: projectId);
}

/// Delegates installment calculation to `POST /installment-plan-templates/calculate`
/// so the formula (defined in `duration-calc.ts`) stays in one place on the server.
class CalculateInstallment implements UseCase<InstallmentResult, InstallmentInput> {
  const CalculateInstallment(this._repo);
  final InstallmentsRepository _repo;

  @override
  Future<Result<InstallmentResult>> call(InstallmentInput input) =>
      _repo.calculateInstallment(input);
}
