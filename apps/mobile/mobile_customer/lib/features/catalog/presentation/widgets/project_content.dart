import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../domain/entities/project_content.dart';

/// The project page content from the dashboard: sections and FAQ as
/// expandable cards, amenities as icon tiles split inside / around, and the
/// construction progress by stage.

// ─────────────────────────────────────────────────────────────────────────────
// Amenity icons — one Material icon per key of the shared list
// (packages/shared-types/src/project-details.ts AMENITY_ICONS).
// ─────────────────────────────────────────────────────────────────────────────

const Map<String, IconData> amenityIcons = {
  'pool': Icons.pool_rounded,
  'gym': Icons.fitness_center_rounded,
  'garden': Icons.yard_rounded,
  'park': Icons.park_rounded,
  'tree': Icons.forest_rounded,
  'playground': Icons.toys_rounded,
  'kids': Icons.child_friendly_rounded,
  'security': Icons.security_rounded,
  'cctv': Icons.videocam_rounded,
  'parking': Icons.local_parking_rounded,
  'elevator': Icons.elevator_rounded,
  'clubhouse': Icons.holiday_village_rounded,
  'mall': Icons.local_mall_rounded,
  'shop': Icons.storefront_rounded,
  'restaurant': Icons.restaurant_rounded,
  'cafe': Icons.local_cafe_rounded,
  'mosque': Icons.mosque_rounded,
  'church': Icons.church_rounded,
  'school': Icons.school_rounded,
  'university': Icons.account_balance_rounded,
  'hospital': Icons.local_hospital_rounded,
  'clinic': Icons.medical_services_rounded,
  'pharmacy': Icons.local_pharmacy_rounded,
  'bank': Icons.savings_rounded,
  'sea': Icons.waves_rounded,
  'lake': Icons.water_rounded,
  'view': Icons.landscape_rounded,
  'jogging': Icons.directions_run_rounded,
  'bike': Icons.directions_bike_rounded,
  'sports': Icons.sports_basketball_rounded,
  'tennis': Icons.sports_tennis_rounded,
  'football': Icons.sports_soccer_rounded,
  'spa': Icons.spa_rounded,
  'wifi': Icons.wifi_rounded,
  'solar': Icons.solar_power_rounded,
  'smart-home': Icons.settings_remote_rounded,
  'generator': Icons.bolt_rounded,
  'hotel': Icons.hotel_rounded,
  'office': Icons.business_center_rounded,
  'metro': Icons.subway_rounded,
  'road': Icons.add_road_rounded,
  'airport': Icons.flight_rounded,
  'location': Icons.place_rounded,
  'building': Icons.apartment_rounded,
  'star': Icons.star_rounded,
  'check': Icons.check_rounded,
};

IconData amenityIcon(String key) => amenityIcons[key] ?? Icons.check_rounded;

// ─────────────────────────────────────────────────────────────────────────────
// Sections and FAQ — titled text that opens on tap
// ─────────────────────────────────────────────────────────────────────────────

/// Expandable cards of (title, body); empty pairs are left out by the caller.
class ProjectExpandableList extends StatelessWidget {
  const ProjectExpandableList({super.key, required this.items, this.openFirst = true});

  final List<(String, String)> items;
  final bool openFirst;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Column(
      children: [
        for (final (i, (title, body)) in items.indexed)
          Padding(
            padding: EdgeInsets.only(bottom: i == items.length - 1 ? 0 : AppSpacing.sm),
            child: Container(
              decoration: BoxDecoration(
                color: colors.surface,
                borderRadius: BorderRadius.circular(AppRadii.lg),
                border: Border.all(color: colors.hairline.withValues(alpha: 0.6)),
              ),
              clipBehavior: Clip.antiAlias,
              child: Theme(
                data: theme.copyWith(dividerColor: Colors.transparent),
                child: ExpansionTile(
                  initiallyExpanded: openFirst && i == 0,
                  tilePadding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                  childrenPadding: const EdgeInsets.fromLTRB(AppSpacing.md, 0, AppSpacing.md, AppSpacing.md),
                  iconColor: colors.brandGold,
                  collapsedIconColor: colors.inkMuted,
                  expandedAlignment: AlignmentDirectional.centerStart,
                  title: Text(title, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700, color: colors.inkStrong)),
                  children: [
                    Text(body, style: theme.textTheme.bodyMedium?.copyWith(color: colors.ink, height: 1.75)),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Amenities — icon tiles, with inside / around tabs when both exist
// ─────────────────────────────────────────────────────────────────────────────

class AmenityGrid extends StatefulWidget {
  const AmenityGrid({super.key, required this.amenities});

  final List<ProjectAmenity> amenities;

  @override
  State<AmenityGrid> createState() => _AmenityGridState();
}

class _AmenityGridState extends State<AmenityGrid> {
  AmenityGroup _group = AmenityGroup.inside;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final colors = context.appColors;
    final named = widget.amenities.where((a) => a.name.resolve(lang).isNotEmpty).toList();
    final inside = named.where((a) => a.group == AmenityGroup.inside).toList();
    final around = named.where((a) => a.group == AmenityGroup.around).toList();
    final both = inside.isNotEmpty && around.isNotEmpty;
    final shown = !both ? named : (_group == AmenityGroup.inside ? inside : around);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (both) ...[
          Wrap(spacing: AppSpacing.xs, children: [
            for (final (g, label, n) in [
              (AmenityGroup.inside, l10n.amenityGroupInside, inside.length),
              (AmenityGroup.around, l10n.amenityGroupAround, around.length),
            ])
              ChoiceChip(
                key: Key('amenity-group-${g.name}'),
                label: Text('$label · $n'),
                selected: _group == g,
                onSelected: (_) => setState(() => _group = g),
                showCheckmark: false,
                selectedColor: colors.brandGold.withValues(alpha: 0.18),
                side: BorderSide(color: _group == g ? colors.brandGold : colors.hairline),
                labelStyle: TextStyle(fontWeight: FontWeight.w700, color: _group == g ? colors.inkStrong : colors.inkMuted),
              ),
          ]),
          const SizedBox(height: AppSpacing.md),
        ],
        GridView.count(
          crossAxisCount: 3,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: AppSpacing.sm,
          crossAxisSpacing: AppSpacing.sm,
          childAspectRatio: 0.95,
          children: [
            for (final a in shown)
              Container(
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: colors.surface,
                  borderRadius: BorderRadius.circular(AppRadii.lg),
                  border: Border.all(color: colors.hairline.withValues(alpha: 0.6)),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(color: colors.brandGold.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(12)),
                      child: Icon(amenityIcon(a.icon), size: 20, color: colors.brandGold),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      a.name.resolve(lang),
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(color: colors.inkStrong, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Construction progress
// ─────────────────────────────────────────────────────────────────────────────

/// «تحت الإنشاء» / «اكتمل الإنشاء».
class ProgressStatusChip extends StatelessWidget {
  const ProgressStatusChip({super.key, required this.complete});
  final bool complete;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final tone = complete ? colors.success : colors.brandGold;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: tone.withValues(alpha: 0.14), borderRadius: AppRadii.pillAll),
      child: Text(
        complete ? context.l10n.projectProgressDone : context.l10n.projectProgressBuilding,
        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: tone),
      ),
    );
  }
}

/// A rounded bar filled to [percent].
class ProgressBar extends StatelessWidget {
  const ProgressBar({super.key, required this.percent, required this.color, this.height = 8});
  final int percent;
  final Color color;
  final double height;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(height),
      child: LinearProgressIndicator(
        value: percent / 100,
        minHeight: height,
        color: color,
        backgroundColor: context.appColors.hairline,
      ),
    );
  }
}

/// The whole progress card: overall bar, status, last update, then each stage.
class ProjectProgressCard extends StatelessWidget {
  const ProjectProgressCard({super.key, required this.progress});
  final ProjectProgress progress;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final colors = context.appColors;
    final theme = Theme.of(context);

    return Container(
      key: const Key('project-progress'),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.6)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            color: colors.surfaceSoft,
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(children: [
                  Expanded(child: Text(l10n.projectProgressOverall, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700))),
                  ProgressStatusChip(complete: progress.isComplete),
                ]),
                const SizedBox(height: AppSpacing.sm),
                Row(children: [
                  Expanded(child: ProgressBar(percent: progress.overall, color: progress.isComplete ? colors.success : colors.brandGold, height: 10)),
                  const SizedBox(width: AppSpacing.sm),
                  Text('${progress.overall}%', style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800, color: colors.inkStrong)),
                ]),
                if (progress.updatedAt != null) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    l10n.projectProgressUpdatedAt(DateFormatter.mediumDate(progress.updatedAt!.toLocal(), languageCode: lang)),
                    style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted),
                  ),
                ],
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              children: [
                for (final (i, s) in progress.stages.indexed)
                  _StageRow(stage: s, last: i == progress.stages.length - 1, lang: lang),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StageRow extends StatelessWidget {
  const _StageRow({required this.stage, required this.last, required this.lang});
  final ProgressStage stage;
  final bool last;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final (Color dot, Color onDot, IconData icon, String label) = stage.isDone
        ? (colors.success, Colors.white, Icons.check_rounded, l10n.projectStageDone)
        : stage.isActive
            ? (colors.brandGold, Colors.white, Icons.schedule_rounded, l10n.projectStageActive)
            : (colors.surfaceSoft, colors.inkMuted, Icons.schedule_rounded, l10n.projectStageNext);

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Column(children: [
            Semantics(
              label: label,
              child: Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(color: dot, shape: BoxShape.circle, border: stage.isDone || stage.isActive ? null : Border.all(color: colors.hairline)),
                child: Icon(icon, size: 16, color: onDot),
              ),
            ),
            if (!last) Expanded(child: Container(width: 2, margin: const EdgeInsets.symmetric(vertical: 4), color: colors.hairline)),
          ]),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(top: 4, bottom: last ? 0 : AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(children: [
                    Expanded(child: Text(stage.name.resolve(lang), style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700, color: colors.inkStrong))),
                    Text('${stage.percent}%', style: theme.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w700, color: stage.isDone ? colors.success : colors.inkMuted)),
                  ]),
                  const SizedBox(height: 6),
                  ProgressBar(percent: stage.percent, color: stage.isDone ? colors.success : colors.brandGold, height: 6),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
