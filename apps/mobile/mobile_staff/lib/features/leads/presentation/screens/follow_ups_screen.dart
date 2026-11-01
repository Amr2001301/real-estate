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
/// own; a manager their team's. Laid out like the other staff lists: a
/// filter bar under the header and accent-striped cards.
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
    final bottomPad = MediaQuery.paddingOf(context).bottom;

    return Scaffold(
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
          const _BucketFilter(),
          Expanded(
            child: BlocBuilder<FollowUpsCubit, FollowUpsState>(
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const StaffListSkeleton();
                  case DataStatus.failure:
                    return ErrorState(failure: state.failure, onRetry: cubit.load);
                  case DataStatus.empty:
                    return EmptyState(
                      icon: Icons.event_available_rounded,
                      title: _emptyLabel(l10n, state.bucket),
                      message: l10n.followUpsEmptyHint,
                    );
                  case DataStatus.success:
                    return RefreshIndicator(
                      onRefresh: cubit.refresh,
                      child: ListView.separated(
                        controller: _scroll,
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.sm, AppSpacing.md, bottomPad + 100),
                        itemCount: state.items.length + (state.isLoadingMore ? 1 : 0),
                        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
                        itemBuilder: (context, i) {
                          if (i >= state.items.length) {
                            return const Padding(
                              padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
                              child: Center(child: CircularProgressIndicator()),
                            );
                          }
                          final item = state.items[i];
                          return _FollowUpTile(
                            item: item,
                            bucket: state.bucket,
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

/// Each list's colour: late is red, today gold, later navy.
Color _bucketColor(FollowUpBucket b, AppColorsExt c) => switch (b) {
      FollowUpBucket.overdue => c.error,
      FollowUpBucket.today => c.brandGold,
      FollowUpBucket.upcoming => c.brandNavy,
    };

// ── Bucket filter bar ─────────────────────────────────────────────────────────

class _BucketFilter extends StatelessWidget {
  const _BucketFilter();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final cubit = context.read<FollowUpsCubit>();

    String label(FollowUpBucket b) => switch (b) {
          FollowUpBucket.overdue => l10n.followUpsOverdue,
          FollowUpBucket.today => l10n.followUpsToday,
          FollowUpBucket.upcoming => l10n.followUpsUpcoming,
        };

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(bottom: BorderSide(color: colors.hairline, width: 0.5)),
      ),
      child: BlocBuilder<FollowUpsCubit, FollowUpsState>(
        buildWhen: (a, b) => a.bucket != b.bucket || a.summary != b.summary,
        builder: (context, state) => SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: 6),
          child: Row(
            children: [
              for (final b in FollowUpBucket.values) ...[
                if (b != FollowUpBucket.values.first) const SizedBox(width: AppSpacing.xs),
                _BucketChip(
                  key: ValueKey('bucket-${b.name}'),
                  label: label(b),
                  count: state.summary?.of(b),
                  dotColor: _bucketColor(b, colors),
                  active: state.bucket == b,
                  onTap: () => cubit.select(b),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _BucketChip extends StatelessWidget {
  const _BucketChip({
    super.key,
    required this.label,
    required this.active,
    required this.onTap,
    required this.dotColor,
    this.count,
  });
  final String label;
  final int? count;
  final bool active;
  final VoidCallback onTap;
  final Color dotColor;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm + 4, vertical: 11),
        decoration: BoxDecoration(
          color: active ? colors.brandNavy : colors.surface,
          borderRadius: AppRadii.pillAll,
          border: Border.all(color: active ? colors.brandNavy : colors.hairline, width: active ? 0 : 1),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (count != null) ...[
              AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 2),
                decoration: BoxDecoration(
                  color: active ? Colors.white.withValues(alpha: 0.18) : colors.surfaceSoft,
                  borderRadius: BorderRadius.circular(100),
                ),
                child: Text(
                  '$count',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: active ? Colors.white : colors.inkStrong,
                    height: 1.2,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.xs),
            ],
            if (!active) ...[
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
              ),
              const SizedBox(width: AppSpacing.xxs + 2),
            ],
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: active ? FontWeight.w700 : FontWeight.w600,
                color: active ? Colors.white : colors.inkStrong,
                height: 1.2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Follow-up tile ────────────────────────────────────────────────────────────

class _FollowUpTile extends StatefulWidget {
  const _FollowUpTile({required this.item, required this.bucket, required this.onTap});
  final FollowUp item;
  final FollowUpBucket bucket;
  final VoidCallback onTap;

  @override
  State<_FollowUpTile> createState() => _FollowUpTileState();
}

class _FollowUpTileState extends State<_FollowUpTile> {
  bool _pressed = false;

  static String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '؟';
    if (parts.length == 1) return parts.first.characters.first;
    return '${parts.first.characters.first}${parts[1].characters.first}';
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final isRtl = context.read<LocaleCubit>().isRtl;
    final item = widget.item;
    final lead = item.lead;
    final accent = _bucketColor(widget.bucket, colors);
    final at = lead.nextActionAt;
    final type = lead.nextActionType ?? 'FOLLOW_UP';
    final note = lead.nextActionNote?.trim();
    final phone = lead.phone?.trim();
    final subtitle = (note != null && note.isNotEmpty) ? note : (lead.projectInterest ?? lead.assignedSalesName);

    return GestureDetector(
      key: ValueKey('follow-up-${lead.id}'),
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _pressed ? 0.975 : 1.0,
        duration: const Duration(milliseconds: 110),
        curve: Curves.easeOutCubic,
        child: Container(
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: AppRadii.card,
            border: Border.all(color: accent.withValues(alpha: 0.16), width: 0.9),
            boxShadow: [
              BoxShadow(color: accent.withValues(alpha: 0.10), blurRadius: 20, offset: const Offset(0, 6)),
              BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 6, offset: const Offset(0, 2)),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Accent strip ─────────────────────────────────────────────
              Container(
                height: 3,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: isRtl ? Alignment.centerRight : Alignment.centerLeft,
                    end: isRtl ? Alignment.centerLeft : Alignment.centerRight,
                    colors: [accent, accent.withValues(alpha: 0.0)],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(AppSpacing.md, 13, AppSpacing.md, 13),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ── Initials · name + what to do · stage · chevron ──
                    Row(
                      children: [
                        Container(
                          width: 46,
                          height: 46,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: accent.withValues(alpha: 0.10),
                            shape: BoxShape.circle,
                            border: Border.all(color: accent.withValues(alpha: 0.28), width: 1.2),
                          ),
                          child: Text(
                            _initials(lead.fullName),
                            style: TextStyle(color: accent, fontSize: 15, fontWeight: FontWeight.w700, height: 1),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                lead.fullName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 15.5,
                                  fontWeight: FontWeight.w700,
                                  color: colors.inkStrong,
                                  height: 1.2,
                                  letterSpacing: -0.2,
                                ),
                              ),
                              if (subtitle != null) ...[
                                const SizedBox(height: 3),
                                Text(
                                  subtitle,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(fontSize: 12, color: colors.inkMuted, height: 1.3),
                                ),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            StatusBadge(label: leadStageLabel(l10n, lead.stage), tone: leadStageTone(lead.stage)),
                            const SizedBox(height: 4),
                            Icon(Icons.chevron_right_rounded, size: 16, color: colors.inkMuted.withValues(alpha: 0.5)),
                          ],
                        ),
                      ],
                    ),
                    // ── When · last activity · call / WhatsApp ───────────
                    const SizedBox(height: 10),
                    Container(height: 0.5, color: colors.hairline),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: Wrap(
                            spacing: 6,
                            runSpacing: 6,
                            children: [
                              _InfoChip(
                                icon: noteKindIcon(type),
                                label: at == null
                                    ? noteKindLabel(l10n, type)
                                    : '${noteKindLabel(l10n, type)} · ${followUpWhen(at, l10n, lang)}',
                                color: accent,
                              ),
                              _InfoChip(
                                icon: Icons.history_rounded,
                                label: item.lastAt == null
                                    ? l10n.followUpsNoActivity
                                    : item.lastCallResult != null
                                        ? '${noteKindLabel(l10n, item.lastKind ?? 'NOTE')} · ${callResultLabel(l10n, item.lastCallResult!)}'
                                        : '${noteKindLabel(l10n, item.lastKind ?? 'NOTE')} · ${followUpDate(item.lastAt!, lang)}',
                                color: colors.inkMuted,
                              ),
                            ],
                          ),
                        ),
                        if (phone != null && phone.isNotEmpty) ...[
                          const SizedBox(width: AppSpacing.xs),
                          _RoundAction(
                            icon: Icons.chat_rounded,
                            color: const Color(0xFF128C7E),
                            tooltip: l10n.contactWhatsapp,
                            onTap: () => ContactActions.whatsApp(number: phone),
                          ),
                          const SizedBox(width: 6),
                          _RoundAction(
                            icon: Icons.call_rounded,
                            color: colors.success,
                            tooltip: l10n.contactCall,
                            onTap: () => ContactActions.call(phone),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Round contact button (as on the leads list) ───────────────────────────────

class _RoundAction extends StatelessWidget {
  const _RoundAction({required this.icon, required this.color, required this.tooltip, required this.onTap});
  final IconData icon;
  final Color color;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Tooltip(
        message: tooltip,
        child: GestureDetector(
          onTap: onTap,
          behavior: HitTestBehavior.opaque,
          child: Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.10),
              border: Border.all(color: color.withValues(alpha: 0.25)),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 15, color: color),
          ),
        ),
      );
}

// ── Info chip (as on the reservations and visits lists) ───────────────────────

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.icon, required this.label, required this.color});
  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.07),
        border: Border.all(color: color.withValues(alpha: 0.20)),
        borderRadius: AppRadii.pillAll,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color.withValues(alpha: 0.80)),
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color, height: 1.2),
            ),
          ),
        ],
      ),
    );
  }
}
