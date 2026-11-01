import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/lead_stage_label.dart';
import '../../domain/repositories/leads_repository.dart';
import '../cubit/create_lead_cubit.dart';

/// DUP2 — the customer already has an open lead. Shows which, with a way to
/// open it, or to add another lead anyway.
Future<void> showOpenLeadSheet(
  BuildContext context,
  CreateLeadCubit cubit,
  List<OpenLeadRef> leads,
) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (sheet) => OpenLeadSheet(
      leads: leads,
      onOpen: (id) {
        Navigator.of(sheet).pop();
        context.push('/leads/$id');
      },
      onAnyway: () {
        Navigator.of(sheet).pop();
        cubit.submitAnyway();
      },
    ),
  );
}

class OpenLeadSheet extends StatelessWidget {
  const OpenLeadSheet({super.key, required this.leads, required this.onOpen, required this.onAnyway});

  final List<OpenLeadRef> leads;
  final ValueChanged<String> onOpen;
  final VoidCallback onAnyway;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final theme = Theme.of(context);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(children: [
              Icon(Icons.warning_amber_rounded, color: theme.colorScheme.tertiary),
              const SizedBox(width: 8),
              Expanded(child: Text(l10n.leadDupTitle, style: theme.textTheme.titleMedium)),
            ]),
            const SizedBox(height: 8),
            Text(l10n.leadDupDesc, style: theme.textTheme.bodyMedium),
            const SizedBox(height: 12),
            for (final lead in leads)
              Card(
                key: ValueKey('open-lead-${lead.id}'),
                child: ListTile(
                  title: Text(leadStageLabel(l10n, lead.stage)),
                  subtitle: Text([
                    '${l10n.leadDupOwner}: ${lead.ownerName ?? l10n.leadDupUnassigned}',
                    if (lead.createdAt != null) DateFormatter.shortDate(lead.createdAt!, languageCode: lang),
                  ].join(' · ')),
                  trailing: TextButton(
                    onPressed: () => onOpen(lead.id),
                    child: Text(l10n.leadDupOpen),
                  ),
                ),
              ),
            const SizedBox(height: 12),
            OutlinedButton(
              key: const ValueKey('add-lead-anyway'),
              onPressed: onAnyway,
              child: Text(l10n.leadDupAnyway),
            ),
          ],
        ),
      ),
    );
  }
}
