import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../common/catalog_status_label.dart';
import '../../../common/reservation_status_label.dart';
import '../../../common/staff_share.dart';
import '../../dashboard/home_kit/home_kit.dart';
import '../../installments/domain/repositories/installments_repository.dart';
import '../domain/entities/staff_project.dart';
import '../kit/catalog_kit.dart';
import '../kit/catalog_media.dart';
import 'unit_page_data.dart';

/// A unit's page (owner-approved design, 2026-11-04), with the website's
/// unit page: the cover (status, type, code, where); the price with the
/// plan and "calculate your instalment"; area, rooms, bathrooms and floor;
/// the specs; the live reservation and the past ones; the project, phase
/// and building; and the status history. Sharing sits on the cover; the
/// only bottom button is "book the unit", for a free unit (the owner found
/// three buttons side by side too many).
class UnitPageScreen extends StatefulWidget {
  const UnitPageScreen({super.key});

  @override
  State<UnitPageScreen> createState() => _UnitPageScreenState();
}

class _UnitPageScreenState extends State<UnitPageScreen> {
  List<InstallmentOffer> _offers = const [];
  bool _offersAsked = false;

  @override
  void initState() {
    super.initState();
    context.read<UnitPageCubit>().load();
  }

  // Best-effort: the page shows without them.
  Future<void> _loadOffers(StaffUnit unit) async {
    if (_offersAsked || unit.projectId == null) return;
    _offersAsked = true;
    final InstallmentsRepository repo;
    try {
      repo = context.read<InstallmentsRepository>();
    } catch (_) {
      return;
    }
    final result = await repo.unitOffers(projectId: unit.projectId!, unitId: unit.id);
    if (!mounted) return;
    if (result case Ok(:final data)) setState(() => _offers = data);
  }

  void _share(StaffUnit unit) => StaffShare.unit(
        unitId: unit.id,
        unitCode: unit.code,
        projectName: unit.projectName?.resolve(Localizations.localeOf(context).languageCode) ?? '',
        l10n: context.l10n,
      );

  void _calculate(StaffUnit unit) {
    final lang = Localizations.localeOf(context).languageCode;
    if (_offers.every((o) => o.options.isEmpty)) {
      context.push('/calculator', extra: {'price': double.tryParse(unit.price ?? ''), 'projectId': unit.projectId});
      return;
    }
    showInstallmentCalculator(
      context,
      subtitle: [ltr(unit.code), if (unit.price != null) PriceFormatter.formatString(unit.price, languageCode: lang)].join(' · '),
      offers: _offers,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BlocConsumer<UnitPageCubit, DataState<UnitPage>>(
          listener: (context, state) {
            if (state.data != null) _loadOffers(state.data!.unit);
          },
          builder: (context, state) {
            final page = state.data;
            if (page == null) {
              return Column(children: [
                const HomeListHero(title: '', back: true),
                Expanded(
                  child: state.status == DataStatus.failure
                      ? ErrorState(failure: state.failure, onRetry: context.read<UnitPageCubit>().load)
                      : const Center(child: CircularProgressIndicator()),
                ),
              ]);
            }
            final u = page.unit;
            final lang = Localizations.localeOf(context).languageCode;
            final where = [
              if (u.projectName != null) u.projectName!.resolve(lang),
              if ((page.buildingName ?? '').isNotEmpty) page.buildingName!,
              if ((u.projectCity ?? '').isNotEmpty) u.projectCity!,
            ].join(' · ');
            final photos = <String>{if (u.coverImage != null) u.coverImage!, ...u.mediaUrls}.toList();
            return Column(children: [
              Expanded(
                child: RefreshIndicator(
                  onRefresh: context.read<UnitPageCubit>().load,
                  child: ListView(padding: EdgeInsets.zero, children: [
                    HomeOverlap(
                      overlap: 30,
                      top: CatalogPageHero(
                      height: 270,
                      photos: photos,
                      badges: [
                        CatalogBadge.status(unitStatusLabel(l10n, u.status), unitStatusColor(u.status)),
                        if ((page.typeName ?? '').isNotEmpty) CatalogBadge.glass(page.typeName!),
                      ],
                      title: l10n.unitTitle(ltr(u.code)),
                      place: where,
                      shareKey: const Key('unit-share'),
                      onShare: () => _share(u),
                    ),
                      bottom: UnitPriceCard(
                        price: double.tryParse(u.price ?? ''),
                        handover: u.specs.deliveryDate,
                        pricePerMeter: page.pricePerMeter,
                        offers: _offers,
                        onCalculate: () => _calculate(u),
                      ),
                    ),
                    const SizedBox(height: 30),
                    Padding(padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md), child: UnitFacts(area: double.tryParse(u.area ?? ''), bedrooms: u.bedrooms, bathrooms: u.bathrooms, floor: u.floor)),
                    HomeSection(icon: Icons.list_alt_rounded, title: l10n.upSpecs, child: UnitSpecTable(code: u.code, typeName: page.typeName, specs: u.specs)),
                    HomeSection(
                      icon: Icons.bookmark_rounded,
                      title: l10n.upReservation,
                      action: page.reservations.isEmpty ? null : l10n.upAllReservations,
                      onAction: page.reservations.isEmpty ? null : () => context.push('/reservations'),
                      child: _Reservation(page: page),
                    ),
                    if (u.floorPlanUrls.isNotEmpty)
                      HomeSection(icon: Icons.architecture_rounded, title: l10n.sectionFloorPlans, child: CatalogFloorPlans(urls: u.floorPlanUrls)),
                    HomeSection(icon: Icons.apartment_rounded, title: l10n.upProject, child: _Where(page: page)),
                    if (u.hasLocation)
                      HomeSection(
                        icon: Icons.map_rounded,
                        title: l10n.projectLocation,
                        child: CatalogMap(lat: u.latitude!, lng: u.longitude!, label: ltr(u.code), openLabel: l10n.openInMaps),
                      ),
                    if (u.maintenanceItems.isNotEmpty)
                      HomeSection(icon: Icons.build_rounded, title: l10n.upMaintenance, child: _Maintenance(items: u.maintenanceItems)),
                    if (page.history.isNotEmpty)
                      HomeSection(icon: Icons.history_rounded, title: l10n.upHistory, child: _History(rows: page.history)),
                    const SizedBox(height: 24),
                  ]),
                ),
              ),
              if (u.status == 'AVAILABLE')
                Container(
                  padding: EdgeInsets.fromLTRB(16, 10, 16, 10 + MediaQuery.paddingOf(context).bottom),
                  decoration: BoxDecoration(
                    color: context.appColors.canvas,
                    border: Border(top: BorderSide(color: context.appColors.hairline)),
                  ),
                  child: FilledButton.icon(
                    key: const Key('unit-reserve'),
                    onPressed: () => context.push(
                      '/reservations/new',
                      extra: {'unitId': u.id, if (u.projectId != null) 'projectId': u.projectId},
                    ),
                    icon: const Icon(Icons.bookmark_add_rounded, size: 19),
                    label: Text(l10n.reservationCreate),
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(48),
                      backgroundColor: AppPalette.gold400,
                      foregroundColor: AppPalette.navy,
                      textStyle: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                    ),
                  ),
                ),
            ]);
          },
        ),
      ),
    );
  }
}

/// The price, the cheapest instalment, the plan's down payment, term and
/// handover, and "calculate your instalment".
class UnitPriceCard extends StatelessWidget {
  const UnitPriceCard({
    super.key,
    required this.price,
    required this.offers,
    required this.onCalculate,
    this.handover,
    this.pricePerMeter,
    this.extraMini,
  });
  final double? price;
  final List<InstallmentOffer> offers;
  final VoidCallback onCalculate;
  final DateTime? handover;
  final double? pricePerMeter;

  /// One more mini figure after the plan's (the broker's commission).
  final (String, String)? extraMini;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final price = this.price;
    final monthly = cheapestInstallmentLine(l10n, lang, offers);
    final offer = offers.where((o) => o.options.isNotEmpty).firstOrNull;
    final longest = offer?.longest;
    final handover = this.handover;
    final minis = <(String, String)>[
      if (offer != null) (l10n.detailUpfrontPct(offer.downPaymentPercentLabel), ltr(catalogGrouped(offer.downPayment))),
      if (longest != null) (l10n.detailTerm, durationText(l10n, longest.durationMonths)),
      if (handover != null) (l10n.detailHandover, ltr('${handover.year}')),
      ?extraMini,
    ];
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: colors.hairline),
        boxShadow: const [BoxShadow(color: Color(0x290F1E33), blurRadius: 40, offset: Offset(0, 18))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(l10n.detailTotalPrice, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
              if (price != null)
                Text.rich(
                  key: const Key('unit-price'),
                  TextSpan(children: [
                    TextSpan(text: ltr(catalogGrouped(price)), style: homeDisplay(27, colors.inkStrong)),
                    TextSpan(text: ' ${PriceFormatter.symbol(lang)}', style: TextStyle(fontSize: 13, color: colors.inkMuted)),
                  ]),
                )
              else
                Text(l10n.priceOnRequest, style: homeDisplay(19, colors.inkMuted)),
              if (monthly != null)
                Text(monthly, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: catalogAvailable)),
            ]),
          ),
          if (pricePerMeter != null)
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text(l10n.upPerMeter, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
              Text(ltr(catalogGrouped(pricePerMeter!)), style: homeDisplay(15, colors.inkStrong)),
            ]),
        ]),
        if (minis.isNotEmpty) ...[
          const SizedBox(height: 11),
          Row(children: [
            for (final (i, (k, v)) in minis.indexed) ...[
              if (i > 0) const SizedBox(width: 6),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
                  decoration: BoxDecoration(
                    color: homeTint(context),
                    border: Border.all(color: homeTintBorder(context)),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(k, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                    Text(v, maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                  ]),
                ),
              ),
            ],
          ]),
        ],
        if (price != null) ...[
          const SizedBox(height: 10),
          Material(
            color: Colors.transparent,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(13),
              side: const BorderSide(color: AppPalette.gold400, width: 1.4),
            ),
            child: InkWell(
              key: const Key('unit-calculator'),
              borderRadius: BorderRadius.circular(13),
              onTap: onCalculate,
              child: SizedBox(
                height: 42,
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  const Icon(Icons.calculate_rounded, size: 18, color: AppPalette.gold600),
                  const SizedBox(width: 6),
                  Text(l10n.detailCalcInstallment,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppPalette.gold600)),
                ]),
              ),
            ),
          ),
        ],
      ]),
    );
  }
}

/// Area, rooms, bathrooms, floor.
class UnitFacts extends StatelessWidget {
  const UnitFacts({super.key, this.area, this.bedrooms, this.bathrooms, this.floor});
  final double? area;
  final int? bedrooms;
  final int? bathrooms;
  final int? floor;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final area = this.area;
    final facts = <(IconData, String, String)>[
      (Icons.straighten_rounded, area == null ? '—' : l10n.unitAreaValue(catalogGrouped(area)), l10n.unitArea),
      (Icons.bed_rounded, bedrooms == null ? '—' : '$bedrooms', l10n.unitBedrooms),
      (Icons.bathtub_rounded, bathrooms == null ? '—' : '$bathrooms', l10n.unitBathrooms),
      (Icons.stairs_rounded, floor == null ? '—' : (floor == 0 ? l10n.cuGroundFloor : '$floor'), l10n.unitFloor),
    ];
    return Container(
      decoration: homeCard(context, radius: 22),
      child: IntrinsicHeight(
        child: Row(children: [
          for (final (i, (icon, value, label)) in facts.indexed) ...[
            if (i > 0) VerticalDivider(width: 1, color: colors.hairline),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
                child: Column(children: [
                  Icon(icon, size: 20, color: AppPalette.gold500),
                  const SizedBox(height: 3),
                  Text(value, style: homeDisplay(value.length > 7 ? 15 : 18, colors.inkStrong)),
                  Text(label, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                ]),
              ),
            ),
          ],
        ]),
      ),
    );
  }
}

/// The code, the type and the specs the website shows, as a table.
class UnitSpecTable extends StatelessWidget {
  const UnitSpecTable({super.key, required this.code, this.typeName, required this.specs, this.extra = const []});
  final String code;
  final String? typeName;
  final UnitSpecs specs;

  /// Rows after the specs (the broker's access).
  final List<(String, String)> extra;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final rows = <(String, String)>[
      (l10n.upCode, ltr(code)),
      if ((typeName ?? '').isNotEmpty) (l10n.ppType, typeName!),
      for (final it in unitSpecItems(specs, l10n, lang)) (it.label, it.value),
      ...extra,
    ];
    return Container(
      key: const Key('unit-spec-table'),
      decoration: homeCard(context, radius: 22),
      clipBehavior: Clip.antiAlias,
      child: LayoutBuilder(builder: (context, box) {
        final w = box.maxWidth / 2;
        return Wrap(children: [
          for (final (i, (k, v)) in rows.indexed)
            Container(
              width: w,
              padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
              decoration: BoxDecoration(
                border: BorderDirectional(
                  end: i.isEven ? BorderSide(color: colors.hairline) : BorderSide.none,
                  bottom: i < rows.length - (rows.length.isEven ? 2 : 1) ? BorderSide(color: colors.hairline) : BorderSide.none,
                ),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(k, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                const SizedBox(height: 2),
                Text(v, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: colors.inkStrong)),
              ]),
            ),
        ]);
      }),
    );
  }
}

/// The live reservation (number, status, client, consultant, expiry) and
/// the past ones, as on the website.
class _Reservation extends StatelessWidget {
  const _Reservation({required this.page});
  final UnitPage page;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final r = page.active;
    final past = page.past;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (r != null)
        Material(
          color: Colors.transparent,
          child: InkWell(
            key: const Key('unit-active-reservation'),
            borderRadius: BorderRadius.circular(22),
            onTap: () => context.push('/reservations/${r.id}'),
            child: Container(
              padding: const EdgeInsets.all(13),
              decoration: BoxDecoration(
                gradient: Theme.of(context).brightness == Brightness.dark
                    ? LinearGradient(colors: [AppPalette.gold500.withValues(alpha: 0.16), AppPalette.gold500.withValues(alpha: 0.08)])
                    : const LinearGradient(colors: [Color(0xFFFFF9EC), Color(0xFFFCF0D8)]),
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: homeTintBorder(context)),
              ),
              child: Column(children: [
                Row(children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(color: catalogReserved, borderRadius: BorderRadius.circular(12)),
                    child: const Icon(Icons.bookmark_rounded, color: Colors.white, size: 20),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(l10n.upActiveReservation, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                      if (r.number != null) Text(ltr(r.number!), style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                    ]),
                  ),
                  StatusBadge(label: reservationStatusLabel(l10n, r.status), tone: reservationStatusTone(r.status)),
                ]),
                const SizedBox(height: 11),
                Row(children: [
                  for (final (i, (k, v)) in [
                    (l10n.upClient, r.client ?? '—'),
                    (l10n.upSales, r.sales ?? '—'),
                    (l10n.upExpires, r.expiresAt == null ? '—' : DateFormatter.dayMonth(r.expiresAt!, languageCode: lang)),
                  ].indexed) ...[
                    if (i > 0) const SizedBox(width: 6),
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
                        decoration: BoxDecoration(color: colors.surface.withValues(alpha: 0.75), borderRadius: BorderRadius.circular(12)),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(k, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                          Text(v, maxLines: 1, overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                        ]),
                      ),
                    ),
                  ],
                ]),
              ]),
            ),
          ),
        )
      else
        Container(
          padding: const EdgeInsets.all(14),
          decoration: homeCard(context, radius: 22),
          child: Row(children: [
            Icon(Icons.bookmark_border_rounded, color: unitStatusColor(page.unit.status)),
            const SizedBox(width: 10),
            Expanded(
              // A rep sees only their own reservations (the server's scope):
              // a unit a colleague holds still reads as held, from the unit.
              child: Text(
                key: const Key('unit-reservation-note'),
                switch (page.unit.status) {
                  'AVAILABLE' => l10n.upNoReservation,
                  'RESERVED' => page.reservedUntil == null
                      ? l10n.upReservedNoDate
                      : l10n.upReservedUntil(DateFormatter.dayMonth(page.reservedUntil!, languageCode: lang)),
                  'SOLD' => l10n.upSoldNote,
                  _ => l10n.upNoActive,
                },
                style: TextStyle(fontSize: 12.5, color: colors.inkMuted),
              ),
            ),
          ]),
        ),
      if (past.isNotEmpty) ...[
        const SizedBox(height: 12),
        Text(l10n.upPastN(past.length), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: colors.inkMuted)),
        const SizedBox(height: 6),
        _ListCard(
          radius: 18,
          child: Column(children: [
            for (final (i, p) in past.indexed) ...[
              if (i > 0) Divider(height: 1, color: colors.hairline),
              ListTile(
                dense: true,
                onTap: () => context.push('/reservations/${p.id}'),
                title: Text(p.client ?? '—', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                subtitle: Text(
                  [if (p.number != null) ltr(p.number!), if (p.createdAt != null) DateFormatter.dayMonth(p.createdAt!, languageCode: lang)].join(' · '),
                  style: TextStyle(fontSize: 12, color: colors.inkMuted),
                ),
                trailing: StatusBadge(label: reservationStatusLabel(l10n, p.status), tone: reservationStatusTone(p.status)),
              ),
            ],
          ]),
        ),
      ],
    ]);
  }
}

/// The project (opens it), the phase, the building, the city and the last
/// update.
class _Where extends StatelessWidget {
  const _Where({required this.page});
  final UnitPage page;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final u = page.unit;
    Widget cell(String k, String? v) => Expanded(
          child: Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(k, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
              Text((v ?? '').isEmpty ? '—' : v!, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.inkStrong)),
            ]),
          ),
        );
    return Material(
      color: colors.surface,
      borderRadius: BorderRadius.circular(22),
      child: InkWell(
        key: const Key('unit-project'),
        borderRadius: BorderRadius.circular(22),
        onTap: u.projectId == null ? null : () => context.push('/projects/${u.projectId}'),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(22), border: Border.all(color: colors.hairline)),
          child: Column(children: [
            Row(children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(gradient: homeNavyGradient, borderRadius: BorderRadius.circular(13)),
                child: const Icon(Icons.apartment_rounded, color: AppPalette.gold300, size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(l10n.upProject, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                  Text(u.projectName?.resolve(lang) ?? '—', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                ]),
              ),
              // chevron_right turns into an outward ‹ in Arabic, as the homes.
              if (u.projectId != null) const Icon(Icons.chevron_right_rounded, color: Color(0xFFB8AE9F)),
            ]),
            const SizedBox(height: 10),
            Divider(height: 1, color: colors.hairline),
            Row(children: [cell(l10n.upPhase, page.phaseName), cell(l10n.upBuilding, page.buildingName)]),
            Row(children: [
              cell(l10n.labelCity, u.projectCity),
              cell(l10n.upUpdated, page.updatedAt == null ? null : DateFormatter.dayMonth(page.updatedAt!, languageCode: lang)),
            ]),
          ]),
        ),
      ),
    );
  }
}

class _Maintenance extends StatelessWidget {
  const _Maintenance({required this.items});
  final List<StaffMaintenanceItem> items;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    return _ListCard(
      child: Column(children: [
        for (final (i, m) in items.indexed) ...[
          if (i > 0) Divider(height: 1, color: colors.hairline),
          ListTile(
            dense: true,
            leading: const Icon(Icons.verified_user_rounded, color: AppPalette.gold500),
            title: Text(m.name.resolve(lang), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.inkStrong)),
            subtitle: Text(
              [
                if (m.categoryName != null) m.categoryName!.resolve(lang),
                if (m.warrantyEnd != null) l10n.upWarrantyUntil(DateFormatter.shortDate(m.warrantyEnd!, languageCode: lang)),
              ].join(' · '),
              style: TextStyle(fontSize: 12, color: colors.inkMuted),
            ),
          ),
        ],
      ]),
    );
  }
}

/// Each status change, newest first, as the website's activity.
class _History extends StatelessWidget {
  const _History({required this.rows});
  final List<UnitHistoryRow> rows;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 4),
      decoration: homeCard(context, radius: 22),
      child: Column(children: [
        for (final h in rows)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                margin: const EdgeInsets.only(top: 3),
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  color: unitStatusColor(h.to),
                  shape: BoxShape.circle,
                  border: Border.all(color: unitStatusColor(h.to).withValues(alpha: 0.25), width: 3),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(l10n.upHistoryLine(unitStatusLabel(l10n, h.from), unitStatusLabel(l10n, h.to)),
                      style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                  Text(
                    [
                      if ((h.reason ?? '').isNotEmpty) ltrRuns(h.reason!),
                      if (h.by != null) l10n.upBy(h.by!),
                      if (h.at != null) '${DateFormatter.dayMonth(h.at!, languageCode: lang)} ${DateFormatter.time(h.at!, languageCode: lang)}',
                    ].join(' · '),
                    style: TextStyle(fontSize: 12, color: colors.inkMuted),
                  ),
                ]),
              ),
            ]),
          ),
      ]),
    );
  }
}

/// A white rounded card that list tiles can paint their ink on.
class _ListCard extends StatelessWidget {
  const _ListCard({required this.child, this.radius = 22});
  final Widget child;
  final double radius;

  @override
  Widget build(BuildContext context) => Material(
        color: context.appColors.surface,
        clipBehavior: Clip.antiAlias,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radius),
          side: BorderSide(color: context.appColors.hairline),
        ),
        child: child,
      );
}
