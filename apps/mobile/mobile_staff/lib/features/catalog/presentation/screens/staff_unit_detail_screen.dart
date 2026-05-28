import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/catalog_status_label.dart';
import '../../domain/entities/staff_project.dart';
import '../cubit/staff_unit_detail_cubit.dart';

/// Staff unit detail (read-only) with workflow CTAs: reserve, schedule visit
/// (when the project is known), and calculate installments (price prefill).
class StaffUnitDetailScreen extends StatefulWidget {
  const StaffUnitDetailScreen({super.key, this.projectId});

  /// Passed from project detail so "Schedule visit" can prefill the project.
  final String? projectId;

  @override
  State<StaffUnitDetailScreen> createState() => _StaffUnitDetailScreenState();
}

class _StaffUnitDetailScreenState extends State<StaffUnitDetailScreen> {
  @override
  void initState() {
    super.initState();
    context.read<StaffUnitDetailCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.navUnits)),
      body: BlocBuilder<StaffUnitDetailCubit, StaffUnitDetailState>(
        builder: (context, state) {
          switch (state.status) {
            case DataStatus.initial:
            case DataStatus.loading:
              return const Center(child: CircularProgressIndicator());
            case DataStatus.failure:
              return ErrorState(
                failure: state.failure,
                onRetry: () => context.read<StaffUnitDetailCubit>().load(),
              );
            case DataStatus.empty:
            case DataStatus.success:
              return _Body(unit: state.data!, projectId: widget.projectId);
          }
        },
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.unit, this.projectId});
  final StaffUnit unit;
  final String? projectId;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        AppCard(
          elevation: AppCardElevation.soft,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(unit.code, style: Theme.of(context).textTheme.titleLarge),
                  ),
                  StatusBadge(label: unitStatusLabel(l10n, unit.status), tone: unitStatusTone(unit.status)),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              if (unit.type != null)
                _Row(label: l10n.unitType, value: unit.type!),
              if (unit.bedrooms != null)
                _Row(label: l10n.unitBedrooms, value: '${unit.bedrooms}'),
              if (unit.area != null)
                _Row(label: l10n.unitArea, value: unit.area!),
              if (unit.price != null)
                _Row(
                  label: l10n.unitPrice,
                  value: PriceFormatter.formatString(unit.price, languageCode: lang),
                ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            AppButton(
              label: l10n.reservationCreate,
              icon: Icons.bookmark_add_outlined,
              size: AppButtonSize.medium,
              variant: AppButtonVariant.gold,
              onPressed: () => context.push('/reservations/new', extra: {'unitId': unit.id}),
            ),
            if (projectId != null)
              AppButton(
                label: l10n.visitNew,
                icon: Icons.event_outlined,
                size: AppButtonSize.medium,
                variant: AppButtonVariant.outline,
                onPressed: () => context.push(
                  '/visits/new',
                  extra: {'projectId': projectId, 'unitId': unit.id},
                ),
              ),
            AppButton(
              label: l10n.calculatorTitle,
              icon: Icons.calculate_outlined,
              size: AppButtonSize.medium,
              variant: AppButtonVariant.outline,
              onPressed: () => context.push(
                '/calculator',
                extra: {'price': double.tryParse(unit.price ?? '')},
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        children: [
          Expanded(
            child: Text(label,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: colors.inkMuted)),
          ),
          Text(value, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
