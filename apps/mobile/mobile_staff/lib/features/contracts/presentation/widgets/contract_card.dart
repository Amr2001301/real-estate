import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../domain/entities/staff_contract.dart';

class ContractCard extends StatelessWidget {
  const ContractCard({super.key, required this.contract, this.onTap});

  final StaffContract contract;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final isSigned = contract.status == StaffContractStatus.signed;

    return AppCard(
      elevation: AppCardElevation.soft,
      onTap: onTap,
      child: Row(
        children: [
          Container(
            width: 4,
            height: 56,
            decoration: BoxDecoration(
              color: isSigned ? colors.success : colors.inkMuted,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        contract.customerName ?? '—',
                        style: Theme.of(context).textTheme.titleSmall,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    StatusBadge(
                      label: isSigned ? l10n.contractStatusSigned : l10n.contractStatusDraft,
                      tone: isSigned ? BadgeTone.success : BadgeTone.neutral,
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  [
                    if (contract.contractNumber != null) '#${contract.contractNumber}',
                    if (contract.unitCode != null) contract.unitCode!,
                    if (contract.projectName != null)
                      contract.projectName!.resolve(lang),
                  ].join('  ·  '),
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: colors.inkMuted),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (contract.totalAmount != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    PriceFormatter.format(contract.totalAmount, languageCode: lang),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: colors.brandGold,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Icon(Icons.chevron_right_rounded, color: colors.inkMuted),
        ],
      ),
    );
  }
}
