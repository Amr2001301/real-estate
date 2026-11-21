import 'package:flutter/material.dart';

import '../design/theme/app_theme_ext.dart';
import '../design/tokens/app_colors.dart';
import '../design/tokens/app_radii.dart';
import '../design/tokens/app_spacing.dart';

/// One numbered step of a form: a card with a gold top line, a title and a
/// subtitle, the step number in a gold square, then the fields. Every create
/// form in the staff app (lead, reservation, visit, activity, and the broker's
/// lead and reservation) is built from these, so they look the same.
class AppFormSection extends StatelessWidget {
  const AppFormSection({
    super.key,
    required this.step,
    required this.title,
    required this.subtitle,
    required this.child,
  });

  /// Shown as is, e.g. `'01'`.
  final String step;
  final String title;
  final String subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    // Devora: the title above a plain white card, no number, no gold line.
    if (AppPalette.calmLight) {
      return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 4, 4, 10),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: TextStyle(fontSize: 17, height: 1.4, fontWeight: FontWeight.w700, color: colors.inkStrong)),
            if (subtitle.isNotEmpty) Text(subtitle, style: TextStyle(fontSize: 12.5, height: 1.5, color: colors.inkMuted)),
          ]),
        ),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: colors.hairline),
            boxShadow: const [BoxShadow(color: Color(0x0A0B1426), blurRadius: 18, offset: Offset(0, 6))],
          ),
          child: child,
        ),
      ]);
    }

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.xl),
        border: Border.all(color: colors.hairline),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 2,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  AppPalette.gold400.withValues(alpha: 0.00),
                  AppPalette.gold400,
                  AppPalette.gold300,
                  AppPalette.gold400.withValues(alpha: 0.00),
                ],
              ),
              borderRadius:
                  BorderRadius.vertical(top: Radius.circular(AppRadii.xl)),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w800,
                              color: colors.inkStrong,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            subtitle,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: colors.inkMuted,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [AppPalette.gold300, AppPalette.gold500],
                        ),
                        borderRadius: BorderRadius.circular(AppRadii.md),
                      ),
                      child: Center(
                        child: Text(
                          step,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.lg),
                const Divider(height: 1),
                const SizedBox(height: AppSpacing.lg),
                child,
              ],
            ),
          ),
        ],
      ),
    );
  }
}
