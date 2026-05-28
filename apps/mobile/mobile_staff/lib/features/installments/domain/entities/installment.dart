import 'package:core/core_domain.dart';

/// A preset duration option on a plan template (durationMonths + price increase).
class PlanDuration extends Equatable {
  const PlanDuration({required this.durationMonths, required this.increasePercentage});
  final int durationMonths;
  final double increasePercentage;

  @override
  List<Object?> get props => [durationMonths, increasePercentage];
}

/// An installment plan template the rep can use to prefill the calculator.
class InstallmentPlanTemplate extends Equatable {
  const InstallmentPlanTemplate({
    required this.id,
    required this.name,
    required this.durations,
  });

  final String id;
  final String name;
  final List<PlanDuration> durations;

  @override
  List<Object?> get props => [id, name, durations];
}

/// Calculator inputs (matches the backend `duration-calc.ts` formula inputs).
class InstallmentInput extends Equatable {
  const InstallmentInput({
    required this.netPrice,
    required this.durationMonths,
    this.reservationAmount = 0,
    this.downPayment = 0,
    this.increasePercentage = 0,
  });

  final double netPrice;
  final int durationMonths;
  final double reservationAmount;
  final double downPayment;
  final double increasePercentage;

  @override
  List<Object?> get props =>
      [netPrice, durationMonths, reservationAmount, downPayment, increasePercentage];
}

/// Calculator result. `schedule` is the per-month installment amounts (equal).
class InstallmentResult extends Equatable {
  const InstallmentResult({
    required this.remainingAmount,
    required this.financedAmount,
    required this.monthlyInstallment,
    required this.totalPayable,
    required this.downPayment,
    required this.reservationAmount,
    required this.durationMonths,
    required this.schedule,
  });

  final double remainingAmount;
  final double financedAmount;
  final double monthlyInstallment;
  final double totalPayable;
  final double downPayment;
  final double reservationAmount;
  final int durationMonths;
  final List<double> schedule;

  @override
  List<Object?> get props =>
      [remainingAmount, financedAmount, monthlyInstallment, totalPayable, durationMonths];
}
