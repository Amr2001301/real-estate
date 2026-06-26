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
const _navyDeep  = Color(0xFF0B1726);
const _navyCard  = Color(0xFF1A3352);
const _navyLight = Color(0xFF243F62);

List<Color> _statusGradient(MaintenanceStatus s) => switch (s) {
      MaintenanceStatus.open ||
      MaintenanceStatus.assigned =>
        [_navyLight, _navyDeep],
      MaintenanceStatus.inProgress =>
        [const Color(0xFF0F3460), const Color(0xFF061830)],
      _ => [const Color(0xFF1B5E3F), const Color(0xFF0D3826)],
    };

Color _statusAccent(MaintenanceStatus s) => switch (s) {
      MaintenanceStatus.open ||
      MaintenanceStatus.assigned => AppPalette.gold300,
      MaintenanceStatus.inProgress => const Color(0xFF60A5FA),
      _ => const Color(0xFF4ADE80),
    };

IconData _statusIcon(MaintenanceStatus s) => switch (s) {
      MaintenanceStatus.open       => Icons.inbox_rounded,
      MaintenanceStatus.assigned   => Icons.person_pin_rounded,
      MaintenanceStatus.inProgress => Icons.engineering_rounded,
      MaintenanceStatus.resolved   => Icons.check_circle_rounded,
      MaintenanceStatus.closed     => Icons.lock_rounded,
      _                            => Icons.build_rounded,
    };

Color _priorityColor(MaintenancePriority p) => switch (p) {
      MaintenancePriority.low    => const Color(0xFF6B7280),
      MaintenancePriority.medium => AppPalette.gold300,
      MaintenancePriority.high   => const Color(0xFFF97316),
      MaintenancePriority.urgent => const Color(0xFFEF4444),
      _                          => const Color(0xFF6B7280),
    };

Color _resolvedByColor(MaintenanceResolvedBy? by) => switch (by) {
      MaintenanceResolvedBy.both => const Color(0xFF4ADE80),
      MaintenanceResolvedBy.customer ||
      MaintenanceResolvedBy.supervisor =>
        AppPalette.gold300,
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
      value: SystemUiOverlayStyle.light
          .copyWith(statusBarColor: Colors.transparent),
      child: Scaffold(
        backgroundColor: const Color(0xFFF5F7FA),
        body: BlocConsumer<MaintenanceDetailCubit, MaintenanceDetailState>(
          listenWhen: (a, b) =>
              a.actionFailure != b.actionFailure && b.actionFailure != null,
          listener: (context, state) =>
              showFailureSnackBar(context, state.actionFailure!),
          builder: (context, state) {
            final r        = state.detail?.request ?? widget.fallback;
            final status   = r?.status;
            final gradient = _statusGradient(status ?? MaintenanceStatus.unknown);
            final accent   = _statusAccent(status ?? MaintenanceStatus.unknown);

            return CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: _DetailHeader(
                    l10n: l10n,
                    status: status,
                    priority: r?.priority,
                    accent: accent,
                    gradient: gradient,
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 20, 16, 40),
                  sliver: switch (state.status) {
                    DataStatus.initial ||
                    DataStatus.loading =>
                      const SliverFillRemaining(
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
                    DataStatus.empty ||
                    DataStatus.success =>
                      SliverList(
                        delegate: SliverChildListDelegate(
                          _buildCards(
                              context, state, l10n, lang, gradient, accent),
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
    final r    = detail.request;
    final icon = _statusIcon(r.status);

    String fmtDate(DateTime? d) =>
        d == null ? '—' : DateFormatter.mediumDate(d, languageCode: lang);

    return [
      // 1. Issue overview card
      _IssueCard(
        r: r, l10n: l10n, lang: lang,
        gradient: gradient, accent: accent, icon: icon,
      ),
      const SizedBox(height: 16),

      // 2. Customer / unit info (with phone tap + map CTA)
      if (r.customerName != null ||
          r.customerPhone != null ||
          r.unitCode != null) ...[
        _CustomerInfoCard(r: r, l10n: l10n),
        const SizedBox(height: 16),
      ],

      // 3. Workflow / SLA card
      _WorkflowCard(r: r, l10n: l10n, fmtDate: fmtDate),
      const SizedBox(height: 16),

      // 4. Unified action card (replaces both _ActionsCard and
      //    _SupervisorConfirmCard — no "locked" state shown separately)
      _WorkflowActionCard(r: r, l10n: l10n, state: state, fmtDate: fmtDate),

      // 5. Customer feedback (read-only)
      if (r.customerConfirmedResolutionAt != null ||
          r.customerRating != null) ...[
        const SizedBox(height: 16),
        _FeedbackCard(r: r, l10n: l10n, fmtDate: fmtDate),
      ],

      // 6. Attachments
      if (detail.documents.isNotEmpty) ...[
        const SizedBox(height: 16),
        _AttachmentsCard(
          documents: detail.documents,
          l10n: l10n,
          requestId: r.id,
        ),
      ],
    ];
  }
}

// ── Compact detail header ─────────────────────────────────────────────────────
class _DetailHeader extends StatelessWidget {
  const _DetailHeader({
    required this.l10n,
    required this.gradient,
    required this.accent,
    this.status,
    this.priority,
  });
  final AppLocalizations     l10n;
  final List<Color>          gradient;
  final Color                accent;
  final MaintenanceStatus?   status;
  final MaintenancePriority? priority;

  @override
  Widget build(BuildContext context) {
    final statusLabel =
        status != null ? maintenanceStatusLabel(status!) : null;

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: gradient,
        ),
      ),
      child: Stack(
        children: [
          const Positioned.fill(
              child: IgnorePointer(child: _DotTexture())),
          PositionedDirectional(
            end: 0,
            top: 0,
            child: Container(
              width: 160,
              height: 110,
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
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  _BackBtn(),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          l10n.maintenanceDetailSubtitle,
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.60),
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          l10n.supervisorDetailTitle,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            height: 1.15,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (statusLabel != null)
                    _GlassBadge(label: statusLabel, accent: accent),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
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
  final AppLocalizations   l10n;
  final String             lang;
  final List<Color>        gradient;
  final Color              accent;
  final IconData           icon;

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
            height: 100,
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
                      horizontal: 16, vertical: 16),
                  child: Row(
                    children: [
                      Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          color: accent.withValues(alpha: 0.18),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                              color: accent.withValues(alpha: 0.35)),
                        ),
                        child: Icon(icon, color: accent, size: 26),
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
                                fontSize: 18,
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
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.maintenanceIssueDescription,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF9CA3AF),
                    letterSpacing: 0.4,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  r.description.isNotEmpty
                      ? r.description
                      : l10n.supervisorNoDescription,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF1A1A2E),
                    height: 1.6,
                  ),
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    if (r.priority != MaintenancePriority.unknown) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: pColor.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                              color: pColor.withValues(alpha: 0.35)),
                        ),
                        child: Text(pLabel,
                            style: TextStyle(
                                color: pColor,
                                fontSize: 12,
                                fontWeight: FontWeight.w700)),
                      ),
                    ],
                    const Spacer(),
                    if (date != null) ...[
                      Icon(Icons.calendar_today_rounded,
                          size: 13,
                          color: Colors.black.withValues(alpha: 0.30)),
                      const SizedBox(width: 4),
                      Text(date,
                          style: TextStyle(
                              color: Colors.black.withValues(alpha: 0.45),
                              fontSize: 12,
                              fontWeight: FontWeight.w500)),
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
class _CustomerInfoCard extends StatelessWidget {
  const _CustomerInfoCard({required this.r, required this.l10n});
  final MaintenanceRequest r;
  final AppLocalizations   l10n;

  Future<void> _callPhone(BuildContext context) async {
    final phone = r.customerPhone;
    if (phone == null) return;
    final ok = await ContactActions.call(phone);
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(l10n.maintenanceCallCustomer)),
      );
    }
  }

  Future<void> _openDirections(BuildContext context) async {
    final lat = r.unitLat;
    final lng = r.unitLng;
    final address = r.unitAddress;

    bool ok;
    if (lat != null && lng != null) {
      final uri = Uri.parse(
        'https://www.google.com/maps/dir/?api=1'
        '&destination=$lat,$lng&travelmode=driving',
      );
      ok = await ContactActions.openExternal(uri.toString());
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

  bool get _hasLocation =>
      (r.unitLat != null && r.unitLng != null) || r.unitAddress != null;

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
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
              child: Column(
                children: [
                  if (r.customerName != null)
                    _InfoRowNew(
                      icon: Icons.person_outline_rounded,
                      label: l10n.supervisorDetailCustomerLabel,
                      value: r.customerName!,
                    ),
                  // Phone row — tappable
                  if (r.customerPhone != null)
                    _InfoRowNew(
                      icon: Icons.phone_outlined,
                      label: l10n.supervisorDetailPhoneLabel,
                      value: r.customerPhone!,
                      valueDirection: TextDirection.ltr,
                      actionIcon: Icons.call_rounded,
                      actionColor: const Color(0xFF4ADE80),
                      onTap: () => _callPhone(context),
                    ),
                  if (r.unitCode != null)
                    _InfoRowNew(
                      icon: Icons.apartment_rounded,
                      label: l10n.supervisorDetailUnitLabel,
                      value: r.unitCode!,
                    ),
                ],
              ),
            ),
            // Directions CTA — always shown; disabled (grey) when backend has
            // not yet provided unit.lat / unit.lng / unit.address.
            // TODO(backend): enable once unit location fields are returned.
            const Divider(height: 1, indent: 16, endIndent: 16),
            InkWell(
              onTap: _hasLocation ? () => _openDirections(context) : null,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
                child: Row(
                  children: [
                    Container(
                      width: 34,
                      height: 34,
                      decoration: BoxDecoration(
                        color: _hasLocation
                            ? const Color(0xFF1A73E8).withValues(alpha: 0.12)
                            : const Color(0xFF9CA3AF).withValues(alpha: 0.10),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(
                        Icons.directions_rounded,
                        color: _hasLocation
                            ? const Color(0xFF1A73E8)
                            : const Color(0xFF9CA3AF),
                        size: 18,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      _hasLocation
                          ? l10n.maintenanceDirectionsToUnit
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
                      const Icon(Icons.arrow_forward_ios_rounded,
                          size: 14, color: Color(0xFF1A73E8)),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 4),
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
  final MaintenanceRequest          r;
  final AppLocalizations            l10n;
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
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
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
                  const SizedBox(height: 14),
                  _InfoRowNew(
                    icon: Icons.event_rounded,
                    label: l10n.supervisorDetailAssignedDateLabel,
                    value: fmtDate(r.assignedAt),
                  ),
                  _InfoRowNew(
                    icon: Icons.schedule_rounded,
                    label: l10n.supervisorDetailDueDateLabel,
                    value: r.dueAt != null
                        ? fmtDate(r.dueAt)
                        : l10n.maintenanceNoTargetDate,
                  ),
                  if (r.complaintAt != null)
                    _InfoRowNew(
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
// Consolidates status transitions + supervisor confirmation into ONE card.
// The "locked/unavailable" text is never shown as a separate full card.
class _WorkflowActionCard extends StatelessWidget {
  const _WorkflowActionCard({
    required this.r,
    required this.l10n,
    required this.state,
    required this.fmtDate,
  });
  final MaintenanceRequest          r;
  final AppLocalizations            l10n;
  final MaintenanceDetailState      state;
  final String Function(DateTime?) fmtDate;

  // Active transitions excluding reopen (handled as edge case separately)
  List<MaintenanceTransition> get _transitions => r.allowedTransitions
      .where((t) => t != MaintenanceTransition.reopen)
      .toList();

  @override
  Widget build(BuildContext context) {
    final confirmed  = r.supervisorHasConfirmed;
    final canConfirm = r.canSupervisorConfirm;
    final isClosed   = r.status == MaintenanceStatus.closed;
    final hasAction  = _transitions.isNotEmpty;

    // Nothing to show for open/unknown states the supervisor can't act on
    if (!confirmed && !canConfirm && !hasAction && !isClosed) {
      return const SizedBox.shrink();
    }

    // Header style varies by state
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
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
              decoration: BoxDecoration(
                color: accentColor?.withValues(alpha: 0.07),
                border: const Border(
                    bottom: BorderSide(color: Color(0xFFF0F0F0))),
              ),
              child: Row(
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: accentColor != null
                          ? accentColor.withValues(alpha: 0.15)
                          : _navyCard,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(headerIcon,
                        color: accentColor ?? Colors.white, size: 18),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    headerTitle,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF1A1A2E),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
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
    // 1. Already confirmed by supervisor
    if (confirmed) {
      return Row(
        children: [
          const Icon(Icons.check_circle_rounded,
              color: Color(0xFF4ADE80), size: 20),
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

    // 2. Supervisor can confirm (resolved, not yet confirmed)
    if (canConfirm) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.supervisorDetailConfirmInstruction,
            style: const TextStyle(
              fontSize: 14,
              color: Color(0xFF6B7280),
              height: 1.5,
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: AppButton(
              label: l10n.maintenanceApproveSolution,
              size: AppButtonSize.medium,
              variant: AppButtonVariant.gold,
              isLoading: state.working,
              onPressed: state.working
                  ? null
                  : () =>
                      context.read<MaintenanceDetailCubit>().confirmResolution(),
            ),
          ),
        ],
      );
    }

    // 3. Active transitions (start / resolve)
    final transitions = _transitions;
    if (transitions.isNotEmpty) {
      return Column(
        children: [
          for (final t in transitions)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: SizedBox(
                width: double.infinity,
                child: AppButton(
                  label: maintenanceTransitionLabel(t),
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
          const Icon(Icons.check_circle_rounded,
              color: Color(0xFF4ADE80), size: 20),
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
  final MaintenanceRequest          r;
  final AppLocalizations            l10n;
  final String Function(DateTime?) fmtDate;

  @override
  Widget build(BuildContext context) {
    final theme  = Theme.of(context);
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
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (r.customerRating != null)
                    _Stars(value: r.customerRating!),
                  if (r.customerRatingText?.isNotEmpty == true) ...[
                    const SizedBox(height: AppSpacing.xs),
                    Text(r.customerRatingText!,
                        style: theme.textTheme.bodyMedium),
                  ],
                  if (r.customerConfirmedResolutionAt != null) ...[
                    const SizedBox(height: AppSpacing.xxs),
                    Text(
                      '${l10n.supervisorDetailCustomerConfirmedAtPrefix} '
                      '${fmtDate(r.customerConfirmedResolutionAt)}',
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: colors.inkMuted),
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
// Image docs → 2-col thumbnail grid (with authenticated fetch when url == null).
// Non-image docs → compact file tile.
//
// Why image docs are shown even when doc.url == null:
//   The backend /me/maintenance-requests/{id} currently returns documents with
//   only id/title/fileName — no url, signedUrl, downloadUrl, or fileUrl.
//   _ImageThumbnail handles this by fetching bytes via the authenticated Dio
//   client using a guessed REST endpoint. Once the backend starts returning
//   signed URLs, doc.url will be non-null and Image.network will be used instead.
//
// Missing backend field: documents[].url (or signedUrl/downloadUrl/fileUrl).
// Missing location fields: unit.lat / unit.lng / unit.address.
class _AttachmentsCard extends StatelessWidget {
  const _AttachmentsCard({
    required this.documents,
    required this.l10n,
    required this.requestId,
  });
  final List<MaintenanceDoc> documents;
  final AppLocalizations     l10n;
  final String               requestId;

  @override
  Widget build(BuildContext context) {
    // All image docs go to the grid; _ImageThumbnail handles url vs. auth-fetch.
    final imageDocs = documents.where((d) => d.isImage).toList();
    final fileDocs  = documents.where((d) => !d.isImage).toList();

    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: Container(
        color: Colors.white,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _CardHeader(
              icon: Icons.attach_file_rounded,
              title: l10n.maintenanceAttachments,
            ),

            // Image thumbnail grid
            if (imageDocs.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
                child: GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate:
                      const SliverGridDelegateWithFixedCrossAxisCount(
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
            for (final d in fileDocs)
              _FileTile(doc: d, l10n: l10n),

            const SizedBox(height: 4),
          ],
        ),
      ),
    );
  }
}

// ── Image thumbnail (handles both public URL and authenticated byte fetch) ────
//
// If doc.url != null  → Image.network (backend returned a public/signed URL).
// If doc.url == null  → fetch bytes via the authenticated Dio client using a
//   guessed REST path. This avoids exposing bearer tokens in URLs and works
//   with the current backend that does not yet return download links.
//
// TODO(backend): confirm the attachment download endpoint path.
//   Current guess: GET /me/maintenance-requests/{requestId}/documents/{docId}/download
//   Adjust the path in _fetchBytes() once the API contract is finalised.
class _ImageThumbnail extends StatefulWidget {
  const _ImageThumbnail({
    required this.doc,
    required this.requestId,
    required this.l10n,
  });
  final MaintenanceDoc   doc;
  final String           requestId;
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
    // Only fetch via Dio when the backend has not provided a direct URL.
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
        _loading  = false;
        _bytes    = (data != null && data.isNotEmpty) ? Uint8List.fromList(data) : null;
        _fetchError = _bytes == null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() { _loading = false; _fetchError = true; });
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
    // ── Loading state ────────────────────────────────────────────────────────
    if (_loading) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Container(
          color: const Color(0xFFF0F0F0),
          child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
        ),
      );
    }

    // ── Error / no usable bytes ──────────────────────────────────────────────
    if (_fetchError || (widget.doc.url == null && _bytes == null)) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Container(
          color: const Color(0xFFF0F0F0),
          child: const Center(
            child: Icon(Icons.broken_image_rounded,
                color: Color(0xFF9CA3AF), size: 32),
          ),
        ),
      );
    }

    // ── Actual image (network URL or memory bytes) ───────────────────────────
    final imageWidget = widget.doc.url != null
        ? Image.network(
            widget.doc.url!,
            fit: BoxFit.cover,
            loadingBuilder: (ctx, child, progress) {
              if (progress == null) return child;
              return Container(
                color: const Color(0xFFF0F0F0),
                child: const Center(
                    child: CircularProgressIndicator(strokeWidth: 2)),
              );
            },
            errorBuilder: (ctx, err, stack) => Container(
              color: const Color(0xFFF0F0F0),
              child: const Icon(Icons.broken_image_rounded,
                  color: Color(0xFF9CA3AF), size: 32),
            ),
          )
        : Image.memory(
            _bytes!,
            fit: BoxFit.cover,
            errorBuilder: (ctx, err, stack) => Container(
              color: const Color(0xFFF0F0F0),
              child: const Icon(Icons.broken_image_rounded,
                  color: Color(0xFF9CA3AF), size: 32),
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
                child: const Icon(Icons.zoom_in_rounded,
                    color: Colors.white, size: 14),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Fullscreen image viewer ───────────────────────────────────────────────────
// Accepts either a public URL (Image.network) or pre-fetched bytes (Image.memory).
class _ImageViewerDialog extends StatelessWidget {
  const _ImageViewerDialog({this.url, this.bytes, required this.l10n})
      : assert(url != null || bytes != null,
            '_ImageViewerDialog requires url or bytes');
  final String?          url;
  final Uint8List?       bytes;
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
                      color: Colors.white, strokeWidth: 2));
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
          const Icon(Icons.broken_image_rounded,
              color: Colors.white54, size: 48),
          const SizedBox(height: 8),
          Text(l10n.maintenanceNoPreviewAvailable,
              style: const TextStyle(color: Colors.white54)),
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
            border: Border.all(
                color: Colors.white.withValues(alpha: 0.25)),
          ),
          child: const Icon(Icons.close_rounded,
              color: Colors.white, size: 20),
        ),
      ),
    );
  }
}

class _FileTile extends StatelessWidget {
  const _FileTile({required this.doc, required this.l10n});
  final MaintenanceDoc   doc;
  final AppLocalizations l10n;

  bool get _isPdf =>
      doc.mimeType == 'application/pdf' ||
      (doc.fileName ?? '').toLowerCase().endsWith('.pdf');

  @override
  Widget build(BuildContext context) {
    final title    = doc.title ?? doc.fileName ?? l10n.supervisorDetailAttachmentFallback;
    final subTitle = (doc.fileName != null && doc.fileName != doc.title)
        ? doc.fileName
        : null;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: Color(0xFFF0F0F0))),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: _isPdf
                  ? const Color(0xFFEF4444).withValues(alpha: 0.10)
                  : _navyCard.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              _isPdf
                  ? Icons.picture_as_pdf_rounded
                  : Icons.insert_drive_file_outlined,
              color: _isPdf
                  ? const Color(0xFFEF4444)
                  : const Color(0xFF6B7280),
              size: 20,
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
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1A1A2E),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (subTitle != null)
                  Text(subTitle,
                      style: const TextStyle(
                          fontSize: 11, color: Color(0xFF9CA3AF)),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
          const SizedBox(width: 8),
          const Icon(Icons.attach_file_rounded,
              color: Color(0xFFD1D5DB), size: 18),
        ],
      ),
    );
  }
}

// ── Shared card header ────────────────────────────────────────────────────────
class _CardHeader extends StatelessWidget {
  const _CardHeader({required this.icon, required this.title});
  final IconData icon;
  final String   title;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Color(0xFFF0F0F0))),
      ),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: _navyCard,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: Colors.white, size: 18),
          ),
          const SizedBox(width: 12),
          Text(
            title,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: Color(0xFF1A1A2E),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Info row (navy icon + label above + value, optional tap + action) ─────────
class _InfoRowNew extends StatelessWidget {
  const _InfoRowNew({
    required this.icon,
    required this.label,
    required this.value,
    this.valueDirection,
    this.onTap,
    this.actionIcon,
    this.actionColor,
  });
  final IconData       icon;
  final String         label;
  final String         value;
  final TextDirection? valueDirection;
  final VoidCallback?  onTap;
  final IconData?      actionIcon;
  final Color?         actionColor;

  @override
  Widget build(BuildContext context) {
    Widget content = Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: _navyCard,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon,
                color: Colors.white.withValues(alpha: 0.85), size: 17),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(label,
                    style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: Color(0xFF9CA3AF))),
                const SizedBox(height: 1),
                Text(
                  value,
                  textDirection: valueDirection,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1A1A2E),
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          if (actionIcon != null) ...[
            const SizedBox(width: 8),
            Icon(actionIcon,
                size: 18,
                color: actionColor ?? const Color(0xFF4ADE80)),
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
  final Color  color;

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
            decoration:
                BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 5),
          Text(label,
              style: TextStyle(
                  color: color,
                  fontSize: 12,
                  fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

// ── Glass badge (header pill) ─────────────────────────────────────────────────
class _GlassBadge extends StatelessWidget {
  const _GlassBadge({required this.label, required this.accent});
  final String label;
  final Color  accent;

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
            decoration:
                BoxDecoration(color: accent, shape: BoxShape.circle),
          ),
          const SizedBox(width: 5),
          Text(label,
              style: TextStyle(
                  color: accent,
                  fontSize: 12,
                  fontWeight: FontWeight.w700)),
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
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(12),
          border:
              Border.all(color: Colors.white.withValues(alpha: 0.15)),
        ),
        child: const Icon(Icons.arrow_back_ios_new_rounded,
            color: Colors.white, size: 18),
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
