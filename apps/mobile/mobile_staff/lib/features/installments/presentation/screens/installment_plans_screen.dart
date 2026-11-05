import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../catalog/domain/repositories/staff_catalog_repository.dart';
import '../../../dashboard/home_kit/home_kit.dart';
import '../../domain/repositories/installments_repository.dart';
import 'calculator_unit_plans.dart';

/// «خطط التقسيط»: the same way as the calculator — pick the project, then
/// one of its units, and that unit's own payment plans come up with every
/// duration and its instalment. A unit with no plans says so.
class InstallmentPlansScreen extends StatelessWidget {
  const InstallmentPlansScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final bottom = MediaQuery.paddingOf(context).bottom;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: ListView(
          key: const Key('installment-plans'),
          padding: EdgeInsets.only(bottom: bottom + 32),
          children: [
            HomeListHero(
              back: true,
              title: l10n.planTemplatesTitle,
              subtitle: l10n.planTemplatesSubtitle,
              actions: [
                HomeHeroButton(
                  key: const Key('plans-calculator'),
                  icon: Icons.calculate_rounded,
                  tooltip: l10n.calculatorTitle,
                  onTap: () => context.push('/calculator'),
                ),
              ],
            ),
            HomeSection(
              icon: Icons.view_list_rounded,
              title: l10n.calculatorUnitSection,
              child: CalculatorUnitPlans(
                catalog: context.read<StaffCatalogRepository>(),
                installments: context.read<InstallmentsRepository>(),
                noPlansText: l10n.plansNoUnitPlans,
                pickHint: l10n.plansPickHint,
                onUnitPrice: (_) {},
                onApply: (_, _) {},
              ),
            ),
          ],
        ),
      ),
    );
  }
}
