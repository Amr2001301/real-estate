import 'package:core/core.dart';
import 'package:flutter/material.dart';

/// Renders a project's free-form `services` (`[{ar,en}]`) as soft chips.
class AmenityChips extends StatelessWidget {
  const AmenityChips({super.key, required this.services});

  final List<Translatable> services;

  @override
  Widget build(BuildContext context) {
    final lang = Localizations.localeOf(context).languageCode;
    final colors = context.appColors;
    final labels = services
        .map((s) => s.resolve(lang))
        .where((s) => s.isNotEmpty)
        .toList();
    if (labels.isEmpty) return const SizedBox.shrink();

    return Wrap(
      spacing: AppSpacing.xs,
      runSpacing: AppSpacing.xs,
      children: [
        for (final label in labels)
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.sm,
              vertical: AppSpacing.xs,
            ),
            decoration: BoxDecoration(
              color: colors.surfaceSoft,
              borderRadius: AppRadii.pillAll,
              border: Border.all(color: colors.hairline),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.check_circle_outline_rounded,
                    size: 14, color: colors.brandGold),
                const SizedBox(width: AppSpacing.xxs),
                Text(label, style: Theme.of(context).textTheme.labelMedium),
              ],
            ),
          ),
      ],
    );
  }
}
