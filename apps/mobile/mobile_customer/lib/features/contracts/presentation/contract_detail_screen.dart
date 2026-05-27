import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../documents/presentation/widgets/documents_list_view.dart';
import '../domain/entities/contract.dart';

/// Contract detail: a summary header plus the signed PDF documents attached to
/// the contract. The documents cubits are provided by the route above.
class ContractDetailScreen extends StatelessWidget {
  const ContractDetailScreen({super.key, required this.contract});

  final Contract contract;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    final signed = contract.status == ContractStatus.signed;

    return Scaffold(
      appBar: AppBar(
        title: Text(contract.contractNumber ?? l10n.accountContracts),
      ),
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
                    Expanded(
                      child: Text(
                        contract.projectName.resolve(lang),
                        style: theme.textTheme.titleMedium,
                      ),
                    ),
                    StatusBadge(
                      label: signed
                          ? l10n.contractStatusSigned
                          : l10n.contractStatusDraft,
                      tone: signed ? BadgeTone.success : BadgeTone.neutral,
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  '${contract.unitType} · ${contract.unitCode}',
                  style: theme.textTheme.bodyMedium
                      ?.copyWith(color: colors.inkMuted),
                ),
                if (contract.signedAt != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    '${l10n.myPropertySignedDate}: '
                    '${DateFormatter.mediumDate(contract.signedAt!, languageCode: lang)}',
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: colors.inkMuted),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Text(l10n.contractsDocumentsTitle, style: theme.textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          const DocumentsListView(),
        ],
      ),
    );
  }
}
