import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../auth/presentation/auth_cubit.dart';
import '../../notifications/presentation/unread_count_cubit.dart';

/// Authenticated account hub: a premium identity header, grouped navigation
/// (account · customer services · settings) as dense divided lists, and logout.
class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  @override
  void initState() {
    super.initState();
    // Refresh the unread badge whenever the hub opens.
    context.read<UnreadCountCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final session = context.watch<SessionCubit>().state.sessionOrNull;
    final unread = context.watch<UnreadCountCubit>().state;
    final name =
        session?.displayName ?? session?.email ?? l10n.accountRoleCustomer;

    // Body-only: the CustomerShellScaffold supplies the app bar + bottom nav.
    return ListView(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg + MediaQuery.of(context).padding.bottom,
      ),
      children: [
        // ── Identity header (tappable → profile) ───────────────────────────
        _ProfileHeader(name: name),
        const SizedBox(height: AppSpacing.xl),

        // ── حسابي ─────────────────────────────────────────────────────────
        _NavGroup(
          title: l10n.navAccount,
          tiles: [
            _NavTile(
              icon: AppIcons.profile,
              tone: AppTone.gold,
              label: l10n.accountProfile,
              onTap: () => context.push('/account/profile'),
            ),
            _NavTile(
              icon: AppIcons.favorite,
              tone: AppTone.gold,
              label: l10n.accountFavorites,
              onTap: () => context.push('/account/favorites'),
            ),
            _NavTile(
              icon: AppIcons.visit,
              tone: AppTone.navy,
              label: l10n.accountMyRequests,
              onTap: () => context.push('/account/requests'),
            ),
            _NavTile(
              icon: AppIcons.notification,
              tone: AppTone.gold,
              label: l10n.accountNotifications,
              badge: unread,
              onTap: () => context.push('/account/notifications'),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),

        // ── خدمات العميل ───────────────────────────────────────────────────
        _NavGroup(
          title: l10n.accountSectionServices,
          tiles: [
            _NavTile(
              icon: AppIcons.property,
              tone: AppTone.gold,
              label: l10n.accountMyProperty,
              onTap: () => context.push('/account/property'),
            ),
            _NavTile(
              icon: AppIcons.contract,
              tone: AppTone.success,
              label: l10n.accountContracts,
              onTap: () => context.push('/account/contracts'),
            ),
            _NavTile(
              icon: AppIcons.installments,
              tone: AppTone.navy,
              label: l10n.installmentsTitle,
              onTap: () => context.push('/account/installments'),
            ),
            _NavTile(
              icon: AppIcons.deposit,
              tone: AppTone.gold,
              label: l10n.accountDeposits,
              onTap: () => context.push('/account/deposits'),
            ),
            _NavTile(
              icon: AppIcons.maintenance,
              tone: AppTone.navy,
              label: l10n.accountMaintenance,
              onTap: () => context.push('/account/maintenance'),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),

        // ── الإعدادات (language/theme — moved out of the app-bar menu) ──────
        _NavGroup(
          title: l10n.accountSectionSettings,
          tiles: [
            _NavTile(
              icon: Icons.translate_rounded,
              tone: AppTone.muted,
              label: l10n.galleryToggleLanguage,
              onTap: () => context.read<LocaleCubit>().toggle(),
            ),
            _NavTile(
              icon: Icons.brightness_6_outlined,
              tone: AppTone.muted,
              label: l10n.galleryToggleTheme,
              onTap: () => context.read<ThemeCubit>().cycle(),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.xl),

        AppButton(
          label: l10n.actionLogout,
          icon: Icons.logout_rounded,
          variant: AppButtonVariant.outline,
          expand: true,
          onPressed: () => _confirmLogout(context),
        ),
      ],
    );
  }

  /// Confirms before signing out, using a platform-adaptive dialog. The cubit
  /// is captured before the await so we don't touch context across the gap.
  Future<void> _confirmLogout(BuildContext context) async {
    final l10n = context.l10n;
    final authCubit = context.read<AuthCubit>();
    final confirmed = await showAdaptiveConfirm(
      context,
      title: l10n.actionLogout,
      message: l10n.logoutConfirmMessage,
      confirmLabel: l10n.actionLogout,
      cancelLabel: l10n.actionCancel,
      destructive: true,
    );
    if (confirmed) authCubit.logout();
  }
}

/// Premium identity header — avatar + name + role, tappable into the profile.
class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    return PremiumCard(
      glow: true,
      onTap: () => context.push('/account/profile'),
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Row(
        children: [
          GradientAvatar(name: name, size: 56),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleMedium?.copyWith(
                    color: colors.inkStrong,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: AppSpacing.xxs),
                StatusBadge(
                  label: l10n.accountRoleCustomer,
                  tone: BadgeTone.gold,
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Icon(AppIcons.chevronForward, size: 20, color: colors.inkMuted),
        ],
      ),
    );
  }
}

/// A titled group rendered as ONE premium card with hairline-divided rows —
/// dense and organized, instead of a stack of bulky individual cards.
class _NavGroup extends StatelessWidget {
  const _NavGroup({required this.title, required this.tiles});

  final String title;
  final List<_NavTile> tiles;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppSectionHeader(title: title),
        const SizedBox(height: AppSpacing.sm),
        PremiumCard(
          padding: EdgeInsets.zero,
          child: Material(
            color: Colors.transparent,
            child: Column(
              children: [
                for (var i = 0; i < tiles.length; i++) ...[
                  if (i > 0)
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.md,
                      ),
                      child: Divider(height: 1, color: colors.hairline),
                    ),
                  tiles[i],
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// A single dense navigation/action row: tinted [IconChip], label, optional
/// count badge, and a chevron. Used inside a [_NavGroup] card.
class _NavTile extends StatelessWidget {
  const _NavTile({
    required this.icon,
    required this.tone,
    required this.label,
    required this.onTap,
    this.badge = 0,
  });

  final IconData icon;
  final AppTone tone;
  final String label;
  final VoidCallback onTap;
  final int badge;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm + 2,
        ),
        child: Row(
          children: [
            IconChip(icon: icon, tone: tone, size: IconChipSize.sm),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.titleSmall?.copyWith(
                  color: colors.inkStrong,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            if (badge > 0) ...[
              StatusBadge(label: '$badge', tone: BadgeTone.gold),
              const SizedBox(width: AppSpacing.xs),
            ],
            Icon(AppIcons.chevronForward, size: 18, color: colors.inkMuted),
          ],
        ),
      ),
    );
  }
}
