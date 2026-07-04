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

/// Pure installment calculation.
///
/// **Formula source:** `apps/api/src/modules/installments/duration-calc.ts`
/// (`computeDurationOption`) — the backend's documented "single source of
/// truth". Mirrored here because there is **no server calculator endpoint**
/// that computes a plan from arbitrary (price, downPayment, months) inputs; the
/// API only exposes plan *templates* with pre-computed options.
///
///   remaining = price − reservation − downPayment   (clamped ≥ 0)
///   financed  = remaining × (1 + increase%/100)
///   monthly   = financed / months
///   total     = reservation + downPayment + financed
///
/// TODO(api-gap): replace this client-side mirror with a server-side calculator
/// endpoint (e.g. `POST /installment-plan-templates/calculate`) so the formula
/// lives in one place. Until then keep this in sync with `duration-calc.ts`;
/// `test/installments_test.dart` guards the math against drift.
/// Returns a validation [AppFailure] for nonsensical inputs.
class CalculateInstallment implements UseCase<InstallmentResult, InstallmentInput> {
  const CalculateInstallment();

  static const maxMonths = 600;

  @override
  Future<Result<InstallmentResult>> call(InstallmentInput input) async {
    final invalid = input.netPrice <= 0 ||
        input.durationMonths < 1 ||
        input.durationMonths > maxMonths ||
        input.downPayment < 0 ||
        input.reservationAmount < 0 ||
        input.increasePercentage < 0 ||
        (input.reservationAmount + input.downPayment) > input.netPrice;
    if (invalid) {
      return Result.err(AppFailure(type: FailureType.validation));
    }

    final remaining = (input.netPrice - input.reservationAmount - input.downPayment)
        .clamp(0, double.infinity)
        .toDouble();
    final financed = remaining * (1 + input.increasePercentage / 100);
    final monthly = input.durationMonths > 0 ? financed / input.durationMonths : 0.0;
    final total = input.reservationAmount + input.downPayment + financed;

    return Result.ok(InstallmentResult(
      remainingAmount: remaining,
      financedAmount: financed,
      monthlyInstallment: monthly,
      totalPayable: total,
      downPayment: input.downPayment,
      reservationAmount: input.reservationAmount,
      durationMonths: input.durationMonths,
      schedule: List<double>.filled(input.durationMonths, monthly),
    ));
  }
}
