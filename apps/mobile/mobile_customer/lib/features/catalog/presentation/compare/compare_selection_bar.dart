import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/unit.dart';
import '../widgets/glass.dart';
import 'compare_cubit.dart';

/// Sticky navy/gold compare action dock shown at the bottom of the Units tab
/// whenever ≥1 unit is selected for comparison. Self-hides when the selection
/// is empty. Place it as a bottom-anchored child of a [Stack]; it lifts itself
/// clear of the iOS floating nav dock (and sits just above the in-slot Android
/// bar). "قارن الآن" is disabled until ≥2 units are selected.
class CompareSelectionBar extends StatelessWidget {
  const CompareSelectionBar({super.key, required this.onCompare});

  /// Invoked by "قارن الآن" — switches to the Compare tab.
  final VoidCallback onCompare;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<CompareCubit, List<Unit>>(
      builder: (context, units) {
        if (units.isEmpty) return const SizedBox.shrink();
        final l10n = context.l10n;
        final colors = context.appColors;
        final count = units.length;
        final canCompare = count >= CompareCubit.minToCompare;

        // Clear the iOS floating dock (≈ inset + 66 tall); on Android the
        // in-slot bar sits below the body, so only a small gap is needed.
        final lift = context.isApplePlatform
            ? MediaQuery.paddingOf(context).bottom + 72
            : AppSpacing.sm;

        return Padding(
          padding: EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.xs,
            AppSpacing.lg,
            lift,
          ),
          child: DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadii.xl),
              boxShadow: colors.shadowLift,
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(AppRadii.xl),
              child: Stack(
                children: [
                  const Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [AppPalette.navy700, AppPalette.navy],
                        ),
                      ),
                    ),
                  ),
                  const Positioned(
                    top: 0,
                    left: AppSpacing.xl,
                    right: AppSpacing.xl,
                    child: GoldHairline(),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.md,
                      AppSpacing.sm,
                      AppSpacing.md,
                      AppSpacing.sm,
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            // Count + (when only one) a gentle helper line.
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    l10n.compareSelectedCount(
                                      count,
                                      CompareCubit.maxItems,
                                    ),
                                    style: Theme.of(context)
                                        .textTheme
                                        .titleMedium
                                        ?.copyWith(
                                          color: Colors.white,
                                          fontWeight: FontWeight.w800,
                                        ),
                                  ),
                                  if (!canCompare) ...[
                                    const SizedBox(height: 2),
                                    Text(
                                      l10n.compareNeedMore,
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodySmall
                                          ?.copyWith(
                                            color: AppPalette.gold200,
                                          ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            _ClearAction(
                              label: l10n.clearFilters,
                              onTap: () =>
                                  context.read<CompareCubit>().clear(),
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            AppButton(
                              label: l10n.compareNow,
                              icon: Icons.compare_arrows_rounded,
                              variant: AppButtonVariant.gold,
                              size: AppButtonSize.medium,
                              onPressed: canCompare ? onCompare : null,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

/// A small white-on-navy "مسح" text action for the compare dock.
class _ClearAction extends StatelessWidget {
  const _ClearAction({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.10),
      shape: StadiumBorder(
        side: BorderSide(color: Colors.white.withValues(alpha: 0.45)),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: 10,
          ),
          child: Text(
            label,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ),
      ),
    );
  }
}
