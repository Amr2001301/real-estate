import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

/// Auth-guarded dashboard placeholder. Real Sales/Broker dashboards arrive in
/// Phases 4–5. Confirms role-aware auth, theme/locale, and navigation.
class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final role = context.watch<SessionCubit>().state.role;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.navDashboard),
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
                Icon(Icons.verified_user_outlined, color: colors.brandGold),
                const SizedBox(width: AppSpacing.sm),
                Text('${l10n.navDashboard} · '),
                StatusBadge(label: role.wire, tone: BadgeTone.navy),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          AppButton(
            label: l10n.galleryTitle,
            icon: Icons.palette_outlined,
            variant: AppButtonVariant.gold,
            expand: true,
            onPressed: () => context.push('/gallery'),
          ),
          const SizedBox(height: AppSpacing.sm),
          AppButton(
            label: l10n.actionLogout,
            icon: Icons.logout_rounded,
            variant: AppButtonVariant.outline,
            expand: true,
            onPressed: () => context.read<SessionCubit>().signOut(),
          ),
        ],
      ),
    );
  }
}
