import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import '../../../../router/auth_navigation.dart';
import '../../../favorites/presentation/widgets/favorite_toggle_button.dart';
import '../../domain/entities/catalog_enums.dart';
import '../../domain/entities/project.dart';
import '../../domain/entities/unit.dart';
import '../../domain/repositories/catalog_repository.dart';
import '../widgets/amenity_chips.dart';
import '../widgets/contact_buttons.dart';
import '../widgets/unit_card.dart';
import 'project_details_cubit.dart';

const _navyDeep = Color(0xFF0B1726);

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

  @override
  State<_DetailPage> createState() => _DetailPageState();
}

class _DetailPageState extends State<_DetailPage> {
  final _aboutKey = GlobalKey();
  final _unitsKey = GlobalKey();
  final _amenitiesKey = GlobalKey();
  final _paymentKey = GlobalKey();
  final _locationKey = GlobalKey();
  ProjectPlanSummary _plans = const ProjectPlanSummary();
  String? _startingPrice;

  @override
  void initState() {
    super.initState();
    _load();
  }

  // Both best-effort: the page shows without them.
  Future<void> _load() async {
    final repo = context.read<CatalogRepository>();
    final id = widget.state.project!.id;
    final results = await Future.wait([
      repo.getProjectPlans(id),
      repo.listUnits(projectId: id, status: UnitStatus.available, sort: UnitSort.priceAsc, pageSize: 1),
    ]);
    if (!mounted) return;
    setState(() {
      if (results[0] case Ok<ProjectPlanSummary>(:final data)) _plans = data;
      if (results[1] case Ok<Paginated<Unit>>(:final data)) _startingPrice = data.data.firstOrNull?.price;
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.state;
    final project = state.project!;
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final whatsapp = EnvConfig.current.whatsappNumber;
    final offerLine = projectOfferLine(l10n, _plans);
    Widget section(String title, Widget child, {Key? key}) => AppDetailPage.box(
          Padding(
            key: key,
            padding: const EdgeInsets.only(top: AppSpacing.xl),
            child: _Section(title: title, child: child),
          ),
        );

    return AppDetailPage(
      onBack: () => context.pop(),
      title: project.name.resolve(lang),
      subtitle: project.city,
      actions: [NavHeaderGlass(child: FavoriteToggleButton(isProject: true, id: project.id))],
      photos: project.galleryImages,
      card: AppPriceCard(
        label: _startingPrice != null ? l10n.detailPricesFrom : l10n.labelPrice,
        price: _startingPrice != null
            ? PriceFormatter.formatString(_startingPrice, languageCode: lang)
            : l10n.priceOnRequest,
        caption: offerLine,
        facts: [
          AppPriceFact(l10n.detailAvailableUnits, '${project.availableUnitsCount}'),
          AppPriceFact(l10n.labelCity, project.city),
          if (project.services.isNotEmpty) AppPriceFact(l10n.labelAmenities, '${project.services.length}'),
        ],
        actionLabel: l10n.requestInfo,
        actionIcon: Icons.info_outline_rounded,
        onAction: () => _requestInfo(context, project),
      ),
      photoBadge: project.featured ? _FeaturedPill(label: l10n.featuredBadge) : null,
      bottomBar: AppDetailBottomBar(
        children: [
          if (whatsapp.isNotEmpty)
            AppDetailIconButton(
              key: const Key('project-whatsapp'),
              icon: Icons.chat_rounded,
              tooltip: l10n.contactWhatsapp,
              onPressed: () => ContactActions.whatsApp(number: whatsapp, message: project.name.resolve(lang)),
            ),
          AppDetailSecondaryButton(
            key: const Key('project-browse-units'),
            label: l10n.viewProjectUnits,
            onPressed: () => context.push('/projects/${project.id}/units'),
          ),
          AppDetailPrimaryButton(
            key: const Key('project-request-visit'),
            label: l10n.requestVisit,
            onPressed: () => _requestVisit(context, project),
          ),
        ],
      ),
      slivers: [
        const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.md)),
        AppSectionTabsSliver(
          tabs: [
            AppSectionTab(l10n.detailTabOverview, _aboutKey),
            if (state.previewUnits.isNotEmpty) AppSectionTab(l10n.detailTabUnits, _unitsKey),
            if (project.services.isNotEmpty) AppSectionTab(l10n.detailTabAmenities, _amenitiesKey),
            if (!_plans.isEmpty) AppSectionTab(l10n.detailTabPayment, _paymentKey),
            if (project.hasLocation) AppSectionTab(l10n.detailTabLocation, _locationKey),
          ],
        ),
        section(
          l10n.projectAbout,
          project.description.isEmpty
              ? _AboutBlock(text: l10n.unitAboutGeneric)
              : _AboutBlock(text: project.description.resolve(lang)),
          key: _aboutKey,
        ),
        if (state.previewUnits.isNotEmpty)
          SliverToBoxAdapter(
            child: Padding(
              key: _unitsKey,
              padding: const EdgeInsets.only(top: AppSpacing.xl),
              child: _UnitsPreview(state: state),
            ),
          ),
        if (project.services.isNotEmpty)
          section(l10n.projectAmenities, AmenityChips(services: project.services), key: _amenitiesKey),
        if (!_plans.isEmpty)
          section(l10n.detailPaymentPlans, AppPlanOfferCards(plans: _plans), key: _paymentKey),
        if (project.hasLocation)
          section(l10n.projectLocation, _LocationTile(project: project, lang: lang, l10n: l10n), key: _locationKey),
      ],
    );
  }
}

void _requestVisit(BuildContext context, ProjectDetail project) {
  final authed = context.read<SessionCubit>().state.isAuthenticated;
  if (authed) {
    context.push('/visit-request', extra: _requestSubject(context, project));
  } else {
    _showVisitPrompt(context, project);
  }
}

void _requestInfo(BuildContext context, ProjectDetail project) {
  final authed = context.read<SessionCubit>().state.isAuthenticated;
  if (authed) {
    context.push('/info-request', extra: _requestSubject(context, project));
  } else {
    _showVisitPrompt(context, project);
  }
}

/// What a request screen shows it is about: the project's name, city and cover.
Map<String, dynamic> _requestSubject(BuildContext context, ProjectDetail project) {
  final lang = Localizations.localeOf(context).languageCode;
  return {
    'projectId': project.id,
    'title': project.name.resolve(lang),
    'subtitle': project.city,
    'imageUrl': project.coverImage,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero panel
// ─────────────────────────────────────────────────────────────────────────────

/// "مميز" on the photos of a featured project.
class _FeaturedPill extends StatelessWidget {
  const _FeaturedPill({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [AppPalette.gold300, AppPalette.gold500]),
        borderRadius: AppRadii.pillAll,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.star_rounded, size: 13, color: AppPalette.navy),
          const SizedBox(width: 5),
          Text(label, style: const TextStyle(color: AppPalette.navy, fontSize: 12, fontWeight: FontWeight.w800)),
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
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [AppDetailSectionTitle(title), const SizedBox(height: AppSpacing.md), child]);
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
// Location section — embedded OSM map + secondary navigation button
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
    final point = LatLng(project.lat!, project.lng!);
    final label = project.name.resolve(lang);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(AppRadii.lg),
          child: SizedBox(
            height: 220,
            child: FlutterMap(
              options: MapOptions(
                initialCenter: point,
                initialZoom: 15,
                interactionOptions: const InteractionOptions(
                  flags:
                      InteractiveFlag.pinchZoom | InteractiveFlag.doubleTapZoom,
                ),
              ),
              children: [
                TileLayer(
                  urlTemplate:
                      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                  subdomains: const ['a', 'b', 'c'],
                  userAgentPackageName: 'com.devora.customer',
                  maxZoom: 19,
                  additionalOptions: const {
                    'attribution':
                        '© OpenStreetMap contributors',
                  },
                ),
                MarkerLayer(
                  markers: [
                    Marker(
                      point: point,
                      width: 48,
                      height: 48,
                      child: const _MapPin(),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        OutlinedButton.icon(
          onPressed: () => ContactActions.openMap(
            lat: project.lat!,
            lng: project.lng!,
            label: label,
          ),
          style: OutlinedButton.styleFrom(
            foregroundColor: AppPalette.gold500,
            side: const BorderSide(color: AppPalette.gold400, width: 1.2),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadii.md),
            ),
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
          icon: const Icon(Icons.open_in_new_rounded, size: 16),
          label: Text(l10n.openInMaps),
        ),
      ],
    );
  }
}

class _MapPin extends StatelessWidget {
  const _MapPin();

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: AppPalette.gold400,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 2.5),
            boxShadow: [
              BoxShadow(
                color: AppPalette.gold400.withValues(alpha: 0.5),
                blurRadius: 10,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: const Icon(
            Icons.apartment_rounded,
            size: 16,
            color: Colors.white,
          ),
        ),
        Container(
          width: 2,
          height: 8,
          decoration: BoxDecoration(
            color: AppPalette.gold400,
            borderRadius: BorderRadius.circular(1),
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Units preview
// ─────────────────────────────────────────────────────────────────────────────

class _UnitsPreview extends StatelessWidget {
  const _UnitsPreview({required this.state});
  final ProjectDetailsState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final project = state.project!;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Expanded(child: AppDetailSectionTitle(l10n.projectUnits, icon: Icons.grid_view_rounded)),
          InkWell(
            onTap: () => context.push('/projects/${project.id}/units'),
            child: Row(children: [
              Text(l10n.viewAll, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppPalette.gold600)),
              // chevron_right mirrors to the outward arrow in Arabic.
              const Icon(Icons.chevron_right_rounded, size: 18, color: AppPalette.gold600),
            ]),
          ),
        ]),
        const SizedBox(height: 12),
        for (final unit in state.previewUnits.take(3))
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: UnitCard(unit: unit, onTap: () => context.push('/units/${unit.id}')),
          ),
      ]),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sticky action dock
// ─────────────────────────────────────────────────────────────────────────────

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
