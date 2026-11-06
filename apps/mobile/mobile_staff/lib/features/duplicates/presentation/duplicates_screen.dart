import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';

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

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: BlocConsumer<DuplicatesCubit, DuplicatesState>(
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
            final ready = state.status == DataStatus.success;
            return RefreshIndicator(
              onRefresh: cubit.load,
              child: ListView(
                key: const Key('duplicates'),
                physics: const AlwaysScrollableScrollPhysics(),
                padding: EdgeInsets.only(bottom: bottomPad + 60),
                children: [
                  HomeListHero(back: true, title: l10n.duplicatesTitle, subtitle: ready ? l10n.duplicatesCountN(state.groups.length) : null),
                  ...switch (state.status) {
                    DataStatus.initial || DataStatus.loading => [const SizedBox(height: 420, child: StaffListSkeleton(rows: 3))],
                    DataStatus.failure => [ErrorState(failure: state.failure, onRetry: cubit.load)],
                    DataStatus.empty => [
                        const SizedBox(height: AppSpacing.xl),
                        EmptyState(icon: Icons.verified_user_outlined, title: l10n.duplicatesEmpty, message: l10n.duplicatesEmptyHint),
                      ],
                    DataStatus.success => [
                        const Padding(padding: EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 0), child: _HowItWorks()),
                        for (final g in state.groups)
                          Padding(
                            padding: const EdgeInsets.fromLTRB(AppSpacing.md, 12, AppSpacing.md, 0),
                            child: _GroupCard(group: g, state: state),
                          ),
                      ],
                  },
                ],
              ),
            );
          },
        ),
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
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppPalette.gold50,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppPalette.gold100),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.info_outline_rounded, size: 18, color: AppPalette.gold600),
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
      decoration: homeCard(context, radius: 24),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(gradient: homeGoldGradient, borderRadius: BorderRadius.circular(15)),
                child: const Icon(Icons.people_alt_rounded, color: AppPalette.navy, size: 22),
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
                borderRadius: BorderRadius.circular(15),
                child: Ink(
                  height: 48,
                  decoration: BoxDecoration(
                    gradient: homeGoldGradient,
                    borderRadius: BorderRadius.circular(15),
                  ),
                  child: Center(
                    child: busy
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: AppPalette.navy),
                          )
                        : Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.merge_rounded, color: AppPalette.navy, size: 19),
                              const SizedBox(width: 6),
                              Text(
                                l10n.duplicatesMergeN(latinDigits('${toMerge.length}')),
                                style: const TextStyle(color: AppPalette.navy, fontWeight: FontWeight.w800, fontSize: 14),
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
        borderRadius: BorderRadius.circular(18),
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
