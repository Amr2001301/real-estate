import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

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
  final _down        = TextEditingController();
  final _reservation = TextEditingController();
  final _months      = TextEditingController(text: '12');
  final _increase    = TextEditingController();

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
    final l10n   = context.l10n;
    final cubit  = context.read<CalculatorCubit>();
    final lang   = Localizations.localeOf(context).languageCode;
    final isRtl  = context.read<LocaleCubit>().isRtl;
    final bottomPad = MediaQuery.paddingOf(context).bottom;

    return Scaffold(
      body: Column(
        children: [
          AppNavHeader(
            title: l10n.calculatorTitle,
            leadingAction: NavHeaderAction(
              icon: Icons.arrow_back_ios_new_rounded,
              onTap: () => context.pop(),
            ),
          ),
          Expanded(
            child: BlocBuilder<CalculatorCubit, CalculatorState>(
              builder: (context, state) => ListView(
                padding: EdgeInsets.fromLTRB(
                    AppSpacing.lg, AppSpacing.md,
                    AppSpacing.lg, bottomPad + AppSpacing.xl),
                children: [
                  // ── Plan templates ──────────────────────────────────────
                  if (state.templatesStatus == DataStatus.success &&
                      state.templates.isNotEmpty) ...[
                    _PlanTemplatesSection(
                      state: state,
                      monthsController: _months,
                      increaseController: _increase,
                    ),
                    const SizedBox(height: AppSpacing.lg),
                  ],

                  // ── Input form ──────────────────────────────────────────
                  _SectionHeader('بيانات الحساب'),
                  const SizedBox(height: AppSpacing.md),

                  // Price
                  _InputCard(
                    icon: Icons.home_work_rounded,
                    label: l10n.calculatorPrice,
                    controller: _price,
                    onChanged: (v) => cubit.setPrice(_d(v)),
                    hint: '15,000,000',
                  ),
                  const SizedBox(height: AppSpacing.sm),

                  // Down payment + Reservation in a row
                  Row(
                    children: [
                      Expanded(
                        child: _InputCard(
                          icon: Icons.payments_rounded,
                          label: l10n.calculatorDownPayment,
                          controller: _down,
                          onChanged: (v) => cubit.setDownPayment(_d(v)),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: _InputCard(
                          icon: Icons.bookmark_rounded,
                          label: l10n.calculatorReservation,
                          controller: _reservation,
                          onChanged: (v) => cubit.setReservation(_d(v)),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),

                  // Months + Increase in a row
                  Row(
                    children: [
                      Expanded(
                        child: _InputCard(
                          icon: Icons.calendar_month_rounded,
                          label: l10n.calculatorMonths,
                          controller: _months,
                          onChanged: (v) =>
                              cubit.setMonths(int.tryParse(v.trim()) ?? 0),
                          hint: '12',
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: _InputCard(
                          icon: Icons.trending_up_rounded,
                          label: l10n.calculatorIncrease,
                          controller: _increase,
                          onChanged: (v) => cubit.setIncrease(_d(v)),
                          hint: '0',
                        ),
                      ),
                    ],
                  ),

                  // Validation error
                  if (state.invalid) ...[
                    const SizedBox(height: AppSpacing.sm),
                    _ErrorBanner(context.l10n.calculatorInvalid),
                  ],

                  const SizedBox(height: AppSpacing.lg),

                  // Calculate button
                  AppButton(
                    label: l10n.calculatorCompute,
                    icon: Icons.calculate_rounded,
                    variant: AppButtonVariant.gold,
                    expand: true,
                    onPressed: cubit.calculate,
                  ),

                  // ── Result ──────────────────────────────────────────────
                  if (state.result != null) ...[
                    const SizedBox(height: AppSpacing.lg),
                    _ResultCard(result: state.result!, lang: lang),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Section header ────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  const _SectionHeader(this.title);
  final String title;

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Container(
            width: 3,
            height: 18,
            decoration: BoxDecoration(
              color: AppPalette.gold400,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
        ],
      );
}

// ── Plan templates section ────────────────────────────────────────────────────

class _PlanTemplatesSection extends StatelessWidget {
  const _PlanTemplatesSection({
    required this.state,
    required this.monthsController,
    required this.increaseController,
  });
  final CalculatorState       state;
  final TextEditingController monthsController;
  final TextEditingController increaseController;

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final cubit  = context.read<CalculatorCubit>();
    final theme  = Theme.of(context);
    final colors = context.appColors;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.card.topLeft.x),
        border: Border.all(color: colors.hairline),
        boxShadow: colors.shadowCard,
      ),
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.md, AppSpacing.md, AppSpacing.md, AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionHeader(l10n.calculatorPlans),
          const SizedBox(height: AppSpacing.sm),
          ...state.templates.map((t) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: AppSpacing.xs),
                Text(
                  t.name,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: colors.inkMuted,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.3,
                  ),
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: t.durations.map((d) {
                    final isSelected =
                        state.months == d.durationMonths &&
                        state.increase == d.increasePercentage;
                    return _DurationChip(
                      months: d.durationMonths,
                      increase: d.increasePercentage,
                      isSelected: isSelected,
                      onTap: () {
                        cubit.applyDuration(d);
                        monthsController.text = '${d.durationMonths}';
                        increaseController.text =
                            d.increasePercentage.toString();
                      },
                    );
                  }).toList(),
                ),
              ],
            );
          }),
        ],
      ),
    );
  }
}

class _DurationChip extends StatelessWidget {
  const _DurationChip({
    required this.months,
    required this.increase,
    required this.isSelected,
    required this.onTap,
  });
  final int    months;
  final double increase;
  final bool   isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? colors.brandNavy : colors.surface,
          borderRadius: AppRadii.pillAll,
          border: Border.all(
            color: isSelected ? colors.brandNavy : colors.hairline,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.calendar_month_rounded,
              size: 13,
              color: isSelected ? Colors.white : colors.inkMuted,
            ),
            const SizedBox(width: 5),
            Text(
              '$months شهر',
              style: TextStyle(
                color: isSelected ? Colors.white : colors.inkStrong,
                fontSize: 13,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
            if (increase > 0) ...[
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                decoration: BoxDecoration(
                  color: isSelected
                      ? Colors.white.withValues(alpha: 0.18)
                      : colors.hairline,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  '+${increase.toStringAsFixed(increase.truncateToDouble() == increase ? 0 : 1)}%',
                  style: TextStyle(
                    color: isSelected ? Colors.white : colors.inkMuted,
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ── Input card ────────────────────────────────────────────────────────────────

class _InputCard extends StatelessWidget {
  const _InputCard({
    required this.icon,
    required this.label,
    required this.controller,
    required this.onChanged,
    this.hint,
  });
  final IconData              icon;
  final String                label;
  final TextEditingController controller;
  final ValueChanged<String>  onChanged;
  final String?               hint;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme  = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.hairline),
        boxShadow: colors.shadowCard,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 13, color: AppPalette.gold400),
              const SizedBox(width: 5),
              Text(
                label,
                style: theme.textTheme.labelSmall?.copyWith(
                  color: colors.inkMuted,
                  fontSize: 11,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          TextField(
            controller: controller,
            keyboardType:
                const TextInputType.numberWithOptions(decimal: true),
            onChanged: onChanged,
            textAlign: TextAlign.start,
            style: theme.textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w600,
              fontSize: 15,
            ),
            decoration: InputDecoration(
              isDense: true,
              contentPadding: EdgeInsets.zero,
              border: InputBorder.none,
              hintText: hint ?? '0',
              hintStyle: theme.textTheme.bodyMedium?.copyWith(
                color: colors.inkMuted.withValues(alpha: 0.40),
                fontSize: 15,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Error banner ──────────────────────────────────────────────────────────────

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: colors.error.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: colors.error.withValues(alpha: 0.20)),
      ),
      child: Row(
        children: [
          Icon(Icons.error_outline_rounded, size: 15, color: colors.error),
          const SizedBox(width: 7),
          Expanded(
            child: Text(
              text,
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: colors.error),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Result card ───────────────────────────────────────────────────────────────

class _ResultCard extends StatelessWidget {
  const _ResultCard({required this.result, required this.lang});
  final InstallmentResult result;
  final String            lang;

  @override
  Widget build(BuildContext context) {
    final l10n  = context.l10n;
    final theme = Theme.of(context);
    String money(double v) => PriceFormatter.format(v, languageCode: lang);

    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF091524), Color(0xFF0F2137)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.07)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.22),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 14),
            child: Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: AppPalette.gold400.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(9),
                    border: Border.all(
                      color: AppPalette.gold400.withValues(alpha: 0.22),
                    ),
                  ),
                  child: const Icon(
                    Icons.calculate_rounded,
                    size: 15,
                    color: AppPalette.gold400,
                  ),
                ),
                const SizedBox(width: 10),
                Text(
                  l10n.calculatorResult,
                  style: theme.textTheme.titleMedium?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),

          // Monthly highlight
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 18),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: AppPalette.gold400.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: AppPalette.gold400.withValues(alpha: 0.22),
              ),
            ),
            child: Column(
              children: [
                Text(
                  l10n.calculatorMonthlyN(result.durationMonths),
                  style: TextStyle(
                    color: AppPalette.gold400.withValues(alpha: 0.72),
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 6),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    money(result.monthlyInstallment),
                    style: const TextStyle(
                      color: AppPalette.gold400,
                      fontSize: 32,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.5,
                      height: 1.0,
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),
          Container(height: 0.5, color: Colors.white.withValues(alpha: 0.07)),

          // Detail rows
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 14, 18, 18),
            child: Column(
              children: [
                _DRow(
                  label: l10n.calculatorReservation,
                  value: money(result.reservationAmount),
                  icon: Icons.bookmark_rounded,
                ),
                const SizedBox(height: 10),
                _DRow(
                  label: l10n.calculatorDownPayment,
                  value: money(result.downPayment),
                  icon: Icons.payments_rounded,
                ),
                const SizedBox(height: 10),
                _DRow(
                  label: l10n.calculatorFinanced,
                  value: money(result.financedAmount),
                  icon: Icons.account_balance_rounded,
                ),
                const SizedBox(height: 14),
                Container(height: 0.5, color: Colors.white.withValues(alpha: 0.10)),
                const SizedBox(height: 14),
                _DRow(
                  label: l10n.calculatorTotal,
                  value: money(result.totalPayable),
                  icon: Icons.summarize_rounded,
                  emphasize: true,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DRow extends StatelessWidget {
  const _DRow({
    required this.label,
    required this.value,
    required this.icon,
    this.emphasize = false,
  });
  final String   label;
  final String   value;
  final IconData icon;
  final bool     emphasize;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(
          icon,
          size: 14,
          color: emphasize
              ? AppPalette.gold400
              : Colors.white.withValues(alpha: 0.35),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            label,
            style: TextStyle(
              color: emphasize
                  ? Colors.white.withValues(alpha: 0.90)
                  : Colors.white.withValues(alpha: 0.50),
              fontSize: emphasize ? 14 : 13,
              fontWeight: emphasize ? FontWeight.w700 : FontWeight.w400,
            ),
          ),
        ),
        Text(
          value,
          style: TextStyle(
            color: emphasize ? AppPalette.gold400 : Colors.white,
            fontSize: emphasize ? 15 : 13,
            fontWeight: emphasize ? FontWeight.w800 : FontWeight.w600,
          ),
        ),
      ],
    );
  }
}
