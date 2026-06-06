import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../common/brand_mark.dart';

/// The guest "المزيد" tab: a premium hub — a navy sign-in banner up top, then
/// the public quick actions (assistant) and app settings (language, theme). The
/// shell supplies the app bar + bottom nav.
class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return ListView(
      padding: EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.lg, AppSpacing.lg,
          AppSpacing.lg + MediaQuery.of(context).padding.bottom),
      children: [
        _SignInBanner(onLogin: () => context.push('/login')),
        const SizedBox(height: AppSpacing.xl),
        AppSectionHeader(title: l10n.moreSectionGeneral),
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
          tone: AppTone.gold,
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

/// Premium navy sign-in banner: gold eyebrow + title + subtitle and a gold
/// "sign in" CTA, over the brand navy depth gradient with a soft gold glow.
class _SignInBanner extends StatelessWidget {
  const _SignInBanner({required this.onLogin});
  final VoidCallback onLogin;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final colors = context.appColors;
    final radius = BorderRadius.circular(AppRadii.xl);

    return DecoratedBox(
      decoration: BoxDecoration(borderRadius: radius, boxShadow: colors.shadowLift),
      child: ClipRRect(
        borderRadius: radius,
        child: Stack(
          children: [
            const Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment(0.64, -1.0),
                    radius: 1.5,
                    colors: [
                      Color(0xFF24426A),
                      Color(0xFF14273F),
                      Color(0xFF0B1726),
                    ],
                    stops: [0.0, 0.58, 1.0],
                  ),
                ),
              ),
            ),
            const Positioned.fill(
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: RadialGradient(
                      center: AlignmentDirectional(0.9, -0.6),
                      radius: 1.0,
                      colors: [Color(0x2BC8A24B), Color(0x00C8A24B)],
                      stops: [0.0, 0.6],
                    ),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const BrandMark(size: 38),
                      const SizedBox(width: AppSpacing.sm),
                      Text(
                        l10n.authEyebrow,
                        style: theme.textTheme.labelLarge?.copyWith(
                          color: AppPalette.gold300,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.4,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    l10n.moreSignInTitle,
                    style: theme.textTheme.titleLarge?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      height: 1.2,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    l10n.moreSignInSubtitle,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: Colors.white.withValues(alpha: 0.78),
                      height: 1.45,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  AppButton(
                    label: l10n.actionLogin,
                    icon: Icons.login_rounded,
                    variant: AppButtonVariant.gold,
                    expand: true,
                    onPressed: onLogin,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
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
