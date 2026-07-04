import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/installment.dart';
import '../../domain/usecases/installment_use_cases.dart';

class CalculatorState extends Equatable {
  const CalculatorState({
    this.templatesStatus = DataStatus.initial,
    this.templates = const [],
    this.netPrice = 0,
    this.downPayment = 0,
    this.reservation = 0,
    this.months = 12,
    this.increase = 0,
    this.result,
    this.invalid = false,
  });

  final DataStatus templatesStatus;
  final List<InstallmentPlanTemplate> templates;
  final double netPrice;
  final double downPayment;
  final double reservation;
  final int months;
  final double increase;
  final InstallmentResult? result;

  /// True when the last calculate() attempt was rejected by validation.
  final bool invalid;

  CalculatorState copyWith({
    DataStatus? templatesStatus,
    List<InstallmentPlanTemplate>? templates,
    double? netPrice,
    double? downPayment,
    double? reservation,
    int? months,
    double? increase,
    InstallmentResult? result,
    bool clearResult = false,
    bool? invalid,
  }) =>
      CalculatorState(
        templatesStatus: templatesStatus ?? this.templatesStatus,
        templates: templates ?? this.templates,
        netPrice: netPrice ?? this.netPrice,
        downPayment: downPayment ?? this.downPayment,
        reservation: reservation ?? this.reservation,
        months: months ?? this.months,
        increase: increase ?? this.increase,
        result: clearResult ? null : (result ?? this.result),
        invalid: invalid ?? this.invalid,
      );

  @override
  List<Object?> get props =>
      [templatesStatus, templates, netPrice, downPayment, reservation, months, increase, result, invalid];
}

/// Drives the installment calculator. Math is local (pure use case mirroring
/// the backend formula); plan templates only prefill duration + increase.
class CalculatorCubit extends Cubit<CalculatorState> {
  CalculatorCubit(
    this._getTemplates,
    this._calculate, {
    double? initialPrice,
    this.projectId,
  }) : super(CalculatorState(netPrice: initialPrice ?? 0));

  final GetPlanTemplates _getTemplates;
  final CalculateInstallment _calculate;
  final String? projectId;

  Future<void> init() async {
    emit(state.copyWith(templatesStatus: DataStatus.loading));
    final result = await _getTemplates(projectId);
    result.when(
      ok: (templates) => emit(state.copyWith(
        templatesStatus: templates.isEmpty ? DataStatus.empty : DataStatus.success,
        templates: templates,
      )),
      // Templates are an optional helper — failure shouldn't block the calculator.
      err: (_) => emit(state.copyWith(templatesStatus: DataStatus.empty)),
    );
  }

  void setPrice(double v) => emit(state.copyWith(netPrice: v, clearResult: true, invalid: false));
  void setDownPayment(double v) => emit(state.copyWith(downPayment: v, clearResult: true, invalid: false));
  void setReservation(double v) => emit(state.copyWith(reservation: v, clearResult: true, invalid: false));
  void setMonths(int v) => emit(state.copyWith(months: v, clearResult: true, invalid: false));
  void setIncrease(double v) => emit(state.copyWith(increase: v, clearResult: true, invalid: false));

  void applyDuration(PlanDuration d) => emit(state.copyWith(
        months: d.durationMonths,
        increase: d.increasePercentage,
        clearResult: true,
        invalid: false,
      ));

  Future<void> calculate() async {
    final result = await _calculate(InstallmentInput(
      netPrice: state.netPrice,
      durationMonths: state.months,
      reservationAmount: state.reservation,
      downPayment: state.downPayment,
      increasePercentage: state.increase,
    ));
    result.when(
      ok: (r) => emit(state.copyWith(result: r, invalid: false)),
      err: (_) => emit(state.copyWith(clearResult: true, invalid: true)),
    );
  }
}
