import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../../favorites/presentation/widgets/favorite_toggle_button.dart';
import '../../domain/entities/project.dart';

/// A project in the staff app's list look: a small photo beside the name, the
/// city and how many units are free, with the favourite heart.
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
                width: 104,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: Stack(fit: StackFit.expand, children: [
                    AppNetworkImage(url: project.coverImage),
                    if (project.featured)
                      PositionedDirectional(top: 6, start: 6, child: CatalogBadge.gold(l10n.featuredBadge, icon: Icons.star_rounded)),
                  ]),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(name.isNotEmpty ? name : (city.isNotEmpty ? city : '—'),
                      maxLines: 2, overflow: TextOverflow.ellipsis, style: homeDisplay(17, colors.inkStrong)),
                  if (city.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Row(children: [
                      Icon(Icons.location_on_rounded, size: 14, color: AppPalette.gold600),
                      const SizedBox(width: 3),
                      Flexible(child: Text(city, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, color: colors.inkMuted))),
                    ]),
                  ],
                  const Spacer(),
                  Row(children: [
                    if (units > 0)
                      CatalogBadge.status(l10n.availableUnitsCount(units), catalogAvailable, icon: Icons.apartment_rounded)
                    else
                      CatalogBadge.status(l10n.statusSold, colors.inkMuted),
                    const Spacer(),
                    FavoriteToggleButton(isProject: true, id: project.id, dense: true),
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
