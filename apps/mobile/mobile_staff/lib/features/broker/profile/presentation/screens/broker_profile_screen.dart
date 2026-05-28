import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../../common/role_label.dart';
import '../../../../auth/presentation/cubit/staff_auth_cubit.dart';
import '../cubit/broker_profile_cubit.dart';

/// Broker profile: identity + company, commissions entry (when allowed),
/// language/theme controls, and logout.
class BrokerProfileScreen extends StatelessWidget {
  const BrokerProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.navProfile)),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          BlocBuilder<BrokerProfileCubit, BrokerProfileState>(
            builder: (context, state) {
              if (state.status == DataStatus.loading || state.status == DataStatus.initial) {
                return const _HeaderSkeleton();
              }
              final session = context.read<SessionCubit>().state.sessionOrNull;
              final p = state.data;
              final name = p?.fullName ?? session?.displayName ?? '—';
              return AppCard(
                elevation: AppCardElevation.soft,
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 28,
                      backgroundColor: colors.brandGoldSoft,
                      child: Icon(Icons.handshake_outlined, color: colors.brandGold),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(name, style: Theme.of(context).textTheme.titleMedium),
                          if (p?.companyName != null) ...[
                            const SizedBox(height: 2),
                            Text(p!.companyName!,
                                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
                          ],
                          const SizedBox(height: AppSpacing.xs),
                          StatusBadge(label: roleLabel(l10n, AppRole.broker), tone: BadgeTone.navy),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: AppSpacing.lg),
          BlocBuilder<BrokerProfileCubit, BrokerProfileState>(
            buildWhen: (a, b) => a.data?.canViewCommissions != b.data?.canViewCommissions,
            builder: (context, state) {
              if (state.data?.canViewCommissions != true) return const SizedBox.shrink();
              return _SettingTile(
                icon: Icons.payments_outlined,
                label: l10n.navCommissions,
                onTap: () => context.push('/broker/commissions'),
              );
            },
          ),
          _SettingTile(
            icon: Icons.translate_rounded,
            label: l10n.settingsLanguage,
            trailing: Text(l10n.languageName),
            onTap: () => context.read<LocaleCubit>().toggle(),
          ),
          _SettingTile(
            icon: Icons.brightness_6_outlined,
            label: l10n.settingsTheme,
            onTap: () => context.read<ThemeCubit>().cycle(),
          ),
          const SizedBox(height: AppSpacing.lg),
          AppButton(
            label: l10n.actionLogout,
            icon: Icons.logout_rounded,
            variant: AppButtonVariant.outline,
            expand: true,
            onPressed: () => context.read<StaffAuthCubit>().logout(),
          ),
        ],
      ),
    );
  }
}

class _SettingTile extends StatelessWidget {
  const _SettingTile({required this.icon, required this.label, required this.onTap, this.trailing});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: AppCard(
        onTap: onTap,
        child: Row(
          children: [
            Icon(icon, color: colors.brandGold),
            const SizedBox(width: AppSpacing.md),
            Expanded(child: Text(label, style: Theme.of(context).textTheme.titleSmall)),
            ?trailing,
            const Icon(Icons.chevron_right_rounded),
          ],
        ),
      ),
    );
  }
}

class _HeaderSkeleton extends StatelessWidget {
  const _HeaderSkeleton();
  @override
  Widget build(BuildContext context) {
    return AppSkeletonizer(
      enabled: true,
      child: AppCard(
        child: Row(
          children: [
            const CircleAvatar(radius: 28),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Broker name', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 4),
                  Text('Company', style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
