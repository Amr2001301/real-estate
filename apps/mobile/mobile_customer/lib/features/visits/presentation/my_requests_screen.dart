import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../domain/entities/visit_request.dart';
import 'my_visits_cubit.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyCard = Color(0xFF1A3352);
const _navyLight = Color(0xFF243F62);

// ── Extensions ────────────────────────────────────────────────────────────────

extension on VisitStatus {
  String label(AppLocalizations l) => switch (this) {
        VisitStatus.pending => l.visitStatusPending,
        VisitStatus.approved => l.visitStatusApproved,
        VisitStatus.scheduled => l.visitStatusScheduled,
        VisitStatus.completed => l.visitStatusCompleted,
        VisitStatus.cancelled => l.visitStatusCancelled,
        VisitStatus.unknown => '',
      };

  BadgeTone get tone => switch (this) {
        VisitStatus.pending => BadgeTone.warning,
        VisitStatus.approved => BadgeTone.info,
        VisitStatus.scheduled => BadgeTone.gold,
        VisitStatus.completed => BadgeTone.success,
        VisitStatus.cancelled => BadgeTone.error,
        VisitStatus.unknown => BadgeTone.neutral,
      };
}

extension on AppointmentStatus {
  String customerLabel(AppLocalizations l) => switch (this) {
        AppointmentStatus.scheduled => l.appointmentStatusAwaitingCustomer,
        AppointmentStatus.confirmed => l.appointmentStatusConfirmedByCustomer,
        AppointmentStatus.pendingReschedule =>
          l.appointmentStatusPendingRescheduleCustomer,
        AppointmentStatus.completed => l.visitStatusCompleted,
        AppointmentStatus.cancelled => l.visitStatusCancelled,
        AppointmentStatus.noShow => l.visitStatusNoShow,
        AppointmentStatus.rescheduled => l.visitStatusRescheduled,
        AppointmentStatus.unknown => '',
      };

  BadgeTone get tone => switch (this) {
        AppointmentStatus.scheduled => BadgeTone.warning,
        AppointmentStatus.confirmed => BadgeTone.success,
        AppointmentStatus.pendingReschedule => BadgeTone.gold,
        AppointmentStatus.completed => BadgeTone.success,
        AppointmentStatus.cancelled => BadgeTone.error,
        AppointmentStatus.noShow => BadgeTone.error,
        AppointmentStatus.rescheduled => BadgeTone.neutral,
        AppointmentStatus.unknown => BadgeTone.neutral,
      };
}

// ─────────────────────────────────────────────────────────────────────────────
// My Requests Screen
// ─────────────────────────────────────────────────────────────────────────────

class MyRequestsScreen extends StatefulWidget {
  const MyRequestsScreen({super.key});

  @override
  State<MyRequestsScreen> createState() => _MyRequestsScreenState();
}

class _MyRequestsScreenState extends State<MyRequestsScreen> {
  @override
  void initState() {
    super.initState();
    context.read<MyVisitsCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      backgroundColor: context.appColors.canvas,
      body: Column(
        children: [
          BlocBuilder<MyVisitsCubit, MyVisitsState>(
            builder: (context, state) => _Header(
              l10n: l10n,
              count: state.data?.length,
            ),
          ),
          Expanded(
            child: BlocConsumer<MyVisitsCubit, MyVisitsState>(
              listenWhen: (a, b) =>
                  !identical(a.lastOutcome, b.lastOutcome) &&
                  b.lastOutcome != null,
              listener: (context, state) {
                final outcome = state.lastOutcome!;
                if (outcome.isSuccess) {
                  final msg = switch (outcome.kind) {
                    VisitActionKind.confirm => l10n.appointmentConfirmSuccess,
                    VisitActionKind.requestReschedule =>
                      l10n.appointmentRescheduleSuccess,
                  };
                  ScaffoldMessenger.of(context)
                      .showSnackBar(SnackBar(content: Text(msg)));
                } else {
                  showFailureSnackBar(context, outcome.failure!);
                }
              },
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const Center(child: CircularProgressIndicator());
                  case DataStatus.failure:
                    return ErrorState(
                      failure: state.failure,
                      onRetry: () => context.read<MyVisitsCubit>().load(),
                    );
                  case DataStatus.empty:
                    return EmptyState(
                      icon: Icons.event_note_outlined,
                      title: l10n.myRequestsEmptyTitle,
                      message: l10n.myRequestsEmptyMessage,
                    );
                  case DataStatus.success:
                    final items = state.data!;
                    return RefreshIndicator(
                      onRefresh: () => context.read<MyVisitsCubit>().load(),
                      child: ListView.separated(
                        padding: EdgeInsets.fromLTRB(
                          AppSpacing.lg,
                          AppSpacing.md,
                          AppSpacing.lg,
                          AppSpacing.xl +
                              MediaQuery.of(context).padding.bottom,
                        ),
                        itemCount: items.length,
                        separatorBuilder: (_, _) =>
                            const SizedBox(height: AppSpacing.md),
                        itemBuilder: (_, i) => _RequestCard(
                          request: items[i],
                          busy: state.inFlightAppointmentId != null &&
                              items[i].latestAppointment?.id ==
                                  state.inFlightAppointmentId,
                        ),
                      ),
                    );
                }
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ── Header ────────────────────────────────────────────────────────────────────

class _Header extends StatelessWidget {
  const _Header({required this.l10n, this.count});
  final AppLocalizations l10n;
  final int? count;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final topInset = MediaQuery.paddingOf(context).top;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: Container(
        width: double.infinity,
        clipBehavior: Clip.antiAlias,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topRight,
            end: Alignment.bottomLeft,
            colors: [_navyLight, _navyCard, _navyDeep],
            stops: [0.0, 0.45, 1.0],
          ),
          borderRadius: BorderRadius.only(
            bottomLeft: Radius.circular(28),
            bottomRight: Radius.circular(28),
          ),
          boxShadow: [
            BoxShadow(
              color: Color(0x35000000),
              blurRadius: 22,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: Stack(
          children: [
            const Positioned.fill(
              child: IgnorePointer(child: _DotTexture()),
            ),
            PositionedDirectional(
              end: 0,
              top: 0,
              child: Container(
                width: 160,
                height: 130,
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment.topRight,
                    radius: 1.0,
                    colors: [
                      AppPalette.gold400.withValues(alpha: 0.09),
                      AppPalette.gold400.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),
            Positioned(
              bottom: 0,
              left: 48,
              right: 48,
              child: Container(
                height: 1,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      AppPalette.gold400.withValues(alpha: 0.0),
                      AppPalette.gold400.withValues(alpha: 0.5),
                      AppPalette.gold400.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.lg,
                topInset + AppSpacing.md,
                AppSpacing.lg,
                AppSpacing.xl,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  _BackBtn(),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          l10n.myRequestsTitle,
                          style: theme.textTheme.titleLarge?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            height: 1.1,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          l10n.visitRequestTitle,
                          style: TextStyle(
                            color: AppPalette.gold300,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (count != null) ...[
                    const SizedBox(width: AppSpacing.sm),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.2),
                        ),
                      ),
                      child: Text(
                        '$count',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 15,
                        ),
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

// ── Request card ──────────────────────────────────────────────────────────────

class _RequestCard extends StatelessWidget {
  const _RequestCard({required this.request, required this.busy});

  final VisitRequest request;
  final bool busy;

  static (List<Color>, Color) _style(VisitRequest req) {
    final appt = req.latestAppointment;
    if (appt != null) {
      return switch (appt.status) {
        AppointmentStatus.completed || AppointmentStatus.confirmed => (
          const [Color(0xFF1B5E3F), Color(0xFF0D3826)],
          const Color(0xFF4ADE80),
        ),
        AppointmentStatus.scheduled => (
          const [_navyLight, _navyDeep],
          AppPalette.gold300,
        ),
        AppointmentStatus.pendingReschedule => (
          const [Color(0xFF7A5C1E), Color(0xFF4A3610)],
          const Color(0xFFFBD27A),
        ),
        AppointmentStatus.cancelled || AppointmentStatus.noShow => (
          const [Color(0xFF9B2020), Color(0xFF620D0D)],
          const Color(0xFFF87171),
        ),
        _ => (const [_navyLight, _navyDeep], AppPalette.gold300),
      };
    }
    return switch (req.status) {
      VisitStatus.completed => (
        const [Color(0xFF1B5E3F), Color(0xFF0D3826)],
        const Color(0xFF4ADE80),
      ),
      VisitStatus.approved || VisitStatus.scheduled => (
        const [Color(0xFF1E3A6E), Color(0xFF0B1F42)],
        const Color(0xFF93C5FD),
      ),
      VisitStatus.cancelled => (
        const [Color(0xFF9B2020), Color(0xFF620D0D)],
        const Color(0xFFF87171),
      ),
      _ => (const [_navyLight, _navyDeep], AppPalette.gold300),
    };
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final appointment = request.latestAppointment;

    final badgeLabel = appointment != null
        ? appointment.status.customerLabel(l10n)
        : request.status.label(l10n);
    final badgeTone = appointment != null
        ? appointment.status.tone
        : request.status.tone;

    final (stripGrad, accent) = _style(request);

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.45)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.07),
            blurRadius: 20,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Gradient strip
          SizedBox(
            height: 72,
            child: Stack(
              fit: StackFit.expand,
              children: [
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: stripGrad,
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                ),
                const IgnorePointer(child: _DotTexture()),
                Positioned(
                  bottom: 0,
                  left: 0,
                  right: 0,
                  child: Container(
                    height: 1,
                    color: accent.withValues(alpha: 0.3),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: AppSpacing.sm,
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              request.projectName?.resolve(lang) ??
                                  l10n.visitRequestTitle,
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w800,
                                fontSize: 17,
                                height: 1.1,
                                letterSpacing: -0.2,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            if (request.assignedSalesName != null) ...[
                              const SizedBox(height: 3),
                              Text(
                                request.assignedSalesName!,
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.65),
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      StatusBadge(label: badgeLabel, tone: badgeTone),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // ── White body
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.md,
              AppSpacing.lg,
              AppSpacing.md,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (request.preferredDate != null)
                  _InfoRow(
                    icon: AppIcons.calendar,
                    label: l10n.visitOn('').trim().isNotEmpty
                        ? l10n.visitOn('').replaceAll('', '').trim()
                        : 'المفضّل',
                    value: DateFormatter.mediumDate(
                      request.preferredDate!,
                      languageCode: lang,
                    ),
                    colors: colors,
                    theme: theme,
                  ),
                if (request.preferredTime != null &&
                    request.preferredTime!.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.xs),
                  _InfoRow(
                    icon: Icons.schedule_rounded,
                    label: l10n.preferredTimeLabel,
                    value: request.preferredTime!,
                    colors: colors,
                    theme: theme,
                  ),
                ],
                if (appointment?.scheduledAt != null) ...[
                  const SizedBox(height: AppSpacing.xs),
                  _InfoRow(
                    icon: Icons.event_available_rounded,
                    label: l10n.appointmentProposedDateLabel,
                    value: DateFormatter.mediumDate(
                      appointment!.scheduledAt!,
                      languageCode: lang,
                    ),
                    colors: colors,
                    theme: theme,
                    highlight: true,
                  ),
                ],
                if (request.notes != null &&
                    request.notes!.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Divider(
                    height: 1,
                    color: colors.hairline,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    '${l10n.customerMessageLabel}:',
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: colors.inkMuted),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    request.notes!,
                    style: theme.textTheme.bodyMedium
                        ?.copyWith(color: colors.inkStrong),
                  ),
                ],
                if (appointment?.status ==
                        AppointmentStatus.pendingReschedule &&
                    appointment?.customerFeedback != null &&
                    appointment!.customerFeedback!.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Divider(height: 1, color: colors.hairline),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    '${l10n.customerRescheduleReasonLabel}:',
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: colors.inkMuted),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    appointment.customerFeedback!,
                    style: theme.textTheme.bodyMedium,
                  ),
                ],
                if (appointment != null && appointment.awaitsCustomer) ...[
                  const SizedBox(height: AppSpacing.md),
                  _AppointmentActions(
                    appointment: appointment,
                    busy: busy,
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Info row ──────────────────────────────────────────────────────────────────

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.colors,
    required this.theme,
    this.highlight = false,
  });

  final IconData icon;
  final String label;
  final String value;
  final AppColorsExt colors;
  final ThemeData theme;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 14, color: colors.inkMuted),
        const SizedBox(width: 6),
        Text(
          '$label: ',
          style: theme.textTheme.bodySmall?.copyWith(
            color: colors.inkMuted,
            fontSize: 13,
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: theme.textTheme.bodySmall?.copyWith(
              color: colors.inkStrong,
              fontSize: 14,
              fontWeight: highlight ? FontWeight.w700 : FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}

// ── Appointment actions ───────────────────────────────────────────────────────

class _AppointmentActions extends StatelessWidget {
  const _AppointmentActions({
    required this.appointment,
    required this.busy,
  });

  final AppointmentSummary appointment;
  final bool busy;

  Future<void> _onRequestReschedule(BuildContext context) async {
    final cubit = context.read<MyVisitsCubit>();
    final reason = await _askReason(context);
    if (reason == null) return;
    await cubit.requestReschedule(
      appointment.id,
      reason: reason.isEmpty ? null : reason,
    );
  }

  Future<String?> _askReason(BuildContext context) async {
    final l10n = context.l10n;
    final controller = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.appointmentRescheduleReasonLabel),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLines: 3,
          maxLength: 500,
          decoration: InputDecoration(
            hintText: l10n.appointmentRescheduleReasonHint,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(l10n.actionCancel),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, controller.text),
            child: Text(l10n.appointmentSendReschedule),
          ),
        ],
      ),
    );
    controller.dispose();
    return result;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Row(
      children: [
        Expanded(
          child: AppButton(
            label: l10n.appointmentActionConfirm,
            variant: AppButtonVariant.gold,
            size: AppButtonSize.medium,
            isLoading: busy,
            onPressed: busy
                ? null
                : () => context
                    .read<MyVisitsCubit>()
                    .confirmAppointment(appointment.id),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: AppButton(
            label: l10n.appointmentActionRequestReschedule,
            variant: AppButtonVariant.outline,
            size: AppButtonSize.medium,
            onPressed:
                busy ? null : () => _onRequestReschedule(context),
          ),
        ),
      ],
    );
  }
}

// ── Shared ────────────────────────────────────────────────────────────────────

class _BackBtn extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.pop(),
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(11),
          border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
        ),
        child: const Icon(
          Icons.arrow_back_ios_new_rounded,
          color: Colors.white,
          size: 16,
        ),
      ),
    );
  }
}

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
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.04);
    const step = 20.0;
    for (var y = 6.0; y < size.height; y += step) {
      for (var x = 6.0; x < size.width; x += step) {
        canvas.drawCircle(Offset(x, y), 1.1, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DotPainter _) => false;
}
