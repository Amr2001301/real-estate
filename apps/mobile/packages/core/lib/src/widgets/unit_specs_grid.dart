import 'package:flutter/material.dart';

import '../common/unit_specs.dart';
import '../design/theme/app_theme_ext.dart';
import '../design/tokens/app_colors.dart';
import '../design/tokens/app_radii.dart';
import '../design/tokens/app_spacing.dart';
import '../l10n/l10n.dart';

String unitFinishingLabel(AppLocalizations l10n, String v) => switch (v) {
      'CORE_AND_SHELL' => l10n.unitFinishingCoreShell,
      'SEMI_FINISHED' => l10n.unitFinishingSemi,
      'FULLY_FINISHED' => l10n.unitFinishingFull,
      'FURNISHED' => l10n.unitFinishingFurnished,
      _ => v,
    };

String unitViewLabel(AppLocalizations l10n, String v) => switch (v) {
      'GARDEN' => l10n.unitViewGarden,
      'POOL' => l10n.unitViewPool,
      'LAGOON' => l10n.unitViewLagoon,
      'SEA' => l10n.unitViewSea,
      'NILE' => l10n.unitViewNile,
      'CLUB' => l10n.unitViewClub,
      'LANDSCAPE' => l10n.unitViewLandscape,
      'MAIN_STREET' => l10n.unitViewMainStreet,
      'SIDE_STREET' => l10n.unitViewSideStreet,
      _ => v,
    };

String unitOrientationLabel(AppLocalizations l10n, String v) => switch (v) {
      'NORTH' => l10n.unitOrientationNorth,
      'SOUTH' => l10n.unitOrientationSouth,
      'EAST' => l10n.unitOrientationEast,
      'WEST' => l10n.unitOrientationWest,
      'NORTH_EAST' => l10n.unitOrientationNorthEast,
      'NORTH_WEST' => l10n.unitOrientationNorthWest,
      'SOUTH_EAST' => l10n.unitOrientationSouthEast,
      'SOUTH_WEST' => l10n.unitOrientationSouthWest,
      _ => v,
    };

const _monthsAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const _monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/// The handover as the website says it: «استلام فوري» once due, else the
/// month and year ("يونيو 2027").
String unitDeliveryLabel(AppLocalizations l10n, DateTime day, String lang, {DateTime? now}) {
  final today = now ?? DateTime.now();
  if (!day.isAfter(DateTime.utc(today.year, today.month, today.day))) return l10n.unitDeliveryNow;
  return '${(lang == 'ar' ? _monthsAr : _monthsEn)[day.month - 1]} ${day.year}';
}

String _area(AppLocalizations l10n, num v) =>
    l10n.unitAreaValue(v == v.roundToDouble() ? v.toInt().toString() : v.toStringAsFixed(1));

/// One spec: its label and value, with an icon.
class UnitSpecItem {
  const UnitSpecItem(this.icon, this.label, this.value);
  final IconData icon;
  final String label;
  final String value;
}

/// The specs a unit has, in the website's order.
List<UnitSpecItem> unitSpecItems(UnitSpecs s, AppLocalizations l10n, String lang, {DateTime? now}) => [
      if (s.netArea != null) UnitSpecItem(Icons.square_foot_rounded, l10n.unitSpecNetArea, _area(l10n, s.netArea!)),
      if (s.gardenArea != null) UnitSpecItem(Icons.park_outlined, l10n.unitSpecGarden, _area(l10n, s.gardenArea!)),
      if (s.roofArea != null) UnitSpecItem(Icons.roofing_rounded, l10n.unitSpecRoof, _area(l10n, s.roofArea!)),
      if (s.terraceArea != null) UnitSpecItem(Icons.deck_outlined, l10n.unitSpecTerrace, _area(l10n, s.terraceArea!)),
      if (s.landArea != null) UnitSpecItem(Icons.landscape_outlined, l10n.unitSpecLand, _area(l10n, s.landArea!)),
      if (s.finishing != null) UnitSpecItem(Icons.format_paint_outlined, l10n.unitSpecFinishing, unitFinishingLabel(l10n, s.finishing!)),
      if (s.view != null) UnitSpecItem(Icons.visibility_outlined, l10n.unitSpecView, unitViewLabel(l10n, s.view!)),
      if (s.orientation != null)
        UnitSpecItem(Icons.explore_outlined, l10n.unitSpecOrientation, unitOrientationLabel(l10n, s.orientation!)),
      if (s.deliveryDate != null)
        UnitSpecItem(Icons.event_available_outlined, l10n.unitSpecDelivery, unitDeliveryLabel(l10n, s.deliveryDate!, lang, now: now)),
    ];

/// A two-column grid of the unit's specs (only those it has); nothing when
/// it has none.
class UnitSpecsGrid extends StatelessWidget {
  const UnitSpecsGrid({super.key, required this.specs, this.now});
  final UnitSpecs specs;
  final DateTime? now;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    final items = unitSpecItems(specs, l10n, lang, now: now);
    if (items.isEmpty) return const SizedBox.shrink();
    final c = context.appColors;
    return LayoutBuilder(
      builder: (context, box) {
        final w = (box.maxWidth - AppSpacing.sm) / 2;
        return Wrap(
          key: const Key('unit-specs'),
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            for (final it in items)
              SizedBox(
                width: w,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: c.surface,
                    borderRadius: BorderRadius.circular(AppRadii.md),
                    border: Border.all(color: c.hairline),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          color: AppPalette.gold400.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(AppRadii.sm),
                        ),
                        child: Icon(it.icon, size: 17, color: AppPalette.gold600),
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(it.label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: c.inkMuted)),
                            const SizedBox(height: 2),
                            Text(
                              it.value,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: c.inkStrong),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}
