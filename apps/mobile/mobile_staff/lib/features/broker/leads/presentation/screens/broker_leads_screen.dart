import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../../common/broker_status_label.dart';
import '../../../../../common/lead_stage_label.dart';
import '../../../../dashboard/home_kit/home_kit.dart';
import '../../../../leads/presentation/screens/leads_screen.dart' show leadStageColor, leadWhen;
import '../../domain/entities/broker_lead.dart';
import '../cubit/broker_leads_cubit.dart';

/// The colour of a broker lead's approval status.
Color brokerApprovalColor(String status, AppColorsExt colors) => switch (status) {
      'APPROVED' => colors.success,
      'REJECTED' => colors.error,
      'PENDING' => AppPalette.gold600,
      _ => colors.inkMuted,
    };

const _stages = ['NEW', 'INTERESTED', 'VISIT', 'NEGOTIATION', 'WON', 'LOST'];

/// The broker's leads (owner-approved look, 2026-11-04), with the broker
/// portal's figures on the website: how many were sent, wait for the
/// company, were approved or rejected; filters by approval and stage; and
/// on each card the project and unit, the company's rep and when it was
/// sent. An agent sees their own leads, the firm's manager all of them
/// (the server decides).
class BrokerLeadsScreen extends StatefulWidget {
  const BrokerLeadsScreen({super.key});

  @override
  State<BrokerLeadsScreen> createState() => _BrokerLeadsScreenState();
}

class _BrokerLeadsScreenState extends State<BrokerLeadsScreen> {
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<BrokerLeadsCubit>().load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    final created = await context.push<bool>('/broker/leads/new');
    if (created == true && mounted) context.read<BrokerLeadsCubit>().load();
  }

  Future<void> _pickStage(BrokerLeadsCubit cubit) async {
    final l10n = context.l10n;
    final current = cubit.state.stage;
    final picked = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: ListView(shrinkWrap: true, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Text(l10n.blStage, style: homeDisplay(16, ctx.appColors.inkStrong)),
          ),
          for (final s in ['', ..._stages])
            ListTile(
              key: Key('broker-stage-${s.isEmpty ? 'all' : s}'),
              title: Text(s.isEmpty ? l10n.lvAll : leadStageLabel(l10n, s)),
              leading: s.isEmpty
                  ? null
                  : Container(width: 10, height: 10, decoration: BoxDecoration(color: leadStageColor(s, ctx.appColors), shape: BoxShape.circle)),
              trailing: (current ?? '') == s ? const Icon(Icons.check_rounded, color: AppPalette.gold500) : null,
              onTap: () => Navigator.of(ctx).pop(s),
            ),
        ]),
      ),
    );
    if (picked != null) await cubit.setStage(picked.isEmpty ? null : picked);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<BrokerLeadsCubit>();
    final bottomPad = MediaQuery.paddingOf(context).bottom;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        floatingActionButton: Padding(
          padding: const EdgeInsets.only(bottom: 84),
          child: FloatingActionButton(
            key: const Key('broker-leads-add'),
            backgroundColor: AppPalette.gold400,
            foregroundColor: AppPalette.navy,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
            onPressed: _create,
            child: const Icon(Icons.person_add_rounded),
          ),
        ),
        body: BlocBuilder<BrokerLeadsCubit, BrokerLeadsListState>(
          builder: (context, state) {
            final c = state.counts;
            return RefreshIndicator(
              onRefresh: cubit.load,
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverToBoxAdapter(
                    child: HomeListHero(
                      title: l10n.bhNavClients,
                      subtitle: c == null ? null : l10n.lvCountN(c.total),
                      actions: [
                        HomeHeroButton(
                          key: const Key('broker-leads-stage'),
                          icon: Icons.tune_rounded,
                          dot: state.stage != null,
                          tooltip: l10n.blStage,
                          onTap: () => _pickStage(cubit),
                        ),
                      ],
                      bottom: HomeSearchField(
                        controller: _search,
                        hint: l10n.leadsSearchHint,
                        onSubmitted: cubit.setSearch,
                        onClear: () {
                          _search.clear();
                          cubit.setSearch('');
                        },
                      ),
                    ),
                  ),
                  if (c != null)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 0),
                        child: HomeBand(figures: [
                          HomeFigure(id: 'total', value: '${c.total}', label: l10n.lvTotal, hint: l10n.blApprovedN(c.approved)),
                          HomeFigure(
                            id: 'pending',
                            value: '${c.pending}',
                            label: l10n.brokerLeadStatusPending,
                            hint: l10n.blWaitingCompany,
                            warn: c.pending > 0,
                          ),
                          HomeFigure(
                            id: 'rejected',
                            value: '${c.rejected}',
                            label: l10n.brokerLeadStatusRejected,
                            hint: c.rejected > 0 ? l10n.blSeeReason : l10n.blNoneRejected,
                          ),
                        ]),
                      ),
                    ),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 12, bottom: 4),
                      child: HomePills(pills: [
                        HomePill(
                          id: 'all',
                          label: l10n.lvAll,
                          count: c?.total,
                          selected: state.approvalStatus == null,
                          onTap: () => cubit.setApprovalStatus(null),
                        ),
                        for (final s in kBrokerLeadStatuses)
                          HomePill(
                            id: s,
                            label: brokerLeadStatusLabel(l10n, s),
                            count: switch (s) {
                              'PENDING' => c?.pending,
                              'APPROVED' => c?.approved,
                              'REJECTED' => c?.rejected,
                              _ => null,
                            },
                            dot: brokerApprovalColor(s, context.appColors),
                            selected: state.approvalStatus == s,
                            onTap: () => cubit.setApprovalStatus(state.approvalStatus == s ? null : s),
                          ),
                      ]),
                    ),
                  ),
                  if (state.stage != null)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(AppSpacing.md, 6, AppSpacing.md, 0),
                        child: Align(
                          alignment: AlignmentDirectional.centerStart,
                          child: InputChip(
                            key: const Key('broker-stage-chip'),
                            label: Text('${l10n.blStage}: ${leadStageLabel(l10n, state.stage!)}'),
                            onDeleted: () => cubit.setStage(null),
                          ),
                        ),
                      ),
                    ),
                  ..._body(context, state),
                  SliverPadding(padding: EdgeInsets.only(bottom: bottomPad + 120)),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  List<Widget> _body(BuildContext context, BrokerLeadsListState state) {
    final l10n = context.l10n;
    switch (state.status) {
      case DataStatus.initial:
      case DataStatus.loading:
        return const [
          SliverToBoxAdapter(child: Padding(padding: EdgeInsets.only(top: 80), child: Center(child: CircularProgressIndicator()))),
        ];
      case DataStatus.failure:
        return [SliverToBoxAdapter(child: ErrorState(failure: state.failure, onRetry: context.read<BrokerLeadsCubit>().load))];
      case DataStatus.empty:
        return [
          SliverToBoxAdapter(
            child: EmptyState(icon: Icons.people_outline_rounded, title: l10n.leadsEmptyTitle, message: l10n.brokerLeadsEmptyMessage),
          ),
        ];
      case DataStatus.success:
        return [
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.sm, AppSpacing.md, 0),
            sliver: SliverList.separated(
              itemCount: state.leads.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (context, i) => BrokerLeadCard(lead: state.leads[i]),
            ),
          ),
        ];
    }
  }
}

/// One broker lead, in the same card as the company's leads list: who,
/// the project and unit, the approval, the stage and the company's rep, and
/// underneath where the request stands (with the rejection reason) and when
/// it was sent, with WhatsApp and call.
class BrokerLeadCard extends StatelessWidget {
  const BrokerLeadCard({super.key, required this.lead});
  final BrokerLead lead;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final approval = brokerApprovalColor(lead.approvalStatus, colors);
    final duplicate = lead.approvalStatus == 'DUPLICATE';
    final where = [
      if ((lead.projectName ?? '').isNotEmpty) lead.projectName!,
      (lead.unitCode ?? '').isNotEmpty ? ltr(lead.unitCode!) : l10n.blAnyUnit,
    ].join(' · ');
    final reason = (lead.rejectionReason ?? '').trim();

    // Where the request stands, as the track on the lead's page.
    final (IconData statusIcon, String statusText) = switch (lead.approvalStatus) {
      'APPROVED' => (
          Icons.verified_rounded,
          lead.approvedAt == null ? l10n.blStepApproved : '${l10n.blStepApproved} · ${leadWhen(context, lead.approvedAt!, withTime: false)}',
        ),
      'REJECTED' => (Icons.cancel_rounded, reason.isNotEmpty ? reason : l10n.blStepRejected),
      'DUPLICATE' => (Icons.content_copy_rounded, l10n.blStepDuplicate),
      'EXPIRED' => (Icons.timer_off_rounded, l10n.blStepExpired),
      _ => (Icons.hourglass_top_rounded, l10n.blWaitingCompany),
    };

    return Opacity(
      opacity: duplicate ? 0.6 : 1,
      child: Material(
        color: colors.surface,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          key: Key('broker-lead-${lead.id}'),
          borderRadius: BorderRadius.circular(20),
          onTap: () => context.push('/broker/leads/${lead.id}', extra: lead),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: colors.hairline),
            ),
            child: Column(children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Container(
                    width: 44,
                    height: 44,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(gradient: homeNavyGradient, borderRadius: BorderRadius.circular(14)),
                    child: duplicate
                        ? const Icon(Icons.content_copy_rounded, size: 18, color: AppPalette.gold300)
                        : Text(homeInitials(lead.fullName), style: homeDisplay(14, AppPalette.gold300)),
                  ),
                  const SizedBox(width: 11),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Expanded(
                          child: Text(lead.fullName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: colors.inkStrong)),
                        ),
                        const SizedBox(width: 6),
                        _Pill(text: brokerLeadStatusLabel(l10n, lead.approvalStatus), color: approval),
                      ]),
                      const SizedBox(height: 3),
                      Row(children: [
                        Icon(Icons.apartment_rounded, size: 13, color: colors.inkMuted),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(where,
                              maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                        ),
                      ]),
                      const SizedBox(height: 6),
                      Wrap(spacing: 6, runSpacing: 4, children: [
                        _Tag(icon: Icons.flag_rounded, text: leadStageLabel(l10n, lead.stage), color: leadStageColor(lead.stage, colors)),
                        if ((lead.assignedSalesName ?? '').isNotEmpty)
                          _Tag(icon: Icons.person_rounded, text: lead.assignedSalesName!)
                        else
                          _Tag(icon: Icons.person_off_rounded, text: l10n.blNoRep),
                      ]),
                    ]),
                  ),
                ]),
              ),
              Container(
                padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
                decoration: BoxDecoration(
                  color: colors.surfaceSoft.withValues(alpha: 0.6),
                  borderRadius: const BorderRadius.vertical(bottom: Radius.circular(20)),
                  border: Border(top: BorderSide(color: colors.hairline)),
                ),
                child: Row(children: [
                  Icon(statusIcon, size: 15, color: approval),
                  const SizedBox(width: 5),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(statusText,
                          key: Key('broker-lead-status-${lead.id}'),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: approval)),
                      if (lead.sentAt != null)
                        Text(l10n.blSent(leadWhen(context, lead.sentAt!, withTime: false)),
                            style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                    ]),
                  ),
                  if ((lead.phone ?? '').isNotEmpty) ...[
                    _RoundAction(
                      key: Key('broker-lead-whatsapp-${lead.id}'),
                      icon: Icons.chat_rounded,
                      color: const Color(0xFF1E9E5A),
                      onTap: () => ContactActions.whatsApp(number: lead.phone!),
                    ),
                    const SizedBox(width: 6),
                    _RoundAction(
                      key: Key('broker-lead-call-${lead.id}'),
                      icon: Icons.phone_rounded,
                      color: AppPalette.navy,
                      onTap: () => ContactActions.call(lead.phone!),
                    ),
                  ],
                ]),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag({required this.icon, required this.text, this.color});
  final IconData icon;
  final String text;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = color ?? context.appColors.inkMuted;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: context.appColors.surfaceSoft, borderRadius: BorderRadius.circular(99)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 12, color: c),
        const SizedBox(width: 4),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 170),
          child: Text(text, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: c)),
        ),
      ]),
    );
  }
}

class _RoundAction extends StatelessWidget {
  const _RoundAction({super.key, required this.icon, required this.color, required this.onTap});
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
        color: color.withValues(alpha: 0.10),
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: SizedBox(width: 36, height: 36, child: Icon(icon, size: 18, color: color)),
        ),
      );
}

class _Pill extends StatelessWidget {
  const _Pill({required this.text, required this.color});
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.11), borderRadius: BorderRadius.circular(99)),
        child: Text(text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color)),
      );
}
