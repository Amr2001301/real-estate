import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

/// The guest "المزيد" tab: a clean, body-only hub for the public actions that
/// used to be squeezed into the app-bar three-dot menu — login, assistant,
/// language, and theme. The shell supplies the app bar + bottom nav.
class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        _MoreRow(
          icon: AppIcons.profile,
          tone: AppTone.gold,
          label: l10n.actionLogin,
          onTap: () => context.push('/login'),
        ),
        const SizedBox(height: AppSpacing.sm),
        _MoreRow(
          icon: AppIcons.chat,
          tone: AppTone.navy,
          label: l10n.homeAskAssistant,
          onTap: () => context.push('/chat'),
        ),
        const SizedBox(height: AppSpacing.xl),
        AppSectionHeader(title: l10n.accountSectionSettings),
        const SizedBox(height: AppSpacing.sm),
        _MoreRow(
          icon: Icons.translate_rounded,
          tone: AppTone.muted,
          label: l10n.galleryToggleLanguage,
          onTap: () => context.read<LocaleCubit>().toggle(),
        ),
        const SizedBox(height: AppSpacing.sm),
        _MoreRow(
          icon: Icons.brightness_6_outlined,
          tone: AppTone.muted,
          label: l10n.galleryToggleTheme,
          onTap: () => context.read<ThemeCubit>().cycle(),
        ),
      ],
    );
  }
}

class _MoreRow extends StatelessWidget {
  const _MoreRow({
    required this.icon,
    required this.tone,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final AppTone tone;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
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
}
