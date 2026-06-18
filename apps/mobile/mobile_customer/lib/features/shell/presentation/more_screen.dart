import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../common/brand_mark.dart';

// Navy depth tokens — shared design language with projects/units/compare.
const _navyDeep = Color(0xFF0B1726);
const _navyMid = Color(0xFF14273F);
const _navyLight = Color(0xFF24426A);

/// Premium "المزيد" hub — self-chrome screen with its own Scaffold.
///
/// Zones:
///   • Navy hero  — cinematic sign-in banner with brand mark, headline, CTA
///   • Benefits   — three "what you unlock" tiles bridging hero → content
///   • Menu       — icon-led grouped tiles (General + Settings)
///   • Footer     — brand mark + version
class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.paddingOf(context).top;
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    final dockClear = context.isApplePlatform ? bottomInset + 60 : 16.0;
    final l10n = context.l10n;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: CustomScrollView(
          slivers: [
            // ── Navy hero sign-in section ──────────────────────────────────
            SliverToBoxAdapter(
              child: _MoreHero(
                topInset: topInset,
                onLogin: () => context.push('/login'),
              ),
            ),

            // ── "What you unlock" benefit tiles ───────────────────────────
            const SliverToBoxAdapter(child: _BenefitStrip()),

            // ── Menu + footer ─────────────────────────────────────────────
            SliverPadding(
              padding: EdgeInsets.fromLTRB(
                  AppSpacing.lg, AppSpacing.lg, AppSpacing.lg, dockClear),
              sliver: SliverList.list(
                children: [
                  // ── General ─────────────────────────────────────────────
                  _SectionLabel(l10n.moreSectionGeneral),
                  const SizedBox(height: AppSpacing.sm),
                  _MenuGroup(
                    children: [
                      _MenuTile(
                        icon: AppIcons.chat,
                        gradient: const LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [Color(0xFF1E3A62), AppPalette.navy],
                        ),
                        label: l10n.homeAskAssistant,
                        subtitle: 'تحدّث مع مساعدنا الذكي',
                        onTap: () => context.push('/chat'),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xl),

                  // ── Settings ─────────────────────────────────────────────
                  _SectionLabel(l10n.accountSectionSettings),
                  const SizedBox(height: AppSpacing.sm),
                  _MenuGroup(
                    children: [
                      _MenuTile(
                        icon: Icons.translate_rounded,
                        gradient: const LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [Color(0xFFC99A2E), AppPalette.gold400],
                        ),
                        label: l10n.galleryToggleLanguage,
                        subtitle: 'العربية  ·  English',
                        onTap: () => context.read<LocaleCubit>().toggle(),
                        divider: true,
                      ),
                      _MenuTile(
                        icon: Icons.brightness_6_outlined,
                        gradient: const LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [Color(0xFF5C6B7A), Color(0xFF3A4D5C)],
                        ),
                        label: l10n.galleryToggleTheme,
                        subtitle:
                            '${l10n.settingsThemeLight}  ·  ${l10n.settingsThemeDark}  ·  ${l10n.settingsThemeSystem}',
                        onTap: () => context.read<ThemeCubit>().cycle(),
                        divider: false,
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xxl),

                  // ── Footer ────────────────────────────────────────────────
                  const _MoreFooter(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Navy hero
// ─────────────────────────────────────────────────────────────────────────────

class _MoreHero extends StatelessWidget {
  const _MoreHero({required this.topInset, required this.onLogin});
  final double topInset;
  final VoidCallback onLogin;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);

    return ClipRRect(
      borderRadius: const BorderRadius.only(
        bottomLeft: Radius.circular(AppRadii.xxl),
        bottomRight: Radius.circular(AppRadii.xxl),
      ),
      child: Stack(
        children: [
          // Base navy radial gradient
          Positioned.fill(
            child: DecoratedBox(
              decoration: const BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment(0.7, -0.9),
                  radius: 1.5,
                  colors: [_navyLight, _navyMid, _navyDeep],
                  stops: [0.0, 0.52, 1.0],
                ),
              ),
            ),
          ),
          // Gold bloom — top-end corner
          PositionedDirectional(
            top: 0,
            end: -24,
            child: Container(
              width: 200,
              height: 200,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [Color(0x2AC8A24B), Color(0x00C8A24B)],
                  stops: [0.0, 0.65],
                ),
              ),
            ),
          ),
          // Subtle second glow — bottom-start
          PositionedDirectional(
            bottom: -30,
            start: -40,
            child: Container(
              width: 160,
              height: 160,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [Color(0x18C8A24B), Color(0x00C8A24B)],
                  stops: [0.0, 0.7],
                ),
              ),
            ),
          ),
          // Content
          Padding(
            padding: EdgeInsets.fromLTRB(AppSpacing.xl,
                topInset + AppSpacing.lg, AppSpacing.xl, AppSpacing.xl),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                // Brand mark + eyebrow label
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const BrandMark(size: 46),
                    const SizedBox(width: AppSpacing.sm),
                    Text(
                      l10n.authEyebrow,
                      style: theme.textTheme.labelLarge?.copyWith(
                        color: AppPalette.gold300,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xxl),

                // Headline
                Text(
                  l10n.moreSignInTitle,
                  style: theme.textTheme.headlineMedium?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    height: 1.15,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),

                // Subtitle
                Text(
                  l10n.moreSignInSubtitle,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: Colors.white.withValues(alpha: 0.70),
                    height: 1.55,
                  ),
                ),
                const SizedBox(height: AppSpacing.xl),

                // Gold CTA button
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
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Benefits strip
// ─────────────────────────────────────────────────────────────────────────────

/// Three "what you unlock" tiles — a visual bridge from the navy hero to the
/// cream menu content below.
class _BenefitStrip extends StatelessWidget {
  const _BenefitStrip();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg, AppSpacing.lg, AppSpacing.lg, 0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: _BenefitTile(
              icon: Icons.favorite_rounded,
              label: 'احفظ مفضلاتك',
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFFC8A24B), AppPalette.gold400],
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: _BenefitTile(
              icon: Icons.compare_arrows_rounded,
              label: 'قارن الوحدات',
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF24426A), AppPalette.navy],
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: _BenefitTile(
              icon: Icons.timeline_rounded,
              label: 'تتبّع رحلتك',
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFFB07818), Color(0xFF8A5F10)],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BenefitTile extends StatelessWidget {
  const _BenefitTile({
    required this.icon,
    required this.label,
    required this.gradient,
  });

  final IconData icon;
  final String label;
  final Gradient gradient;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.symmetric(
          vertical: AppSpacing.md, horizontal: AppSpacing.xs),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(
          color: colors.hairline.withValues(alpha: 0.7),
        ),
        boxShadow: colors.shadowSoft,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 46,
            height: 46,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              gradient: gradient,
              borderRadius: BorderRadius.circular(AppRadii.sm),
            ),
            child: Icon(icon, size: 22, color: Colors.white),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 2,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: colors.inkStrong,
                  fontWeight: FontWeight.w700,
                  height: 1.35,
                ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Section label
// ─────────────────────────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsetsDirectional.only(start: AppSpacing.xs),
      child: Text(
        text,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: context.appColors.inkMuted,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8,
            ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Menu group + tile
// ─────────────────────────────────────────────────────────────────────────────

/// A grouped surface card wrapping related menu items. Dividers are drawn
/// between items (indented to clear the icon), not as full-width hairlines.
class _MenuGroup extends StatelessWidget {
  const _MenuGroup({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.7)),
        boxShadow: colors.shadowSoft,
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: children,
      ),
    );
  }
}

class _MenuTile extends StatelessWidget {
  const _MenuTile({
    required this.icon,
    required this.gradient,
    required this.label,
    required this.subtitle,
    required this.onTap,
    this.divider = false,
  });

  final IconData icon;
  final Gradient gradient;
  final String label;
  final String subtitle;
  final VoidCallback onTap;
  final bool divider;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.lg, vertical: AppSpacing.md),
              child: Row(
                children: [
                  // Icon container
                  Container(
                    width: 44,
                    height: 44,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      gradient: gradient,
                      borderRadius: BorderRadius.circular(AppRadii.sm),
                    ),
                    child: Icon(icon, size: 20, color: Colors.white),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  // Label + subtitle
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          label,
                          style: theme.textTheme.titleSmall?.copyWith(
                            color: colors.inkStrong,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          subtitle,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: colors.inkMuted,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  // Directional chevron
                  Icon(AppIcons.chevronForward,
                      size: 18, color: colors.inkMuted),
                ],
              ),
            ),
          ),
        ),
        if (divider)
          Padding(
            padding: EdgeInsetsDirectional.only(
              start: AppSpacing.lg + 44 + AppSpacing.md,
              end: AppSpacing.sm,
            ),
            child: Divider(
              height: 0.5,
              thickness: 0.5,
              color: colors.hairline,
            ),
          ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Footer
// ─────────────────────────────────────────────────────────────────────────────

class _MoreFooter extends StatelessWidget {
  const _MoreFooter();

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const BrandMark(size: 32),
        const SizedBox(height: AppSpacing.xs),
        Text(
          context.l10n.authEyebrow,
          style: const TextStyle(
            color: AppPalette.gold300,
            fontSize: 12,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: AppSpacing.xxs),
        Text(
          'v1.0.0',
          style: TextStyle(
            color: colors.inkMuted,
            fontSize: 11,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
      ],
    );
  }
}
