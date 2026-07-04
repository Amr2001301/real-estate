import 'package:core/core.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/installments/data/dtos/plan_template_dto.dart';
import 'package:mobile_staff/features/installments/data/mappers/plan_template_mapper.dart';
import 'package:mobile_staff/features/installments/domain/entities/installment.dart';
import 'package:mobile_staff/features/installments/domain/repositories/installments_repository.dart';
import 'package:mobile_staff/features/installments/domain/usecases/installment_use_cases.dart';
import 'package:mobile_staff/features/installments/presentation/cubit/calculator_cubit.dart';

class _FakeRepo implements InstallmentsRepository {
  _FakeRepo(this._result);
  final Result<List<InstallmentPlanTemplate>> _result;
  @override
  Future<Result<List<InstallmentPlanTemplate>>> getPlanTemplates({String? projectId}) async => _result;
}

void main() {
  group('PlanTemplateDto → entity', () {
    test('parses duration options', () {
      final t = PlanTemplateDto.fromJson({
        'id': 't1',
        'name': 'Plan A',
        'durationOptions': [
          {'durationMonths': 12, 'increasePercentage': '0'},
          {'durationMonths': 24, 'increasePercentage': '10'},
        ],
      }).toEntity();
      expect(t.name, 'Plan A');
      expect(t.durations, hasLength(2));
      expect(t.durations[1].durationMonths, 24);
      expect(t.durations[1].increasePercentage, 10);
    });
  });

  group('CalculateInstallment (mirrors backend formula)', () {
    const calc = CalculateInstallment();

    test('computes remaining/financed/monthly/total', () async {
      final r = await calc(const InstallmentInput(
        netPrice: 1000000,
        reservationAmount: 50000,
        downPayment: 150000,
        durationMonths: 20,
        increasePercentage: 10,
      ));
      final result = r.dataOrNull!;
      // remaining = 1,000,000 − 50,000 − 150,000 = 800,000
      expect(result.remainingAmount, 800000);
      // financed = 800,000 × 1.10 = 880,000
      expect(result.financedAmount, closeTo(880000, 0.01));
      // monthly = 880,000 / 20 = 44,000
      expect(result.monthlyInstallment, closeTo(44000, 0.01));
      // total = 50,000 + 150,000 + 880,000 = 1,080,000
      expect(result.totalPayable, closeTo(1080000, 0.01));
      expect(result.schedule, hasLength(20));
    });

    test('zero increase → financed equals remaining', () async {
      final r = await calc(const InstallmentInput(netPrice: 500000, durationMonths: 10));
      expect(r.dataOrNull!.financedAmount, 500000);
      expect(r.dataOrNull!.monthlyInstallment, 50000);
    });

    test('rejects months < 1', () async {
      final r = await calc(const InstallmentInput(netPrice: 100000, durationMonths: 0));
      expect(r.failureOrNull?.type, FailureType.validation);
    });

    test('rejects down+reservation exceeding price', () async {
      final r = await calc(const InstallmentInput(
        netPrice: 100000,
        downPayment: 80000,
        reservationAmount: 40000,
        durationMonths: 12,
      ));
      expect(r.failureOrNull?.type, FailureType.validation);
    });

    test('rejects non-positive price', () async {
      final r = await calc(const InstallmentInput(netPrice: 0, durationMonths: 12));
      expect(r.failureOrNull?.type, FailureType.validation);
    });
  });

  group('CalculatorCubit', () {
    CalculatorCubit build({double? price}) => CalculatorCubit(
          GetPlanTemplates(_FakeRepo(const Ok([]))),
          const CalculateInstallment(),
          initialPrice: price,
        );

    test('prefills price', () {
      final cubit = build(price: 750000);
      expect(cubit.state.netPrice, 750000);
    });

    test('valid inputs produce a result', () async {
      final cubit = build(price: 600000);
      cubit.setMonths(12);
      await cubit.calculate();
      expect(cubit.state.result, isNotNull);
      expect(cubit.state.invalid, isFalse);
    });

    test('invalid inputs set invalid flag and clear result', () async {
      final cubit = build(price: 0);
      cubit.setMonths(0);
      await cubit.calculate();
      expect(cubit.state.result, isNull);
      expect(cubit.state.invalid, isTrue);
    });

    test('applyDuration sets months + increase', () {
      final cubit = build(price: 100000);
      cubit.applyDuration(const PlanDuration(durationMonths: 36, increasePercentage: 15));
      expect(cubit.state.months, 36);
      expect(cubit.state.increase, 15);
    });
  });
}
