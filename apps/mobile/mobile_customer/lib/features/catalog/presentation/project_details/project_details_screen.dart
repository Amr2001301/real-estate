import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../router/auth_navigation.dart';
import '../../../favorites/presentation/widgets/favorite_toggle_button.dart';
import '../../domain/entities/project.dart';
import '../widgets/amenity_chips.dart';
import '../widgets/contact_buttons.dart';
import '../widgets/glass.dart';
import '../widgets/image_gallery.dart';
import '../widgets/section_header.dart';
import '../widgets/unit_card.dart';
import 'project_details_cubit.dart';

// Navy palette.
const _navyDeep = Color(0xFF0B1726);
const _navyMid = Color(0xFF14273F);

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

class ProjectDetailsScreen extends StatelessWidget {
  const ProjectDetailsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ProjectDetailsCubit, ProjectDetailsState>(
      builder: (context, state) {
        switch (state.status) {
          case DataStatus.initial:
          case DataStatus.loading:
            return const _LoadingScaffold();
          case DataStatus.failure:
          case DataStatus.empty:
            return Scaffold(
              appBar: AppBar(),
              body: ErrorState(
                failure: state.failure,
                onRetry: () => context.read<ProjectDetailsCubit>().load(),
              ),
            );
          case DataStatus.success:
            return _DetailPage(state: state);
        }
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading
// ─────────────────────────────────────────────────────────────────────────────

class _LoadingScaffold extends StatelessWidget {
  const _LoadingScaffold();

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: _navyDeep,
        body: const Center(
          child: CircularProgressIndicator(
            color: AppPalette.gold400,
            strokeWidth: 2,
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page — Stack: pinned hero + scrollable sheet + floating nav + dock
// ─────────────────────────────────────────────────────────────────────────────

class _DetailPage extends StatefulWidget {
  const _DetailPage({required this.state});
  final ProjectDetailsState state;

  // Hero fills the top of the screen.
  static const double _heroH = 390.0;
  // Sheet starts this many px above the hero's bottom edge (overlap).
  static const double _sheetPeek = 40.0;

  @override
  State<_DetailPage> createState() => _DetailPageState();
}

class _DetailPageState extends State<_DetailPage> {
  late final ScrollController _scroll;
  double _px = 0;

  @override
  void initState() {
    super.initState();
    _scroll = ScrollController()..addListener(() {
      if (mounted) setState(() => _px = _scroll.offset);
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  // Nav buttons are over the sheet once the sheet has scrolled up past them.
  bool get _overSheet {
    final topInset = MediaQuery.paddingOf(context).top;
    return _px > (_DetailPage._heroH - _DetailPage._sheetPeek - topInset - 56);
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.state;
    final project = state.project!;
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final colors = context.appColors;
    final topInset = MediaQuery.paddingOf(context).top;
    final bottomInset = MediaQuery.paddingOf(context).bottom;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: colors.canvas,
        body: Stack(
          children: [
            // ── 1. Hero image — fixed, never scrolls ──────────────────────
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              height: _DetailPage._heroH + topInset,
              child: _HeroPanel(project: project, l10n: l10n),
            ),

            // ── 2. Scrollable content sheet ────────────────────────────────
            SingleChildScrollView(
              controller: _scroll,
              physics: const ClampingScrollPhysics(),
              child: Column(
                children: [
                  // Transparent spacer beneath the hero (sheet peeks into it).
                  SizedBox(
                    height: topInset +
                        _DetailPage._heroH -
                        _DetailPage._sheetPeek,
                  ),

                  // The floating sheet
                  Container(
                    decoration: BoxDecoration(
                      color: colors.canvas,
                      borderRadius: const BorderRadius.only(
                        topLeft: Radius.circular(AppRadii.xxl + 10),
                        topRight: Radius.circular(AppRadii.xxl + 10),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.22),
                          blurRadius: 32,
                          spreadRadius: 2,
                          offset: const Offset(0, -10),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Drag handle
                        _SheetHandle(colors: colors),

                        // Identity
                        Padding(
                          padding: const EdgeInsets.fromLTRB(
                              AppSpacing.xl,
                              AppSpacing.md,
                              AppSpacing.xl,
                              0),
                          child: _IdentityBlock(
                              project: project, lang: lang, l10n: l10n),
                        ),

                        // Stat tiles
                        Padding(
                          padding: const EdgeInsets.fromLTRB(
                              AppSpacing.xl,
                              AppSpacing.xl,
                              AppSpacing.xl,
                              0),
                          child: _StatTiles(project: project, l10n: l10n),
                        ),

                        // About
                        if (!project.description.isEmpty) ...[
                          const SizedBox(height: AppSpacing.xxl),
                          Padding(
                            padding: const EdgeInsets.symmetric(
                                horizontal: AppSpacing.xl),
                            child: _Section(
                              title: l10n.projectAbout,
                              child: _AboutBlock(
                                  text: project.description.resolve(lang)),
                            ),
                          ),
                        ],

                        // Amenities
                        if (project.services.isNotEmpty) ...[
                          const SizedBox(height: AppSpacing.xxl),
                          Padding(
                            padding: const EdgeInsets.symmetric(
                                horizontal: AppSpacing.xl),
                            child: _Section(
                              title: l10n.projectAmenities,
                              child: AmenityChips(
                                  services: project.services),
                            ),
                          ),
                        ],

                        // Location
                        if (project.hasLocation) ...[
                          const SizedBox(height: AppSpacing.xxl),
                          Padding(
                            padding: const EdgeInsets.symmetric(
                                horizontal: AppSpacing.xl),
                            child: _Section(
                              title: l10n.projectLocation,
                              child: _LocationTile(
                                  project: project, lang: lang, l10n: l10n),
                            ),
                          ),
                        ],

                        // Units carousel (full-bleed)
                        if (state.previewUnits.isNotEmpty) ...[
                          const SizedBox(height: AppSpacing.xxl),
                          _UnitsPreview(state: state),
                        ],

                        // Dock clearance
                        SizedBox(height: 104 + bottomInset),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // ── 3. Floating nav buttons (always on top) ────────────────────
            Positioned(
              top: topInset,
              left: 0,
              right: 0,
              height: 68,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _NavBtn(
                      overSheet: _overSheet,
                      child: BackButton(
                        color: _overSheet
                            ? colors.inkStrong
                            : Colors.white,
                      ),
                    ),
                    _NavBtn(
                      overSheet: _overSheet,
                      child: FavoriteToggleButton(
                          isProject: true, id: project.id),
                    ),
                  ],
                ),
              ),
            ),

            // ── 4. Sticky action dock ──────────────────────────────────────
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: _StickyDock(project: project),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero panel
// ─────────────────────────────────────────────────────────────────────────────

class _HeroPanel extends StatelessWidget {
  const _HeroPanel({required this.project, required this.l10n});
  final ProjectDetail project;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        // Gallery
        ImageGallery(images: project.galleryImages),

        // Top scrim — protects nav buttons
        const Positioned(
          top: 0,
          left: 0,
          right: 0,
          height: 140,
          child: IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color(0xB0000000), Color(0x00000000)],
                ),
              ),
            ),
          ),
        ),

        // Bottom scrim — hero fades into the sheet's rounded corners
        const Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          height: 120,
          child: IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [Color(0x88000000), Color(0x00000000)],
                ),
              ),
            ),
          ),
        ),

        // Pills — bottom of hero
        PositionedDirectional(
          bottom: 52, // above the sheet peek zone
          start: AppSpacing.xl,
          end: AppSpacing.xl,
          child: Row(
            children: [
              if (project.featured) ...[
                _HeroPill.gold(label: l10n.featuredBadge),
                const SizedBox(width: AppSpacing.xs),
              ],
              _HeroPill.glass(
                icon: Icons.location_on_rounded,
                label: project.city,
              ),
            ],
          ),
        ),

        // Page indicator dots
        PositionedDirectional(
          bottom: 28,
          start: 0,
          end: 0,
          child: _HeroDots(count: project.galleryImages.length),
        ),
      ],
    );
  }
}

class _HeroPill extends StatelessWidget {
  const _HeroPill._({
    required this.label,
    required this.isGold,
    this.icon,
  });

  factory _HeroPill.gold({required String label}) =>
      _HeroPill._(label: label, isGold: true);

  factory _HeroPill.glass({required String label, required IconData icon}) =>
      _HeroPill._(label: label, isGold: false, icon: icon);

  final String label;
  final bool isGold;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    if (isGold) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [AppPalette.gold300, AppPalette.gold500],
          ),
          borderRadius: AppRadii.pillAll,
          boxShadow: [
            BoxShadow(
              color: AppPalette.gold400.withValues(alpha: 0.40),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.star_rounded, size: 13, color: AppPalette.navy),
            const SizedBox(width: 5),
            Text(
              label,
              style: const TextStyle(
                color: AppPalette.navy,
                fontSize: 12,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.38),
        borderRadius: AppRadii.pillAll,
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.28),
          width: 0.8,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 13, color: Colors.white),
            const SizedBox(width: 5),
          ],
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

/// Minimal gold dash page indicator.
class _HeroDots extends StatelessWidget {
  const _HeroDots({required this.count});
  final int count;

  @override
  Widget build(BuildContext context) {
    if (count <= 1) return const SizedBox.shrink();
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        for (var i = 0; i < count.clamp(0, 5); i++)
          Container(
            width: i == 0 ? 20 : 6,
            height: 3,
            margin: const EdgeInsets.symmetric(horizontal: 2),
            decoration: BoxDecoration(
              color: i == 0
                  ? AppPalette.gold400
                  : Colors.white.withValues(alpha: 0.45),
              borderRadius: BorderRadius.circular(999),
            ),
          ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sheet handle
// ─────────────────────────────────────────────────────────────────────────────

class _SheetHandle extends StatelessWidget {
  const _SheetHandle({required this.colors});
  final AppColorsExt colors;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 44,
        height: 4,
        margin: const EdgeInsets.only(top: AppSpacing.sm + 2),
        decoration: BoxDecoration(
          color: colors.hairline,
          borderRadius: BorderRadius.circular(999),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Nav button — transitions between glass (over hero) and surface (over sheet)
// ─────────────────────────────────────────────────────────────────────────────

class _NavBtn extends StatelessWidget {
  const _NavBtn({required this.overSheet, required this.child});
  final bool overSheet;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      width: 42,
      height: 42,
      decoration: BoxDecoration(
        color: overSheet
            ? colors.surface
            : Colors.white.withValues(alpha: 0.18),
        shape: BoxShape.circle,
        border: Border.all(
          color: overSheet
              ? colors.hairline
              : Colors.white.withValues(alpha: 0.32),
          width: 0.8,
        ),
        boxShadow: overSheet ? colors.shadowSoft : null,
      ),
      child: IconButtonTheme(
        data: IconButtonThemeData(
          style: IconButton.styleFrom(
            minimumSize: const Size(42, 42),
            maximumSize: const Size(42, 42),
            padding: EdgeInsets.zero,
            iconSize: 20,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
        ),
        child: child,
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Identity block
// ─────────────────────────────────────────────────────────────────────────────

class _IdentityBlock extends StatelessWidget {
  const _IdentityBlock({
    required this.project,
    required this.lang,
    required this.l10n,
  });

  final ProjectDetail project;
  final String lang;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Featured badge
        if (project.featured) ...[
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppPalette.gold300, AppPalette.gold500],
              ),
              borderRadius: AppRadii.pillAll,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.star_rounded,
                    size: 11, color: AppPalette.navy),
                const SizedBox(width: 4),
                Text(
                  l10n.featuredBadge,
                  style: const TextStyle(
                    color: AppPalette.navy,
                    fontSize: 10.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.3,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
        ],

        // Name — headline anchor
        Text(
          project.name.resolve(lang),
          style: theme.textTheme.headlineLarge?.copyWith(
            fontWeight: FontWeight.w900,
            color: colors.inkStrong,
            height: 1.05,
            letterSpacing: -0.6,
          ),
        ),
        const SizedBox(height: AppSpacing.xs + 2),

        // City
        Row(
          children: [
            const Icon(Icons.location_on_rounded,
                size: 15, color: AppPalette.gold400),
            const SizedBox(width: 4),
            Text(
              project.city,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: colors.inkMuted,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),

        // Gold separator line
        Container(
          width: 48,
          height: 2,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [
                AppPalette.gold400,
                Color(0x00B8941F),
              ],
            ),
            borderRadius: BorderRadius.circular(999),
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat tiles — 3 individual surface cards, each with a gold top border
// ─────────────────────────────────────────────────────────────────────────────

class _StatTiles extends StatelessWidget {
  const _StatTiles({required this.project, required this.l10n});
  final ProjectDetail project;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final stats = <(IconData, String, String)>[
      (
        Icons.meeting_room_outlined,
        '${project.availableUnitsCount}',
        l10n.labelAvailableUnits,
      ),
      (Icons.location_city_outlined, project.city, l10n.labelCity),
      if (project.services.isNotEmpty)
        (
          Icons.spa_outlined,
          '${project.services.length}',
          l10n.labelAmenities,
        ),
    ];

    return Row(
      children: [
        for (var i = 0; i < stats.length; i++) ...[
          if (i > 0) const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: _StatCard(
              icon: stats[i].$1,
              value: stats[i].$2,
              label: stats[i].$3,
            ),
          ),
        ],
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.value,
    required this.label,
  });

  final IconData icon;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    // Flutter requires uniform border colors when borderRadius is set.
    // Instead, we render the gold top accent as the first child of the card.
    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.5)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          // Gold top accent bar — clipped to match the card's corner radius.
          ClipRRect(
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(AppRadii.lg - 1),
              topRight: Radius.circular(AppRadii.lg - 1),
            ),
            child: Container(
              height: 2.5,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppPalette.gold300, AppPalette.gold500],
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.xs, AppSpacing.md, AppSpacing.xs, AppSpacing.md),
            child: Column(
              children: [
                Icon(icon, size: 22, color: colors.brandGold),
                const SizedBox(height: 8),
                Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: colors.inkStrong,
                    letterSpacing: -0.2,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  label,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.labelSmall
                      ?.copyWith(color: colors.inkMuted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Section wrapper — gold-bar label + content
// ─────────────────────────────────────────────────────────────────────────────

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 4,
              height: 20,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [AppPalette.gold300, AppPalette.gold500],
                ),
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Text(
              title,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: colors.inkStrong,
                    letterSpacing: -0.2,
                  ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md + 2),
        child,
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// About block — editorial text, no card shell
// ─────────────────────────────────────────────────────────────────────────────

class _AboutBlock extends StatelessWidget {
  const _AboutBlock({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: colors.surfaceSoft,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.5)),
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Directional gold bar — first in row = start side (right in RTL)
            Container(
              width: 3,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [AppPalette.gold300, AppPalette.gold500],
                ),
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Flexible(
              child: Text(
                text,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: colors.inkStrong.withValues(alpha: 0.85),
                  height: 1.75,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Location tile
// ─────────────────────────────────────────────────────────────────────────────

class _LocationTile extends StatelessWidget {
  const _LocationTile({
    required this.project,
    required this.lang,
    required this.l10n,
  });

  final ProjectDetail project;
  final String lang;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => ContactActions.openMap(
          lat: project.lat!,
          lng: project.lng!,
          label: project.name.resolve(lang),
        ),
        borderRadius: BorderRadius.circular(AppRadii.xl),
        child: Ink(
          padding: const EdgeInsets.all(AppSpacing.lg),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment(0, -1),
              end: Alignment(0.8, 1),
              colors: [_navyMid, _navyDeep],
            ),
            borderRadius: BorderRadius.circular(AppRadii.xl),
            boxShadow: [
              BoxShadow(
                color: _navyDeep.withValues(alpha: 0.40),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Row(
            children: [
              // Icon container
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(AppRadii.md),
                  border: Border.all(
                    color: AppPalette.gold400.withValues(alpha: 0.40),
                    width: 0.8,
                  ),
                ),
                child: const Icon(Icons.location_on_outlined,
                    size: 22, color: AppPalette.gold300),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      project.city,
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.1,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      l10n.openInMaps,
                      style: const TextStyle(
                        color: AppPalette.gold300,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                AppIcons.chevronForward,
                size: 18,
                color: Colors.white.withValues(alpha: 0.40),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Units preview
// ─────────────────────────────────────────────────────────────────────────────

class _UnitsPreview extends StatelessWidget {
  const _UnitsPreview({required this.state});
  final ProjectDetailsState state;

  // 210 image + hairline + ~148 content = 370 fits the UnitCard without overflow.
  static const double _cardH = 370.0;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final project = state.project!;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
          child: SectionHeader(
            title: l10n.projectUnits,
            onViewAll: () =>
                context.push('/projects/${project.id}/units'),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        SizedBox(
          height: _cardH,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
            itemCount: state.previewUnits.length,
            separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.md),
            itemBuilder: (context, i) {
              final unit = state.previewUnits[i];
              return UnitCard(
                unit: unit,
                width: 280,
                onTap: () => context.push('/units/${unit.id}'),
              );
            },
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sticky action dock
// ─────────────────────────────────────────────────────────────────────────────

class _StickyDock extends StatelessWidget {
  const _StickyDock({required this.project});
  final ProjectDetail project;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final l10n = context.l10n;

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg, AppSpacing.xs, AppSpacing.lg, AppSpacing.sm),
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
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: AppSpacing.sm,
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: AppButton(
                          label: l10n.requestVisit,
                          icon: Icons.event_available_outlined,
                          variant: AppButtonVariant.gold,
                          size: AppButtonSize.medium,
                          expand: true,
                          onPressed: () => _onRequestVisit(context),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      _GlassBtn(
                        icon: Icons.auto_awesome_rounded,
                        tooltip: l10n.homeAskAssistant,
                        onTap: () => context.push('/chat'),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _onRequestVisit(BuildContext context) {
    final authed = context.read<SessionCubit>().state.isAuthenticated;
    if (authed) {
      context.push('/visit-request', extra: {'projectId': project.id});
    } else {
      _showVisitPrompt(context, project);
    }
  }
}

class _GlassBtn extends StatelessWidget {
  const _GlassBtn(
      {required this.icon, required this.onTap, required this.tooltip});
  final IconData icon;
  final VoidCallback onTap;
  final String tooltip;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: Colors.white.withValues(alpha: 0.14),
        shape: CircleBorder(
          side: BorderSide(color: Colors.white.withValues(alpha: 0.40)),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          customBorder: const CircleBorder(),
          child: SizedBox(
            width: 46,
            height: 46,
            child: Icon(icon, color: Colors.white, size: 22),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Guest visit prompt sheet
// ─────────────────────────────────────────────────────────────────────────────

void _showVisitPrompt(BuildContext context, ProjectDetail project) {
  final l10n = context.l10n;
  final lang = Localizations.localeOf(context).languageCode;
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (sheetCtx) => Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg, 0, AppSpacing.lg, AppSpacing.xl),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.requestVisit,
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: AppSpacing.xs),
          Text(l10n.requestVisitPrompt,
              style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: AppSpacing.lg),
          AppButton(
            label: l10n.actionLogin,
            icon: Icons.login_rounded,
            expand: true,
            onPressed: () {
              Navigator.of(sheetCtx).pop();
              context.pushLoginWithRedirect();
            },
          ),
          const SizedBox(height: AppSpacing.sm),
          ContactButtons(whatsappMessage: project.name.resolve(lang)),
        ],
      ),
    ),
  );
}
