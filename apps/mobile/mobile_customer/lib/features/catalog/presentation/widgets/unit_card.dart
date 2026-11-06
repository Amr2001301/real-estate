import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../favorites/presentation/widgets/favorite_toggle_button.dart';
import '../../domain/entities/catalog_enums.dart';
import '../../domain/entities/unit.dart';
import '../compare/compare_cubit.dart';
import 'price_text.dart';
import 'glass.dart';
import 'unit_status_chip.dart';

/// A unit as the staff app shows it: the cover with its type, project and
/// status on it, then the rooms and area, and the price with the heart and
/// compare buttons.
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
      color: colors.surface,
      borderRadius: BorderRadius.circular(24),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: DecoratedBox(
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(24), border: Border.all(color: colors.hairline)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            CatalogCover(
              url: unit.coverImage,
              height: 150,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    if (unit.status != UnitStatus.unknown) CatalogBadge.status(unit.status.label(l10n), _statusColor(colors, unit.status)),
                    const Spacer(),
                    GlassCircle(child: FavoriteToggleButton(isProject: false, id: unit.id, dense: true)),
                    const SizedBox(width: 6),
                    GlassCircle(child: UnitCompareButton(unit: unit)),
                  ]),
                  const Spacer(),
                  Text(unit.typeLabel(lang), maxLines: 1, overflow: TextOverflow.ellipsis, style: homeDisplay(18, Colors.white)),
                  if (where.isNotEmpty)
                    Row(children: [
                      const Icon(Icons.apartment_rounded, size: 14, color: AppPalette.gold300),
                      const SizedBox(width: 3),
                      Expanded(
                        child: Text(where, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5, color: Color(0xFFDCE3EC))),
                      ),
                    ]),
                ]),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(13, 11, 13, 10),
              child: Wrap(spacing: 6, runSpacing: 6, children: [
                if (unit.bedrooms > 0) _Spec(Icons.bed_rounded, ltr('${unit.bedrooms}')),
                if (unit.bathrooms > 0) _Spec(Icons.bathtub_outlined, ltr('${unit.bathrooms}')),
                _Spec(Icons.square_foot_rounded, '${ltr('${unit.area}')} ${l10n.filterAreaUnit}'),
                _Spec(Icons.tag_rounded, ltr(unit.code)),
              ]),
            ),
            Container(
              padding: const EdgeInsets.fromLTRB(13, 9, 13, 10),
              decoration: BoxDecoration(
                color: colors.surfaceSoft.withValues(alpha: 0.6),
                border: Border(top: BorderSide(color: colors.hairline)),
              ),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(l10n.detailTotalPrice, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                    PriceText(unit.price, style: homeDisplay(18, AppPalette.gold600)),
                  ]),
                ),
                Icon(Icons.chevron_right_rounded, size: 22, color: colors.inkStrong),
              ]),
            ),
          ]),
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
