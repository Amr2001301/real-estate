import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../../favorites/presentation/widgets/favorite_toggle_button.dart';
import '../../domain/entities/project.dart';
import 'glass.dart';

/// A project as the staff app shows it: the cover with its name and city on
/// it, then what is free and what it offers.
class ProjectCard extends StatelessWidget {
  const ProjectCard({super.key, required this.project, this.onTap, this.width, this.index = 0});

  final ProjectListItem project;
  final VoidCallback? onTap;

  /// Kept for the carousels; the list fills its parent.
  final double? width;
  final int index;

  @override
  Widget build(BuildContext context) {
    final lang = Localizations.localeOf(context).languageCode;
    final colors = context.appColors;
    final l10n = context.l10n;
    final name = project.name.resolve(lang).trim();
    final city = project.city.trim();
    final units = project.availableUnitsCount;
    final services = [for (final s in project.services) s.resolve(lang).trim()].where((s) => s.isNotEmpty).take(3).toList();
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
              url: project.coverImage,
              height: 168,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    if (project.featured) CatalogBadge.gold(l10n.featuredBadge, icon: Icons.star_rounded),
                    const Spacer(),
                    GlassCircle(child: FavoriteToggleButton(isProject: true, id: project.id, dense: true)),
                  ]),
                  const Spacer(),
                  Text(name.isNotEmpty ? name : (city.isNotEmpty ? city : '—'),
                      maxLines: 1, overflow: TextOverflow.ellipsis, style: homeDisplay(19, Colors.white)),
                  if (city.isNotEmpty)
                    Row(children: [
                      Icon(Icons.location_on_rounded, size: 14, color: AppPalette.gold300),
                      const SizedBox(width: 3),
                      Expanded(
                        child: Text(city, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5, color: Color(0xFFDCE3EC))),
                      ),
                    ]),
                ]),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(13, 11, 13, 12),
              child: Row(children: [
                Expanded(
                  child: Wrap(spacing: 6, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
                    if (units > 0)
                      CatalogBadge.status(l10n.availableUnitsCount(units), catalogAvailable, icon: Icons.apartment_rounded)
                    else
                      CatalogBadge.status(l10n.statusSold, colors.inkMuted),
                    for (final s in services)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                        decoration: BoxDecoration(color: colors.surfaceSoft, borderRadius: BorderRadius.circular(99)),
                        child: Text(s, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: colors.inkMuted)),
                      ),
                  ]),
                ),
                const SizedBox(width: 8),
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(color: colors.surfaceSoft, shape: BoxShape.circle),
                  // chevron_right points outward in both reading directions.
                  child: Icon(Icons.chevron_right_rounded, size: 22, color: colors.inkStrong),
                ),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}
