import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../favorites/presentation/widgets/favorite_toggle_button.dart';
import '../../domain/entities/unit.dart';
import '../widgets/contact_buttons.dart';
import '../widgets/image_gallery.dart';
import '../widgets/price_text.dart';
import '../widgets/unit_status_chip.dart';
import '../compare/compare_cubit.dart';
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

class _Content extends StatelessWidget {
  const _Content({required this.unit});
  final Unit unit;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 300,
            pinned: true,
            actions: [
              FavoriteToggleButton(isProject: false, id: unit.id),
              _CompareButton(unit: unit),
            ],
            flexibleSpace: FlexibleSpaceBar(
              background: ImageGallery(images: unit.galleryImages),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(unit.type, style: theme.textTheme.headlineSmall),
                      ),
                      UnitStatusChip(unit.status),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(l10n.unitCode(unit.code),
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: context.appColors.inkMuted)),
                  const SizedBox(height: AppSpacing.md),
                  PriceText(unit.price, style: theme.textTheme.headlineSmall),
                  const SizedBox(height: AppSpacing.xl),

                  Text(l10n.unitOverview, style: theme.textTheme.titleLarge),
                  const SizedBox(height: AppSpacing.sm),
                  _SpecsGrid(unit: unit),

                  if (unit.project != null) ...[
                    const SizedBox(height: AppSpacing.xl),
                    _ProjectRef(project: unit.project!),
                  ],

                  const SizedBox(height: AppSpacing.xl),
                  ContactButtons(
                    whatsappMessage: '${unit.type} · ${unit.code}',
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  AppButton(
                    label: l10n.requestVisit,
                    icon: Icons.event_available_outlined,
                    expand: true,
                    onPressed: () => _onRequestVisit(context),
                  ),
                  const SizedBox(height: AppSpacing.xxl),
                ],
              ),
            ),
          ),
        ],
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
            Text(l10n.requestVisit, style: Theme.of(context).textTheme.titleLarge),
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
            ContactButtons(whatsappMessage: '${unit.type} · ${unit.code}'),
          ],
        ),
      ),
    );
  }
}

class _CompareButton extends StatelessWidget {
  const _CompareButton({required this.unit});
  final Unit unit;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<CompareCubit, List<Unit>>(
      builder: (context, selected) {
        final inCompare = selected.any((u) => u.id == unit.id);
        return IconButton(
          tooltip: l10nCompareTooltip(context, inCompare),
          icon: Icon(inCompare
              ? Icons.compare_arrows_rounded
              : Icons.add_to_photos_outlined),
          onPressed: () => _toggle(context),
        );
      },
    );
  }

  String l10nCompareTooltip(BuildContext context, bool inCompare) =>
      inCompare ? context.l10n.compareRemove : context.l10n.compareAdd;

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
              label: context.l10n.compareTitle,
              onPressed: () => context.push('/compare'),
            )
          : null,
    ));
  }
}

class _SpecsGrid extends StatelessWidget {
  const _SpecsGrid({required this.unit});
  final Unit unit;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final specs = <(IconData, String, String)>[
      (Icons.square_foot_outlined, l10n.labelArea, l10n.areaValue('${unit.area}')),
      (Icons.bed_outlined, l10n.labelBedrooms, '${unit.bedrooms}'),
      (Icons.bathtub_outlined, l10n.labelBathrooms, '${unit.bathrooms}'),
      if (unit.floor != null)
        (Icons.stairs_outlined, l10n.labelFloor, '${unit.floor}'),
    ];
    return Wrap(
      spacing: AppSpacing.md,
      runSpacing: AppSpacing.md,
      children: [
        for (final (icon, label, value) in specs)
          SizedBox(width: 150, child: _SpecTile(icon: icon, label: label, value: value)),
      ],
    );
  }
}

class _SpecTile extends StatelessWidget {
  const _SpecTile({required this.icon, required this.label, required this.value});
  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.md),
      elevation: AppCardElevation.none,
      child: Row(
        children: [
          Icon(icon, color: colors.brandGold),
          const SizedBox(width: AppSpacing.sm),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label,
                  style: theme.textTheme.labelSmall?.copyWith(color: colors.inkMuted)),
              Text(value, style: theme.textTheme.titleSmall),
            ],
          ),
        ],
      ),
    );
  }
}

class _ProjectRef extends StatelessWidget {
  const _ProjectRef({required this.project});
  final UnitProjectRef project;

  @override
  Widget build(BuildContext context) {
    final lang = Localizations.localeOf(context).languageCode;
    final colors = context.appColors;
    return AppCard(
      onTap: () => context.push('/projects/${project.id}'),
      child: Row(
        children: [
          Icon(Icons.apartment_rounded, color: colors.brandGold),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(context.l10n.labelProject,
                    style: Theme.of(context)
                        .textTheme
                        .labelSmall
                        ?.copyWith(color: colors.inkMuted)),
                Text(project.name.resolve(lang),
                    style: Theme.of(context).textTheme.titleMedium),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded),
        ],
      ),
    );
  }
}
