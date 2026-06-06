import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../router/auth_navigation.dart';
import '../../../favorites/presentation/widgets/favorite_toggle_button.dart';
import '../../domain/entities/catalog_enums.dart';
import '../../domain/entities/unit.dart';
import '../../domain/repositories/catalog_repository.dart';
import '../../domain/usecases/get_units.dart';
import '../compare/compare_cubit.dart';
import '../widgets/contact_buttons.dart';
import '../widgets/glass.dart';
import '../widgets/image_gallery.dart';
import '../widgets/price_text.dart';
import '../widgets/section_header.dart';
import '../widgets/unit_card.dart';
import '../widgets/unit_status_chip.dart';
import 'unit_details_cubit.dart';

class UnitDetailsScreen extends StatelessWidget {
  const UnitDetailsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<UnitDetailsCubit, UnitDetailsState>(
      builder: (context, state) {
        switch (state.status) {
          case DataStatus.initial:
          case DataStatus.loading:
            return Scaffold(
              appBar: AppBar(),
              body: const Center(child: CircularProgressIndicator()),
            );
          case DataStatus.failure:
          case DataStatus.empty:
            return Scaffold(
              appBar: AppBar(),
              body: ErrorState(
                failure: state.failure,
                onRetry: () => context.read<UnitDetailsCubit>().load(),
              ),
            );
          case DataStatus.success:
            return _Content(unit: state.data!);
        }
      },
    );
  }
}

class _Content extends StatefulWidget {
  const _Content({required this.unit});
  final Unit unit;

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
    final unit = widget.unit;
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final colors = context.appColors;
    final isDark = theme.brightness == Brightness.dark;

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
                  unit.type,
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
                padding: const EdgeInsetsDirectional.only(start: AppSpacing.lg),
                child: _Chrome(child: BackButton(color: colors.inkStrong)),
              ),
              actions: [
                _Chrome(
                    child: FavoriteToggleButton(isProject: false, id: unit.id)),
                const SizedBox(width: AppSpacing.sm),
                _Chrome(child: _CompareButton(unit: unit)),
                const SizedBox(width: AppSpacing.lg),
              ],
              flexibleSpace: FlexibleSpaceBar(
                collapseMode: CollapseMode.parallax,
                background: _Hero(unit: unit),
              ),
            ),

            // Main info + content sections (uniform horizontal padding).
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
                    // ── Identity + price anchor ────────────────────────────
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            unit.type,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.headlineMedium?.copyWith(
                              fontWeight: FontWeight.w800,
                              color: colors.inkStrong,
                              height: 1.1,
                            ),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        UnitStatusChip(unit.status),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      l10n.unitCode(unit.code),
                      style: theme.textTheme.bodyMedium
                          ?.copyWith(color: colors.inkMuted),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Divider(height: 1, color: colors.hairline.withValues(alpha: 0.8)),
                    const SizedBox(height: AppSpacing.md),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                l10n.labelPrice,
                                style: theme.textTheme.labelMedium?.copyWith(
                                  color: colors.inkMuted,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 4),
                              PriceText(
                                unit.price,
                                style: theme.textTheme.headlineMedium?.copyWith(
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.xl),

                    // ── Specs ──────────────────────────────────────────────
                    _SectionTitle(l10n.unitOverview),
                    const SizedBox(height: AppSpacing.md),
                    _SpecsBar(unit: unit),

                    // ── About (generic brand copy — no per-unit description
                    //    field exists in the API) ────────────────────────────
                    const SizedBox(height: AppSpacing.xl),
                    _SectionTitle(l10n.unitAbout),
                    const SizedBox(height: AppSpacing.md),
                    _AboutCard(text: l10n.unitAboutGeneric),

                    // ── Within the project ─────────────────────────────────
                    if (unit.project != null) ...[
                      const SizedBox(height: AppSpacing.xl),
                      _SectionTitle(l10n.unitWithinProject),
                      const SizedBox(height: AppSpacing.md),
                      _WithinProject(project: unit.project!),
                    ],

                    // ── Unit plan ──────────────────────────────────────────
                    const SizedBox(height: AppSpacing.xl),
                    _SectionTitle(l10n.unitPlanTitle),
                    const SizedBox(height: AppSpacing.md),
                    _UnitPlan(
                      unit: unit,
                      onRequest: () => showUnitContactSheet(context, unit),
                    ),
                  ],
                ),
              ),
            ),

            // Other units in this project (full-bleed carousel; self-hides).
            if (unit.project != null)
              SliverToBoxAdapter(
                child: _SimilarUnits(
                  projectId: unit.project!.id,
                  currentUnitId: unit.id,
                ),
              ),

            SliverToBoxAdapter(
              child:
                  SizedBox(height: 104 + MediaQuery.paddingOf(context).bottom),
            ),
          ],
            ),
          ),
          // Floating navy action dock — overlays the scrolling content.
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: _StickyActionBar(unit: unit),
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

/// A solid surface circle that hosts a header action (back/favorite/compare).
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

/// Edge-to-edge hero gallery with a top scrim and a solid location pill.
class _Hero extends StatelessWidget {
  const _Hero({required this.unit});
  final Unit unit;

  @override
  Widget build(BuildContext context) {
    final lang = Localizations.localeOf(context).languageCode;
    final project = unit.project;
    return Stack(
      fit: StackFit.expand,
      children: [
        ImageGallery(images: unit.galleryImages),
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
        if (project != null)
          PositionedDirectional(
            bottom: AppSpacing.xl,
            start: AppSpacing.lg,
            end: AppSpacing.lg,
            child: Align(
              alignment: AlignmentDirectional.centerStart,
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  maxWidth: MediaQuery.sizeOf(context).width * 0.68,
                ),
                child: _LocationPill(
                  label: '${project.name.resolve(lang)} · ${project.city}',
                ),
              ),
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

/// Compact premium specs bar: a single card with icon/value/label columns
/// separated by hairline dividers — denser and more elegant than separate
/// tiles. Adapts to 3 or 4 stats (floor optional).
class _SpecsBar extends StatelessWidget {
  const _SpecsBar({required this.unit});
  final Unit unit;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final stats = <(IconData, String, String)>[
      (Icons.bed_outlined, '${unit.bedrooms}', l10n.labelBedrooms),
      (Icons.bathtub_outlined, '${unit.bathrooms}', l10n.labelBathrooms),
      (Icons.square_foot_outlined, l10n.areaValue('${unit.area}'), l10n.labelArea),
      if (unit.floor != null)
        (Icons.stairs_outlined, '${unit.floor}', l10n.labelFloor),
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

/// "About this unit" — a soft card with the brand's generic copy (the API has
/// no per-unit description; the website shows the same generic helper).
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

/// Rich "within the project" card: identity + city + two real actions.
class _WithinProject extends StatelessWidget {
  const _WithinProject({required this.project});
  final UnitProjectRef project;

  @override
  Widget build(BuildContext context) {
    final lang = Localizations.localeOf(context).languageCode;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final l10n = context.l10n;
    return PremiumCard(
      glow: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const IconChip(icon: Icons.apartment_rounded),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.labelProject,
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: colors.brandGold,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.3,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      project.name.resolve(lang),
                      style: theme.textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: colors.inkStrong,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        Icon(Icons.location_on_rounded,
                            size: 14, color: colors.brandGold),
                        const SizedBox(width: AppSpacing.xxs),
                        Flexible(
                          child: Text(
                            project.city,
                            style: theme.textTheme.bodySmall
                                ?.copyWith(color: colors.inkMuted),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          const GoldHairline(),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: AppButton(
                  label: l10n.viewProject,
                  variant: AppButtonVariant.primary,
                  size: AppButtonSize.small,
                  onPressed: () => context.push('/projects/${project.id}'),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: AppButton(
                  label: l10n.viewProjectUnits,
                  variant: AppButtonVariant.outline,
                  size: AppButtonSize.small,
                  onPressed: () =>
                      context.push('/projects/${project.id}/units'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// "Unit plan": a real FLOORPLAN media image when one exists, otherwise the
/// honest "available on request" card (mirrors the website — no fake plan).
class _UnitPlan extends StatelessWidget {
  const _UnitPlan({required this.unit, required this.onRequest});
  final Unit unit;
  final VoidCallback onRequest;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    final plans = unit.media
        .where((m) => m.type.toUpperCase() == 'FLOORPLAN')
        .toList();

    if (plans.isNotEmpty) {
      return LuxeCard(
        child: AspectRatio(
          aspectRatio: 4 / 3,
          child: AppNetworkImage(url: plans.first.url, fit: BoxFit.contain),
        ),
      );
    }

    return _BlueprintCard(
      text: l10n.unitPlanOnRequest,
      ctaLabel: l10n.unitPlanRequest,
      onRequest: onRequest,
    );
  }
}

/// Premium navy "blueprint" placeholder for units with no plan media: a navy
/// panel with a subtle grid pattern, a gold-framed drafting icon, the
/// on-request copy, and a white-outline CTA. Compact (~190px).
class _BlueprintCard extends StatelessWidget {
  const _BlueprintCard({
    required this.text,
    required this.ctaLabel,
    required this.onRequest,
  });

  final String text;
  final String ctaLabel;
  final VoidCallback onRequest;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return DecoratedBox(
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
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [AppPalette.navy700, AppPalette.navy],
                  ),
                ),
              ),
            ),
            const Positioned.fill(
              child: IgnorePointer(
                child: CustomPaint(painter: _BlueprintGrid()),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.lg,
                vertical: AppSpacing.lg,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 58,
                      height: 58,
                      decoration: BoxDecoration(
                        color: AppPalette.gold400.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(AppRadii.md),
                        border: Border.all(
                          color: AppPalette.gold400.withValues(alpha: 0.55),
                        ),
                      ),
                      child: const Icon(Icons.architecture_rounded,
                          color: AppPalette.gold300, size: 28),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    text,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.82),
                      height: 1.5,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  _OutlineOnNavyButton(label: ctaLabel, onTap: onRequest),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A white-outline pill CTA designed to sit on the navy blueprint panel.
class _OutlineOnNavyButton extends StatelessWidget {
  const _OutlineOnNavyButton({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.08),
      shape: StadiumBorder(
        side: BorderSide(color: Colors.white.withValues(alpha: 0.5)),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: SizedBox(
          height: 46,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.description_outlined,
                  size: 18, color: Colors.white),
              const SizedBox(width: AppSpacing.sm),
              Text(
                label,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Faint graph-paper grid for the blueprint panel.
class _BlueprintGrid extends CustomPainter {
  const _BlueprintGrid();

  @override
  void paint(Canvas canvas, Size size) {
    final line = Paint()
      ..color = Colors.white.withValues(alpha: 0.05)
      ..strokeWidth = 1;
    final gold = Paint()
      ..color = AppPalette.gold400.withValues(alpha: 0.07)
      ..strokeWidth = 1;
    const step = 26.0;
    var i = 0;
    for (var x = step; x < size.width; x += step, i++) {
      canvas.drawLine(
          Offset(x, 0), Offset(x, size.height), i.isEven ? gold : line);
    }
    i = 0;
    for (var y = step; y < size.height; y += step, i++) {
      canvas.drawLine(
          Offset(0, y), Offset(size.width, y), i.isEven ? gold : line);
    }
  }

  @override
  bool shouldRepaint(_BlueprintGrid oldDelegate) => false;
}

/// Other units in the same project (excluding the current one). Honest data via
/// the existing project-scoped units API; self-hides on empty/error and never
/// blocks the page.
class _SimilarUnits extends StatefulWidget {
  const _SimilarUnits({required this.projectId, required this.currentUnitId});
  final String projectId;
  final String currentUnitId;

  @override
  State<_SimilarUnits> createState() => _SimilarUnitsState();
}

class _SimilarUnitsState extends State<_SimilarUnits> {
  late final Future<List<Unit>> _future = _load();

  Future<List<Unit>> _load() async {
    final result = await GetUnits(context.read<CatalogRepository>())(
      GetUnitsParams(
        projectId: widget.projectId,
        status: UnitStatus.available,
        page: 1,
        pageSize: 8,
      ),
    );
    return result.when(
      ok: (page) =>
          page.data.where((u) => u.id != widget.currentUnitId).toList(),
      err: (_) => const <Unit>[],
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return FutureBuilder<List<Unit>>(
      future: _future,
      builder: (context, snapshot) {
        final units = snapshot.data ?? const <Unit>[];
        if (snapshot.connectionState != ConnectionState.done || units.isEmpty) {
          return const SizedBox.shrink();
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: AppSpacing.xl),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              child: SectionHeader(
                title: l10n.unitOtherInProject,
                onViewAll: () =>
                    context.push('/projects/${widget.projectId}/units'),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            SizedBox(
              height: 320,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                itemCount: units.length,
                separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.md),
                itemBuilder: (context, i) {
                  final unit = units[i];
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
      },
    );
  }
}

/// Premium sticky action panel: actions only (no duplicated price). Primary
/// "request a visit" + a compact "request info" (contact) when configured.
class _StickyActionBar extends StatelessWidget {
  const _StickyActionBar({required this.unit});
  final Unit unit;

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
        // Premium floating navy action dock with a gold CTA.
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
                        // AI assistant — compact, secondary to the visit CTA.
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

  void _onRequestVisit(BuildContext context) {
    final authed = context.read<SessionCubit>().state.isAuthenticated;
    final projectId = unit.project?.id;
    if (authed && projectId != null) {
      context.push('/visit-request', extra: {
        'projectId': projectId,
        'unitId': unit.id,
      });
    } else {
      _showVisitPrompt(context);
    }
  }

  void _showVisitPrompt(BuildContext context) {
    final l10n = context.l10n;
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
                context.pushLoginWithRedirect();
              },
            ),
            const SizedBox(height: AppSpacing.sm),
            ContactButtons(whatsappMessage: '${unit.type} · ${unit.code}'),
          ],
        ),
      ),
    );
  }
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

/// Contact ("request info") bottom sheet: call + WhatsApp, prefilled with the
/// unit reference. Preserves the existing [ContactButtons] behavior.
void showUnitContactSheet(BuildContext context, Unit unit) {
  final l10n = context.l10n;
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
          Text(l10n.requestInfo,
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: AppSpacing.xs),
          Text(
            '${unit.type} · ${l10n.unitCode(unit.code)}',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: context.appColors.inkMuted,
                ),
          ),
          const SizedBox(height: AppSpacing.lg),
          ContactButtons(whatsappMessage: '${unit.type} · ${unit.code}'),
        ],
      ),
    ),
  );
}

/// Compare toggle (icon only — hosted in a [_Chrome] circle over the hero).
class _CompareButton extends StatelessWidget {
  const _CompareButton({required this.unit});
  final Unit unit;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<CompareCubit, List<Unit>>(
      builder: (context, selected) {
        final inCompare = selected.any((u) => u.id == unit.id);
        return IconButton(
          tooltip:
              inCompare ? context.l10n.compareRemove : context.l10n.compareAdd,
          color: context.appColors.inkStrong,
          icon: Icon(inCompare
              ? Icons.compare_arrows_rounded
              : Icons.add_to_photos_outlined),
          onPressed: () => _toggle(context),
        );
      },
    );
  }

  void _toggle(BuildContext context) {
    final l10n = context.l10n;
    final result = context.read<CompareCubit>().toggle(unit);
    final messenger = ScaffoldMessenger.of(context)..hideCurrentSnackBar();
    final text = switch (result) {
      CompareToggle.added => l10n.compareAdded,
      CompareToggle.removed => l10n.compareRemove,
      CompareToggle.full => l10n.compareFull(CompareCubit.maxItems),
    };
    messenger.showSnackBar(SnackBar(
      content: Text(text),
      action: result == CompareToggle.added
          ? SnackBarAction(
              label: l10n.compareTitle,
              onPressed: () => context.push('/compare'),
            )
          : null,
    ));
  }
}
