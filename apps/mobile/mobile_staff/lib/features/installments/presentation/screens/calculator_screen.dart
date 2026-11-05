import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../dashboard/home_kit/home_kit.dart';
import '../../domain/entities/installment.dart';
import '../../../catalog/domain/repositories/staff_catalog_repository.dart';
import '../../domain/repositories/installments_repository.dart';
import '../cubit/calculator_cubit.dart';
import 'calculator_unit_plans.dart';

/// The instalment calculator: the unit and its plans on top (project, then
/// unit, then the plan's durations), the inputs, and the result — the monthly instalment with how the
/// total splits between the booking, the down payment and the financed
/// amount. The numbers come from the server's formula (`duration-calc.ts`).
class CalculatorScreen extends StatefulWidget {
  const CalculatorScreen({super.key});

  @override
  State<CalculatorScreen> createState() => _CalculatorScreenState();
}

class _CalculatorScreenState extends State<CalculatorScreen> {
  late final _price = TextEditingController(
    text: _fmt(context.read<CalculatorCubit>().state.netPrice),
  );
  final _down = TextEditingController();
  final _reservation = TextEditingController();
  final _months = TextEditingController(text: '12');
  final _increase = TextEditingController();

  static String _fmt(double v) => v > 0 ? v.toStringAsFixed(0) : '';

  @override
  void initState() {
    super.initState();
  }

  @override
  void dispose() {
    for (final c in [_price, _down, _reservation, _months, _increase]) {
      c.dispose();
    }
    super.dispose();
  }

  double _d(String s) => double.tryParse(s.trim()) ?? 0;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<CalculatorCubit>();
    final lang = Localizations.localeOf(context).languageCode;
    final bottom = MediaQuery.paddingOf(context).bottom;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: BlocBuilder<CalculatorCubit, CalculatorState>(
          builder: (context, state) {
            return ListView(
              key: const Key('calculator'),
              padding: EdgeInsets.only(bottom: bottom + 32),
              children: [
                HomeListHero(
                  back: true,
                  title: l10n.calculatorTitle,
                  subtitle: state.netPrice > 0
                      ? PriceFormatter.format(
                          state.netPrice,
                          languageCode: lang,
                        )
                      : null,
                ),
                HomeSection(
                  icon: Icons.view_list_rounded,
                  title: l10n.calculatorUnitSection,
                  child: CalculatorUnitPlans(
                    catalog: context.read<StaffCatalogRepository>(),
                    installments: context.read<InstallmentsRepository>(),
                    projectId: cubit.projectId,
                    onUnitPrice: (price) {
                      _price.text = _fmt(price);
                      _down.clear();
                      _reservation.clear();
                      cubit
                        ..setPrice(price)
                        ..setDownPayment(0)
                        ..setReservation(0);
                    },
                    onApply: (offer, o) {
                      _price.text = _fmt(offer.netPrice);
                      _reservation.text = _fmt(offer.booking);
                      _down.text = _fmt(offer.downPayment);
                      _months.text = '${o.durationMonths}';
                      _increase.text = percentText(o.increasePercentage);
                      cubit
                        ..setPrice(offer.netPrice)
                        ..setReservation(offer.booking)
                        ..setDownPayment(offer.downPayment)
                        ..setMonths(o.durationMonths)
                        ..setIncrease(o.increasePercentage)
                        ..calculate();
                    },
                  ),
                ),
                HomeSection(
                  icon: Icons.calculate_rounded,
                  title: l10n.calculatorInputs,
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: homeCard(context, radius: 24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _Field(
                          key: const Key('calc-price'),
                          icon: Icons.home_work_rounded,
                          label: l10n.calculatorPrice,
                          controller: _price,
                          hint: '15,000,000',
                          large: true,
                          onChanged: (v) => cubit.setPrice(_d(v)),
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: _Field(
                                key: const Key('calc-down'),
                                icon: Icons.payments_rounded,
                                label: l10n.calculatorDownPayment,
                                controller: _down,
                                onChanged: (v) => cubit.setDownPayment(_d(v)),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: _Field(
                                key: const Key('calc-reservation'),
                                icon: Icons.bookmark_rounded,
                                label: l10n.calculatorReservation,
                                controller: _reservation,
                                onChanged: (v) => cubit.setReservation(_d(v)),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: _Field(
                                key: const Key('calc-months'),
                                icon: Icons.calendar_month_rounded,
                                label: l10n.calculatorMonths,
                                controller: _months,
                                hint: '12',
                                onChanged: (v) => cubit.setMonths(
                                  int.tryParse(v.trim()) ?? 0,
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: _Field(
                                key: const Key('calc-increase'),
                                icon: Icons.trending_up_rounded,
                                label: l10n.calculatorIncrease,
                                controller: _increase,
                                hint: '0',
                                onChanged: (v) => cubit.setIncrease(_d(v)),
                              ),
                            ),
                          ],
                        ),
                        if (state.invalid) ...[
                          const SizedBox(height: 10),
                          Container(
                            key: const Key('calc-invalid'),
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: context.appColors.error.withValues(
                                alpha: 0.07,
                              ),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: context.appColors.error.withValues(
                                  alpha: 0.3,
                                ),
                              ),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Icon(
                                  Icons.error_outline_rounded,
                                  size: 18,
                                  color: context.appColors.error,
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    l10n.calculatorInvalid,
                                    style: TextStyle(
                                      fontSize: 12.5,
                                      color: context.appColors.error,
                                      height: 1.4,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                        const SizedBox(height: 14),
                        AppButton(
                          key: const Key('calc-compute'),
                          label: l10n.calculatorCompute,
                          icon: Icons.calculate_rounded,
                          variant: AppButtonVariant.gold,
                          expand: true,
                          onPressed: cubit.calculate,
                        ),
                      ],
                    ),
                  ),
                ),
                if (state.result != null)
                  HomeSection(
                    icon: Icons.summarize_rounded,
                    title: l10n.calculatorResult,
                    child: _Result(result: state.result!, lang: lang),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// The ready plans: one row of choices per plan, «60 شهر +12%».
class _Field extends StatelessWidget {
  const _Field({
    super.key,
    required this.icon,
    required this.label,
    required this.controller,
    required this.onChanged,
    this.hint,
    this.large = false,
  });
  final IconData icon;
  final String label;
  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final String? hint;
  final bool large;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
      decoration: BoxDecoration(
        color: colors.surfaceSoft,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 14, color: AppPalette.gold500),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12, color: colors.inkMuted),
                ),
              ),
            ],
          ),
          TextField(
            controller: controller,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
            ],
            onChanged: onChanged,
            textDirection: TextDirection.ltr,
            textAlign: TextAlign.start,
            style: TextStyle(
              fontSize: large ? 22 : 17,
              fontWeight: FontWeight.w800,
              color: colors.inkStrong,
            ),
            decoration: InputDecoration(
              hintText: hint,
              hintStyle: TextStyle(
                fontSize: large ? 22 : 17,
                fontWeight: FontWeight.w600,
                color: colors.inkMuted.withValues(alpha: 0.5),
              ),
              border: InputBorder.none,
              enabledBorder: InputBorder.none,
              focusedBorder: InputBorder.none,
              filled: false,
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(vertical: 6),
            ),
          ),
        ],
      ),
    );
  }
}

/// The result: the monthly instalment on navy, how the total splits, and
/// the figures behind it.
class _Result extends StatelessWidget {
  const _Result({required this.result, required this.lang});
  final InstallmentResult result;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    String money(double v) => PriceFormatter.format(v, languageCode: lang);
    final total = result.totalPayable <= 0 ? 1.0 : result.totalPayable;
    final parts = <(String, double, Color, IconData)>[
      (
        l10n.calculatorReservation,
        result.reservationAmount,
        AppPalette.gold300,
        Icons.bookmark_rounded,
      ),
      (
        l10n.calculatorDownPayment,
        result.downPayment,
        AppPalette.gold500,
        Icons.payments_rounded,
      ),
      (
        l10n.calculatorFinanced,
        result.financedAmount,
        AppPalette.navy600,
        Icons.account_balance_rounded,
      ),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          key: const Key('calc-result'),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
          decoration: BoxDecoration(
            gradient: homeNavyGradient,
            borderRadius: BorderRadius.circular(24),
          ),
          child: Column(
            children: [
              Text(
                l10n.calculatorMonthlyN(result.durationMonths),
                style: const TextStyle(
                  color: Color(0xFFC9D2DE),
                  fontSize: 12.5,
                ),
              ),
              const SizedBox(height: 6),
              FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  money(result.monthlyInstallment),
                  style: homeDisplay(34, AppPalette.gold300),
                ),
              ),
              const SizedBox(height: 14),
              ClipRRect(
                borderRadius: BorderRadius.circular(99),
                child: SizedBox(
                  height: 10,
                  child: Row(
                    children: [
                      for (final p in parts)
                        if (p.$2 > 0)
                          Expanded(
                            flex: ((p.$2 / total) * 1000).round().clamp(
                              1,
                              1000,
                            ),
                            child: ColoredBox(color: p.$3),
                          ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (final p in parts)
                    if (p.$2 > 0)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 6),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color: p.$3,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 4),
                            Text(
                              ltr('${(p.$2 / total * 100).round()}%'),
                              style: const TextStyle(
                                color: Color(0xFFDCE3EC),
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          decoration: homeCard(context, radius: 22),
          child: Column(
            children: [
              for (var i = 0; i < parts.length; i++)
                _Line(
                  icon: parts[i].$4,
                  label: parts[i].$1,
                  value: money(parts[i].$2),
                  first: i == 0,
                  dot: parts[i].$3,
                ),
              _Line(
                icon: Icons.summarize_rounded,
                label: l10n.calculatorTotal,
                value: money(result.totalPayable),
                emphasize: true,
                color: colors.inkStrong,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Line extends StatelessWidget {
  const _Line({
    required this.icon,
    required this.label,
    required this.value,
    this.first = false,
    this.emphasize = false,
    this.dot,
    this.color,
  });
  final IconData icon;
  final String label;
  final String value;
  final bool first;
  final bool emphasize;
  final Color? dot;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        border: first ? null : Border(top: BorderSide(color: colors.hairline)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 17, color: dot ?? AppPalette.gold500),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: emphasize ? 14 : 13,
                fontWeight: emphasize ? FontWeight.w800 : FontWeight.w500,
                color: emphasize ? color : colors.inkMuted,
              ),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: emphasize ? 16 : 14,
              fontWeight: FontWeight.w800,
              color: colors.inkStrong,
            ),
          ),
        ],
      ),
    );
  }
}
