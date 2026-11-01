import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/lead_stage_label.dart';
import '../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/lead.dart';
import '../cubit/follow_ups_cubit.dart';
import '../follow_up_labels.dart';

/// FU1 — «المتابعات»: the customers due a call, in three lists (overdue,
/// today, upcoming) with their counts, as on the dashboard. A rep sees their
/// own; a manager their team's.
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

  String _bucketLabel(AppLocalizations l10n, FollowUpBucket b) => switch (b) {
        FollowUpBucket.overdue => l10n.followUpsOverdue,
        FollowUpBucket.today => l10n.followUpsToday,
        FollowUpBucket.upcoming => l10n.followUpsUpcoming,
      };

  String _emptyLabel(AppLocalizations l10n, FollowUpBucket b) => switch (b) {
        FollowUpBucket.overdue => l10n.followUpsEmptyOverdue,
        FollowUpBucket.today => l10n.followUpsEmptyToday,
        FollowUpBucket.upcoming => l10n.followUpsEmptyUpcoming,
      };

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;

    return Scaffold(
      backgroundColor: colors.canvas,
      body: Column(
        children: [
          AppNavHeader(
            title: l10n.followUpsTitle,
            compact: true,
            leadingAction: NavHeaderAction(
              icon: Icons.arrow_back_ios_new_rounded,
              onTap: () => context.canPop() ? context.pop() : context.go('/home'),
            ),
          ),
          BlocBuilder<FollowUpsCubit, FollowUpsState>(
            buildWhen: (a, b) => a.bucket != b.bucket || a.summary != b.summary,
            builder: (context, state) => Padding(
              padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.sm, AppSpacing.md, AppSpacing.xs),
              child: AppFilterPills<FollowUpBucket>(
                options: [
                  for (final b in FollowUpBucket.values)
                    FilterPillOption(
                      value: b,
                      label: state.summary == null
                          ? _bucketLabel(l10n, b)
                          : '${_bucketLabel(l10n, b)} (${state.summary!.of(b)})',
                      tone: b == FollowUpBucket.overdue ? BadgeTone.error : null,
                    ),
                ],
                selected: state.bucket,
                onSelected: (b) {
                  if (b != null) context.read<FollowUpsCubit>().select(b);
                },
              ),
            ),
          ),
          Expanded(
            child: BlocBuilder<FollowUpsCubit, FollowUpsState>(
              builder: (context, state) {
                final cubit = context.read<FollowUpsCubit>();
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const StaffListSkeleton(rows: 5, lines: 3);
                  case DataStatus.failure:
                    return ErrorState(failure: state.failure, onRetry: cubit.load);
                  case DataStatus.empty:
                    return RefreshIndicator(
                      onRefresh: cubit.refresh,
                      child: ListView(
                        children: [
                          const SizedBox(height: AppSpacing.xxl),
                          EmptyState(
                            icon: Icons.event_available_rounded,
                            title: _emptyLabel(l10n, state.bucket),
                            message: l10n.followUpsEmptyHint,
                          ),
                        ],
                      ),
                    );
                  case DataStatus.success:
                    return RefreshIndicator(
                      onRefresh: cubit.refresh,
                      child: ListView.separated(
                        controller: _scroll,
                        padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.sm, AppSpacing.md, AppSpacing.xxl),
                        itemCount: state.items.length + (state.isLoadingMore ? 1 : 0),
                        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
                        itemBuilder: (context, i) {
                          if (i >= state.items.length) {
                            return const Padding(
                              padding: EdgeInsets.all(AppSpacing.md),
                              child: Center(child: CircularProgressIndicator()),
                            );
                          }
                          final item = state.items[i];
                          return _FollowUpCard(
                            item: item,
                            late: state.bucket == FollowUpBucket.overdue,
                            onTap: () async {
                              await context.push('/leads/${item.lead.id}', extra: item.lead);
                              // Back from the lead: what was logged there moves it.
                              if (context.mounted) await cubit.refresh();
                            },
                          );
                        },
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

class _FollowUpCard extends StatelessWidget {
  const _FollowUpCard({required this.item, required this.late, required this.onTap});
  final FollowUp item;
  final bool late;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final text = Theme.of(context).textTheme;
    final lang = Localizations.localeOf(context).languageCode;
    final lead = item.lead;
    final at = lead.nextActionAt;
    final type = lead.nextActionType ?? 'FOLLOW_UP';
    final note = lead.nextActionNote?.trim();
    final phone = lead.phone?.trim();

    return AppCard(
      key: ValueKey('follow-up-${lead.id}'),
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(lead.fullName, style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
              ),
              StatusBadge(label: leadStageLabel(l10n, lead.stage), tone: BadgeTone.neutral),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Row(
            children: [
              Icon(noteKindIcon(type), size: 16, color: late ? colors.error : noteKindColor(type)),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  at == null ? noteKindLabel(l10n, type) : '${noteKindLabel(l10n, type)} · ${followUpWhen(at, l10n, lang)}',
                  style: text.bodySmall?.copyWith(
                    color: late ? colors.error : colors.inkStrong,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          if (note != null && note.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(note, style: text.bodySmall?.copyWith(color: colors.inkMuted)),
          ],
          const SizedBox(height: AppSpacing.xs),
          Text(
            item.lastAt == null
                ? l10n.followUpsNoActivity
                : '${l10n.followUpsLastActivity}: ${noteKindLabel(l10n, item.lastKind ?? 'NOTE')}'
                    '${item.lastCallResult != null ? ' (${callResultLabel(l10n, item.lastCallResult!)})' : ''}'
                    ' · ${followUpDate(item.lastAt!, lang)}',
            style: text.labelSmall?.copyWith(color: colors.inkMuted),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          if (lead.assignedSalesName != null) ...[
            const SizedBox(height: 2),
            Text(lead.assignedSalesName!, style: text.labelSmall?.copyWith(color: colors.inkMuted)),
          ],
          if (phone != null && phone.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Row(
              children: [
                TextButton.icon(
                  onPressed: () => ContactActions.call(phone),
                  icon: const Icon(Icons.call_rounded, size: 16),
                  label: Text(l10n.contactCall),
                ),
                TextButton.icon(
                  onPressed: () => ContactActions.whatsApp(number: phone),
                  icon: const Icon(Icons.chat_rounded, size: 16),
                  label: Text(l10n.contactWhatsapp),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
