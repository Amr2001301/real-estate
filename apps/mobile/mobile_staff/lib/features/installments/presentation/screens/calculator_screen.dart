import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/installment.dart';
import '../cubit/calculator_cubit.dart';

/// Installment calculator. Numbers are computed locally (mirrors the backend
/// formula); plan templates only prefill duration + increase %.
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
    context.read<CalculatorCubit>().init();
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

    return Scaffold(
      appBar: AppBar(title: Text(l10n.calculatorTitle)),
      body: BlocBuilder<CalculatorCubit, CalculatorState>(
        builder: (context, state) => ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            _PlanTemplates(state: state, monthsController: _months, increaseController: _increase),
            _NumberField(
              controller: _price,
              label: l10n.calculatorPrice,
              onChanged: (v) => cubit.setPrice(_d(v)),
            ),
            _NumberField(
              controller: _down,
              label: l10n.calculatorDownPayment,
              onChanged: (v) => cubit.setDownPayment(_d(v)),
            ),
            _NumberField(
              controller: _reservation,
              label: l10n.calculatorReservation,
              onChanged: (v) => cubit.setReservation(_d(v)),
            ),
            _NumberField(
              controller: _months,
              label: l10n.calculatorMonths,
              onChanged: (v) => cubit.setMonths(int.tryParse(v.trim()) ?? 0),
            ),
            _NumberField(
              controller: _increase,
              label: l10n.calculatorIncrease,
              onChanged: (v) => cubit.setIncrease(_d(v)),
            ),
            if (state.invalid) ...[
              const SizedBox(height: AppSpacing.xs),
              Text(l10n.calculatorInvalid,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: context.appColors.error)),
            ],
            const SizedBox(height: AppSpacing.lg),
            AppButton(
              label: l10n.calculatorCompute,
              icon: Icons.calculate_rounded,
              variant: AppButtonVariant.gold,
              expand: true,
              onPressed: cubit.calculate,
            ),
            if (state.result != null) ...[
              const SizedBox(height: AppSpacing.lg),
              _ResultCard(result: state.result!, lang: lang),
            ],
          ],
        ),
      ),
    );
  }
}

class _PlanTemplates extends StatelessWidget {
  const _PlanTemplates({
    required this.state,
    required this.monthsController,
    required this.increaseController,
  });
  final CalculatorState state;
  final TextEditingController monthsController;
  final TextEditingController increaseController;

  @override
  Widget build(BuildContext context) {
    if (state.templatesStatus != DataStatus.success || state.templates.isEmpty) {
      return const SizedBox.shrink();
    }
    final l10n = context.l10n;
    final cubit = context.read<CalculatorCubit>();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(l10n.calculatorPlans, style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.xs,
          children: [
            for (final t in state.templates)
              for (final d in t.durations)
                ActionChip(
                  label: Text('${t.name} · ${d.durationMonths}${l10n.calculatorMonthsShort}'),
                  onPressed: () {
                    cubit.applyDuration(d);
                    monthsController.text = '${d.durationMonths}';
                    increaseController.text = d.increasePercentage.toString();
                  },
                ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
      ],
    );
  }
}

class _NumberField extends StatelessWidget {
  const _NumberField({required this.controller, required this.label, required this.onChanged});
  final TextEditingController controller;
  final String label;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: AppTextField(
        controller: controller,
        label: label,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        onChanged: onChanged,
      ),
    );
  }
}

class _ResultCard extends StatelessWidget {
  const _ResultCard({required this.result, required this.lang});
  final InstallmentResult result;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    String money(double v) => PriceFormatter.format(v, languageCode: lang);
    return AppCard(
      elevation: AppCardElevation.soft,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.calculatorResult, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          _Row(label: l10n.calculatorReservation, value: money(result.reservationAmount)),
          _Row(label: l10n.calculatorDownPayment, value: money(result.downPayment)),
          _Row(label: l10n.calculatorFinanced, value: money(result.financedAmount)),
          const Divider(),
          _Row(
            label: l10n.calculatorMonthlyN(result.durationMonths),
            value: money(result.monthlyInstallment),
            emphasize: true,
          ),
          _Row(label: l10n.calculatorTotal, value: money(result.totalPayable), emphasize: true),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value, this.emphasize = false});
  final String label;
  final String value;
  final bool emphasize;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final style = emphasize
        ? Theme.of(context).textTheme.titleSmall
        : Theme.of(context).textTheme.bodyMedium?.copyWith(color: colors.inkMuted);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxs),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Flexible(child: Text(label, style: style)),
          Text(value, style: emphasize
              ? Theme.of(context).textTheme.titleSmall?.copyWith(color: colors.brandGold)
              : Theme.of(context).textTheme.bodyMedium),
        ],
      ),
    );
  }
}
