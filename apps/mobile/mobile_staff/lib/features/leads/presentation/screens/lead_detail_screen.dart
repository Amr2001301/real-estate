import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/lead_stage_label.dart';
import '../../../../common/reservation_status_label.dart';
import '../../../../common/staff_list_skeleton.dart';
import '../../../../common/visit_status_label.dart';
import '../../domain/entities/lead.dart';
import '../../domain/repositories/leads_repository.dart';
import '../cubit/lead_detail_cubit.dart';
import '../follow_up_labels.dart';
import 'leads_screen.dart' show leadFollowState, LeadFollowState, leadWhen;
import 'log_activity_screen.dart';
import 'lost_reason_sheet.dart';

/// A lead's page (owner-approved look, 2026-11-04), with what the website's
/// lead page shows: the contact and the stage path, the next follow-up and
/// its log, the visits and bookings, the activity log, who owns it, the
/// client, the lead's details and its ad attribution.
class LeadDetailScreen extends StatefulWidget {
  const LeadDetailScreen({super.key, required this.leadId, this.fallbackName});
  final String leadId;
  final String? fallbackName;

  @override
  State<LeadDetailScreen> createState() => _LeadDetailScreenState();
}

enum _LeadTab { follow, links, activity }

class _LeadDetailScreenState extends State<LeadDetailScreen> {
  _LeadTab _tab = _LeadTab.follow;

  @override
  void initState() {
    super.initState();
    context.read<LeadDetailCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: BlocConsumer<LeadDetailCubit, LeadDetailState>(
          listenWhen: (a, b) => a.actionFailure != b.actionFailure && b.actionFailure != null,
          listener: (context, state) => showFailureSnackBar(context, state.actionFailure!),
          builder: (context, state) {
            final detail = state.detail;
            if (detail == null) {
              final name = widget.fallbackName ?? context.l10n.navLeads;
              return Column(children: [
                HomeListHero(back: true, title: name),
                Expanded(
                  child: state.status == DataStatus.failure
                      ? ErrorState(failure: state.failure, onRetry: () => context.read<LeadDetailCubit>().load())
                      : const StaffListSkeleton(rows: 5, lines: 3),
                ),
              ]);
            }
            return RefreshIndicator(
              onRefresh: () => context.read<LeadDetailCubit>().load(),
              child: ListView(
                key: const Key('lead-detail'),
                padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 32),
                children: [_LeadHero(detail: detail, working: state.working), ..._sections(context, state, detail)],
              ),
            );
          },
        ),
      ),
    );
  }

  List<Widget> _sections(BuildContext context, LeadDetailState state, LeadDetail detail) {
    final l10n = context.l10n;
    final lead = detail.lead;
    final role = context.read<SessionCubit>().state.role;
    final manager = role == AppRole.admin || role == AppRole.salesManager;
    final open = lead.stage != 'WON' && lead.stage != 'LOST';
    final hasLinks = !state.links.isEmpty;
    final tab = !hasLinks && _tab == _LeadTab.links ? _LeadTab.follow : _tab;

    return [
      if (lead.stage == 'LOST')
        Padding(padding: const EdgeInsets.fromLTRB(AppSpacing.md, 16, AppSpacing.md, 0), child: _LostBox(detail: detail)),
      HomeSection(
        icon: Icons.alarm_rounded,
        title: l10n.leadNextAction,
        child: _NextFollowUp(lead: lead, open: open, working: state.working),
      ),
      DvTabs<_LeadTab>(
        keyPrefix: 'lead-tab',
        selected: tab,
        onChanged: (t) => setState(() => _tab = t),
        tabs: [
          (_LeadTab.follow, l10n.ldFollowLog, detail.notes.isEmpty ? null : detail.notes.length, false),
          if (hasLinks) (_LeadTab.links, l10n.ldVisitsBookings, null, false),
          (_LeadTab.activity, l10n.ldActivityLog, null, false),
        ],
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(AppSpacing.md, 12, AppSpacing.md, 0),
        child: switch (tab) {
          _LeadTab.follow => _NotesLog(notes: detail.notes),
          _LeadTab.links => _Links(links: state.links),
          _LeadTab.activity => _ActivityLog(items: detail.activities),
        },
      ),
      HomeSection(
        icon: Icons.info_outline_rounded,
        title: l10n.ldOpportunity,
        child: _Opportunity(detail: detail, manager: manager, working: state.working, profile: role == AppRole.admin),
      ),
      if (detail.utm.isNotEmpty)
        HomeSection(
          icon: Icons.campaign_rounded,
          title: l10n.ldAds,
          child: DvInfoCard(rows: [for (final e in detail.utm.entries) DvInfo(e.key, ltr(e.value))]),
        ),
    ];
  }
}

/// The navy header: the name and stage, the project and source, how to reach
/// the lead, the stage path (a tap moves it) and call / WhatsApp / email
/// (a press is logged, as on the website).
class _LeadHero extends StatelessWidget {
  const _LeadHero({required this.detail, required this.working});
  final LeadDetail detail;
  final bool working;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final lead = detail.lead;
    final cubit = context.read<LeadDetailCubit>();
    final project = lead.projectName?.resolve(lang) ?? lead.projectInterest;
    final source = lead.brokerName != null ? '${l10n.lvBroker} · ${lead.brokerName}' : (lead.sourceName?.resolve(lang) ?? l10n.lvDirect);

    Future<void> contact(String kind) async {
      final messenger = ScaffoldMessenger.of(context);
      final noPhone = l10n.lvNoPhone;
      final phone = await cubit.openContact(kind) ?? lead.phone;
      if (phone == null || phone.isEmpty) {
        messenger.showSnackBar(SnackBar(content: Text(noPhone)));
        return;
      }
      kind == 'WHATSAPP' ? await ContactActions.whatsApp(number: phone) : await ContactActions.call(phone);
    }

    void stage(String s) {
      if (s == lead.stage || working) return;
      // As on the website: a lead is won only by converting its booking.
      if (s == 'WON') {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(l10n.ldWonByBooking)));
        return;
      }
      s == 'LOST' ? showLostReasonSheet(context, cubit) : cubit.changeStage(s);
    }

    final reach = [if ((lead.phone ?? '').isNotEmpty) ltr(lead.phone!), if ((lead.email ?? '').isNotEmpty) lead.email!].join(' · ');
    return HomeListHero(
      key: const Key('lead-contact-card'),
      back: true,
      title: lead.fullName,
      badge: DvHeroBadge(
        leadStageLabel(l10n, lead.stage),
        tone: lead.stage == 'WON' ? DvTone.ok : (lead.stage == 'LOST' ? DvTone.bad : DvTone.neutral),
      ),
      subtitle: [
        if ((project ?? '').isNotEmpty) project!,
        if ((detail.unitInterest ?? '').isNotEmpty) ltr(detail.unitInterest!),
        source,
      ].join(' · '),
      bottom: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        if (reach.isNotEmpty)
          Text(reach, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5, color: Color(0xFFAEB8CB))),
        const SizedBox(height: 14),
        _StageBar(current: lead.stage, working: working, onTap: stage),
        const SizedBox(height: 16),
        Row(children: [
          if ((lead.phone ?? '').isNotEmpty) ...[
            Expanded(child: _HeroBtn(key: const Key('lead-detail-call'), icon: Icons.phone_rounded, label: l10n.ldCall, gold: true, onTap: () => contact('CALL'))),
            const SizedBox(width: 8),
            Expanded(child: _HeroBtn(key: const Key('lead-detail-whatsapp'), icon: Icons.chat_rounded, label: l10n.ldWhatsApp, onTap: () => contact('WHATSAPP'))),
          ],
          if ((lead.email ?? '').isNotEmpty) ...[
            if ((lead.phone ?? '').isNotEmpty) const SizedBox(width: 8),
            Expanded(
              child: _HeroBtn(icon: Icons.mail_rounded, label: l10n.ldEmail, onTap: () => ContactActions.openExternal('mailto:${lead.email}')),
            ),
          ],
        ]),
      ]),
    );
  }
}

/// The stage path as segments: done gold, the current one named in gold,
/// a lost lead's segment red. A tap moves the lead.
class _StageBar extends StatelessWidget {
  const _StageBar({required this.current, required this.working, required this.onTap});
  final String current;
  final bool working;
  final ValueChanged<String> onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lost = current == 'LOST';
    final at = kLeadStages.indexOf(current);
    return Opacity(
      opacity: working ? 0.6 : 1,
      child: Row(children: [
        for (var i = 0; i < kLeadStages.length; i++)
          Expanded(
            child: InkWell(
              key: Key('lead-stage-${kLeadStages[i]}'),
              onTap: working ? null : () => onTap(kLeadStages[i]),
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 4),
                child: Column(children: [
                  Container(
                    height: 5,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(3),
                      gradient: !lost && i <= at ? dvGoldGradient : null,
                      color: lost && i == at ? const Color(0xFFE5737D) : (!lost && i <= at ? null : const Color(0x24FFFFFF)),
                    ),
                  ),
                  const SizedBox(height: 6),
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      leadStageLabel(l10n, kLeadStages[i]),
                      maxLines: 1,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: i == at ? FontWeight.w700 : FontWeight.w500,
                        color: i == at ? (lost ? const Color(0xFFF29AA2) : const Color(0xFFEED7A0)) : const Color(0xFFAEB8CB),
                      ),
                    ),
                  ),
                ]),
              ),
            ),
          ),
      ]),
    );
  }
}

class _HeroBtn extends StatelessWidget {
  const _HeroBtn({super.key, required this.icon, required this.label, required this.onTap, this.gold = false});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool gold;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: gold ? dvGoldGradient : null,
        color: gold ? null : const Color(0x14FFFFFF),
        border: gold ? null : Border.all(color: const Color(0x24FFFFFF)),
        borderRadius: BorderRadius.circular(13),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(13),
          onTap: onTap,
          child: SizedBox(
            height: 42,
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(icon, size: 17, color: gold ? dvOnGold : Colors.white),
              const SizedBox(width: 6),
              Flexible(
                child: Text(label,
                    maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: gold ? dvOnGold : Colors.white)),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

class _Btn extends StatelessWidget {
  const _Btn({super.key, required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Material(
      color: colors.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: colors.hairline)),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: SizedBox(
          height: 48,
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: 17, color: colors.inkStrong),
            const SizedBox(width: 6),
            Flexible(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.inkStrong))),
          ]),
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.text, required this.color});
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.11), borderRadius: BorderRadius.circular(99)),
        child: Text(text, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: color)),
      );
}

/// Why and when it was lost.
class _LostBox extends StatelessWidget {
  const _LostBox({required this.detail});
  final LeadDetail detail;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    return Container(
      key: const Key('lead-lost'),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colors.error.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.error.withValues(alpha: 0.25)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(detail.lostReason?.resolve(lang) ?? l10n.ldNoReason,
            style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: colors.error)),
        if (detail.lostAt != null)
          Text(l10n.ldLostOn(DateFormatter.mediumDate(detail.lostAt!, languageCode: lang)),
              style: TextStyle(fontSize: 12, color: colors.inkMuted)),
        if ((detail.lostNote ?? '').trim().isNotEmpty) ...[
          const SizedBox(height: 4),
          Text(detail.lostNote!.trim(), style: TextStyle(fontSize: 12.5, color: colors.inkStrong, height: 1.4)),
        ],
      ]),
    );
  }
}

/// The next follow-up, coloured as on the website (overdue red, today amber,
/// later gold), with logging a contact and scheduling a visit.
class _NextFollowUp extends StatelessWidget {
  const _NextFollowUp({required this.lead, required this.open, required this.working});
  final Lead lead;
  final bool open;
  final bool working;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final cubit = context.read<LeadDetailCubit>();
    final at = lead.nextActionAt;
    final state = at == null ? null : leadFollowState(at, DateTime.now());
    final (Color tone, String badge) = switch (state) {
      LeadFollowState.overdue => (colors.error, l10n.ldStateOverdue),
      LeadFollowState.today => (colors.warning, l10n.ldStateToday),
      LeadFollowState.upcoming => (AppPalette.gold600, l10n.ldStateUpcoming),
      null => (colors.inkMuted, ''),
    };
    final note = lead.nextActionNote?.trim();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Container(
        key: const Key('lead-next-action'),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: at == null ? colors.surface : tone.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: at == null ? colors.hairline : tone.withValues(alpha: 0.35)),
        ),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: at == null ? colors.surfaceSoft : tone,
              borderRadius: BorderRadius.circular(13),
            ),
            child: Icon(at == null ? Icons.event_busy_rounded : noteKindIcon(lead.nextActionType ?? 'FOLLOW_UP'),
                size: 20, color: at == null ? colors.inkMuted : Colors.white),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: at == null
                ? Text(l10n.leadNextActionNone, style: TextStyle(fontSize: 12.5, color: colors.inkMuted, height: 1.4))
                : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Container(
                        key: Key('lead-next-state-${state!.name}'),
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(color: tone, borderRadius: BorderRadius.circular(99)),
                        child: Text(badge, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Colors.white)),
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(noteKindLabel(l10n, lead.nextActionType ?? 'FOLLOW_UP'),
                            style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: colors.inkStrong)),
                      ),
                    ]),
                    const SizedBox(height: 4),
                    Text(leadWhen(context, at), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: tone)),
                    if (note != null && note.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(note, style: TextStyle(fontSize: 12.5, color: colors.inkMuted, height: 1.4)),
                    ],
                  ]),
          ),
        ]),
      ),
      const SizedBox(height: 10),
      Row(children: [
        Expanded(
          flex: 3,
          child: AppButton(
            key: const Key('lead-log-activity'),
            label: l10n.leadLogActivity,
            onPressed: working ? null : () => openLogActivity(context, cubit, leadName: lead.fullName, currentNext: lead.nextActionAt),
            variant: AppButtonVariant.gold,
            icon: Icons.add_comment_rounded,
            isLoading: working,
            expand: true,
          ),
        ),
        if (open) ...[
          const SizedBox(width: 8),
          Expanded(
            flex: 2,
            child: _Btn(
              key: const Key('lead-schedule-visit'),
              icon: Icons.event_rounded,
              label: l10n.visitNew,
              onTap: () => context.push('/visits/new', extra: {'leadId': lead.id}),
            ),
          ),
        ],
      ]),
    ]);
  }
}

/// The logged contacts (the website's follow-up log): kind, call result,
/// who and when, the follow-up each set, and replies.
class _NotesLog extends StatelessWidget {
  const _NotesLog({required this.notes});
  final List<LeadTimelineEntry> notes;

  static Future<void> _askReply(BuildContext context, String noteId) async {
    final l10n = context.l10n;
    final cubit = context.read<LeadDetailCubit>();
    final controller = TextEditingController();
    final body = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.noteReply),
        content: TextField(
          key: const Key('reply-body'),
          controller: controller,
          autofocus: true,
          minLines: 1,
          maxLines: 4,
          decoration: InputDecoration(hintText: l10n.noteReplyHint),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: Text(l10n.actionCancel)),
          FilledButton(
            key: const Key('reply-send'),
            onPressed: () => Navigator.of(ctx).pop(controller.text),
            child: Text(l10n.noteReplySend),
          ),
        ],
      ),
    );
    controller.dispose();
    if (body != null && body.trim().isNotEmpty) await cubit.reply(noteId, body);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    if (notes.isEmpty) return _Empty(text: l10n.ldNoNotes);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      decoration: homeCard(context, radius: 22),
      child: Column(children: [
        for (var i = 0; i < notes.length; i++)
          Container(
            key: Key('lead-note-${notes[i].id}'),
            padding: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: colors.hairline))),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(color: noteKindColor(notes[i].kind).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
                child: Icon(noteKindIcon(notes[i].kind), size: 18, color: noteKindColor(notes[i].kind)),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Wrap(spacing: 6, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
                    Text(noteKindLabel(l10n, notes[i].kind),
                        style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: noteKindColor(notes[i].kind))),
                    if (notes[i].callResult != null)
                      StatusBadge(label: callResultLabel(l10n, notes[i].callResult!), tone: callResultTone(notes[i].callResult!)),
                  ]),
                  if (notes[i].body.trim().isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(notes[i].body, style: TextStyle(fontSize: 13, color: colors.inkStrong, height: 1.45)),
                  ],
                  if (notes[i].nextActionAt != null) ...[
                    const SizedBox(height: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(color: homeTint(context), borderRadius: BorderRadius.circular(99)),
                      child: Text('${l10n.leadNextAction}: ${followUpWhen(notes[i].nextActionAt!, l10n, lang)}',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppPalette.gold600)),
                    ),
                  ],
                  const SizedBox(height: 4),
                  Text(
                    [
                      if ((notes[i].authorName ?? '').isNotEmpty) notes[i].authorName!,
                      if (notes[i].createdAt != null) leadWhen(context, notes[i].createdAt!),
                    ].join(' · '),
                    style: TextStyle(fontSize: 12, color: colors.inkMuted),
                  ),
                  for (final r in notes[i].replies)
                    Container(
                      margin: const EdgeInsets.only(top: 6),
                      padding: const EdgeInsetsDirectional.only(start: 10),
                      decoration: BoxDecoration(border: BorderDirectional(start: BorderSide(color: colors.hairline, width: 2))),
                      child: Text.rich(
                        TextSpan(children: [
                          if (r.authorName != null) TextSpan(text: '${r.authorName}: ', style: const TextStyle(fontWeight: FontWeight.w700)),
                          TextSpan(text: r.body),
                        ]),
                        style: TextStyle(fontSize: 12.5, color: colors.inkStrong, height: 1.4),
                      ),
                    ),
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: TextButton.icon(
                      key: ValueKey('reply-${notes[i].id}'),
                      style: TextButton.styleFrom(padding: EdgeInsets.zero, visualDensity: VisualDensity.compact),
                      onPressed: () => _askReply(context, notes[i].id),
                      icon: const Icon(Icons.reply_rounded, size: 16),
                      label: Text(l10n.noteReply),
                    ),
                  ),
                ]),
              ),
            ]),
          ),
      ]),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: homeCard(context, radius: 20),
        child: Text(text, style: TextStyle(fontSize: 13, color: context.appColors.inkMuted)),
      );
}

String _requestStatus(AppLocalizations l10n, String s) => switch (s) {
      'NEW' || 'PENDING' => l10n.ldReqNew,
      'UNDER_REVIEW' || 'APPROVED' => l10n.ldReqReview,
      'CONVERTED' || 'SCHEDULED' || 'COMPLETED' => l10n.ldReqConverted,
      'REJECTED' => l10n.ldReqRejected,
      'CANCELLED' => l10n.ldReqCancelled,
      _ => s,
    };

/// The lead's visit requests, visits and bookings.
class _Links extends StatelessWidget {
  const _Links({required this.links});
  final LeadLinks links;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final rows = <Widget>[
      for (final r in links.appointments)
        _LinkRow(
          key: Key('lead-visit-${r.id}'),
          icon: Icons.event_rounded,
          title: '${l10n.ldAppointment} ${ltr(r.number ?? '')}'.trim(),
          sub: r.at == null ? '' : leadWhen(context, r.at!),
          status: visitStatusLabel(l10n, r.status),
          tone: colors.info,
          onTap: () => context.push('/visits/${r.id}'),
        ),
      for (final r in links.requests)
        _LinkRow(
          icon: Icons.event_note_rounded,
          title: '${l10n.ldVisitRequest} ${ltr(r.number ?? '')}'.trim(),
          sub: r.at == null ? '' : DateFormatter.mediumDate(r.at!, languageCode: lang),
          status: _requestStatus(l10n, r.status),
          tone: AppPalette.gold600,
        ),
      for (final r in links.reservations)
        _LinkRow(
          key: Key('lead-reservation-${r.id}'),
          icon: Icons.bookmark_rounded,
          title: '${l10n.ldReservation} ${ltr(r.number ?? '')}'.trim(),
          sub: [
            if (r.project != null) r.project!.resolve(lang),
            if ((r.unitCode ?? '').isNotEmpty) ltr(r.unitCode!),
            if (r.at != null) l10n.ldExpires(DateFormatter.mediumDate(r.at!, languageCode: lang)),
          ].join(' · '),
          status: reservationStatusLabel(l10n, r.status),
          tone: colors.success,
          onTap: () => context.push('/reservations/${r.id}'),
        ),
    ];
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      decoration: homeCard(context, radius: 22),
      child: Column(children: [
        for (var i = 0; i < rows.length; i++)
          DecoratedBox(
            decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: colors.hairline))),
            child: rows[i],
          ),
      ]),
    );
  }
}

class _LinkRow extends StatelessWidget {
  const _LinkRow({super.key, required this.icon, required this.title, required this.sub, required this.status, required this.tone, this.onTap});
  final IconData icon;
  final String title;
  final String sub;
  final String status;
  final Color tone;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 11),
        child: Row(children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(color: tone.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, size: 18, color: tone),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: colors.inkStrong)),
              if (sub.isNotEmpty) Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
            ]),
          ),
          _Chip(text: status, color: tone),
          if (onTap != null) ...[const SizedBox(width: 4), Icon(Icons.chevron_left_rounded, size: 18, color: colors.inkMuted)],
        ]),
      ),
    );
  }
}

/// What the website's activity log says for one system entry.
(String, IconData, Color) leadActivityText(AppLocalizations l10n, LeadTimelineEntry e, AppColorsExt colors) {
  final p = e.payload;
  String? s(String k) => p[k] is String ? p[k] as String : null;
  final type = e.body;
  if (type == 'reservation') {
    final status = s('status') ?? '';
    final n = status == 'CONVERTED' ? s('contractNumber') : s('reservationNumber');
    final label = switch (status) {
      'CONVERTED' => l10n.ldActConverted,
      'CREATED' => l10n.ldActResCreated,
      'APPROVED' => l10n.ldActResApproved,
      'REJECTED' => l10n.ldActResRejected,
      'CANCELLED' => l10n.ldActResCancelled,
      'EXPIRED' => l10n.ldActResExpired,
      _ => l10n.ldActResOther,
    };
    final tone = switch (status) {
      'CONVERTED' || 'APPROVED' => colors.success,
      'REJECTED' || 'CANCELLED' => colors.error,
      'EXPIRED' => colors.warning,
      _ => AppPalette.gold600,
    };
    return (n == null ? label : '$label · ${ltr(n)}', Icons.bookmark_rounded, tone);
  }
  if (type == 'status_change') {
    final from = s('from'), to = s('to');
    return (
      l10n.ldActStage(from == null ? '—' : leadStageLabel(l10n, from), to == null ? '—' : leadStageLabel(l10n, to)),
      Icons.swap_horiz_rounded,
      to == 'WON' ? colors.success : to == 'LOST' ? colors.error : colors.warning,
    );
  }
  if (type == 'visit') {
    final status = s('status') ?? '';
    final label = switch (status) {
      'SCHEDULED' => l10n.ldActVisitScheduled,
      'CONFIRMED' => l10n.ldActVisitConfirmed,
      'PENDING_RESCHEDULE' => l10n.ldActVisitPending,
      'RESCHEDULED' => l10n.ldActVisitRescheduled,
      'COMPLETED' => l10n.ldActVisitCompleted,
      'CANCELLED' => l10n.ldActVisitCancelled,
      'NO_SHOW' => l10n.ldActVisitNoShow,
      _ => l10n.ldActVisitOther,
    };
    final n = s('visitNumber');
    final tone = status == 'COMPLETED' ? colors.success : status == 'CANCELLED' || status == 'NO_SHOW' ? colors.error : colors.info;
    return (n == null ? label : '$label · ${ltr(n)}', Icons.event_rounded, tone);
  }
  String by(String label) => (s('by') ?? '').isEmpty ? label : '$label — ${s('by')}';
  return switch (type) {
    'created' => (l10n.ldActCreated, Icons.person_add_rounded, colors.info),
    'assigned' => (l10n.ldActAssigned, Icons.badge_rounded, AppPalette.gold600),
    'note' => (l10n.ldActNote, Icons.sticky_note_2_rounded, colors.inkMuted),
    'broker_submitted' => (l10n.ldActBrokerSubmitted, Icons.handshake_rounded, colors.info),
    'broker_approved' => (l10n.ldActBrokerApproved, Icons.handshake_rounded, colors.success),
    'broker_rejected' => (l10n.ldActBrokerRejected, Icons.handshake_rounded, colors.error),
    'broker_marked_duplicate' => (l10n.ldActBrokerDuplicate, Icons.handshake_rounded, colors.warning),
    'broker_note' => (l10n.ldActBrokerNote, Icons.handshake_rounded, colors.inkMuted),
    'broker_reservation_created' => (l10n.ldActBrokerReservation, Icons.handshake_rounded, AppPalette.gold600),
    'broker_contract_created' => (l10n.ldActBrokerContract, Icons.handshake_rounded, colors.success),
    'broker_commission_earned' => (l10n.ldActBrokerCommission, Icons.handshake_rounded, colors.success),
    'broker_submitted_via_visit' || 'broker_visit_requested' => (l10n.ldActBrokerVisit, Icons.handshake_rounded, colors.info),
    'returned' => (l10n.ldActReturned, Icons.replay_rounded, AppPalette.gold600),
    'merged' => (by(l10n.ldActMerged(p['count'] is num ? (p['count'] as num).toInt() : 1)), Icons.merge_rounded, colors.info),
    'contact_opened' => s('kind') == 'WHATSAPP'
        ? (by(l10n.ldActWhatsApp), Icons.chat_rounded, colors.success)
        : (by(l10n.ldActCall), Icons.phone_rounded, colors.info),
    _ when type.startsWith('relinked') => (l10n.ldActRelinked, Icons.link_rounded, colors.inkMuted),
    _ => (l10n.ldActOther, Icons.history_rounded, colors.inkMuted),
  };
}

class _ActivityLog extends StatelessWidget {
  const _ActivityLog({required this.items});
  final List<LeadTimelineEntry> items;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    if (items.isEmpty) return _Empty(text: l10n.ldNoActivity);
    return DvTimeline(events: [
      for (final e in items)
        DvEvent(leadActivityText(l10n, e, colors).$1, subtitle: e.createdAt == null ? null : leadWhen(context, e.createdAt!)),
    ]);
  }
}

/// The lead's details, as the website's «بيانات الفرصة», with who owns it
/// (managers and admins hand it to another rep) and the client behind it.
class _Opportunity extends StatelessWidget {
  const _Opportunity({required this.detail, required this.manager, required this.working, this.profile = false});
  final LeadDetail detail;
  final bool manager;
  final bool working;

  /// The client's profile opens for admins only, as on the website.
  final bool profile;

  Future<void> _pick(BuildContext context) async {
    final cubit = context.read<LeadDetailCubit>();
    final l10n = context.l10n;
    final staff = await cubit.salesStaff();
    if (!context.mounted || staff.isEmpty) return;
    final chosen = await showModalBottomSheet<StaffOption>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: ListView(shrinkWrap: true, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Text(l10n.ldAssignTo, style: homeDisplay(16, ctx.appColors.inkStrong)),
          ),
          for (final o in staff)
            ListTile(
              key: Key('assign-${o.id}'),
              leading: CircleAvatar(
                backgroundColor: AppPalette.navy,
                child: Text(homeInitials(o.name), style: TextStyle(color: AppPalette.gold300, fontSize: 12)),
              ),
              title: Text(o.name),
              trailing: o.id == detail.assignedSalesId ? Icon(Icons.check_rounded, color: AppPalette.gold500) : null,
              onTap: () => Navigator.of(ctx).pop(o),
            ),
        ]),
      ),
    );
    if (chosen != null && chosen.id != detail.assignedSalesId) await cubit.assign(chosen.id);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final lead = detail.lead;
    final project = lead.projectName?.resolve(lang) ?? lead.projectInterest;
    final id = lead.id.replaceAll('-', '');
    final rep = lead.assignedSalesName;
    return DvInfoCard(rows: [
      DvInfo(
        l10n.ldAssignment,
        rep == null ? (manager ? l10n.ldAssign : l10n.lvUnassigned) : (manager ? '$rep · ${l10n.ldReassign}' : rep),
        id: manager ? 'lead-reassign' : null,
        onTap: manager && !working ? () => _pick(context) : null,
      ),
      if (detail.clientId != null)
        DvInfo(
          l10n.ldClient,
          detail.clientRole == 'CUSTOMER' ? l10n.ldOwner : l10n.ldBrowser,
          id: 'lead-client',
          onTap: profile ? () => context.push('/clients/${detail.clientId}') : null,
        ),
      if ((project ?? '').isNotEmpty) DvInfo(l10n.ldProject, project!),
      if ((detail.unitInterest ?? '').isNotEmpty)
        DvInfo(l10n.ldUnit, [ltr(detail.unitInterest!), if ((detail.unitType ?? '').isNotEmpty) detail.unitType!].join(' · ')),
      DvInfo(l10n.ldSource, lead.brokerName != null ? l10n.lvBroker : (lead.sourceName?.resolve(lang) ?? l10n.lvDirect)),
      if (lead.brokerName != null) DvInfo(l10n.ldBrokerLbl, lead.brokerName!),
      if ((detail.brokerAgentName ?? '').isNotEmpty) DvInfo(l10n.ldBrokerAgent, detail.brokerAgentName!),
      if ((lead.campaignName ?? '').isNotEmpty) DvInfo(l10n.ldCampaign, lead.campaignName!),
      if (lead.createdAt != null) DvInfo(l10n.ldCreated, DateFormatter.mediumDate(lead.createdAt!.toLocal(), languageCode: lang)),
      DvInfo(l10n.ldLeadId, ltr('#${id.substring(0, id.length < 8 ? id.length : 8).toUpperCase()}')),
    ]);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Action card row (schedule visit etc.)
// ══════════════════════════════════════════════════════════════════════════════

