import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../favorites/presentation/widgets/favorite_toggle_button.dart';
import '../../domain/entities/catalog_enums.dart';
import '../../domain/entities/unit.dart';
import '../compare/compare_cubit.dart';
import 'price_text.dart';
import 'unit_status_chip.dart';

/// A unit in the staff app's list look: a small photo with its status, the
/// type and code, the project, the rooms and area, the price, and the heart
/// and compare buttons.
class UnitCard extends StatelessWidget {
  const UnitCard({super.key, required this.unit, this.onTap, this.width, this.index = 0});

  final Unit unit;
  final VoidCallback? onTap;

  /// Kept for the carousels; the list fills its parent.
  final double? width;
  final int index;

  Color _statusColor(AppColorsExt c, UnitStatus s) => switch (s) {
        UnitStatus.available => catalogAvailable,
        UnitStatus.reserved => catalogReserved,
        _ => c.inkMuted,
      };

  @override
  Widget build(BuildContext context) {
    final lang = Localizations.localeOf(context).languageCode;
    final colors = context.appColors;
    final l10n = context.l10n;
    final projectName = unit.project?.name.resolve(lang).trim() ?? '';
    final where = [if (projectName.isNotEmpty) projectName, if (unit.floor != null) '${l10n.labelFloor} ${unit.floor}'].join(' · ');
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: homeCard(context, radius: 22),
          child: IntrinsicHeight(
            child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              SizedBox(
                width: 96,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: Stack(fit: StackFit.expand, children: [
                    AppNetworkImage(url: unit.coverImage),
                    if (unit.status != UnitStatus.unknown)
                      PositionedDirectional(
                        top: 6,
                        start: 6,
                        child: CatalogBadge.status(unit.status.label(l10n), _statusColor(colors, unit.status)),
                      ),
                  ]),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text(unit.typeLabel(lang), maxLines: 1, overflow: TextOverflow.ellipsis, style: homeDisplay(16, colors.inkStrong))),
                    const SizedBox(width: 6),
                    Text(ltr(unit.code), style: TextStyle(fontSize: 12.5, color: colors.inkMuted)),
                  ]),
                  if (where.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(where, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, color: colors.inkMuted)),
                  ],
                  const SizedBox(height: 6),
                  Wrap(spacing: 6, runSpacing: 4, children: [
                    if (unit.bedrooms > 0) _Spec(Icons.bed_rounded, ltr('${unit.bedrooms}')),
                    if (unit.bathrooms > 0) _Spec(Icons.bathtub_outlined, ltr('${unit.bathrooms}')),
                    _Spec(Icons.square_foot_rounded, '${ltr('${unit.area}')} ${l10n.filterAreaUnit}'),
                  ]),
                  const Spacer(),
                  Row(children: [
                    Expanded(child: PriceText(unit.price, style: homeDisplay(16, colors.inkStrong))),
                    FavoriteToggleButton(isProject: false, id: unit.id, dense: true),
                    UnitCompareButton(unit: unit),
                  ]),
                ]),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

class _Spec extends StatelessWidget {
  const _Spec(this.icon, this.text);
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
        decoration: BoxDecoration(
          color: homeTint(context),
          border: Border.all(color: homeTintBorder(context)),
          borderRadius: BorderRadius.circular(99),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 14, color: AppPalette.gold600),
          const SizedBox(width: 4),
          Text(text, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: context.appColors.inkStrong)),
        ]),
      );
}

/// Compare toggle (local [CompareCubit]); compact for the on-image glass circle.
class UnitCompareButton extends StatelessWidget {
  const UnitCompareButton({super.key, required this.unit});
  final Unit unit;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final l10n = context.l10n;
    return BlocBuilder<CompareCubit, List<Unit>>(
      builder: (context, units) {
        final inCompare = units.any((u) => u.id == unit.id);
        return IconButton(
          iconSize: 19,
          padding: EdgeInsets.zero,
          visualDensity: VisualDensity.compact,
          constraints: const BoxConstraints.tightFor(width: 38, height: 38),
          tooltip: l10n.compareTitle,
          icon: Icon(
            inCompare
                ? Icons.check_circle_rounded
                : Icons.compare_arrows_rounded,
            color: inCompare ? colors.brandGold : null,
          ),
          onPressed: () {
            final result = context.read<CompareCubit>().toggle(unit);
            if (result == CompareToggle.full) {
              ScaffoldMessenger.of(context)
                ..hideCurrentSnackBar()
                ..showSnackBar(SnackBar(
                  content: Text(l10n.compareFull(CompareCubit.maxItems)),
                ));
            }
          },
        );
      },
    );
  }
}
