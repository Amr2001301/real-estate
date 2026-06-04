import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// The "Finance" tab: a lightweight hub with premium navigation cards into the
/// installments, deposits/payments, and contracts areas. Body-only (the shell
/// provides the header + bottom nav). No API calls — pure navigation entry
/// points; the destination list screens load their own data as before.
class FinanceHubScreen extends StatelessWidget {
  const FinanceHubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return ListView(
      padding: EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.lg, AppSpacing.lg,
          AppSpacing.lg + MediaQuery.of(context).padding.bottom),
      children: [
        AppSectionHeader(
          eyebrow: l10n.navFinance,
          title: l10n.navFinance,
          subtitle: l10n.financeHubSubtitle,
        ),
        const SizedBox(height: AppSpacing.md),
        StaggeredColumn(
          children: [
            _FinanceCard(
              icon: AppIcons.installments,
              tone: AppTone.gold,
              title: l10n.installmentsTitle,
              subtitle: l10n.financeInstallmentsDesc,
              onTap: () => context.push('/account/installments'),
            ),
            _FinanceCard(
              icon: AppIcons.deposit,
              tone: AppTone.navy,
              title: l10n.accountDeposits,
              subtitle: l10n.financeDepositsDesc,
              onTap: () => context.push('/account/deposits'),
            ),
            _FinanceCard(
              icon: AppIcons.contract,
              tone: AppTone.success,
              title: l10n.accountContracts,
              subtitle: l10n.financeContractsDesc,
              onTap: () => context.push('/account/contracts'),
            ),
          ],
        ),
      ],
    );
  }
}

class _FinanceCard extends StatelessWidget {
  const _FinanceCard({
    required this.icon,
    required this.tone,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final AppTone tone;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    return PremiumCard(
      onTap: onTap,
      accentRail: tone,
      child: Row(
        children: [
          IconChip(icon: icon, tone: tone, size: IconChipSize.md),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  style: theme.textTheme.titleSmall?.copyWith(
                    color: colors.inkStrong,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  subtitle,
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: colors.inkMuted),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          Icon(AppIcons.chevronForward, color: colors.inkMuted),
        ],
      ),
    );
  }
}
