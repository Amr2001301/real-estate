import 'package:core/core.dart';
import 'package:flutter/material.dart';

/// Premium warm-luxe search pill for catalog screens: surface fill, hairline
/// border, soft shadow, an integrated search glyph and an inline clear button.
/// RTL-safe and dark-mode aware.
class CatalogSearchField extends StatelessWidget {
  const CatalogSearchField({
    super.key,
    required this.controller,
    required this.hint,
    this.onChanged,
    this.onSubmitted,
    this.onClear,
  });

  final TextEditingController controller;
  final String hint;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Container(
      height: 50,
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadii.pillAll,
        border: Border.all(color: colors.hairline),
        boxShadow: colors.shadowSoft,
      ),
      child: Row(
        children: [
          const SizedBox(width: AppSpacing.md),
          Icon(Icons.search_rounded, size: 20, color: colors.inkMuted),
          const SizedBox(width: AppSpacing.xs),
          Expanded(
            child: TextField(
              controller: controller,
              onChanged: onChanged,
              onSubmitted: onSubmitted,
              textInputAction: TextInputAction.search,
              style: theme.textTheme.bodyMedium,
              decoration: InputDecoration(
                isDense: true,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                contentPadding: EdgeInsets.zero,
                hintText: hint,
                hintStyle:
                    theme.textTheme.bodyMedium?.copyWith(color: colors.inkMuted),
              ),
            ),
          ),
          if (controller.text.isNotEmpty)
            IconButton(
              visualDensity: VisualDensity.compact,
              tooltip: MaterialLocalizations.of(context).cancelButtonLabel,
              icon: Icon(Icons.close_rounded, size: 18, color: colors.inkMuted),
              onPressed: onClear,
            ),
          const SizedBox(width: AppSpacing.xs),
        ],
      ),
    );
  }
}

/// Premium filter trigger that lives beside the search field. Compact square
/// (icon only) by default, or an expanded labelled bar when [label] is given
/// (used where there is no search field). Shows an active-filter count badge
/// and a gold-tinted edge when filters are applied.
class CatalogFilterButton extends StatelessWidget {
  const CatalogFilterButton({
    super.key,
    required this.activeCount,
    required this.onTap,
    this.label,
    this.tooltip,
  });

  final int activeCount;
  final VoidCallback onTap;
  final String? label;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    final active = activeCount > 0;
    final radius = BorderRadius.circular(AppRadii.lg);

    final content = Row(
      mainAxisSize: label == null ? MainAxisSize.min : MainAxisSize.max,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Badge(
          isLabelVisible: active,
          label: Text('$activeCount'),
          child: Icon(Icons.tune_rounded,
              size: 20, color: active ? colors.brandGold : colors.inkStrong),
        ),
        if (label != null) ...[
          const SizedBox(width: AppSpacing.sm),
          Text(
            label!,
            style: theme.textTheme.titleSmall?.copyWith(
              color: colors.inkStrong,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ],
    );

    return DecoratedBox(
      decoration: BoxDecoration(borderRadius: radius, boxShadow: colors.shadowSoft),
      child: Material(
        color: colors.surface,
        borderRadius: radius,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Container(
            height: 50,
            width: label == null ? 50 : double.infinity,
            padding: EdgeInsets.symmetric(
                horizontal: label == null ? 0 : AppSpacing.lg),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              borderRadius: radius,
              border: Border.all(
                color: active
                    ? colors.brandGold.withValues(alpha: 0.5)
                    : colors.hairline,
              ),
            ),
            child: content,
          ),
        ),
      ),
    );
  }
}
