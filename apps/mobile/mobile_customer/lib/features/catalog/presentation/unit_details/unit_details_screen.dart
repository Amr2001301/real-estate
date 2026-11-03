import 'package:core/core.dart';
import 'package:flutter/material.dart';
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

// ─────────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────────

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
            return _DetailPage(unit: state.data!);
        }
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Floating-sheet detail page
// ─────────────────────────────────────────────────────────────────────────────

class _DetailPage extends StatelessWidget {
  const _DetailPage({required this.unit});
  final Unit unit;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final project = unit.project;
    Widget section(String title) => AppDetailPage.box(
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.xl, bottom: AppSpacing.md),
            child: AppDetailSectionTitle(title),
          ),
        );

    return AppDetailPage(
      onBack: () => context.canPop() ? context.pop() : context.go('/home'),
      title: unit.typeLabel(lang),
      subtitle: [
        ltr(unit.code),
        if (project != null) project.name.resolve(lang),
      ].join(' · '),
      actions: [
        NavHeaderGlass(child: FavoriteToggleButton(isProject: false, id: unit.id)),
        NavHeaderGlass(child: _CompareButton(unit: unit)),
      ],
      gallery: ImageGallery(images: unit.galleryImages),
      bottomBar: _StickyActionBar(unit: unit),
      slivers: [
        AppDetailPage.box(
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: AppSpacing.md),
              _IdentityRow(unit: unit),
              const SizedBox(height: AppSpacing.md),
              _PriceBlock(unit: unit),
            ],
          ),
        ),
        section(l10n.unitOverview),
        AppDetailPage.box(_SpecsRow(unit: unit)),
        // EE2/EE5 — the specs the website shows (only those it has).
        if (!unit.specs.isEmpty)
          AppDetailPage.box(
            Padding(padding: const EdgeInsets.only(top: AppSpacing.md), child: UnitSpecsGrid(specs: unit.specs)),
          ),
        section(l10n.unitAbout),
        AppDetailPage.box(_AboutCard(text: l10n.unitAboutGeneric)),
        if (project != null) ...[
          section(l10n.unitWithinProject),
          AppDetailPage.box(_WithinProject(project: project)),
        ],
        section(l10n.unitPlanTitle),
        AppDetailPage.box(_UnitPlan(unit: unit, onRequest: () => showUnitContactSheet(context, unit))),
        if (project != null)
          SliverToBoxAdapter(child: _SimilarUnits(projectId: project.id, currentUnitId: unit.id)),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Sheet chrome
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Identity + pricing
// ─────────────────────────────────────────────────────────────────────────────

class _IdentityRow extends StatelessWidget {
  const _IdentityRow({required this.unit});
  final Unit unit;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        UnitStatusChip(unit.status),
        Text(
          context.l10n.unitCode(unit.code),
          style: theme.textTheme.bodySmall?.copyWith(
            color: colors.inkMuted,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

class _PriceBlock extends StatelessWidget {
  const _PriceBlock({required this.unit});
  final Unit unit;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surfaceSoft,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(
          color: AppPalette.gold400.withValues(alpha: 0.25),
        ),
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
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    context.l10n.labelPrice,
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: colors.inkMuted,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.2,
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
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Section heading
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Spec chips
// ─────────────────────────────────────────────────────────────────────────────

class _SpecsRow extends StatelessWidget {
  const _SpecsRow({required this.unit});
  final Unit unit;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final stats = <(IconData, String, String)>[
      (Icons.bed_outlined, '${unit.bedrooms}', l10n.labelBedrooms),
      (Icons.bathtub_outlined, '${unit.bathrooms}', l10n.labelBathrooms),
      (
        Icons.square_foot_outlined,
        l10n.areaValue('${unit.area}'),
        l10n.labelArea,
      ),
      if (unit.floor != null)
        (Icons.layers_outlined, '${unit.floor}', l10n.labelFloor),
    ];

    return Row(
      children: [
        for (int i = 0; i < stats.length; i++) ...[
          if (i > 0) const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: _StatChip(
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

class _StatChip extends StatelessWidget {
  const _StatChip({
    required this.icon,
    required this.value,
    required this.label,
  });
  final IconData icon;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return AppDetailStat(icon: icon, value: value, label: label);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Content sections
// ─────────────────────────────────────────────────────────────────────────────

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

class _UnitPlan extends StatelessWidget {
  const _UnitPlan({required this.unit, required this.onRequest});
  final Unit unit;
  final VoidCallback onRequest;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final plans =
        unit.media.where((m) => m.type.toUpperCase() == 'FLOORPLAN').toList();

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

// ─────────────────────────────────────────────────────────────────────────────
// Similar units carousel
// ─────────────────────────────────────────────────────────────────────────────

class _SimilarUnits extends StatefulWidget {
  const _SimilarUnits({
    required this.projectId,
    required this.currentUnitId,
  });
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
        if (snapshot.connectionState != ConnectionState.done ||
            units.isEmpty) {
          return const SizedBox.shrink();
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: AppSpacing.xl),
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              child: SectionHeader(
                title: l10n.unitOtherInProject,
                onViewAll: () =>
                    context.push('/projects/${widget.projectId}/units'),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            SizedBox(
              height: 370,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding:
                    const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                itemCount: units.length,
                separatorBuilder: (_, _) =>
                    const SizedBox(width: AppSpacing.md),
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

// ─────────────────────────────────────────────────────────────────────────────
// Sticky action dock
// ─────────────────────────────────────────────────────────────────────────────

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
            ContactButtons(whatsappMessage: '${unit.typeLabel(Localizations.localeOf(context).languageCode)} · ${unit.code}'),
          ],
        ),
      ),
    );
  }
}

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

// ─────────────────────────────────────────────────────────────────────────────
// Compare toggle
// ─────────────────────────────────────────────────────────────────────────────

class _CompareButton extends StatelessWidget {
  const _CompareButton({required this.unit});
  final Unit unit;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<CompareCubit, List<Unit>>(
      builder: (context, selected) {
        final inCompare = selected.any((u) => u.id == unit.id);
        return IconButton(
          tooltip: inCompare
              ? context.l10n.compareRemove
              : context.l10n.compareAdd,
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

// ─────────────────────────────────────────────────────────────────────────────
// Contact sheet
// ─────────────────────────────────────────────────────────────────────────────

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
            '${unit.typeLabel(Localizations.localeOf(context).languageCode)} · ${l10n.unitCode(unit.code)}',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: context.appColors.inkMuted,
                ),
          ),
          const SizedBox(height: AppSpacing.lg),
          ContactButtons(whatsappMessage: '${unit.typeLabel(Localizations.localeOf(context).languageCode)} · ${unit.code}'),
        ],
      ),
    ),
  );
}
