import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../../common/catalog_status_label.dart';
import '../../domain/entities/broker_project.dart';

/// Broker unit detail (read-only). Receives the unit + its project context via
/// route extra (the portal has no single-unit endpoint). CTA: add a lead.
class BrokerUnitDetailScreen extends StatelessWidget {
  const BrokerUnitDetailScreen({super.key, required this.unit, this.projectId});

  final BrokerUnit unit;
  final String? projectId;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    return Scaffold(
      appBar: AppBar(title: Text(unit.code)),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          AppCard(
            elevation: AppCardElevation.soft,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(child: Text(unit.code, style: Theme.of(context).textTheme.titleLarge)),
                    StatusBadge(label: unitStatusLabel(l10n, unit.status), tone: unitStatusTone(unit.status)),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                if (unit.type != null) _row(context, l10n.unitType, unit.type!),
                if (unit.bedrooms != null) _row(context, l10n.unitBedrooms, '${unit.bedrooms}'),
                if (unit.area != null) _row(context, l10n.unitArea, unit.area!),
                if (unit.price != null)
                  _row(context, l10n.unitPrice, PriceFormatter.formatString(unit.price, languageCode: lang)),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          AppButton(
            label: l10n.brokerLeadNew,
            icon: Icons.person_add_alt_1_outlined,
            variant: AppButtonVariant.gold,
            expand: true,
            onPressed: () => context.push('/broker/leads/new', extra: {
              'projectId': projectId,
              'unitId': unit.id,
            }),
          ),
        ],
      ),
    );
  }

  Widget _row(BuildContext context, String label, String value) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        children: [
          Expanded(child: Text(label, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: colors.inkMuted))),
          Text(value, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
