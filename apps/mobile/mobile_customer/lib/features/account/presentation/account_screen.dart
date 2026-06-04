import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../auth/presentation/auth_cubit.dart';
import '../../notifications/presentation/unread_count_cubit.dart';

/// Authenticated account hub: profile, favorites, my requests, notifications
/// (with unread badge), and logout.
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
    final name = session?.displayName ?? session?.email ?? l10n.accountRoleCustomer;

    // Body-only: the CustomerShellScaffold supplies the app bar (with the
    // language/theme toggles) + bottom nav.
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        // ── Identity header ────────────────────────────────────────────────
        PremiumCard(
          glow: true,
          child: GradientAvatar.identity(
            name: name,
            role: l10n.accountRoleCustomer,
          ),
        ),
        const SizedBox(height: AppSpacing.xl),

        // ── حسابي ─────────────────────────────────────────────────────────
        _section(context, l10n.navAccount, [
          _NavEntry(AppIcons.profile, AppTone.gold, l10n.accountProfile,
              '/account/profile'),
          _NavEntry(AppIcons.favorite, AppTone.gold, l10n.accountFavorites,
              '/account/favorites'),
          _NavEntry(AppIcons.visit, AppTone.navy, l10n.accountMyRequests,
              '/account/requests'),
          _NavEntry(AppIcons.notification, AppTone.gold,
              l10n.accountNotifications, '/account/notifications',
              badge: unread),
        ]),
        const SizedBox(height: AppSpacing.xl),

        // ── خدمات العميل ───────────────────────────────────────────────────
        _section(context, l10n.accountSectionServices, [
          _NavEntry(AppIcons.property, AppTone.gold, l10n.accountMyProperty,
              '/account/property'),
          _NavEntry(AppIcons.contract, AppTone.success, l10n.accountContracts,
              '/account/contracts'),
          _NavEntry(AppIcons.installments, AppTone.navy, l10n.installmentsTitle,
              '/account/installments'),
          _NavEntry(AppIcons.deposit, AppTone.gold, l10n.accountDeposits,
              '/account/deposits'),
          _NavEntry(AppIcons.maintenance, AppTone.navy, l10n.accountMaintenance,
              '/account/maintenance'),
        ]),
        const SizedBox(height: AppSpacing.xl),

        // ── الإعدادات (language/theme — moved out of the app-bar menu) ──────
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppSectionHeader(title: l10n.accountSectionSettings),
            const SizedBox(height: AppSpacing.sm),
            StaggeredColumn(
              spacing: AppSpacing.sm,
              children: [
                _actionRow(context, Icons.translate_rounded, AppTone.muted,
                    l10n.galleryToggleLanguage,
                    () => context.read<LocaleCubit>().toggle()),
                _actionRow(context, Icons.brightness_6_outlined, AppTone.muted,
                    l10n.galleryToggleTheme,
                    () => context.read<ThemeCubit>().cycle()),
              ],
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

  /// A premium row driven by a callback (settings toggles) rather than a route.
  Widget _actionRow(BuildContext context, IconData icon, AppTone tone,
      String label, VoidCallback onTap) {
    final colors = context.appColors;
    return PremiumCard(
      elevation: AppCardElevation.soft,
      onTap: onTap,
      child: Row(
        children: [
          IconChip(icon: icon, tone: tone, size: IconChipSize.sm),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(
              label,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: colors.inkStrong,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
          Icon(AppIcons.chevronForward, color: colors.inkMuted),
        ],
      ),
    );
  }

  /// A titled group of premium navigation rows with a light staggered entrance.
  Widget _section(BuildContext context, String title, List<_NavEntry> entries) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppSectionHeader(title: title),
        const SizedBox(height: AppSpacing.sm),
        StaggeredColumn(
          spacing: AppSpacing.sm,
          children: [for (final e in entries) _navRow(context, e)],
        ),
      ],
    );
  }

  /// Confirms before signing out, using a platform-adaptive dialog
  /// (Cupertino on iOS, Material on Android). The cubit is captured before the
  /// await so we don't touch context across the async gap.
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

  /// A premium navigation row: gold/navy [IconChip], label, optional count
  /// badge, and a chevron. Pushes the entry's route (full-screen over the
  /// shell), preserving the existing navigation destinations.
  Widget _navRow(BuildContext context, _NavEntry e) {
    final colors = context.appColors;
    return PremiumCard(
      elevation: AppCardElevation.soft,
      onTap: () => context.push(e.route),
      child: Row(
        children: [
          IconChip(icon: e.icon, tone: e.tone, size: IconChipSize.sm),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(
              e.label,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: colors.inkStrong,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
          if (e.badge > 0) ...[
            StatusBadge(label: '${e.badge}', tone: BadgeTone.gold),
            const SizedBox(width: AppSpacing.xs),
          ],
          Icon(AppIcons.chevronForward, color: colors.inkMuted),
        ],
      ),
    );
  }
}

/// A single account-hub navigation destination.
class _NavEntry {
  const _NavEntry(this.icon, this.tone, this.label, this.route, {this.badge = 0});

  final IconData icon;
  final AppTone tone;
  final String label;
  final String route;
  final int badge;
}
