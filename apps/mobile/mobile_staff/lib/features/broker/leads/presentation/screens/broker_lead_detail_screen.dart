import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../../common/broker_status_label.dart';
import '../../../../../common/lead_stage_label.dart';
import '../../../../../common/staff_contact_actions.dart';
import '../../domain/entities/broker_lead.dart';
import '../cubit/broker_lead_detail_cubit.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyCard = Color(0xFF1A3352);
const _navyLight = Color(0xFF243F62);

// ─────────────────────────────────────────────────────────────────────────────
// Broker Lead Detail Screen
// ─────────────────────────────────────────────────────────────────────────────

class BrokerLeadDetailScreen extends StatefulWidget {
  const BrokerLeadDetailScreen({super.key, this.fallback});
  final BrokerLead? fallback;

  @override
  State<BrokerLeadDetailScreen> createState() =>
      _BrokerLeadDetailScreenState();
}

class _BrokerLeadDetailScreenState extends State<BrokerLeadDetailScreen> {
  @override
  void initState() {
    super.initState();
    context.read<BrokerLeadDetailCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: BlocBuilder<BrokerLeadDetailCubit, BrokerLeadDetailState>(
          builder: (context, state) {
            switch (state.status) {
              case DataStatus.initial:
              case DataStatus.loading:
                return Column(
                  children: [
                    _LeadHeader(name: widget.fallback?.fullName),
                    const Expanded(
                      child: Center(child: CircularProgressIndicator()),
                    ),
                  ],
                );
              case DataStatus.failure:
                return Column(
                  children: [
                    _LeadHeader(name: widget.fallback?.fullName),
                    Expanded(
                      child: ErrorState(
                        failure: state.failure,
                        onRetry: () =>
                            context.read<BrokerLeadDetailCubit>().load(),
                      ),
                    ),
                  ],
                );
              case DataStatus.empty:
              case DataStatus.success:
                return _Body(detail: state.data!);
            }
          },
        ),
      ),
    );
  }
}

// ── Body ──────────────────────────────────────────────────────────────────────

class _Body extends StatelessWidget {
  const _Body({required this.detail});
  final BrokerLeadDetail detail;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final theme = Theme.of(context);
    final lead = detail.lead;

    return Column(
      children: [
        _LeadHeader(
          name: lead.fullName,
          approvalStatus: lead.approvalStatus,
          l10n: l10n,
        ),
        Expanded(
          child: ListView(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.xl + MediaQuery.of(context).padding.bottom,
            ),
            children: [
              // ── Contact card ──────────────────────────────────────────────
              Container(
                padding: const EdgeInsets.all(AppSpacing.lg),
                decoration: BoxDecoration(
                  color: colors.surface,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: colors.hairline.withValues(alpha: 0.4),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 12,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 46,
                          height: 46,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [_navyLight, _navyDeep],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(13),
                          ),
                          child: Center(
                            child: Text(
                              lead.fullName.isNotEmpty
                                  ? lead.fullName[0].toUpperCase()
                                  : '?',
                              style: const TextStyle(
                                color: AppPalette.gold300,
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                lead.fullName,
                                style: theme.textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              const SizedBox(height: 4),
                              StatusBadge(
                                label: leadStageLabel(l10n, lead.stage),
                                tone: leadStageTone(lead.stage),
                              ),
                            ],
                          ),
                        ),
                        if (lead.projectName != null)
                          Flexible(
                            child: Text(
                              lead.projectName!,
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: colors.inkMuted,
                              ),
                              textAlign: TextAlign.end,
                              maxLines: 2,
                            ),
                          ),
                      ],
                    ),
                    if (lead.phone != null) ...[
                      const SizedBox(height: AppSpacing.md),
                      Divider(height: 1, color: colors.hairline),
                      const SizedBox(height: AppSpacing.md),
                      StaffContactButtons(phone: lead.phone),
                    ],
                  ],
                ),
              ),

              const SizedBox(height: AppSpacing.md),

              // ── New reservation CTA ───────────────────────────────────────
              GestureDetector(
                onTap: () => context.push(
                  '/broker/reservations/new',
                  extra: {'leadId': lead.id},
                ),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 18,
                    vertical: 16,
                  ),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF7C5200), Color(0xFF3D2800)],
                      begin: Alignment.topRight,
                      end: Alignment.bottomLeft,
                    ),
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF7C5200).withValues(alpha: 0.35),
                        blurRadius: 14,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(
                          Icons.bookmark_add_rounded,
                          color: AppPalette.gold300,
                          size: 22,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              l10n.reservationNew,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 14,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            Text(
                              'قدّم طلب حجز لهذا العميل',
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.6),
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Icon(
                        Directionality.of(context) == TextDirection.rtl
                            ? Icons.arrow_back_ios_new_rounded
                            : Icons.arrow_forward_ios_rounded,
                        color: Colors.white.withValues(alpha: 0.5),
                        size: 14,
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: AppSpacing.lg),

              // ── Timeline section ──────────────────────────────────────────
              _SectionLabel(label: l10n.leadTimeline),
              const SizedBox(height: AppSpacing.sm),

              if (detail.timeline.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
                  child: Text(
                    l10n.leadTimelineEmpty,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: colors.inkMuted,
                    ),
                  ),
                )
              else
                for (final e in detail.timeline) ...[
                  _TimelineEntry(entry: e, lang: lang),
                  const SizedBox(height: AppSpacing.sm),
                ],
            ],
          ),
        ),
      ],
    );
  }
}

// ── Lead header ───────────────────────────────────────────────────────────────

class _LeadHeader extends StatelessWidget {
  const _LeadHeader({this.name, this.approvalStatus, this.l10n});

  final String? name;
  final String? approvalStatus;
  final AppLocalizations? l10n;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final topInset = MediaQuery.paddingOf(context).top;

    return Container(
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
              height: 120,
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
                        name ?? '—',
                        style: theme.textTheme.titleLarge?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          height: 1.1,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'العميل المحتمل',
                        style: TextStyle(
                          color: AppPalette.gold300,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                if (approvalStatus != null && l10n != null) ...[
                  const SizedBox(width: AppSpacing.sm),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.25),
                      ),
                    ),
                    child: Text(
                      brokerLeadStatusLabel(l10n!, approvalStatus!),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
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

// ── Section label ─────────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Row(
      children: [
        Container(
          width: 3,
          height: 16,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppPalette.gold400, AppPalette.gold300],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          label,
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w800,
            color: colors.inkStrong,
          ),
        ),
      ],
    );
  }
}

// ── Timeline entry ────────────────────────────────────────────────────────────

class _TimelineEntry extends StatelessWidget {
  const _TimelineEntry({required this.entry, required this.lang});
  final BrokerLeadTimelineEntry entry;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.4)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: entry.isNote
                  ? AppPalette.gold300.withValues(alpha: 0.12)
                  : colors.inkMuted.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(
              entry.isNote
                  ? Icons.sticky_note_2_rounded
                  : Icons.history_rounded,
              size: 16,
              color: entry.isNote ? AppPalette.gold300 : colors.inkMuted,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.body,
                  style: theme.textTheme.bodyMedium,
                ),
                if (entry.createdAt != null) ...[
                  const SizedBox(height: 3),
                  Text(
                    [
                      if (entry.authorName != null) entry.authorName!,
                      DateFormatter.shortDate(
                        entry.createdAt!,
                        languageCode: lang,
                      ),
                    ].join(' · '),
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: colors.inkMuted,
                    ),
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
        child: Icon(
          Directionality.of(context) == TextDirection.rtl
              ? Icons.arrow_forward_ios_rounded
              : Icons.arrow_back_ios_new_rounded,
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
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.04);
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
