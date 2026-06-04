import 'package:flutter/material.dart';

import '../design/theme/app_theme_ext.dart';
import '../design/tokens/app_spacing.dart';
import 'app_skeleton.dart';
import 'app_tone.dart';
import 'icon_chip.dart';
import 'premium_card.dart';

/// A KPI / overview tile for the account dashboard: a gold [IconChip], a large
/// value, a label, and an optional subtitle — wrapped in a glowing
/// [PremiumCard]. Mirrors the website's SummaryTile.
///
/// When [loading] is true the content is rendered as shimmering bones via
/// [AppSkeletonizer] (placeholder strings keep the layout identical).
class SummaryTile extends StatelessWidget {
  const SummaryTile({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    this.subtitle,
    this.tone = AppTone.gold,
    this.onTap,
    this.loading = false,
  });

  final IconData icon;
  final String label;
  final String value;
  final String? subtitle;
  final AppTone tone;
  final VoidCallback? onTap;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    final content = Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        IconChip(icon: icon, tone: tone, size: IconChipSize.lg, filled: true),
        const SizedBox(height: AppSpacing.sm),
        Text(
          loading ? '0000' : value,
          textAlign: TextAlign.center,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: theme.textTheme.headlineMedium?.copyWith(
            color: colors.inkStrong,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: AppSpacing.xxs),
        Text(
          loading ? 'Placeholder' : label,
          textAlign: TextAlign.center,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: AppSpacing.xxs),
          Text(
            loading ? '—' : subtitle!,
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.labelSmall?.copyWith(color: colors.brandGold),
          ),
        ],
      ],
    );

    return PremiumCard(
      onTap: loading ? null : onTap,
      glow: true,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.lg,
      ),
      child: AppSkeletonizer(
        enabled: loading,
        child: Center(child: content),
      ),
    );
  }
}
