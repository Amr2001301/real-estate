import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../design/theme/app_theme_ext.dart';
import '../design/tokens/app_icons.dart';
import '../design/tokens/app_spacing.dart';
import '../env/app_environment.dart';
import '../env/env_config.dart';
import '../error/app_failure.dart';
import '../error/error_presenter.dart';
import '../error/failure_type.dart';
import '../l10n/l10n.dart';
import '../theme/theme_mode_controller.dart';
import '../widgets/app_button.dart';
import '../widgets/app_card.dart';
import '../widgets/app_skeleton.dart';
import '../widgets/app_text_field.dart';
import '../widgets/app_tone.dart';
import '../widgets/empty_state.dart';
import '../widgets/error_state.dart';
import '../widgets/gradient_avatar.dart';
import '../widgets/icon_chip.dart';
import '../widgets/premium_card.dart';
import '../widgets/section_header.dart';
import '../widgets/status_badge.dart';
import '../widgets/summary_tile.dart';

/// A living style guide. Both apps route to it (`/gallery`) to visually verify
/// the design system across light/dark, Arabic-RTL/English-LTR, the skeleton
/// loading effect, every shared widget, and the error/empty states.
class ComponentGalleryScreen extends StatefulWidget {
  const ComponentGalleryScreen({super.key});

  @override
  State<ComponentGalleryScreen> createState() => _ComponentGalleryScreenState();
}

class _ComponentGalleryScreenState extends State<ComponentGalleryScreen> {
  bool _skeletonOn = false;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.galleryTitle),
        actions: [
          IconButton(
            tooltip: l10n.galleryToggleLanguage,
            icon: const Icon(Icons.translate_rounded),
            onPressed: () => context.read<LocaleCubit>().toggle(),
          ),
          IconButton(
            tooltip: l10n.galleryToggleTheme,
            icon: const Icon(Icons.brightness_6_outlined),
            onPressed: () => context.read<ThemeCubit>().cycle(),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          _envBanner(context),
          const SizedBox(height: AppSpacing.lg),

          _section(context, l10n.gallerySectionButtons),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              AppButton(label: l10n.actionContinue, onPressed: () {}),
              AppButton(
                label: l10n.actionLogin,
                variant: AppButtonVariant.gold,
                icon: Icons.login_rounded,
                onPressed: () {},
              ),
              AppButton(
                label: l10n.actionSearch,
                variant: AppButtonVariant.outline,
                onPressed: () {},
              ),
              AppButton(
                label: l10n.actionViewMore,
                variant: AppButtonVariant.ghost,
                onPressed: () {},
              ),
              const AppButton(label: 'Loading', isLoading: true),
              const AppButton(label: 'Disabled', onPressed: null),
            ],
          ),
          const SizedBox(height: AppSpacing.xl),

          _section(context, l10n.gallerySectionInputs),
          AppTextField(
            label: l10n.galleryInputLabel,
            hint: l10n.galleryInputHint,
            prefixIcon: Icons.person_outline_rounded,
          ),
          const SizedBox(height: AppSpacing.md),
          AppTextField(
            label: l10n.galleryInputLabel,
            hint: l10n.galleryInputHint,
            errorText: l10n.galleryInputError,
          ),
          const SizedBox(height: AppSpacing.xl),

          _section(context, l10n.gallerySectionCards),
          _sampleCard(context),
          const SizedBox(height: AppSpacing.xl),

          _section(context, l10n.gallerySectionBadges),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: const [
              StatusBadge(label: 'NEW', tone: BadgeTone.gold),
              StatusBadge(label: 'WON', tone: BadgeTone.success, dot: true),
              StatusBadge(label: 'PENDING', tone: BadgeTone.warning),
              StatusBadge(label: 'LOST', tone: BadgeTone.error),
              StatusBadge(
                label: 'NAVY',
                tone: BadgeTone.navy,
                variant: BadgeVariant.solid,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xl),

          // ── Phase A premium widgets ─────────────────────────────────────
          _section(context, 'Icon chips'),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: const [
              IconChip(icon: AppIcons.property),
              IconChip(icon: AppIcons.wallet, filled: true),
              IconChip(icon: AppIcons.maintenance, tone: AppTone.navy),
              IconChip(icon: AppIcons.contract, tone: AppTone.success),
              IconChip(icon: AppIcons.visit, tone: AppTone.warning),
              IconChip(icon: AppIcons.notification, tone: AppTone.error),
              IconChip(icon: AppIcons.document, tone: AppTone.muted),
              IconChip(icon: AppIcons.favorite, size: IconChipSize.sm),
              IconChip(icon: AppIcons.profile, size: IconChipSize.lg),
            ],
          ),
          const SizedBox(height: AppSpacing.xl),

          _section(context, 'Gradient avatar'),
          const Row(
            children: [
              GradientAvatar(name: 'Amr Tarek'),
              SizedBox(width: AppSpacing.lg),
              Expanded(
                child: GradientAvatar.identity(
                  name: 'Amr Tarek',
                  role: 'عميل / مالك وحدة',
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xl),

          _section(context, 'Section header'),
          AppSectionHeader(
            eyebrow: 'نظرة عامة',
            title: 'حسابي',
            subtitle: 'ملخص سريع لعقاراتك ومدفوعاتك.',
            action: AppButton(
              label: l10n.actionViewMore,
              size: AppButtonSize.small,
              variant: AppButtonVariant.ghost,
              onPressed: () {},
            ),
          ),
          const SizedBox(height: AppSpacing.xl),

          _section(context, 'Premium cards (accent rail + glow)'),
          PremiumCard(
            accentRail: AppTone.gold,
            glow: true,
            onTap: () {},
            child: _railCardBody(context, 'حجز رقم 1024', AppIcons.property),
          ),
          const SizedBox(height: AppSpacing.sm),
          PremiumCard(
            accentRail: AppTone.success,
            onTap: () {},
            child: _railCardBody(context, 'عقد موقّع', AppIcons.contract),
          ),
          const SizedBox(height: AppSpacing.sm),
          PremiumCard(
            accentRail: AppTone.error,
            child: _railCardBody(context, 'دفعة متأخرة', AppIcons.wallet),
          ),
          const SizedBox(height: AppSpacing.xl),

          _section(context, 'Summary tiles'),
          Row(
            children: [
              Expanded(
                child: SummaryTile(
                  icon: AppIcons.property,
                  value: '3',
                  label: 'عقاراتي',
                  onTap: () {},
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: SummaryTile(
                  icon: AppIcons.installments,
                  value: '12,500',
                  label: 'القسط القادم',
                  subtitle: 'خلال ٧ أيام',
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              const Expanded(
                child: SummaryTile(
                  icon: AppIcons.maintenance,
                  value: '0',
                  label: 'طلبات الصيانة',
                  loading: true,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xl),

          _section(context, l10n.gallerySectionSkeleton),
          SwitchListTile.adaptive(
            value: _skeletonOn,
            onChanged: (v) => setState(() => _skeletonOn = v),
            title: Text(l10n.gallerySectionSkeleton),
            contentPadding: EdgeInsets.zero,
            activeThumbColor: colors.brandGold,
          ),
          AppSkeletonizer(
            enabled: _skeletonOn,
            child: Column(children: [_sampleCard(context)]),
          ),
          const SizedBox(height: AppSpacing.xl),

          _section(context, l10n.gallerySectionStates),
          // Error state (full-screen style) with a retryable sample failure.
          AppCard(
            elevation: AppCardElevation.none,
            child: SizedBox(
              height: 220,
              child: ErrorState(
                failure: AppFailure(type: FailureType.network),
                onRetry: () {},
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          // Empty state — semantically different from an error.
          AppCard(
            elevation: AppCardElevation.none,
            child: SizedBox(
              height: 200,
              child: EmptyState(
                action: AppButton(
                  label: l10n.actionViewMore,
                  size: AppButtonSize.small,
                  variant: AppButtonVariant.outline,
                  onPressed: () {},
                ),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          // Action-level failure → localized SnackBar with retry.
          AppButton(
            label: 'Show error toast',
            icon: Icons.warning_amber_rounded,
            variant: AppButtonVariant.outline,
            onPressed: () => showFailureSnackBar(
              context,
              AppFailure(type: FailureType.timeout),
              onRetry: () {},
            ),
          ),
          const SizedBox(height: AppSpacing.xxl),
        ],
      ),
    );
  }

  Widget _section(BuildContext context, String title) => Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.sm),
        child: Text(title, style: Theme.of(context).textTheme.titleMedium),
      );

  /// Sample body for the PremiumCard accent-rail demo: an icon chip, a title,
  /// a muted line, and a status badge — the shape account cards will take.
  Widget _railCardBody(BuildContext context, String title, IconData icon) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Row(
      children: [
        IconChip(icon: icon, size: IconChipSize.md),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                title,
                style: theme.textTheme.titleSmall
                    ?.copyWith(color: colors.inkStrong),
              ),
              const SizedBox(height: AppSpacing.xxs),
              Text(
                'سولارا هايتس — شقة ثلاث غرف',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: colors.inkMuted),
              ),
            ],
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        const StatusBadge(label: 'نشط', tone: BadgeTone.gold),
      ],
    );
  }

  Widget _envBanner(BuildContext context) {
    final colors = context.appColors;
    final mode = context.watch<ThemeCubit>().state;
    final locale = context.watch<LocaleCubit>().state;
    return AppCard(
      elevation: AppCardElevation.soft,
      child: Row(
        children: [
          Icon(Icons.tune_rounded, color: colors.brandGold),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              'ENV ${EnvConfig.current.environment.label}  ·  '
              'theme ${mode.name}  ·  locale ${locale.languageCode}',
              style: Theme.of(context).textTheme.labelMedium,
            ),
          ),
        ],
      ),
    );
  }

  Widget _sampleCard(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    return AppCard(
      padding: EdgeInsets.zero,
      elevation: AppCardElevation.card,
      onTap: () {},
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 140,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [colors.brandNavy, colors.brandGold],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: const Align(
              alignment: AlignmentDirectional.topEnd,
              child: Padding(
                padding: EdgeInsets.all(AppSpacing.sm),
                child: StatusBadge(
                  label: 'FEATURED',
                  tone: BadgeTone.gold,
                  variant: BadgeVariant.solid,
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l10n.gallerySampleCardTitle, style: theme.textTheme.titleLarge),
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  l10n.gallerySampleCardSubtitle,
                  style: theme.textTheme.bodyMedium
                      ?.copyWith(color: colors.inkMuted),
                ),
                const SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    _spec(context, Icons.bed_outlined, '3'),
                    _spec(context, Icons.bathtub_outlined, '2'),
                    _spec(context, Icons.square_foot_outlined, '180 m²'),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  l10n.gallerySampleCardPrice,
                  style: theme.textTheme.titleMedium
                      ?.copyWith(color: colors.brandGold),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _spec(BuildContext context, IconData icon, String value) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsetsDirectional.only(end: AppSpacing.md),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: colors.inkMuted),
          const SizedBox(width: AppSpacing.xxs),
          Text(value, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}
