import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../favorites/presentation/widgets/favorite_toggle_button.dart';
import '../../domain/entities/project.dart';
import '../widgets/amenity_chips.dart';
import '../widgets/contact_buttons.dart';
import '../widgets/glass.dart';
import '../widgets/image_gallery.dart';
import '../widgets/section_header.dart';
import '../widgets/unit_card.dart';
import 'project_details_cubit.dart';

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
            return _Content(state: state);
        }
      },
    );
  }
}

class _LoadingScaffold extends StatelessWidget {
  const _LoadingScaffold();
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(),
      body: const Center(child: CircularProgressIndicator()),
    );
  }
}

class _Content extends StatefulWidget {
  const _Content({required this.state});
  final ProjectDetailsState state;

  @override
  State<_Content> createState() => _ContentState();
}

class _ContentState extends State<_Content> {
  static const double _heroHeight = 320;

  // True once the hero has scrolled away and the pinned bar shows the page
  // surface — drives the status-bar icon brightness.
  bool _collapsed = false;

  bool _onScroll(ScrollNotification n) {
    final collapsed = n.metrics.pixels > (_heroHeight - 96);
    if (collapsed != _collapsed) setState(() => _collapsed = collapsed);
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.state;
    final project = state.project!;
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final theme = Theme.of(context);
    final colors = context.appColors;
    final isDark = theme.brightness == Brightness.dark;

    final hasUnits = state.previewUnits.isNotEmpty;
    final hasDescription = !project.description.isEmpty;

    const overImage = SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      statusBarBrightness: Brightness.dark,
    );
    final overBar = isDark
        ? overImage
        : const SystemUiOverlayStyle(
            statusBarColor: Colors.transparent,
            statusBarIconBrightness: Brightness.dark,
            statusBarBrightness: Brightness.light,
          );

    return Scaffold(
      body: Stack(
        children: [
          NotificationListener<ScrollNotification>(
            onNotification: _onScroll,
            child: CustomScrollView(
              slivers: [
                SliverAppBar(
                  pinned: true,
                  expandedHeight: _heroHeight,
                  automaticallyImplyLeading: false,
                  backgroundColor: colors.canvas,
                  surfaceTintColor: Colors.transparent,
                  elevation: 0,
                  scrolledUnderElevation: 0,
                  systemOverlayStyle: _collapsed ? overBar : overImage,
                  toolbarHeight: 68,
                  centerTitle: true,
                  title: AnimatedOpacity(
                    opacity: _collapsed ? 1 : 0,
                    duration: const Duration(milliseconds: 200),
                    child: Text(
                      project.name.resolve(lang),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: colors.inkStrong,
                      ),
                    ),
                  ),
                  leadingWidth: 72,
                  leading: Padding(
                    padding:
                        const EdgeInsetsDirectional.only(start: AppSpacing.lg),
                    child: _Chrome(child: BackButton(color: colors.inkStrong)),
                  ),
                  actions: [
                    _Chrome(
                      child: FavoriteToggleButton(
                          isProject: true, id: project.id),
                    ),
                    const SizedBox(width: AppSpacing.lg),
                  ],
                  flexibleSpace: FlexibleSpaceBar(
                    collapseMode: CollapseMode.parallax,
                    background: _Hero(project: project),
                  ),
                ),

                // Identity + content sections (uniform horizontal padding).
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.lg,
                      AppSpacing.lg,
                      AppSpacing.lg,
                      0,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // ── Identity ───────────────────────────────────────
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Text(
                                project.name.resolve(lang),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: theme.textTheme.headlineMedium?.copyWith(
                                  fontWeight: FontWeight.w800,
                                  color: colors.inkStrong,
                                  height: 1.1,
                                ),
                              ),
                            ),
                            if (project.featured) ...[
                              const SizedBox(width: AppSpacing.sm),
                              StatusBadge(
                                label: l10n.featuredBadge,
                                tone: BadgeTone.gold,
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Row(
                          children: [
                            Icon(Icons.location_on_rounded,
                                size: 16, color: colors.brandGold),
                            const SizedBox(width: AppSpacing.xxs),
                            Text(
                              project.city,
                              style: theme.textTheme.bodyMedium
                                  ?.copyWith(color: colors.inkMuted),
                            ),
                          ],
                        ),

                        // ── Overview ───────────────────────────────────────
                        const SizedBox(height: AppSpacing.xl),
                        _SectionTitle(l10n.projectOverview),
                        const SizedBox(height: AppSpacing.md),
                        _OverviewBar(project: project),

                        // ── About the project (real description only) ──────
                        if (hasDescription) ...[
                          const SizedBox(height: AppSpacing.xl),
                          _SectionTitle(l10n.projectAbout),
                          const SizedBox(height: AppSpacing.md),
                          _AboutCard(text: project.description.resolve(lang)),
                        ],

                        // ── Amenities ──────────────────────────────────────
                        if (project.services.isNotEmpty) ...[
                          const SizedBox(height: AppSpacing.xl),
                          _SectionTitle(l10n.projectAmenities),
                          const SizedBox(height: AppSpacing.md),
                          AmenityChips(services: project.services),
                        ],

                        // ── Location (only when coordinates exist) ─────────
                        if (project.hasLocation) ...[
                          const SizedBox(height: AppSpacing.xl),
                          _SectionTitle(l10n.projectLocation),
                          const SizedBox(height: AppSpacing.md),
                          _LocationCard(project: project),
                        ],
                      ],
                    ),
                  ),
                ),

                // ── Project units (full-bleed carousel; self-hides) ────────
                if (hasUnits)
                  SliverToBoxAdapter(child: _UnitsPreview(state: state)),

                SliverToBoxAdapter(
                  child: SizedBox(
                      height: 104 + MediaQuery.paddingOf(context).bottom),
                ),
              ],
            ),
          ),

          // Floating navy action dock — overlays the scrolling content.
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: _StickyActionBar(project: project),
          ),
        ],
      ),
    );
  }
}

/// A consistent premium section header: a gold accent bar + bold title.
class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.title);
  final String title;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Row(
      children: [
        Container(
          width: 4,
          height: 18,
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
              ),
        ),
      ],
    );
  }
}

/// A solid surface circle that hosts a header action (back/favorite).
class _Chrome extends StatelessWidget {
  const _Chrome({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Center(
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.surface,
          shape: BoxShape.circle,
          border: Border.all(color: colors.hairline),
          boxShadow: colors.shadowSoft,
        ),
        child: IconButtonTheme(
          data: IconButtonThemeData(
            style: IconButton.styleFrom(
              minimumSize: const Size(40, 40),
              maximumSize: const Size(40, 40),
              padding: EdgeInsets.zero,
              iconSize: 20,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
          ),
          child: child,
        ),
      ),
    );
  }
}

/// Edge-to-edge hero gallery with a top scrim and bottom city/featured pills.
class _Hero extends StatelessWidget {
  const _Hero({required this.project});
  final ProjectDetail project;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Stack(
      fit: StackFit.expand,
      children: [
        ImageGallery(images: project.galleryImages),
        const Positioned(
          top: 0,
          left: 0,
          right: 0,
          height: 150,
          child: IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Color(0xA6000000),
                    Color(0x29000000),
                    Color(0x00000000),
                  ],
                  stops: [0.0, 0.42, 1.0],
                ),
              ),
            ),
          ),
        ),
        PositionedDirectional(
          bottom: AppSpacing.xl,
          start: AppSpacing.lg,
          end: AppSpacing.lg,
          child: Row(
            children: [
              Flexible(
                child: _LocationPill(label: project.city),
              ),
              if (project.featured) ...[
                const SizedBox(width: AppSpacing.sm),
                _FeaturedPill(label: l10n.featuredBadge),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _LocationPill extends StatelessWidget {
  const _LocationPill({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: 6,
      ),
      decoration: BoxDecoration(
        color: AppPalette.navy.withValues(alpha: 0.82),
        borderRadius: AppRadii.pillAll,
        border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.location_on_rounded, size: 14, color: Colors.white),
          const SizedBox(width: AppSpacing.xs),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// A warm gold "featured" pill for the hero overlay.
class _FeaturedPill extends StatelessWidget {
  const _FeaturedPill({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: 6,
      ),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppPalette.gold300, AppPalette.gold500],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: AppRadii.pillAll,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.star_rounded, size: 14, color: AppPalette.navy),
          const SizedBox(width: AppSpacing.xs),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: AppPalette.navy,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

/// Compact premium overview bar: a single card with icon/value/label columns
/// separated by hairline dividers. Renders only the real facts a project has:
/// available units, city, and amenities count (when present).
class _OverviewBar extends StatelessWidget {
  const _OverviewBar({required this.project});
  final ProjectDetail project;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final stats = <(IconData, String, String)>[
      (
        Icons.meeting_room_outlined,
        '${project.availableUnitsCount}',
        l10n.labelAvailableUnits
      ),
      (Icons.location_city_outlined, project.city, l10n.labelCity),
      if (project.services.isNotEmpty)
        (
          Icons.spa_outlined,
          '${project.services.length}',
          l10n.labelAmenities
        ),
    ];

    final cells = <Widget>[];
    for (var i = 0; i < stats.length; i++) {
      if (i > 0) {
        cells.add(VerticalDivider(
          width: 1,
          thickness: 1,
          indent: AppSpacing.sm,
          endIndent: AppSpacing.sm,
          color: colors.hairline,
        ));
      }
      final s = stats[i];
      cells.add(Expanded(child: _Stat(icon: s.$1, value: s.$2, label: s.$3)));
    }

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.8)),
        boxShadow: colors.shadowSoft,
      ),
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
      child: IntrinsicHeight(child: Row(children: cells)),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.icon, required this.value, required this.label});
  final IconData icon;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 22, color: colors.brandGold),
          const SizedBox(height: 6),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w800,
              color: colors.inkStrong,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.labelSmall?.copyWith(color: colors.inkMuted),
          ),
        ],
      ),
    );
  }
}

/// "About the project" — a soft warm card with the real project description and
/// a gold vertical accent line (mirrors Unit Details' About card).
class _AboutCard extends StatelessWidget {
  const _AboutCard({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surfaceSoft,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.5)),
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
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
            Expanded(
              child: Text(
                text,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: colors.inkStrong.withValues(alpha: 0.86),
                  height: 1.6,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Compact premium location card: opens the project coordinates in Maps.
class _LocationCard extends StatelessWidget {
  const _LocationCard({required this.project});
  final ProjectDetail project;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final colors = context.appColors;
    final theme = Theme.of(context);
    return PremiumCard(
      glow: true,
      onTap: () => ContactActions.openMap(
        lat: project.lat!,
        lng: project.lng!,
        label: project.name.resolve(lang),
      ),
      child: Row(
        children: [
          const IconChip(icon: Icons.map_outlined),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  project.city,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: colors.inkStrong,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  l10n.openInMaps,
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: colors.brandGold),
                ),
              ],
            ),
          ),
          Icon(Icons.open_in_new_rounded, size: 20, color: colors.inkMuted),
        ],
      ),
    );
  }
}

class _UnitsPreview extends StatelessWidget {
  const _UnitsPreview({required this.state});
  final ProjectDetailsState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final project = state.project!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: AppSpacing.xl),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          child: SectionHeader(
            title: l10n.projectUnits,
            onViewAll: () => context.push('/projects/${project.id}/units'),
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        SizedBox(
          height: 320,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
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

/// Premium sticky action dock: a slim navy bar with the primary "request a
/// visit" gold CTA (the project's main conversion action) plus a compact,
/// secondary AI-assistant glass action.
class _StickyActionBar extends StatelessWidget {
  const _StickyActionBar({required this.project});
  final ProjectDetail project;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final l10n = context.l10n;

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg,
          AppSpacing.xs,
          AppSpacing.lg,
          AppSpacing.sm,
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
                      _GlassAction(
                        tooltip: l10n.homeAskAssistant,
                        icon: Icons.auto_awesome_rounded,
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

  /// Auth-aware project visit request — reuses the existing `/visit-request`
  /// flow (no new route/API). Guests get the login + contact prompt sheet.
  void _onRequestVisit(BuildContext context) {
    final authed = context.read<SessionCubit>().state.isAuthenticated;
    if (authed) {
      context.push('/visit-request', extra: {'projectId': project.id});
    } else {
      _showVisitPrompt(context, project);
    }
  }
}

/// Guest visit prompt: sign in to request a visit, or contact us directly —
/// mirrors the Unit Details behavior, prefilled with the project name.
void _showVisitPrompt(BuildContext context, ProjectDetail project) {
  final l10n = context.l10n;
  final lang = Localizations.localeOf(context).languageCode;
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (sheetContext) => Padding(
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
              Navigator.of(sheetContext).pop();
              context.push('/login');
            },
          ),
          const SizedBox(height: AppSpacing.sm),
          ContactButtons(whatsappMessage: project.name.resolve(lang)),
        ],
      ),
    ),
  );
}

/// A compact translucent-glass circular action on the navy dock — secondary to
/// the primary CTA (e.g. the AI assistant).
class _GlassAction extends StatelessWidget {
  const _GlassAction({
    required this.icon,
    required this.onTap,
    required this.tooltip,
  });

  final IconData icon;
  final VoidCallback onTap;
  final String tooltip;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Semantics(
        button: true,
        label: tooltip,
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
      ),
    );
  }
}
