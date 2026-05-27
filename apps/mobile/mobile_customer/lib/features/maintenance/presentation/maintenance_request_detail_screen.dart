import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../documents/presentation/widgets/documents_list_view.dart';
import '../domain/entities/maintenance_request.dart';
import 'maintenance_format.dart';

/// Maintenance request detail: status, priority, description, and the
/// customer-visible photos/documents (signed downloads). Documents cubits are
/// provided by the route above.
class MaintenanceRequestDetailScreen extends StatelessWidget {
  const MaintenanceRequestDetailScreen({super.key, required this.request});

  final MaintenanceRequest request;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    final category = request.categoryName?.resolve(lang);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.maintenanceDetailTitle)),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          AppCard(
            elevation: AppCardElevation.soft,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.xs,
                  children: [
                    StatusBadge(
                      label: maintenanceStatusLabel(l10n, request.status),
                      tone: maintenanceStatusTone(request.status),
                      dot: true,
                    ),
                    StatusBadge(
                      label: maintenancePriorityLabel(l10n, request.priority),
                      tone: maintenancePriorityTone(request.priority),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                if (category?.isNotEmpty == true) ...[
                  Text(category!, style: theme.textTheme.titleMedium),
                  const SizedBox(height: AppSpacing.xs),
                ],
                Text(request.description, style: theme.textTheme.bodyMedium),
                if (request.unitCode != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    '${l10n.maintenanceUnit}: ${request.unitCode}',
                    style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted),
                  ),
                ],
                if (request.createdAt != null) ...[
                  const SizedBox(height: AppSpacing.xxs),
                  Text(
                    DateFormatter.mediumDate(request.createdAt!, languageCode: lang),
                    style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Text(l10n.maintenanceAttachmentsTitle, style: theme.textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          DocumentsListView(emptyMessage: l10n.maintenanceNoAttachments),
        ],
      ),
    );
  }
}
