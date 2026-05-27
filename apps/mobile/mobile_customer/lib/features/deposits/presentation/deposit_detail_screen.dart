import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../documents/presentation/widgets/documents_list_view.dart';
import '../domain/entities/deposit.dart';
import 'deposit_format.dart';

/// Deposit detail: payment summary plus its receipt documents (signed
/// downloads). The documents cubits are provided by the route above.
class DepositDetailScreen extends StatelessWidget {
  const DepositDetailScreen({super.key, required this.deposit});

  final Deposit deposit;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.depositDetailTitle)),
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
                        PriceFormatter.formatString(deposit.amount, languageCode: lang),
                        style: theme.textTheme.headlineSmall,
                      ),
                    ),
                    StatusBadge(
                      label: deposit.verified
                          ? l10n.depositVerified
                          : l10n.depositPending,
                      tone: deposit.verified ? BadgeTone.success : BadgeTone.warning,
                      dot: true,
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  depositTypeLabel(l10n, deposit.type),
                  style: theme.textTheme.bodyMedium?.copyWith(color: colors.inkMuted),
                ),
                if (deposit.paidAt != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    '${l10n.depositPaidOn}: '
                    '${DateFormatter.mediumDate(deposit.paidAt!, languageCode: lang)}',
                    style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted),
                  ),
                ],
                if (deposit.contractNumber != null) ...[
                  const SizedBox(height: AppSpacing.xxs),
                  Text(
                    '${l10n.myPropertyContractNumber}: ${deposit.contractNumber}',
                    style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Text(l10n.depositReceiptsTitle, style: theme.textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          DocumentsListView(emptyMessage: l10n.depositNoReceipts),
        ],
      ),
    );
  }
}
