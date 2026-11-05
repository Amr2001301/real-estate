import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../notifications/presentation/widgets/customer_notification_button.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyLight = Color(0xFF243F62);

// ─────────────────────────────────────────────────────────────────────────────
// Finance Hub Screen
// ─────────────────────────────────────────────────────────────────────────────

class FinanceHubScreen extends StatelessWidget {
  const FinanceHubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final session = context.watch<SessionCubit>().state;
    final displayName =
        session.sessionOrNull?.displayName ?? session.sessionOrNull?.email;

    return Column(
      children: [
        _FinanceHeader(displayName: displayName, l10n: l10n),
        Expanded(
          child: ListView(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.lg + MediaQuery.of(context).padding.bottom,
            ),
            children: [
              _PortalCard(
                icon: AppIcons.installments,
                title: l10n.installmentsTitle,
                subtitle: l10n.financeInstallmentsDesc,
                gradientColors: const [Color(0xFFC8A24B), Color(0xFF9A6F1E)],
                iconColor: Colors.white,
                onTap: () => context.push('/account/installments'),
              ),
              const SizedBox(height: AppSpacing.md),
              _PortalCard(
                icon: AppIcons.deposit,
                title: l10n.accountDeposits,
                subtitle: l10n.financeDepositsDesc,
                gradientColors: const [_navyLight, _navyDeep],
                iconColor: AppPalette.gold300,
                onTap: () => context.push('/account/deposits'),
              ),
              const SizedBox(height: AppSpacing.md),
              _PortalCard(
                icon: AppIcons.contract,
                title: l10n.accountContracts,
                subtitle: l10n.financeContractsDesc,
                gradientColors: const [Color(0xFF2D7A5F), Color(0xFF1B4A3A)],
                iconColor: Colors.greenAccent,
                onTap: () => context.push('/account/contracts'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Screen header ─────────────────────────────────────────────────────────────

class _FinanceHeader extends StatelessWidget {
  const _FinanceHeader({required this.displayName, required this.l10n});

  final String? displayName;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return AppNavHeader(
      title: l10n.navFinance,
      subtitle: l10n.financeSubtitle,
      compact: true,
      leadingAction: GestureDetector(
        onTap: () => context.push('/account/profile'),
        child: _GoldRingAvatar(name: displayName),
      ),
      actions: const [CustomerNotificationButton()],
    );
  }
}

// ── Portal card ───────────────────────────────────────────────────────────────

class _PortalCard extends StatelessWidget {
  const _PortalCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.gradientColors,
    required this.iconColor,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final List<Color> gradientColors;
  final Color iconColor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.45)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Row(
              children: [
                Container(
                  width: 54,
                  height: 54,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: gradientColors,
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Icon(icon, color: iconColor, size: 26),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: colors.inkStrong,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        subtitle,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: colors.inkMuted,
                          height: 1.45,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Icon(AppIcons.chevronForward, size: 20, color: colors.inkMuted),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Shared: gold ring avatar ──────────────────────────────────────────────────

class _GoldRingAvatar extends StatelessWidget {
  const _GoldRingAvatar({required this.name});
  final String? name;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: AppPalette.gold400.withValues(alpha: 0.75),
          width: 2,
        ),
        boxShadow: [
          BoxShadow(
            color: AppPalette.gold400.withValues(alpha: 0.26),
            blurRadius: 14,
            spreadRadius: 1,
          ),
        ],
      ),
      child: GradientAvatar(name: name, size: 48),
    );
  }
}
