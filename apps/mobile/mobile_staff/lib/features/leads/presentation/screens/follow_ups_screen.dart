import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/lead_stage_label.dart';
import '../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/lead.dart';
import '../cubit/follow_ups_cubit.dart';
import '../follow_up_labels.dart';

/// «المتابعات» (design x1, owner-approved 2026-11-05): the customers due a
/// call, in three lists (overdue, today, upcoming) with their counts, as on
/// the dashboard. A rep sees their own; a manager their team's.
class FollowUpsScreen extends StatefulWidget {
  const FollowUpsScreen({super.key});

  @override
  State<FollowUpsScreen> createState() => _FollowUpsScreenState();
}

class _FollowUpsScreenState extends State<FollowUpsScreen> {
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    context.read<FollowUpsCubit>().load();
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 300) {
        context.read<FollowUpsCubit>().loadMore();
      }
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  String _emptyLabel(AppLocalizations l10n, FollowUpBucket b) => switch (b) {
        FollowUpBucket.overdue => l10n.followUpsEmptyOverdue,
        FollowUpBucket.today => l10n.followUpsEmptyToday,
        FollowUpBucket.upcoming => l10n.followUpsEmptyUpcoming,
      };

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<FollowUpsCubit>();
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BlocBuilder<FollowUpsCubit, FollowUpsState>(
          builder: (context, state) {
            final s = state.summary;
            Color tone(FollowUpBucket b) => switch (b) {
                  FollowUpBucket.overdue => const Color(0xFFB3261E),
                  FollowUpBucket.today => AppPalette.gold500,
                  FollowUpBucket.upcoming => const Color(0xFF26405F),
                };
            String label(FollowUpBucket b) => switch (b) {
                  FollowUpBucket.overdue => l10n.followUpsOverdue,
                  FollowUpBucket.today => l10n.followUpsToday,
                  FollowUpBucket.upcoming => l10n.followUpsUpcoming,
                };
            return RefreshIndicator(
              onRefresh: cubit.refresh,
              child: CustomScrollView(
                controller: _scroll,
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverToBoxAdapter(
                    child: HomeListHero(
                      title: l10n.followUpsTitle,
                      subtitle: s == null ? null : l10n.fuCountN(s.overdue + s.today + s.upcoming),
                      back: true,
                    ),
                  ),
                  if (s != null) ...[
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 0),
                        child: HomeBand(figures: [
                          HomeFigure(id: 'overdue', value: '${s.overdue}', label: l10n.followUpsOverdue, hint: l10n.fuOverdueHint, warn: s.overdue > 0),
                          HomeFigure(id: 'today', value: '${s.today}', label: l10n.followUpsToday, hint: s.today == 0 ? l10n.fuNoneToday : l10n.followUpsToday),
                          HomeFigure(id: 'upcoming', value: '${s.upcoming}', label: l10n.followUpsUpcoming, hint: s.upcoming == 0 ? l10n.fuNoneUpcoming : l10n.followUpsUpcoming),
                        ]),
                      ),
                    ),
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 14),
                        child: HomePills(pills: [
                          for (final b in FollowUpBucket.values)
                            HomePill(id: b.name, label: label(b), count: s.of(b), dot: tone(b), selected: state.bucket == b, onTap: () => cubit.select(b)),
                        ]),
                      ),
                    ),
                  ],
                  ...switch (state.status) {
                    DataStatus.initial || DataStatus.loading => [const SliverToBoxAdapter(child: SizedBox(height: 520, child: StaffListSkeleton(band: true)))],
                    DataStatus.failure => [SliverToBoxAdapter(child: ErrorState(failure: state.failure, onRetry: cubit.load))],
                    DataStatus.empty => [SliverToBoxAdapter(child: EmptyState(icon: Icons.event_available_rounded, title: _emptyLabel(l10n, state.bucket), message: l10n.followUpsEmptyHint))],
                    DataStatus.success => [
                        SliverPadding(
                          padding: const EdgeInsets.fromLTRB(AppSpacing.md, 12, AppSpacing.md, 0),
                          sliver: SliverList.separated(
                            itemCount: state.items.length + (state.isLoadingMore ? 1 : 0),
                            separatorBuilder: (_, _) => const SizedBox(height: 10),
                            itemBuilder: (context, i) {
                              if (i >= state.items.length) return const Padding(padding: EdgeInsets.symmetric(vertical: 16), child: Center(child: CircularProgressIndicator()));
                              final item = state.items[i];
                              return FollowUpCard(
                                item: item,
                                color: tone(state.bucket),
                                onTap: () async {
                                  await context.push('/leads/${item.lead.id}', extra: item.lead);
                                  // Back from the lead: what was logged there moves it.
                                  if (context.mounted) await cubit.refresh();
                                },
                              );
                            },
                          ),
                        ),
                      ],
                  },
                  SliverPadding(padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 100)),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

/// One customer due a call: who, the stage, what to do and when, the last
/// contact, and call / WhatsApp; a tap opens the lead to log the result.
class FollowUpCard extends StatelessWidget {
  const FollowUpCard({super.key, required this.item, required this.color, required this.onTap});
  final FollowUp item;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final lead = item.lead;
    final at = lead.nextActionAt;
    final type = lead.nextActionType ?? 'FOLLOW_UP';
    final note = lead.nextActionNote?.trim();
    final phone = lead.phone?.trim();
    final where = [
      if ((lead.projectInterest ?? '').isNotEmpty) lead.projectInterest!,
      if ((lead.assignedSalesName ?? '').isNotEmpty) lead.assignedSalesName!,
    ].join(' · ');
    final last = item.lastAt == null
        ? l10n.followUpsNoActivity
        : item.lastCallResult != null
            ? '${noteKindLabel(l10n, item.lastKind ?? 'NOTE')} · ${callResultLabel(l10n, item.lastCallResult!)}'
            : '${noteKindLabel(l10n, item.lastKind ?? 'NOTE')} · ${followUpDate(item.lastAt!, lang)}';
    final stageColor = switch (leadStageTone(lead.stage)) {
      BadgeTone.success => colors.success,
      BadgeTone.warning => colors.warning,
      BadgeTone.error => colors.error,
      BadgeTone.info => colors.info,
      _ => colors.inkMuted,
    };
    return DvEntityCard(
      inkKey: ValueKey('follow-up-${lead.id}'),
      onTap: onTap,
      initials: homeInitials(lead.fullName),
      title: lead.fullName,
      subtitle: [if (note != null && note.isNotEmpty) note, if (where.isNotEmpty) where].join(' · '),
      status: leadStageLabel(l10n, lead.stage),
      statusColor: stageColor,
      footIcon: noteKindIcon(type),
      footColor: color,
      footText: at == null ? noteKindLabel(l10n, type) : '${noteKindLabel(l10n, type)} · ${followUpWhen(at, l10n, lang)}',
      footSub: last,
      actions: [
        if (phone != null && phone.isNotEmpty) ...[
          DvSquareAction(icon: Icons.chat_outlined, color: const Color(0xFF1E7A55), tooltip: l10n.contactWhatsapp, onTap: () => ContactActions.whatsApp(number: phone)),
          DvSquareAction(icon: Icons.phone_rounded, gold: true, tooltip: l10n.contactCall, onTap: () => ContactActions.call(phone)),
        ],
      ],
    );
  }
}
