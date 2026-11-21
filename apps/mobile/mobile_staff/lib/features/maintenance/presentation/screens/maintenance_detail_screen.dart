import 'dart:async';
import 'dart:typed_data';

import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/maintenance_request.dart';
import '../cubit/maintenance_detail_cubit.dart';
import '../maintenance_format.dart';

// ── Palette ───────────────────────────────────────────────────────────────────
const _navyDeep = Color(0xFF0B1726);
const _navyCard = Color(0xFF1A3352);
const _navyLight = Color(0xFF243F62);

List<Color> _statusGradient(MaintenanceStatus s) => switch (s) {
  MaintenanceStatus.open ||
  MaintenanceStatus.assigned => [_navyLight, _navyDeep],
  MaintenanceStatus.inProgress => [
    const Color(0xFF0F3460),
    const Color(0xFF061830),
  ],
  _ => [const Color(0xFF1B5E3F), const Color(0xFF0D3826)],
};

Color _statusAccent(MaintenanceStatus s) => switch (s) {
  MaintenanceStatus.open || MaintenanceStatus.assigned => AppPalette.gold300,
  MaintenanceStatus.inProgress => const Color(0xFF60A5FA),
  _ => const Color(0xFF4ADE80),
};

IconData _statusIcon(MaintenanceStatus s) => switch (s) {
  MaintenanceStatus.open => Icons.inbox_rounded,
  MaintenanceStatus.assigned => Icons.person_pin_rounded,
  MaintenanceStatus.inProgress => Icons.engineering_rounded,
  MaintenanceStatus.resolved => Icons.check_circle_rounded,
  MaintenanceStatus.closed => Icons.lock_rounded,
  _ => Icons.build_rounded,
};

Color _warrantyColor(MaintenanceWarrantyStatus s) => switch (s) {
  MaintenanceWarrantyStatus.inWarranty => const Color(0xFF4ADE80),
  MaintenanceWarrantyStatus.outOfWarranty => const Color(0xFFF97316),
  MaintenanceWarrantyStatus.unknown => const Color(0xFF9CA3AF),
};

Color _resolvedByColor(MaintenanceResolvedBy? by) => switch (by) {
  MaintenanceResolvedBy.both => const Color(0xFF4ADE80),
  MaintenanceResolvedBy.customer ||
  MaintenanceResolvedBy.supervisor => AppPalette.gold300,
  null => const Color(0xFF9CA3AF),
};

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────
class MaintenanceDetailScreen extends StatefulWidget {
  const MaintenanceDetailScreen({super.key, this.fallback});
  final MaintenanceRequest? fallback;

  @override
  State<MaintenanceDetailScreen> createState() =>
      _MaintenanceDetailScreenState();
}

class _MaintenanceDetailScreenState extends State<MaintenanceDetailScreen> {
  @override
  void initState() {
    super.initState();
    context.read<MaintenanceDetailCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: BlocConsumer<MaintenanceDetailCubit, MaintenanceDetailState>(
          listenWhen: (a, b) =>
              a.actionFailure != b.actionFailure && b.actionFailure != null,
          listener: (context, state) =>
              showFailureSnackBar(context, state.actionFailure!),
          builder: (context, state) {
            final r = state.detail?.request ?? widget.fallback;
            final status = r?.status;
            final gradient = _statusGradient(status ?? MaintenanceStatus.unknown);
            final accent = _statusAccent(status ?? MaintenanceStatus.unknown);
            final category = r?.categoryName?.resolve(lang);
            final ready = state.status == DataStatus.success || state.status == DataStatus.empty;
            final bar = ready && state.detail != null ? _ActionBar.maybe(context, state.detail!.request, l10n, state) : null;

            return Column(children: [
              Expanded(
                child: CustomScrollView(
                  slivers: [
                    SliverToBoxAdapter(
                      child: HomeListHero(
                        back: true,
                        title: (category ?? '').isNotEmpty ? category! : l10n.maintenanceFallbackTitle,
                        badge: status == null ? null : DvHeroBadge(maintenanceStatusLabel(context.l10n, status), tone: dvToneOf(maintenanceStatusTone(status))),
                        subtitle: r == null
                            ? null
                            : [
                                if (r.unitCode != null) ltr(r.unitCode!),
                                if (r.priority != MaintenancePriority.unknown) maintenancePriorityLabel(context.l10n, r.priority),
                              ].join(' · '),
                      ),
                    ),
                    SliverPadding(
                      padding: EdgeInsets.fromLTRB(16, 4, 16, bar == null ? 40 : 24),
                      sliver: switch (state.status) {
                        DataStatus.initial || DataStatus.loading => const SliverFillRemaining(
                          hasScrollBody: true,
                          child: StaffListSkeleton(rows: 5),
                        ),
                        DataStatus.failure => SliverFillRemaining(
                          hasScrollBody: false,
                          child: ErrorState(failure: state.failure, onRetry: () => context.read<MaintenanceDetailCubit>().load()),
                        ),
                        DataStatus.empty || DataStatus.success => SliverList(
                          delegate: SliverChildListDelegate(_buildCards(context, state, l10n, lang, gradient, accent)),
                        ),
                      },
                    ),
                  ],
                ),
              ),
              ?bar,
            ]);
          },
        ),
      ),
    );
  }

  List<Widget> _buildCards(
    BuildContext context,
    MaintenanceDetailState state,
    AppLocalizations l10n,
    String lang,
    List<Color> gradient,
    Color accent,
  ) {
    final detail = state.detail;
    if (detail == null) return [];
    final r = detail.request;
    final icon = _statusIcon(r.status);

    String fmtDate(DateTime? d) =>
        d == null ? '—' : DateFormatter.mediumDate(d, languageCode: lang);

    Widget section(String title, Widget child) => Padding(
          padding: const EdgeInsets.only(top: 8),
          child: HomeSection(icon: Icons.circle, title: title, horizontal: 0, child: child),
        );

    return [
      // The SLA countdown, hidden once the request is resolved/closed.
      if (r.dueAt != null && r.status != MaintenanceStatus.resolved && r.status != MaintenanceStatus.closed) ...[
        const SizedBox(height: 12),
        _SlaTimerCard(r: r),
      ],
      section(l10n.maintenanceIssueDescription, _IssueCard(r: r, l10n: l10n, lang: lang, gradient: gradient, accent: accent, icon: icon)),
      if (r.customerName != null || r.customerPhone != null || r.unitCode != null)
        section(l10n.maintenanceCustomerInfo, _CustomerInfoCard(r: r, l10n: l10n)),
      if ((r.unitLat != null && r.unitLng != null) || r.unitAddress != null)
        section(l10n.maintenanceLocationPreview, _LocationCard(r: r, l10n: l10n)),
      section(l10n.maintenanceWorkflow, _WorkflowCard(r: r, l10n: l10n, lang: lang, fmtDate: fmtDate)),
      // A confirmed or closed request says so here; what can still be done is
      // in the bar under the page.
      if (r.supervisorHasConfirmed || r.status == MaintenanceStatus.closed)
        Padding(padding: const EdgeInsets.only(top: 12), child: _WorkflowActionCard(r: r, l10n: l10n, state: state, fmtDate: fmtDate)),
      if (r.customerConfirmedResolutionAt != null || r.customerRating != null)
        section(l10n.supervisorDetailFeedbackTitle, _FeedbackCard(r: r, l10n: l10n, fmtDate: fmtDate)),
      if (detail.documents.isNotEmpty)
        section(l10n.maintenanceAttachments, _AttachmentsCard(documents: detail.documents, l10n: l10n, requestId: r.id)),
    ];
  }
}

// ── Pinned collapsible header delegate ───────────────────────────────────────
// Expanded: shows subtitle + large title + status badge.
// Collapsed (pinned): compact title + status badge always visible.
// ── SLA countdown / overdue timer ────────────────────────────────────────────
class _SlaTimerCard extends StatefulWidget {
  const _SlaTimerCard({required this.r});
  final MaintenanceRequest r;

  @override
  State<_SlaTimerCard> createState() => _SlaTimerCardState();
}

class _SlaTimerCardState extends State<_SlaTimerCard> {
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    _tick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.r;
    final dueAt = r.dueAt!;
    final now = DateTime.now();
    final isOverdue = now.isAfter(dueAt);
    final d = isOverdue ? now.difference(dueAt) : dueAt.difference(now);
    String two(int n) => n.toString().padLeft(2, '0');
    final clock = '${d.inDays > 0 ? '${d.inDays}:' : ''}${two(d.inHours % 24)}:${two(d.inMinutes % 60)}:${two(d.inSeconds % 60)}';

    // 0 = just started, 1 = the deadline.
    final startAt = r.assignedAt ?? r.createdAt;
    double progress = isOverdue ? 1.0 : 0.0;
    if (startAt != null) {
      final total = dueAt.difference(startAt).inSeconds;
      if (total > 0) progress = (now.difference(startAt).inSeconds / total).clamp(0.0, 1.0);
    }
    final lang = Localizations.localeOf(context).languageCode;
    final colors = context.appColors;
    final tone = isOverdue ? colors.error : colors.inkStrong;
    return Container(
      key: const Key('maintenance-sla'),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      decoration: homeCard(context, radius: 22),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(
          '${isOverdue ? context.l10n.supervisorDetailOverdueLabel : context.l10n.maintenanceSlaRemaining} · ${DateFormatter.mediumDate(dueAt, languageCode: lang)}',
          style: TextStyle(fontSize: 12.5, color: isOverdue ? colors.error : colors.inkMuted),
        ),
        const SizedBox(height: 4),
        Text(ltr(clock), style: TextStyle(fontSize: 28, height: 1.2, fontWeight: FontWeight.w700, letterSpacing: 0.5, color: tone)),
        const SizedBox(height: 10),
        ClipRRect(
          borderRadius: BorderRadius.circular(3),
          child: LinearProgressIndicator(
            value: progress,
            minHeight: 6,
            color: isOverdue ? colors.error : AppPalette.gold500,
            backgroundColor: colors.surfaceSoft,
          ),
        ),
      ]),
    );
  }
}

class _IssueCard extends StatelessWidget {
  const _IssueCard({
    required this.r,
    required this.l10n,
    required this.lang,
    required this.gradient,
    required this.accent,
    required this.icon,
  });
  final MaintenanceRequest r;
  final AppLocalizations l10n;
  final String lang;
  final List<Color> gradient;
  final Color accent;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final date = r.createdAt != null ? DateFormatter.mediumDate(r.createdAt!, languageCode: lang) : null;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: homeCard(context, radius: 22),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(
          r.description.isNotEmpty ? r.description : l10n.supervisorNoDescription,
          style: TextStyle(fontSize: 14.5, height: 1.7, color: colors.inkStrong),
        ),
        if (date != null) ...[
          const SizedBox(height: 12),
          Text(date, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
        ],
      ]),
    );
  }
}

// ── Customer / unit info card ─────────────────────────────────────────────────
// Directions CTA moved to _LocationCard below.
class _CustomerInfoCard extends StatelessWidget {
  const _CustomerInfoCard({required this.r, required this.l10n});
  final MaintenanceRequest r;
  final AppLocalizations l10n;

  Future<void> _callPhone(BuildContext context) async {
    final phone = r.customerPhone;
    if (phone == null) return;
    final ok = await ContactActions.call(phone);
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.maintenanceCallCustomer)));
    }
  }

  Future<void> _openWhatsApp(BuildContext context) async {
    final phone = r.customerPhone;
    if (phone == null) return;
    final ok = await ContactActions.whatsApp(number: phone);
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.whatsappOpenFailed)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasPhone = r.customerPhone != null;
    return Container(
      decoration: homeCard(context, radius: 22),
      clipBehavior: Clip.antiAlias,
      child: Container(
        color: Colors.transparent,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _CardHeader(
              icon: Icons.person_rounded,
              title: l10n.maintenanceCustomerInfo,
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
              child: Column(
                children: [
                  if (r.customerName != null)
                    _InfoRow(
                      icon: Icons.person_outline_rounded,
                      label: l10n.supervisorDetailCustomerLabel,
                      value: r.customerName!,
                    ),
                  if (hasPhone)
                    _InfoRow(
                      icon: Icons.phone_outlined,
                      label: l10n.supervisorDetailPhoneLabel,
                      value: r.customerPhone!,
                      valueDirection: TextDirection.ltr,
                    ),
                  if (r.unitCode != null)
                    _InfoRow(
                      icon: Icons.apartment_rounded,
                      label: l10n.supervisorDetailUnitLabel,
                      value: r.unitCode!,
                    ),
                ],
              ),
            ),
            if (hasPhone) ...[
              const Divider(height: 1, indent: 16, endIndent: 16),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
                child: Row(
                  children: [
                    Expanded(
                      child: _ContactActionButton(
                        icon: Icons.call_rounded,
                        label: context.l10n.contactCall,
                        color: const Color(0xFF4ADE80),
                        onTap: () => _callPhone(context),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _ContactActionButton(
                        icon: Icons.chat_rounded,
                        label: context.l10n.contactWhatsapp,
                        color: const Color(0xFF25D366),
                        onTap: () => _openWhatsApp(context),
                      ),
                    ),
                  ],
                ),
              ),
            ] else
              const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

// ── Unit location card ────────────────────────────────────────────────────────
// Shows address + coordinates and opens Google Maps externally.
// Embedded map preview deferred until google_maps_flutter API keys are set up.
class _LocationCard extends StatelessWidget {
  const _LocationCard({required this.r, required this.l10n});
  final MaintenanceRequest r;
  final AppLocalizations l10n;

  bool get _hasLocation =>
      (r.unitLat != null && r.unitLng != null) || r.unitAddress != null;

  Future<void> _openDirections(BuildContext context) async {
    final lat = r.unitLat;
    final lng = r.unitLng;
    final address = r.unitAddress;
    bool ok;
    if (lat != null && lng != null) {
      ok = await ContactActions.openExternal(
        'https://www.google.com/maps/dir/?api=1'
        '&destination=$lat,$lng&travelmode=driving',
      );
    } else if (address != null) {
      final dest = Uri.encodeComponent(address);
      ok = await ContactActions.openExternal(
        'https://www.google.com/maps/dir/?api=1'
        '&destination=$dest&travelmode=driving',
      );
    } else {
      ok = false;
    }
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(l10n.maintenanceLocationUnavailable)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasCoords = r.unitLat != null && r.unitLng != null;
    final address = r.unitAddress;

    return Container(
      decoration: homeCard(context, radius: 22),
      clipBehavior: Clip.antiAlias,
      child: Container(
        color: Colors.transparent,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (_hasLocation) ...[

              // Address line
              if (address != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 2),
                  child: Text(
                    address,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF374151),
                      height: 1.5,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),

              // Coordinates
              if (hasCoords)
                Padding(
                  padding: EdgeInsets.fromLTRB(
                    16,
                    address != null ? 2 : 10,
                    16,
                    8,
                  ),
                  child: Text(
                    '${r.unitLat!.toStringAsFixed(5)}, '
                    '${r.unitLng!.toStringAsFixed(5)}',
                    textDirection: TextDirection.ltr,
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF9CA3AF),
                    ),
                  ),
                ),

              // Inline OpenStreetMap — shown whenever coordinates are available
              if (hasCoords)
                SizedBox(
                  height: 200,
                  child: Stack(
                    children: [
                      FlutterMap(
                        options: MapOptions(
                          initialCenter: LatLng(r.unitLat!, r.unitLng!),
                          initialZoom: 15,
                          interactionOptions: const InteractionOptions(
                            flags: InteractiveFlag.pinchZoom |
                                InteractiveFlag.doubleTapZoom,
                          ),
                        ),
                        children: [
                          TileLayer(
                            urlTemplate:
                                'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                            userAgentPackageName: 'com.devora.staff',
                            maxZoom: 19,
                          ),
                          MarkerLayer(
                            markers: [
                              Marker(
                                point: LatLng(r.unitLat!, r.unitLng!),
                                width: 48,
                                height: 48,
                                child: const Icon(
                                  Icons.location_pin,
                                  color: Color(0xFF1A73E8),
                                  size: 40,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                      // External-directions overlay button (bottom-end corner)
                      PositionedDirectional(
                        end: 10,
                        bottom: 10,
                        child: Material(
                          color: const Color(0xFF1A73E8),
                          borderRadius: BorderRadius.circular(8),
                          elevation: 3,
                          child: InkWell(
                            onTap: () => _openDirections(context),
                            borderRadius: BorderRadius.circular(8),
                            child: Padding(
                              padding: EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 7,
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.directions_rounded,
                                    color: Colors.white,
                                    size: 15,
                                  ),
                                  SizedBox(width: 5),
                                  Text(
                                    context.l10n.maintenanceDirections,
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                )
              else
                const SizedBox(height: 4),
            ] else ...[
              // No location data yet
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 2, 16, 12),
                child: Text(
                  l10n.maintenanceLocationUnavailable,
                  style: const TextStyle(
                    fontSize: 13,
                    color: Color(0xFF9CA3AF),
                  ),
                ),
              ),
            ],

            // Directions CTA footer — shown only when no inline map (address-only case)
            if (_hasLocation && !hasCoords) ...[
              const Divider(height: 1, indent: 16, endIndent: 16),
              InkWell(
                onTap: () => _openDirections(context),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 11, 16, 13),
                  child: Row(
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: const Color(0xFF1A73E8).withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(9),
                        ),
                        child: const Icon(
                          Icons.directions_rounded,
                          color: Color(0xFF1A73E8),
                          size: 17,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        l10n.maintenanceOpenDirections,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF1A73E8),
                        ),
                      ),
                      const Spacer(),
                      const Icon(
                        AppIcons.chevronForward,
                        size: 16,
                        color: Color(0xFF1A73E8),
                      ),
                    ],
                  ),
                ),
              ),
            ] else if (!_hasLocation) ...[
              const Divider(height: 1, indent: 16, endIndent: 16),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 11, 16, 13),
                child: Row(
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: const Color(0xFF9CA3AF).withValues(alpha: 0.10),
                        borderRadius: BorderRadius.circular(9),
                      ),
                      child: const Icon(
                        Icons.directions_rounded,
                        color: Color(0xFF9CA3AF),
                        size: 17,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      l10n.maintenanceLocationUnavailable,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF9CA3AF),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ── Workflow / SLA card ───────────────────────────────────────────────────────
class _WorkflowCard extends StatelessWidget {
  const _WorkflowCard({
    required this.r,
    required this.l10n,
    required this.lang,
    required this.fmtDate,
  });
  final MaintenanceRequest r;
  final AppLocalizations l10n;
  final String lang;
  final String Function(DateTime?) fmtDate;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: homeCard(context, radius: 22),
      clipBehavior: Clip.antiAlias,
      child: Container(
        color: Colors.transparent,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _CardHeader(
              icon: Icons.checklist_rounded,
              title: l10n.maintenanceWorkflow,
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: [
                      _StatusPill(
                        label: maintenanceResolvedByLabel(context.l10n, r.resolvedBy),
                        color: _resolvedByColor(r.resolvedBy),
                      ),
                      if (r.warrantyStatus != null &&
                          r.warrantyStatus != MaintenanceWarrantyStatus.unknown)
                        _StatusPill(
                          label: maintenanceWarrantyStatusLabel(context.l10n, r.warrantyStatus!),
                          color: _warrantyColor(r.warrantyStatus!),
                        ),
                      if (r.isOverdue)
                        _StatusPill(
                          label: l10n.supervisorDetailOverdueLabel,
                          color: const Color(0xFFEF4444),
                        ),
                      if (r.unresolvedAt != null)
                        _StatusPill(
                          label: l10n.supervisorDetailUnresolvedLabel,
                          color: const Color(0xFFEF4444),
                        ),
                      if (r.complaintAt != null)
                        _StatusPill(
                          label: l10n.supervisorDetailComplaintLabel,
                          color: const Color(0xFFF97316),
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _InfoRow(
                    icon: Icons.event_rounded,
                    label: l10n.supervisorDetailAssignedDateLabel,
                    value: fmtDate(r.assignedAt),
                  ),
                  _InfoRow(
                    icon: Icons.schedule_rounded,
                    label: l10n.supervisorDetailDueDateLabel,
                    value: r.dueAt != null
                        ? fmtDate(r.dueAt)
                        : l10n.maintenanceNoTargetDate,
                  ),
                  if (r.complaintAt != null)
                    _InfoRow(
                      icon: Icons.report_rounded,
                      label: l10n.supervisorDetailComplaintDateLabel,
                      value: fmtDate(r.complaintAt),
                    ),
                  if (r.warrantyStatus == MaintenanceWarrantyStatus.inWarranty &&
                      r.warrantyEndSnapshot != null)
                    _InfoRow(
                      icon: Icons.shield_rounded,
                      label: context.l10n.maintenanceWarrantyEnds,
                      value: fmtDate(r.warrantyEndSnapshot),
                    ),
                  if (r.itemName != null)
                    _InfoRow(
                      icon: Icons.build_circle_outlined,
                      label: context.l10n.maintenanceServicedItem,
                      value: r.itemName!.resolve(lang),
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

// ── Workflow state + action bar ───────────────────────────────────────────────

/// A confirmed or closed request, said in one line (what can still be done is
/// in [_ActionBar]).
class _WorkflowActionCard extends StatelessWidget {
  const _WorkflowActionCard({
    required this.r,
    required this.l10n,
    required this.state,
    required this.fmtDate,
  });
  final MaintenanceRequest r;
  final AppLocalizations l10n;
  final MaintenanceDetailState state;
  final String Function(DateTime?) fmtDate;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final confirmed = r.supervisorHasConfirmed;
    if (!confirmed && r.status != MaintenanceStatus.closed) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: homeCard(context, radius: 22),
      child: Row(children: [
        Icon(Icons.check_circle_rounded, color: colors.success, size: 22),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            confirmed ? '${l10n.supervisorDetailConfirmedAtPrefix} ${fmtDate(r.supervisorConfirmedResolutionAt)}' : l10n.maintenanceClosedState,
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: colors.inkStrong),
          ),
        ),
      ]),
    );
  }
}

/// What the viewer can do next, fixed under the page: the main step in gold,
/// the rest beside it.
class _ActionBar extends StatelessWidget {
  const _ActionBar({required this.items, required this.working, this.hint});
  final List<(String, IconData, bool, VoidCallback)> items;
  final bool working;
  final String? hint;

  static Widget? maybe(BuildContext context, MaintenanceRequest r, AppLocalizations l10n, MaintenanceDetailState state) {
    final cubit = context.read<MaintenanceDetailCubit>();
    if (r.supervisorHasConfirmed) return null;
    if (r.canSupervisorConfirm) {
      return _ActionBar(
        working: state.working,
        hint: l10n.supervisorDetailConfirmInstruction,
        items: [(l10n.maintenanceApproveSolution, Icons.verified_rounded, true, cubit.confirmResolution)],
      );
    }
    final transitions = r.allowedTransitions.where((t) => t != MaintenanceTransition.reopen).toList();
    if (transitions.isEmpty) return null;
    final hasResolve = transitions.contains(MaintenanceTransition.resolve);
    return _ActionBar(
      working: state.working,
      hint: hasResolve ? l10n.maintenanceActionHintInProgress : null,
      items: [
        for (final t in transitions)
          (maintenanceTransitionLabel(l10n, t), maintenanceTransitionIcon(t), t == MaintenanceTransition.resolve || transitions.length == 1, () => cubit.applyTransition(t)),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    // The gold one takes the room; the others sit beside it.
    final sorted = [...items]..sort((a, b) => (b.$3 ? 1 : 0).compareTo(a.$3 ? 1 : 0));
    return Container(
      key: const Key('maintenance-action-bar'),
      padding: EdgeInsets.fromLTRB(16, 12, 16, 12 + MediaQuery.paddingOf(context).bottom),
      decoration: BoxDecoration(color: colors.canvas, border: Border(top: BorderSide(color: colors.hairline))),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (hint != null) ...[
          Text(hint!, style: TextStyle(fontSize: 12.5, height: 1.5, color: colors.inkMuted)),
          const SizedBox(height: 10),
        ],
        Row(children: [
          for (final (i, it) in sorted.indexed) ...[
            if (i > 0) const SizedBox(width: 10),
            Expanded(
              flex: it.$3 ? 2 : 1,
              child: it.$3
                  ? DvGoldButton(label: it.$1, icon: it.$2, onTap: working ? null : it.$4)
                  : SizedBox(
                      height: 48,
                      child: OutlinedButton.icon(
                        onPressed: working ? null : it.$4,
                        icon: Icon(it.$2, size: 18),
                        label: Text(it.$1, maxLines: 1, overflow: TextOverflow.ellipsis),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: colors.inkStrong,
                          side: BorderSide(color: colors.hairline),
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                      ),
                    ),
            ),
          ],
        ]),
      ]),
    );
  }
}

// ── Customer feedback card ────────────────────────────────────────────────────
class _FeedbackCard extends StatelessWidget {
  const _FeedbackCard({
    required this.r,
    required this.l10n,
    required this.fmtDate,
  });
  final MaintenanceRequest r;
  final AppLocalizations l10n;
  final String Function(DateTime?) fmtDate;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = context.appColors;

    return Container(
      decoration: homeCard(context, radius: 22),
      clipBehavior: Clip.antiAlias,
      child: Container(
        color: Colors.transparent,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _CardHeader(
              icon: Icons.star_rounded,
              title: l10n.supervisorDetailFeedbackTitle,
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (r.customerRating != null)
                    _Stars(value: r.customerRating!),
                  if (r.customerRatingText?.isNotEmpty == true) ...[
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      r.customerRatingText!,
                      style: theme.textTheme.bodyMedium,
                    ),
                  ],
                  if (r.customerConfirmedResolutionAt != null) ...[
                    const SizedBox(height: AppSpacing.xxs),
                    Text(
                      '${l10n.supervisorDetailCustomerConfirmedAtPrefix} '
                      '${fmtDate(r.customerConfirmedResolutionAt)}',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: colors.inkMuted,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Attachments card ──────────────────────────────────────────────────────────
// Uses a lighter inline header (no heavy navy icon square) to reduce the gap
// between the section label and the image grid.
class _AttachmentsCard extends StatelessWidget {
  const _AttachmentsCard({
    required this.documents,
    required this.l10n,
    required this.requestId,
  });
  final List<MaintenanceDoc> documents;
  final AppLocalizations l10n;
  final String requestId;

  @override
  Widget build(BuildContext context) {
    final imageDocs = documents.where((d) => d.isImage).toList();
    final fileDocs = documents.where((d) => !d.isImage).toList();

    return Container(
      decoration: homeCard(context, radius: 22),
      clipBehavior: Clip.antiAlias,
      child: Container(
        color: Colors.transparent,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [

            // Image thumbnail grid
            if (imageDocs.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(10, 8, 10, 4),
                child: GridView.builder(
                  padding: EdgeInsets.all(8),
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    crossAxisSpacing: 8,
                    mainAxisSpacing: 8,
                    childAspectRatio: 1.1,
                  ),
                  itemCount: imageDocs.length,
                  itemBuilder: (ctx, i) => _ImageThumbnail(
                    doc: imageDocs[i],
                    requestId: requestId,
                    l10n: l10n,
                  ),
                ),
              ),

            // Non-image file tiles
            for (final d in fileDocs) _FileTile(doc: d, l10n: l10n),

            const SizedBox(height: 6),
          ],
        ),
      ),
    );
  }
}

// ── Image thumbnail (handles public URL or authenticated byte fetch) ───────────
class _ImageThumbnail extends StatefulWidget {
  const _ImageThumbnail({
    required this.doc,
    required this.requestId,
    required this.l10n,
  });
  final MaintenanceDoc doc;
  final String requestId;
  final AppLocalizations l10n;

  @override
  State<_ImageThumbnail> createState() => _ImageThumbnailState();
}

class _ImageThumbnailState extends State<_ImageThumbnail> {
  Uint8List? _bytes;
  bool _loading = false;
  bool _fetchError = false;

  @override
  void initState() {
    super.initState();
    if (widget.doc.url == null) _fetchBytes();
  }

  Future<void> _fetchBytes() async {
    setState(() => _loading = true);
    try {
      final dio = context.read<Dio>();
      final res = await dio.get<List<int>>(
        '/me/maintenance-requests/${widget.requestId}'
        '/documents/${widget.doc.id}/download',
        options: Options(responseType: ResponseType.bytes),
      );
      final data = res.data;
      if (!mounted) return;
      setState(() {
        _loading = false;
        _bytes = (data != null && data.isNotEmpty)
            ? Uint8List.fromList(data)
            : null;
        _fetchError = _bytes == null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _fetchError = true;
      });
    }
  }

  void _openViewer(BuildContext ctx) {
    showDialog<void>(
      context: ctx,
      barrierColor: Colors.black,
      builder: (_) => _ImageViewerDialog(
        url: widget.doc.url,
        bytes: _bytes,
        l10n: widget.l10n,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Container(
          color: homeLine(context),
          child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
        ),
      );
    }

    if (_fetchError || (widget.doc.url == null && _bytes == null)) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Container(
          color: homeLine(context),
          child: const Center(
            child: Icon(
              Icons.broken_image_rounded,
              color: Color(0xFF9CA3AF),
              size: 32,
            ),
          ),
        ),
      );
    }

    final imageWidget = widget.doc.url != null
        ? Image.network(
            widget.doc.url!,
            fit: BoxFit.cover,
            loadingBuilder: (ctx, child, progress) {
              if (progress == null) return child;
              return Container(
                color: homeLine(context),
                child: const Center(
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              );
            },
            errorBuilder: (ctx, err, stack) => Container(
              color: homeLine(context),
              child: const Icon(
                Icons.broken_image_rounded,
                color: Color(0xFF9CA3AF),
                size: 32,
              ),
            ),
          )
        : Image.memory(
            _bytes!,
            fit: BoxFit.cover,
            errorBuilder: (ctx, err, stack) => Container(
              color: homeLine(context),
              child: const Icon(
                Icons.broken_image_rounded,
                color: Color(0xFF9CA3AF),
                size: 32,
              ),
            ),
          );

    return GestureDetector(
      onTap: () => _openViewer(context),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Stack(
          fit: StackFit.expand,
          children: [
            imageWidget,
            PositionedDirectional(
              bottom: 6,
              end: 6,
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.45),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Icon(
                  Icons.zoom_in_rounded,
                  color: Colors.white,
                  size: 14,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Fullscreen image viewer ───────────────────────────────────────────────────
class _ImageViewerDialog extends StatelessWidget {
  const _ImageViewerDialog({this.url, this.bytes, required this.l10n})
    : assert(
        url != null || bytes != null,
        '_ImageViewerDialog requires url or bytes',
      );
  final String? url;
  final Uint8List? bytes;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final imageWidget = url != null
        ? Image.network(
            url!,
            fit: BoxFit.contain,
            loadingBuilder: (ctx, child, progress) {
              if (progress == null) return child;
              return const Center(
                child: CircularProgressIndicator(
                  color: Colors.white,
                  strokeWidth: 2,
                ),
              );
            },
            errorBuilder: (ctx, err, stack) => _brokenImage(l10n),
          )
        : Image.memory(
            bytes!,
            fit: BoxFit.contain,
            errorBuilder: (ctx, err, stack) => _brokenImage(l10n),
          );

    return Dialog.fullscreen(
      backgroundColor: Colors.black,
      child: SafeArea(
        child: Stack(
          children: [
            Center(
              child: InteractiveViewer(
                panEnabled: true,
                minScale: 0.8,
                maxScale: 5.0,
                child: imageWidget,
              ),
            ),
            PositionedDirectional(
              top: 8,
              end: 8,
              child: _CloseButton(l10n: l10n),
            ),
          ],
        ),
      ),
    );
  }

  static Widget _brokenImage(AppLocalizations l10n) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      const Icon(Icons.broken_image_rounded, color: Colors.white54, size: 48),
      const SizedBox(height: 8),
      Text(
        l10n.maintenanceNoPreviewAvailable,
        style: const TextStyle(color: Colors.white54),
      ),
    ],
  );
}

class _CloseButton extends StatelessWidget {
  const _CloseButton({required this.l10n});
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: l10n.maintenanceClosePreview,
      child: GestureDetector(
        onTap: () => Navigator.of(context).pop(),
        child: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.15),
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
          ),
          child: const Icon(Icons.close_rounded, color: Colors.white, size: 20),
        ),
      ),
    );
  }
}

class _FileTile extends StatelessWidget {
  const _FileTile({required this.doc, required this.l10n});
  final MaintenanceDoc doc;
  final AppLocalizations l10n;

  bool get _isPdf =>
      doc.mimeType == 'application/pdf' ||
      (doc.fileName ?? '').toLowerCase().endsWith('.pdf');

  @override
  Widget build(BuildContext context) {
    final title =
        doc.title ?? doc.fileName ?? l10n.supervisorDetailAttachmentFallback;
    final subTitle = (doc.fileName != null && doc.fileName != doc.title)
        ? doc.fileName
        : null;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: homeLine(context))),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: _isPdf
                  ? const Color(0xFFEF4444).withValues(alpha: 0.10)
                  : _navyCard.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(
              _isPdf
                  ? Icons.picture_as_pdf_rounded
                  : Icons.insert_drive_file_outlined,
              color: _isPdf ? const Color(0xFFEF4444) : const Color(0xFF6B7280),
              size: 19,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1A1A2E),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (subTitle != null)
                  Text(
                    subTitle,
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF9CA3AF),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          const Icon(
            Icons.attach_file_rounded,
            color: Color(0xFFD1D5DB),
            size: 17,
          ),
        ],
      ),
    );
  }
}

// ── Shared card header ────────────────────────────────────────────────────────
// ── Tappable contact button (Call / WhatsApp) ─────────────────────────────────
class _ContactActionButton extends StatelessWidget {
  const _ContactActionButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color.withValues(alpha: 0.10),
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: color, size: 18),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  color: color,
                  fontSize: 13,
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

class _CardHeader extends StatelessWidget {
  const _CardHeader({required this.icon, required this.title});
  final IconData icon;
  final String title;

  /// The section title sits above the card now; nothing inside it.
  @override
  Widget build(BuildContext context) => const SizedBox(height: 4);
}

// ── Info row (lighter icon, label + value) ────────────────────────────────────
class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.valueDirection,
  });
  final IconData icon;
  final String label;
  final String value;
  final TextDirection? valueDirection;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 13, height: 1.45, color: colors.inkMuted)),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              value,
              textDirection: valueDirection,
              textAlign: TextAlign.end,
              style: TextStyle(fontSize: 14, height: 1.45, fontWeight: FontWeight.w600, color: colors.inkStrong),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Status pill ───────────────────────────────────────────────────────────────
class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 5,
            height: 5,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Glass badge (header pill) ─────────────────────────────────────────────────
// ── Back button ───────────────────────────────────────────────────────────────
// ── Stars (read-only) ─────────────────────────────────────────────────────────
class _Stars extends StatelessWidget {
  const _Stars({required this.value});
  final int value;

  @override
  Widget build(BuildContext context) {
    final gold = context.appColors.brandGold;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(
        5,
        (i) => Icon(
          i < value ? Icons.star_rounded : Icons.star_border_rounded,
          color: gold,
          size: 22,
        ),
      ),
    );
  }
}

// ── Dot texture ───────────────────────────────────────────────────────────────
