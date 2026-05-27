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
    final colors = context.appColors;
    final session = context.watch<SessionCubit>().state.sessionOrNull;
    final unread = context.watch<UnreadCountCubit>().state;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.navAccount),
        actions: [
          IconButton(
            icon: const Icon(Icons.translate_rounded),
            onPressed: () => context.read<LocaleCubit>().toggle(),
          ),
          IconButton(
            icon: const Icon(Icons.brightness_6_outlined),
            onPressed: () => context.read<ThemeCubit>().cycle(),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          AppCard(
            elevation: AppCardElevation.soft,
            child: Row(
              children: [
                CircleAvatar(
                  backgroundColor: colors.brandGoldSoft,
                  child: Icon(Icons.person, color: colors.brandGold),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(session?.displayName ?? session?.email ?? '—',
                          style: Theme.of(context).textTheme.titleMedium),
                      if (session?.email != null)
                        Text(session!.email!,
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(color: colors.inkMuted)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          _tile(context, Icons.home_work_outlined, l10n.accountMyProperty,
              () => context.push('/account/property')),
          _tile(context, Icons.account_balance_wallet_outlined, l10n.accountDeposits,
              () => context.push('/account/deposits')),
          _tile(context, Icons.folder_outlined, l10n.accountContracts,
              () => context.push('/account/contracts')),
          _tile(context, Icons.build_outlined, l10n.accountMaintenance,
              () => context.push('/account/maintenance')),
          _tile(context, Icons.person_outline_rounded, l10n.accountProfile,
              () => context.push('/account/profile')),
          _tile(context, Icons.favorite_border_rounded, l10n.accountFavorites,
              () => context.push('/account/favorites')),
          _tile(context, Icons.event_note_outlined, l10n.accountMyRequests,
              () => context.push('/account/requests')),
          _tile(context, Icons.notifications_none_rounded, l10n.accountNotifications,
              () => context.push('/account/notifications'), badge: unread),
          const SizedBox(height: AppSpacing.lg),
          AppButton(
            label: l10n.actionLogout,
            icon: Icons.logout_rounded,
            variant: AppButtonVariant.outline,
            expand: true,
            onPressed: () => context.read<AuthCubit>().logout(),
          ),
        ],
      ),
    );
  }

  Widget _tile(
    BuildContext context,
    IconData icon,
    String label,
    VoidCallback onTap, {
    int badge = 0,
  }) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: AppCard(
        onTap: onTap,
        child: Row(
          children: [
            Badge(
              isLabelVisible: badge > 0,
              label: Text('$badge'),
              child: Icon(icon, color: colors.brandGold),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(child: Text(label, style: Theme.of(context).textTheme.titleSmall)),
            const Icon(Icons.chevron_right_rounded),
          ],
        ),
      ),
    );
  }
}
