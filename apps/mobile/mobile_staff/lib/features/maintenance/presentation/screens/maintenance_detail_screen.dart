import 'dart:typed_data';

import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';

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

Color _priorityColor(MaintenancePriority p) => switch (p) {
  MaintenancePriority.low => const Color(0xFF6B7280),
  MaintenancePriority.medium => AppPalette.gold300,
  MaintenancePriority.high => const Color(0xFFF97316),
  MaintenancePriority.urgent => const Color(0xFFEF4444),
  _ => const Color(0xFF6B7280),
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
    final statusBarH = MediaQuery.of(context).padding.top;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: Scaffold(
        backgroundColor: const Color(0xFFF5F7FA),
        body: BlocConsumer<MaintenanceDetailCubit, MaintenanceDetailState>(
          listenWhen: (a, b) =>
              a.actionFailure != b.actionFailure && b.actionFailure != null,
          listener: (context, state) =>
              showFailureSnackBar(context, state.actionFailure!),
          builder: (context, state) {
            final r = state.detail?.request ?? widget.fallback;
            final status = r?.status;
            final gradient = _statusGradient(
              status ?? MaintenanceStatus.unknown,
            );
            final accent = _statusAccent(status ?? MaintenanceStatus.unknown);

            return CustomScrollView(
              slivers: [
                // Pinned collapsible header — stays visible while scrolling.
                SliverPersistentHeader(
                  pinned: true,
                  delegate: _DetailHeaderDelegate(
                    statusBarH: statusBarH,
                    l10n: l10n,
                    status: status,
                    gradient: gradient,
                    accent: accent,
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 20, 16, 40),
                  sliver: switch (state.status) {
                    DataStatus.initial ||
                    DataStatus.loading => const SliverFillRemaining(
                      hasScrollBody: false,
                      child: Center(child: CircularProgressIndicator()),
                    ),
                    DataStatus.failure => SliverFillRemaining(
                      hasScrollBody: false,
                      child: ErrorState(
                        failure: state.failure,
                        onRetry: () =>
                            context.read<MaintenanceDetailCubit>().load(),
                      ),
                    ),
                    DataStatus.empty || DataStatus.success => SliverList(
                      delegate: SliverChildListDelegate(
                        _buildCards(
                          context,
                          state,
                          l10n,
                          lang,
                          gradient,
                          accent,
                        ),
                      ),
                    ),
                  },
                ),
              ],
            );
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

    return [
      // 1. Issue overview card
      _IssueCard(
        r: r,
        l10n: l10n,
        lang: lang,
        gradient: gradient,
        accent: accent,
        icon: icon,
      ),
      const SizedBox(height: 12),

      // 2. Customer / unit info
      if (r.customerName != null ||
          r.customerPhone != null ||
          r.unitCode != null) ...[
        _CustomerInfoCard(r: r, l10n: l10n),
        const SizedBox(height: 12),
      ],

      // 3. Unit location card (shown whenever there's a unit code)
      if (r.unitCode != null) ...[
        _LocationCard(r: r, l10n: l10n),
        const SizedBox(height: 12),
      ],

      // 4. Workflow / SLA card
      _WorkflowCard(r: r, l10n: l10n, fmtDate: fmtDate),
      const SizedBox(height: 12),

      // 5. Unified action card
      _WorkflowActionCard(r: r, l10n: l10n, state: state, fmtDate: fmtDate),

      // 6. Customer feedback (read-only)
      if (r.customerConfirmedResolutionAt != null ||
          r.customerRating != null) ...[
        const SizedBox(height: 12),
        _FeedbackCard(r: r, l10n: l10n, fmtDate: fmtDate),
      ],

      // 7. Attachments
      if (detail.documents.isNotEmpty) ...[
        const SizedBox(height: 12),
        _AttachmentsCard(
          documents: detail.documents,
          l10n: l10n,
          requestId: r.id,
        ),
      ],
    ];
  }
}

// ── Pinned collapsible header delegate ───────────────────────────────────────
// Expanded: shows subtitle + large title + status badge.
// Collapsed (pinned): compact title + status badge always visible.
class _DetailHeaderDelegate extends SliverPersistentHeaderDelegate {
  const _DetailHeaderDelegate({
    required this.statusBarH,
    required this.l10n,
    required this.gradient,
    required this.accent,
    this.status,
  });

  final double statusBarH;
  final AppLocalizations l10n;
  final List<Color> gradient;
  final Color accent;
  final MaintenanceStatus? status;

  static const double _expandedContent = 90.0;
  static const double _compactContent = 56.0;

  @override
  double get minExtent => statusBarH + _compactContent;

  @override
  double get maxExtent => statusBarH + _expandedContent;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    final t = (shrinkOffset / (_expandedContent - _compactContent)).clamp(
      0.0,
      1.0,
    );
    final statusLabel = status != null ? maintenanceStatusLabel(status!) : null;

    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: gradient,
        ),
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Subtle dot texture
          const IgnorePointer(child: _DotTexture()),
          // Gold corner glow
          PositionedDirectional(
            end: 0,
            top: 0,
            child: SizedBox(
              width: 140,
              height: statusBarH + _expandedContent,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment.topRight,
                    radius: 1.0,
                    colors: [
                      AppPalette.gold400.withValues(alpha: 0.08),
                      AppPalette.gold400.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),
          ),
          // Content — below status bar
          Positioned(
            top: statusBarH,
            left: 0,
            right: 0,
            bottom: 0,
            child: Padding(
              padding: EdgeInsets.fromLTRB(
                16,
                12.0 - (t * 4.0), // 12 → 8 when collapsed
                16,
                16.0 - (t * 8.0), // 16 → 8 when collapsed
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  _BackBtn(),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Subtitle fades out as header collapses
                        if (t < 0.85)
                          Opacity(
                            opacity: (1.0 - t / 0.65).clamp(0.0, 1.0),
                            child: Text(
                              l10n.maintenanceDetailSubtitle,
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.60),
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        const SizedBox(height: 2),
                        // Title: 20px → 16px as it collapses
                        Text(
                          l10n.maintenanceCompactDetailTitle,
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 20.0 - (t * 4.0),
                            fontWeight: FontWeight.w800,
                            height: 1.15,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  if (statusLabel != null) ...[
                    const SizedBox(width: 8),
                    _GlassBadge(label: statusLabel, accent: accent),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  bool shouldRebuild(_DetailHeaderDelegate old) =>
      old.status != status ||
      old.accent != accent ||
      old.statusBarH != statusBarH ||
      old.gradient != gradient;
}

// ── Issue overview card ───────────────────────────────────────────────────────
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
    final category = r.categoryName?.resolve(lang);
    final date = r.createdAt != null
        ? DateFormatter.mediumDate(r.createdAt!, languageCode: lang)
        : null;
    final pColor = _priorityColor(r.priority);
    final pLabel = maintenancePriorityLabel(r.priority);

    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Gradient strip
          Container(
            height: 88,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: gradient,
              ),
            ),
            child: Stack(
              children: [
                const Positioned.fill(child: _DotTexture()),
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 14,
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: accent.withValues(alpha: 0.18),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: accent.withValues(alpha: 0.35),
                          ),
                        ),
                        child: Icon(icon, color: accent, size: 24),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              category?.isNotEmpty == true
                                  ? category!
                                  : l10n.maintenanceFallbackTitle,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 17,
                                fontWeight: FontWeight.w800,
                                height: 1.2,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            if (r.unitCode != null)
                              Text(
                                'وحدة ${r.unitCode}',
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.65),
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          // White body
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.maintenanceIssueDescription,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF9CA3AF),
                    letterSpacing: 0.4,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  r.description.isNotEmpty
                      ? r.description
                      : l10n.supervisorNoDescription,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF1A1A2E),
                    height: 1.55,
                  ),
                  maxLines: 4,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    if (r.priority != MaintenancePriority.unknown) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: pColor.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: pColor.withValues(alpha: 0.35),
                          ),
                        ),
                        child: Text(
                          pLabel,
                          style: TextStyle(
                            color: pColor,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                    const Spacer(),
                    if (date != null) ...[
                      Icon(
                        Icons.calendar_today_rounded,
                        size: 12,
                        color: Colors.black.withValues(alpha: 0.28),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        date,
                        style: TextStyle(
                          color: Colors.black.withValues(alpha: 0.40),
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
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

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: Container(
        color: Colors.white,
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
                  if (r.customerPhone != null)
                    _InfoRow(
                      icon: Icons.phone_outlined,
                      label: l10n.supervisorDetailPhoneLabel,
                      value: r.customerPhone!,
                      valueDirection: TextDirection.ltr,
                      actionIcon: Icons.call_rounded,
                      actionColor: const Color(0xFF4ADE80),
                      onTap: () => _callPhone(context),
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

    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: Container(
        color: Colors.white,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Section header — lighter than _CardHeader to reduce visual weight
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
              child: Row(
                children: [
                  Icon(
                    Icons.location_on_rounded,
                    color: _hasLocation
                        ? const Color(0xFF1A73E8)
                        : const Color(0xFF9CA3AF),
                    size: 17,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    l10n.maintenanceLocationPreview,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF1A1A2E),
                    ),
                  ),
                ],
              ),
            ),

            if (_hasLocation) ...[
              const Divider(height: 1, color: Color(0xFFF0F0F0)),

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
                    0,
                  ),
                  child: Text(
                    '${r.unitLat!.toStringAsFixed(5)}, '
                    '${r.unitLng!.toStringAsFixed(5)}',
                    textDirection: TextDirection.ltr,
                    style: const TextStyle(
                      fontSize: 11,
                      color: Color(0xFF9CA3AF),
                    ),
                  ),
                ),

              // Map placeholder (replace with google_maps_flutter once keys ready)
              // TODO: swap this Container for GoogleMap widget with single marker,
              //   zoomGesturesEnabled: false, scrollGesturesEnabled: false.
              Container(
                margin: const EdgeInsets.fromLTRB(12, 10, 12, 0),
                height: 96,
                decoration: BoxDecoration(
                  color: const Color(0xFFF0F4F8),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE5E7EB)),
                ),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.map_rounded,
                          color: Color(0xFFB8C4D0),
                          size: 28,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          l10n.maintenanceMapPreviewUnavailable,
                          style: const TextStyle(
                            fontSize: 11,
                            color: Color(0xFFB8C4D0),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
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

            // Directions CTA
            const Divider(height: 1, indent: 16, endIndent: 16),
            InkWell(
              onTap: _hasLocation ? () => _openDirections(context) : null,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 11, 16, 13),
                child: Row(
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: _hasLocation
                            ? const Color(0xFF1A73E8).withValues(alpha: 0.12)
                            : const Color(0xFF9CA3AF).withValues(alpha: 0.10),
                        borderRadius: BorderRadius.circular(9),
                      ),
                      child: Icon(
                        Icons.directions_rounded,
                        color: _hasLocation
                            ? const Color(0xFF1A73E8)
                            : const Color(0xFF9CA3AF),
                        size: 17,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      _hasLocation
                          ? l10n.maintenanceOpenDirections
                          : l10n.maintenanceLocationUnavailable,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: _hasLocation
                            ? const Color(0xFF1A73E8)
                            : const Color(0xFF9CA3AF),
                      ),
                    ),
                    if (_hasLocation) ...[
                      const Spacer(),
                      const Icon(
                        Icons.arrow_forward_ios_rounded,
                        size: 13,
                        color: Color(0xFF1A73E8),
                      ),
                    ],
                  ],
                ),
              ),
            ),
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
    required this.fmtDate,
  });
  final MaintenanceRequest r;
  final AppLocalizations l10n;
  final String Function(DateTime?) fmtDate;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: Container(
        color: Colors.white,
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
                        label: maintenanceResolvedByLabel(r.resolvedBy),
                        color: _resolvedByColor(r.resolvedBy),
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
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Unified workflow action card ──────────────────────────────────────────────
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

  List<MaintenanceTransition> get _transitions => r.allowedTransitions
      .where((t) => t != MaintenanceTransition.reopen)
      .toList();

  @override
  Widget build(BuildContext context) {
    final confirmed = r.supervisorHasConfirmed;
    final canConfirm = r.canSupervisorConfirm;
    final isClosed = r.status == MaintenanceStatus.closed;
    final hasAction = _transitions.isNotEmpty;

    if (!confirmed && !canConfirm && !hasAction && !isClosed) {
      return const SizedBox.shrink();
    }

    final Color? accentColor = confirmed || isClosed
        ? const Color(0xFF4ADE80)
        : canConfirm
        ? AppPalette.gold400
        : null;

    final IconData headerIcon = confirmed || isClosed
        ? Icons.verified_rounded
        : canConfirm
        ? Icons.admin_panel_settings_rounded
        : Icons.update_rounded;

    final String headerTitle = (confirmed || isClosed)
        ? (isClosed && !confirmed
              ? l10n.maintenanceClosedState
              : l10n.supervisorDetailConfirmTitle)
        : canConfirm
        ? l10n.supervisorDetailConfirmTitle
        : l10n.maintenanceUpdateStatus;

    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: Container(
        color: Colors.white,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              decoration: BoxDecoration(
                color: accentColor?.withValues(alpha: 0.07),
                border: const Border(
                  bottom: BorderSide(color: Color(0xFFF0F0F0)),
                ),
              ),
              child: Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: accentColor != null
                          ? accentColor.withValues(alpha: 0.15)
                          : _navyCard,
                      borderRadius: BorderRadius.circular(9),
                    ),
                    child: Icon(
                      headerIcon,
                      color: accentColor ?? Colors.white,
                      size: 17,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    headerTitle,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF1A1A2E),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
              child: _body(context, confirmed, canConfirm, isClosed),
            ),
          ],
        ),
      ),
    );
  }

  Widget _body(
    BuildContext context,
    bool confirmed,
    bool canConfirm,
    bool isClosed,
  ) {
    // 1. Already confirmed
    if (confirmed) {
      return Row(
        children: [
          const Icon(
            Icons.check_circle_rounded,
            color: Color(0xFF4ADE80),
            size: 20,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              '${l10n.supervisorDetailConfirmedAtPrefix} '
              '${fmtDate(r.supervisorConfirmedResolutionAt)}',
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Color(0xFF1A1A2E),
              ),
            ),
          ),
        ],
      );
    }

    // 2. Can confirm (resolved, not yet confirmed)
    if (canConfirm) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.supervisorDetailConfirmInstruction,
            style: const TextStyle(
              fontSize: 13,
              color: Color(0xFF6B7280),
              height: 1.5,
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: AppButton(
              label: l10n.maintenanceApproveSolution,
              icon: Icons.verified_rounded,
              size: AppButtonSize.medium,
              variant: AppButtonVariant.gold,
              isLoading: state.working,
              onPressed: state.working
                  ? null
                  : () => context
                        .read<MaintenanceDetailCubit>()
                        .confirmResolution(),
            ),
          ),
        ],
      );
    }

    // 3. Active transitions
    final transitions = _transitions;
    if (transitions.isNotEmpty) {
      final hasResolve = transitions.any(
        (t) => t == MaintenanceTransition.resolve,
      );
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Hint text for the in-progress resolve action
          if (hasResolve) ...[
            Text(
              l10n.maintenanceActionHintInProgress,
              style: const TextStyle(
                fontSize: 13,
                color: Color(0xFF6B7280),
                height: 1.5,
              ),
            ),
            const SizedBox(height: 10),
          ],
          for (final t in transitions)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: SizedBox(
                width: double.infinity,
                child: AppButton(
                  label: maintenanceTransitionLabel(t),
                  icon: maintenanceTransitionIcon(t),
                  size: AppButtonSize.medium,
                  variant: t == MaintenanceTransition.resolve
                      ? AppButtonVariant.gold
                      : AppButtonVariant.outline,
                  isLoading: state.working,
                  onPressed: state.working
                      ? null
                      : () => context
                            .read<MaintenanceDetailCubit>()
                            .applyTransition(t),
                ),
              ),
            ),
        ],
      );
    }

    // 4. Closed state
    if (isClosed) {
      return Row(
        children: [
          const Icon(
            Icons.check_circle_rounded,
            color: Color(0xFF4ADE80),
            size: 20,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              l10n.maintenanceClosedState,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Color(0xFF4ADE80),
              ),
            ),
          ),
        ],
      );
    }

    return Text(
      l10n.maintenanceActionUnavailable,
      style: const TextStyle(fontSize: 13, color: Color(0xFF9CA3AF)),
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

    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: Container(
        color: Colors.white,
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

    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: Container(
        color: Colors.white,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Lightweight header — smaller vertical padding than _CardHeader
            // so the image grid starts close under the section label.
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 8),
              child: Row(
                children: [
                  Icon(
                    Icons.attach_file_rounded,
                    color: _navyCard.withValues(alpha: 0.7),
                    size: 17,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    l10n.maintenanceAttachments,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF1A1A2E),
                    ),
                  ),
                  const Spacer(),
                  Text(
                    '${documents.length}',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF9CA3AF),
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: Color(0xFFF0F0F0)),

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
          color: const Color(0xFFF0F0F0),
          child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
        ),
      );
    }

    if (_fetchError || (widget.doc.url == null && _bytes == null)) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Container(
          color: const Color(0xFFF0F0F0),
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
                color: const Color(0xFFF0F0F0),
                child: const Center(
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              );
            },
            errorBuilder: (ctx, err, stack) => Container(
              color: const Color(0xFFF0F0F0),
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
              color: const Color(0xFFF0F0F0),
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
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: Color(0xFFF0F0F0))),
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
                      fontSize: 11,
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
class _CardHeader extends StatelessWidget {
  const _CardHeader({required this.icon, required this.title});
  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Color(0xFFF0F0F0))),
      ),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: _navyCard,
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(icon, color: Colors.white, size: 17),
          ),
          const SizedBox(width: 10),
          Text(
            title,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: Color(0xFF1A1A2E),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Info row (lighter icon, label + value) ────────────────────────────────────
class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.valueDirection,
    this.onTap,
    this.actionIcon,
    this.actionColor,
  });
  final IconData icon;
  final String label;
  final String value;
  final TextDirection? valueDirection;
  final VoidCallback? onTap;
  final IconData? actionIcon;
  final Color? actionColor;

  @override
  Widget build(BuildContext context) {
    Widget content = Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Light icon container — less visually heavy than full navy
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: _navyCard.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(icon, color: _navyCard, size: 16),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF9CA3AF),
                  ),
                ),
                const SizedBox(height: 1),
                Text(
                  value,
                  textDirection: valueDirection,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1A1A2E),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          if (actionIcon != null) ...[
            const SizedBox(width: 8),
            Icon(
              actionIcon,
              size: 18,
              color: actionColor ?? const Color(0xFF4ADE80),
            ),
          ],
        ],
      ),
    );

    if (onTap != null) {
      return GestureDetector(onTap: onTap, child: content);
    }
    return content;
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
class _GlassBadge extends StatelessWidget {
  const _GlassBadge({required this.label, required this.accent});
  final String label;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: accent.withValues(alpha: 0.40)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: accent, shape: BoxShape.circle),
          ),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              color: accent,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Back button ───────────────────────────────────────────────────────────────
class _BackBtn extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => Navigator.of(context).pop(),
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(11),
          border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
        ),
        child: const Icon(
          Icons.arrow_back_ios_new_rounded,
          color: Colors.white,
          size: 17,
        ),
      ),
    );
  }
}

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
class _DotTexture extends StatelessWidget {
  const _DotTexture();

  @override
  Widget build(BuildContext context) =>
      const CustomPaint(painter: _DotPainter(), child: SizedBox.expand());
}

class _DotPainter extends CustomPainter {
  const _DotPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.04);
    const step = 18.0;
    for (var y = 0.0; y < size.height; y += step) {
      for (var x = 0.0; x < size.width; x += step) {
        canvas.drawCircle(Offset(x, y), 1.5, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DotPainter _) => false;
}
