import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../common/lead_stage_label.dart';
import '../../../common/staff_list_skeleton.dart';
import '../../leads/presentation/follow_up_labels.dart';
import '../domain/duplicates.dart';
import 'duplicates_cubit.dart';

/// DUP1 — «العملاء المكررين»: a customer with more than one open lead. Keep
/// one; the ticked others merge into it with their notes and history. Admin,
/// and a sales manager over their own team.
class DuplicatesScreen extends StatefulWidget {
  const DuplicatesScreen({super.key});

  @override
  State<DuplicatesScreen> createState() => _DuplicatesScreenState();
}

class _DuplicatesScreenState extends State<DuplicatesScreen> {
  @override
  void initState() {
    super.initState();
    context.read<DuplicatesCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<DuplicatesCubit>();
    final bottomPad = MediaQuery.paddingOf(context).bottom;

    return Scaffold(
      body: Column(
        children: [
          AppNavHeader(
            title: l10n.duplicatesTitle,
            compact: true,
            leadingAction: NavHeaderAction(
              icon: Icons.arrow_back_ios_new_rounded,
              onTap: () => context.canPop() ? context.pop() : context.go('/home'),
            ),
          ),
          Expanded(
            child: BlocConsumer<DuplicatesCubit, DuplicatesState>(
              listenWhen: (a, b) => a.merged != b.merged || a.actionFailure != b.actionFailure,
              listener: (context, state) {
                final text = state.actionFailure != null
                    ? state.actionFailure!.userMessage(l10n)
                    : state.merged != null
                        ? l10n.duplicatesMerged(latinDigits('${state.merged}'))
                        : null;
                if (text != null) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
              },
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const StaffListSkeleton(rows: 3);
                  case DataStatus.failure:
                    return ErrorState(failure: state.failure, onRetry: cubit.load);
                  case DataStatus.empty:
                    return RefreshIndicator(
                      onRefresh: cubit.load,
                      child: ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        children: [
                          const SizedBox(height: AppSpacing.xl),
                          EmptyState(
                            icon: Icons.verified_user_outlined,
                            title: l10n.duplicatesEmpty,
                            message: l10n.duplicatesEmptyHint,
                          ),
                        ],
                      ),
                    );
                  case DataStatus.success:
                    return RefreshIndicator(
                      onRefresh: cubit.load,
                      child: ListView.separated(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.md, AppSpacing.md, bottomPad + 60),
                        itemCount: state.groups.length + 1,
                        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
                        itemBuilder: (context, i) =>
                            i == 0 ? const _HowItWorks() : _GroupCard(group: state.groups[i - 1], state: state),
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

class _HowItWorks extends StatelessWidget {
  const _HowItWorks();

  @override
  Widget build(BuildContext context) {
    final c = context.appColors;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: c.info.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: c.info.withValues(alpha: 0.25)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.info_outline_rounded, size: 18, color: c.info),
          const SizedBox(width: AppSpacing.xs),
          Expanded(child: Text(context.l10n.duplicatesHow, style: TextStyle(fontSize: 12.5, height: 1.6, color: c.ink))),
        ],
      ),
    );
  }
}

class _GroupCard extends StatelessWidget {
  const _GroupCard({required this.group, required this.state});
  final DuplicateGroup group;
  final DuplicatesState state;

  Future<void> _merge(BuildContext context, int count) async {
    final l10n = context.l10n;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.duplicatesConfirmTitle),
        content: Text(l10n.duplicatesConfirmBody),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: Text(l10n.actionCancel)),
          FilledButton(onPressed: () => Navigator.of(ctx).pop(true), child: Text(l10n.duplicatesMergeN(latinDigits('$count')))),
        ],
      ),
    );
    if (ok == true && context.mounted) await context.read<DuplicatesCubit>().merge(group);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final cubit = context.read<DuplicatesCubit>();
    final keep = state.keepOf(group);
    final toMerge = state.toMerge(group);
    final busy = state.merging == group.clientId;

    return Container(
      key: ValueKey('dup-${group.clientId}'),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadii.card,
        border: Border.all(color: colors.hairline.withValues(alpha: 0.7)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 12, offset: const Offset(0, 4))],
      ),
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(color: colors.warning.withValues(alpha: 0.12), shape: BoxShape.circle),
                child: Icon(Icons.people_alt_rounded, color: colors.warning, size: 20),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(group.name, style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w800, color: colors.inkStrong)),
                    if (group.phone != null)
                      Directionality(
                        textDirection: TextDirection.ltr,
                        child: Text(latinDigits(group.phone!), style: TextStyle(fontSize: 12.5, color: colors.inkMuted)),
                      ),
                  ],
                ),
              ),
              StatusBadge(label: l10n.duplicatesOpenLeads(latinDigits('${group.leads.length}')), tone: BadgeTone.warning),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          for (final l in group.leads) ...[
            _LeadRow(
              lead: l,
              isKeep: l.id == keep,
              ticked: toMerge.contains(l.id),
              onKeep: busy ? null : () => cubit.pickKeep(group, l.id),
              onTick: busy || l.id == keep || !l.mergeable ? null : () => cubit.toggle(group, l.id),
            ),
            const SizedBox(height: AppSpacing.xs),
          ],
          const SizedBox(height: AppSpacing.xs),
          Opacity(
            opacity: toMerge.isEmpty ? 0.5 : 1,
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                key: ValueKey('dup-merge-${group.clientId}'),
                onTap: toMerge.isEmpty || busy ? null : () => _merge(context, toMerge.length),
                borderRadius: BorderRadius.circular(AppRadii.md),
                child: Ink(
                  height: 46,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(colors: [AppPalette.gold600, AppPalette.gold400]),
                    borderRadius: BorderRadius.circular(AppRadii.md),
                  ),
                  child: Center(
                    child: busy
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.merge_rounded, color: Colors.white, size: 18),
                              const SizedBox(width: 6),
                              Text(
                                l10n.duplicatesMergeN(latinDigits('${toMerge.length}')),
                                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14),
                              ),
                            ],
                          ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LeadRow extends StatelessWidget {
  const _LeadRow({required this.lead, required this.isKeep, required this.ticked, this.onKeep, this.onTick});
  final DuplicateLead lead;
  final bool isKeep;
  final bool ticked;
  final VoidCallback? onKeep;
  final VoidCallback? onTick;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final l = lead;
    final meta = [
      '${l10n.duplicatesOwner}: ${l.ownerName ?? l10n.duplicatesUnassigned}',
      if (l.campaignName != null) l.campaignName! else if (l.sourceName != null) l.sourceName!,
      if (l.projectName != null) l.projectName!,
    ].join(' · ');
    final sub = [
      if (l.createdAt != null) '${l10n.duplicatesAdded} ${followUpDate(l.createdAt!, lang)}',
      l10n.duplicatesActivities(latinDigits('${l.notes}')),
    ].join(' · ');

    return Container(
      key: ValueKey('dup-lead-${l.id}'),
      padding: const EdgeInsets.fromLTRB(AppSpacing.sm, 10, AppSpacing.sm, 10),
      decoration: BoxDecoration(
        color: isKeep ? AppPalette.gold400.withValues(alpha: 0.08) : colors.surfaceSoft,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: isKeep ? AppPalette.gold400.withValues(alpha: 0.6) : colors.hairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              StatusBadge(label: leadStageLabel(l10n, l.stage), tone: leadStageTone(l.stage)),
              const Spacer(),
              _Choice(
                key: ValueKey('dup-keep-${l.id}'),
                label: l10n.duplicatesKeep,
                selected: isKeep,
                radio: true,
                onTap: onKeep,
              ),
              const SizedBox(width: AppSpacing.xs),
              _Choice(
                key: ValueKey('dup-tick-${l.id}'),
                label: l10n.duplicatesMerge,
                selected: !isKeep && ticked,
                onTap: onTick,
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(meta, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: colors.inkStrong)),
          const SizedBox(height: 2),
          Text(sub, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
          if (!l.mergeable) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                Icon(Icons.lock_outline_rounded, size: 14, color: colors.warning),
                const SizedBox(width: 4),
                Expanded(child: Text(l10n.duplicatesLocked, style: TextStyle(fontSize: 12, color: colors.warning))),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _Choice extends StatelessWidget {
  const _Choice({super.key, required this.label, required this.selected, this.radio = false, this.onTap});
  final String label;
  final bool selected;
  final bool radio;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final enabled = onTap != null || selected;
    final icon = radio
        ? (selected ? Icons.radio_button_checked_rounded : Icons.radio_button_unchecked_rounded)
        : (selected ? Icons.check_box_rounded : Icons.check_box_outline_blank_rounded);
    return Opacity(
      opacity: enabled ? 1 : 0.4,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadii.pillAll,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 20, color: selected ? AppPalette.gold500 : colors.inkMuted),
              const SizedBox(width: 4),
              Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.inkStrong)),
            ],
          ),
        ),
      ),
    );
  }
}
