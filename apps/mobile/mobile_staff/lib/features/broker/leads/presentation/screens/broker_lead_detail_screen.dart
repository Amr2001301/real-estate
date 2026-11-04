import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../../common/broker_status_label.dart';
import '../../../../../common/lead_stage_label.dart';
import '../../../../../common/visit_status_label.dart';
import '../../../../dashboard/home_kit/home_kit.dart';
import '../../../../leads/presentation/screens/leads_screen.dart' show leadStageColor, leadWhen;
import '../../domain/entities/broker_lead.dart';
import '../cubit/broker_lead_detail_cubit.dart';
import 'broker_leads_screen.dart' show brokerApprovalColor;

/// A broker's lead (owner-approved look, 2026-11-04), with what the broker
/// portal's lead page shows: the approval and stage, why it was rejected,
/// the client and the company's rep, the interest, the request's track
/// with its dates, and the visits. The company's notes stay internal.
class BrokerLeadDetailScreen extends StatefulWidget {
  const BrokerLeadDetailScreen({super.key, this.fallback});
  final BrokerLead? fallback;

  @override
  State<BrokerLeadDetailScreen> createState() => _BrokerLeadDetailScreenState();
}

class _BrokerLeadDetailScreenState extends State<BrokerLeadDetailScreen> {
  @override
  void initState() {
    super.initState();
    context.read<BrokerLeadDetailCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: BlocBuilder<BrokerLeadDetailCubit, BrokerLeadDetailState>(
          builder: (context, state) {
            final detail = state.data;
            final lead = detail?.lead ?? widget.fallback;
            final hero = HomeListHero(
              back: true,
              title: lead?.fullName ?? l10n.leadSingular,
              subtitle: lead?.projectName,
            );
            if (detail == null) {
              return Column(children: [
                hero,
                Expanded(
                  child: state.status == DataStatus.failure
                      ? ErrorState(failure: state.failure, onRetry: () => context.read<BrokerLeadDetailCubit>().load())
                      : const Center(child: CircularProgressIndicator()),
                ),
              ]);
            }
            final l = detail.lead;
            // The server books only leads the company approved.
            final canBook = l.approvalStatus == 'APPROVED' && l.stage != 'WON' && l.stage != 'LOST';
            return RefreshIndicator(
              onRefresh: () => context.read<BrokerLeadDetailCubit>().load(),
              child: ListView(
                key: const Key('broker-lead-detail'),
                padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 32),
                children: [
                  hero,
                  const SizedBox(height: AppSpacing.md),
                  Padding(padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md), child: _ClientCard(lead: l)),
                  if (l.approvalStatus == 'REJECTED' && (l.rejectionReason ?? '').isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.sm),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                      child: _RejectionBox(reason: l.rejectionReason!),
                    ),
                  ],
                  if (canBook) ...[
                    const SizedBox(height: AppSpacing.md),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                      child: AppButton(
                        key: const Key('broker-lead-book'),
                        label: l10n.reservationNew,
                        icon: Icons.bookmark_add_rounded,
                        variant: AppButtonVariant.gold,
                        expand: true,
                        onPressed: () => context.push('/broker/reservations/new', extra: {'leadId': l.id}),
                      ),
                    ),
                  ],
                  HomeSection(icon: Icons.timeline_rounded, title: l10n.blTrack, child: _Track(lead: l)),
                  HomeSection(icon: Icons.apartment_rounded, title: l10n.blInterest, child: _Interest(lead: l, unitCode: detail.unitCode)),
                  HomeSection(icon: Icons.event_rounded, title: l10n.blVisits, child: _Visits(visits: detail.visits)),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _ClientCard extends StatelessWidget {
  const _ClientCard({required this.lead});
  final BrokerLead lead;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final approval = brokerApprovalColor(lead.approvalStatus, colors);
    return Container(
      key: const Key('broker-lead-card'),
      padding: const EdgeInsets.all(14),
      decoration: homeCard(context, radius: 24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Container(
            width: 54,
            height: 54,
            alignment: Alignment.center,
            decoration: BoxDecoration(gradient: homeNavyGradient, borderRadius: BorderRadius.circular(17)),
            child: Text(homeInitials(lead.fullName), style: homeDisplay(17, AppPalette.gold300)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(lead.fullName, style: homeDisplay(18, colors.inkStrong)),
              const SizedBox(height: 6),
              Wrap(spacing: 6, runSpacing: 6, children: [
                _Pill(text: brokerLeadStatusLabel(l10n, lead.approvalStatus), color: approval),
                _Pill(text: leadStageLabel(l10n, lead.stage), color: leadStageColor(lead.stage, colors)),
              ]),
            ]),
          ),
        ]),
        const SizedBox(height: 12),
        _Line(icon: Icons.badge_rounded, text: '${l10n.blRepFollows}: ${lead.assignedSalesName ?? l10n.blNoRep}'),
        if ((lead.phone ?? '').isNotEmpty) _Line(icon: Icons.phone_rounded, text: ltr(lead.phone!)),
        if ((lead.email ?? '').isNotEmpty) _Line(icon: Icons.alternate_email_rounded, text: lead.email!),
        if ((lead.phone ?? '').isNotEmpty || (lead.email ?? '').isNotEmpty) ...[
          const SizedBox(height: 12),
          Row(children: [
            if ((lead.phone ?? '').isNotEmpty) ...[
              Expanded(child: _Btn(icon: Icons.phone_rounded, label: l10n.ldCall, filled: true, onTap: () => ContactActions.call(lead.phone!))),
              const SizedBox(width: 8),
              Expanded(child: _Btn(icon: Icons.chat_rounded, label: l10n.ldWhatsApp, onTap: () => ContactActions.whatsApp(number: lead.phone!))),
            ],
            if ((lead.email ?? '').isNotEmpty) ...[
              if ((lead.phone ?? '').isNotEmpty) const SizedBox(width: 8),
              Expanded(child: _Btn(icon: Icons.mail_rounded, label: l10n.ldEmail, onTap: () => ContactActions.openExternal('mailto:${lead.email}'))),
            ],
          ]),
        ],
      ]),
    );
  }
}

class _RejectionBox extends StatelessWidget {
  const _RejectionBox({required this.reason});
  final String reason;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      key: const Key('broker-lead-rejection'),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colors.error.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.error.withValues(alpha: 0.25)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(context.l10n.blRejectionReason, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: colors.error)),
        const SizedBox(height: 4),
        Text(reason, style: TextStyle(fontSize: 13, color: colors.inkStrong, height: 1.4)),
      ]),
    );
  }
}

/// Sent, under review, then approved / rejected / already registered, with
/// the dates — the portal's status timeline.
class _Track extends StatelessWidget {
  const _Track({required this.lead});
  final BrokerLead lead;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    String? day(DateTime? d) => d == null ? null : leadWhen(context, d, withTime: false);
    final steps = <(IconData, String, String?, Color, bool)>[
      (Icons.send_rounded, l10n.blStepSent, day(lead.sentAt), colors.info, true),
      switch (lead.approvalStatus) {
        'APPROVED' => (Icons.check_circle_rounded, l10n.blStepApproved, day(lead.approvedAt), colors.success, true),
        'REJECTED' => (Icons.cancel_rounded, l10n.blStepRejected, day(lead.rejectedAt), colors.error, true),
        'DUPLICATE' => (Icons.content_copy_rounded, l10n.blStepDuplicate, null, colors.inkMuted, true),
        'EXPIRED' => (Icons.timer_off_rounded, l10n.blStepExpired, null, colors.inkMuted, true),
        _ => (Icons.hourglass_top_rounded, l10n.blStepReview, null, AppPalette.gold600, false),
      },
    ];
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      decoration: homeCard(context, radius: 20),
      child: Column(children: [
        for (var i = 0; i < steps.length; i++)
          Container(
            key: Key('broker-track-$i'),
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: colors.hairline))),
            child: Row(children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(color: steps[i].$4.withValues(alpha: steps[i].$5 ? 0.14 : 0.08), shape: BoxShape.circle),
                child: Icon(steps[i].$1, size: 17, color: steps[i].$4),
              ),
              const SizedBox(width: 11),
              Expanded(child: Text(steps[i].$2, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: colors.inkStrong))),
              if (steps[i].$3 != null) Text(steps[i].$3!, style: TextStyle(fontSize: 11.5, color: colors.inkMuted)),
            ]),
          ),
      ]),
    );
  }
}

class _Interest extends StatelessWidget {
  const _Interest({required this.lead, this.unitCode});
  final BrokerLead lead;
  final String? unitCode;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final code = unitCode ?? lead.unitCode;
    final unit = (code ?? '').isEmpty
        ? l10n.blAnyUnit
        : [ltr(code!), if ((lead.unitType ?? '').isNotEmpty) unitTypeLabel(lead.unitType, languageCode: lang)].join(' · ');
    return _Rows(rows: [
      if ((lead.projectName ?? '').isNotEmpty)
        (l10n.ldProject, [lead.projectName!, if ((lead.projectCity ?? '').isNotEmpty) lead.projectCity!].join(' · ')),
      (l10n.ldUnit, unit),
      (l10n.blStage, leadStageLabel(l10n, lead.stage)),
    ]);
  }
}

class _Visits extends StatelessWidget {
  const _Visits({required this.visits});
  final List<BrokerLeadVisit> visits;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    if (visits.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(14),
        decoration: homeCard(context, radius: 20),
        child: Text(l10n.blNoVisits, style: TextStyle(fontSize: 13, color: colors.inkMuted)),
      );
    }
    final now = DateTime.now();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      decoration: homeCard(context, radius: 20),
      child: Column(children: [
        for (var i = 0; i < visits.length; i++)
          () {
            final v = visits[i];
            final upcoming = v.at != null && v.at!.isAfter(now) && (v.status == 'SCHEDULED' || v.status == 'CONFIRMED');
            return Container(
              key: Key('broker-visit-${v.id}'),
              padding: const EdgeInsets.symmetric(vertical: 11),
              decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: colors.hairline))),
              child: Row(children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: (upcoming ? AppPalette.gold400 : colors.info).withValues(alpha: upcoming ? 0.22 : 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(Icons.event_rounded, size: 18, color: upcoming ? AppPalette.gold600 : colors.info),
                ),
                const SizedBox(width: 11),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${l10n.ldAppointment} ${ltr(v.number ?? '')}'.trim(),
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: colors.inkStrong)),
                    if (v.at != null) Text(leadWhen(context, v.at!), style: TextStyle(fontSize: 11.5, color: colors.inkMuted)),
                  ]),
                ),
                _Pill(text: visitStatusLabel(l10n, v.status), color: colors.info),
              ]),
            );
          }(),
      ]),
    );
  }
}

class _Rows extends StatelessWidget {
  const _Rows({required this.rows});
  final List<(String, String)> rows;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      decoration: homeCard(context, radius: 20),
      child: Column(children: [
        for (var i = 0; i < rows.length; i++)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: colors.hairline))),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              SizedBox(width: 100, child: Text(rows[i].$1, style: TextStyle(fontSize: 12, color: colors.inkMuted))),
              Expanded(child: Text(rows[i].$2, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.inkStrong))),
            ]),
          ),
      ]),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.text, required this.color});
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.11), borderRadius: BorderRadius.circular(99)),
        child: Text(text, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: color)),
      );
}

class _Line extends StatelessWidget {
  const _Line({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Row(children: [
          Icon(icon, size: 15, color: AppPalette.gold500),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: TextStyle(fontSize: 13, color: context.appColors.inkStrong))),
        ]),
      );
}

class _Btn extends StatelessWidget {
  const _Btn({required this.icon, required this.label, required this.onTap, this.filled = false});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Material(
      color: filled ? AppPalette.navy : colors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: filled ? AppPalette.navy : colors.hairline),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: SizedBox(
          height: 44,
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: 17, color: filled ? AppPalette.gold300 : AppPalette.navy),
            const SizedBox(width: 6),
            Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: filled ? Colors.white : AppPalette.navy)),
          ]),
        ),
      ),
    );
  }
}
