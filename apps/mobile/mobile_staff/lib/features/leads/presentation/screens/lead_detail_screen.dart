import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/lead_stage_label.dart';
import '../../../../common/staff_contact_actions.dart';
import '../cubit/lead_detail_cubit.dart';

/// Lead detail: premium info card, interactive stage pipeline, note input,
/// and a merged activity timeline.
class LeadDetailScreen extends StatefulWidget {
  const LeadDetailScreen({super.key, required this.leadId, this.fallbackName});
  final String leadId;
  final String? fallbackName;

  @override
  State<LeadDetailScreen> createState() => _LeadDetailScreenState();
}

class _LeadDetailScreenState extends State<LeadDetailScreen> {
  final _note = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<LeadDetailCubit>().load();
  }

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  void _submitNote() {
    final text = _note.text;
    if (text.trim().isEmpty) return;
    context.read<LeadDetailCubit>().addNote(text);
    _note.clear();
    FocusScope.of(context).unfocus();
  }

  @override
  Widget build(BuildContext context) {
    final l10n  = context.l10n;
    final isRtl = Directionality.of(context) == TextDirection.rtl;
    return Scaffold(
      body: Column(
        children: [
          AppNavHeader(
            title: widget.fallbackName ?? l10n.navLeads,
            leadingAction: NavHeaderAction(
              icon: isRtl
                  ? Icons.arrow_forward_ios_rounded
                  : Icons.arrow_back_ios_new_rounded,
              onTap: () => context.pop(),
            ),
          ),
          Expanded(
            child: BlocConsumer<LeadDetailCubit, LeadDetailState>(
              listenWhen: (a, b) =>
                  a.actionFailure != b.actionFailure && b.actionFailure != null,
              listener: (context, state) =>
                  showFailureSnackBar(context, state.actionFailure!),
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const Center(child: CircularProgressIndicator());
                  case DataStatus.failure:
                    return ErrorState(
                      failure: state.failure,
                      onRetry: () => context.read<LeadDetailCubit>().load(),
                    );
                  case DataStatus.empty:
                  case DataStatus.success:
                    return _Body(
                      state: state,
                      noteController: _note,
                      onSubmitNote: _submitNote,
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

// ── Body ──────────────────────────────────────────────────────────────────────

class _Body extends StatelessWidget {
  const _Body({
    required this.state,
    required this.noteController,
    required this.onSubmitNote,
  });
  final LeadDetailState state;
  final TextEditingController noteController;
  final VoidCallback onSubmitNote;

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final lang   = Localizations.localeOf(context).languageCode;
    final detail = state.detail!;
    final lead   = detail.lead;
    final cubit  = context.read<LeadDetailCubit>();

    return ListView(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.xl),
      children: [

        // ── Info card ─────────────────────────────────────────────────
        _InfoCard(lead: lead, detail: detail),

        const SizedBox(height: AppSpacing.md),

        // ── Stage pipeline ────────────────────────────────────────────
        _StagePipeline(
          currentStage: lead.stage,
          isWorking: state.working,
          onStageSelected: (stage) {
            if (stage != lead.stage && !state.working) {
              cubit.changeStage(stage);
            }
          },
        ),

        const SizedBox(height: AppSpacing.sm),

        // ── Schedule visit ────────────────────────────────────────────
        AppButton(
          label: l10n.visitNew,
          icon: Icons.event_outlined,
          variant: AppButtonVariant.outline,
          expand: true,
          onPressed: () =>
              context.push('/visits/new', extra: {'leadId': lead.id}),
        ),

        const SizedBox(height: AppSpacing.lg),

        // ── Add note ──────────────────────────────────────────────────
        _NoteSection(
          controller: noteController,
          onSubmit: onSubmitNote,
          working: state.working,
        ),

        const SizedBox(height: AppSpacing.lg),

        // ── Timeline ──────────────────────────────────────────────────
        _TimelineSection(detail: detail, lang: lang),
      ],
    );
  }
}

// ── Info card ─────────────────────────────────────────────────────────────────

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.lead, required this.detail});
  final dynamic lead;   // Lead
  final dynamic detail; // LeadDetail

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final colors = context.appColors;
    final theme  = Theme.of(context);
    final tone   = leadStageTone(lead.stage);
    final stageColor = _toneColor(colors, tone);
    final initials = (lead.fullName as String).isNotEmpty
        ? (lead.fullName as String).characters.first
        : '?';

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.hairline),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Top: avatar + info
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Avatar
                Container(
                  width: 54, height: 54,
                  decoration: BoxDecoration(
                    color: colors.brandGoldSoft,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: colors.brandGold.withValues(alpha: 0.30),
                      width: 2,
                    ),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    initials,
                    style: TextStyle(
                      color: colors.brandGold,
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(width: 12),

                // Name + meta
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              lead.fullName as String,
                              style: theme.textTheme.titleLarge?.copyWith(
                                fontWeight: FontWeight.w800,
                                height: 1.2,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          // Stage badge
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: stageColor.withValues(alpha: 0.10),
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(
                                color: stageColor.withValues(alpha: 0.25),
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: 5, height: 5,
                                  decoration: BoxDecoration(
                                    color: stageColor, shape: BoxShape.circle,
                                  ),
                                ),
                                const SizedBox(width: 5),
                                Text(
                                  leadStageLabel(l10n, lead.stage as String),
                                  style: TextStyle(
                                    color: stageColor,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      if ((lead.projectInterest as String?) != null) ...[
                        const SizedBox(height: 5),
                        Row(
                          children: [
                            Icon(Icons.apartment_outlined,
                                size: 13, color: colors.inkMuted),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                '${l10n.leadInterest}: ${lead.projectInterest}'
                                '${(detail.unitInterest as String?) != null ? ' · ${detail.unitInterest}' : ''}',
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: colors.inkMuted,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ],
                      if ((lead.assignedSalesName as String?) != null) ...[
                        const SizedBox(height: 3),
                        Row(
                          children: [
                            Icon(Icons.person_outline_rounded,
                                size: 13, color: colors.inkMuted),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                '${l10n.leadAssignedTo}: ${lead.assignedSalesName}',
                                style: theme.textTheme.labelSmall?.copyWith(
                                  color: colors.inkMuted,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Divider
          Divider(height: 1, color: colors.hairline),

          // Contact buttons
          Padding(
            padding: const EdgeInsets.all(12),
            child: StaffContactButtons(phone: lead.phone as String?),
          ),
        ],
      ),
    );
  }

  Color _toneColor(AppColorsExt c, BadgeTone tone) => switch (tone) {
        BadgeTone.success => c.success,
        BadgeTone.warning => c.warning,
        BadgeTone.error   => c.error,
        BadgeTone.info    => c.info,
        BadgeTone.gold    => c.brandGold,
        _                 => c.inkMuted,
      };
}

// ── Stage pipeline ────────────────────────────────────────────────────────────

class _StagePipeline extends StatelessWidget {
  const _StagePipeline({
    required this.currentStage,
    required this.isWorking,
    required this.onStageSelected,
  });
  final String currentStage;
  final bool   isWorking;
  final ValueChanged<String> onStageSelected;

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final colors = context.appColors;
    final theme  = Theme.of(context);
    final currentIndex = kLeadStages.indexOf(currentStage);

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.hairline),
      ),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Container(
                width: 3, height: 16,
                decoration: BoxDecoration(
                  color: AppPalette.gold400,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                l10n.leadChangeStage,
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const Spacer(),
              if (isWorking)
                SizedBox(
                  width: 14, height: 14,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppPalette.gold400,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 14),

          // Stage steps — horizontal scrollable pipeline
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Directionality(
              textDirection: TextDirection.rtl,
              child: Row(
                children: [
                  for (int i = 0; i < kLeadStages.length; i++) ...[
                    _StageNode(
                      stage: kLeadStages[i],
                      label: leadStageLabel(l10n, kLeadStages[i]),
                      tone: leadStageTone(kLeadStages[i]),
                      isCurrent: i == currentIndex,
                      isPast: i < currentIndex,
                      isWorking: isWorking,
                      colors: colors,
                      onTap: () => onStageSelected(kLeadStages[i]),
                    ),
                    if (i < kLeadStages.length - 1)
                      _PipelineConnector(
                        active: i < currentIndex,
                        colors: colors,
                      ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StageNode extends StatelessWidget {
  const _StageNode({
    required this.stage,
    required this.label,
    required this.tone,
    required this.isCurrent,
    required this.isPast,
    required this.isWorking,
    required this.colors,
    required this.onTap,
  });
  final String stage;
  final String label;
  final BadgeTone tone;
  final bool isCurrent;
  final bool isPast;
  final bool isWorking;
  final AppColorsExt colors;
  final VoidCallback onTap;

  Color get _stageColor => switch (tone) {
        BadgeTone.success => colors.success,
        BadgeTone.warning => colors.warning,
        BadgeTone.error   => colors.error,
        BadgeTone.info    => colors.info,
        BadgeTone.gold    => colors.brandGold,
        _                 => colors.inkMuted,
      };

  @override
  Widget build(BuildContext context) {
    final color = _stageColor;
    final isActive = isCurrent || isPast;

    return GestureDetector(
      onTap: isWorking ? null : onTap,
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: 64,
        child: Column(
          children: [
            // Circle indicator
            AnimatedContainer(
              duration: const Duration(milliseconds: 220),
              width: isCurrent ? 34 : 26,
              height: isCurrent ? 34 : 26,
              decoration: BoxDecoration(
                color: isActive ? color : Colors.transparent,
                shape: BoxShape.circle,
                border: Border.all(
                  color: isActive ? color : colors.hairline,
                  width: isCurrent ? 2.5 : 1.5,
                ),
                boxShadow: isCurrent
                    ? [
                        BoxShadow(
                          color: color.withValues(alpha: 0.30),
                          blurRadius: 8,
                          spreadRadius: 1,
                        ),
                      ]
                    : null,
              ),
              child: isActive
                  ? Icon(
                      isPast ? Icons.check_rounded : Icons.circle,
                      size: isCurrent ? 16 : 10,
                      color: Colors.white,
                    )
                  : null,
            ),
            const SizedBox(height: 6),
            // Stage label
            Text(
              label,
              textAlign: TextAlign.center,
              maxLines: 2,
              style: TextStyle(
                fontSize: isCurrent ? 11 : 10,
                fontWeight: isCurrent ? FontWeight.w700 : FontWeight.w400,
                color: isCurrent ? color : (isPast ? colors.inkStrong : colors.inkMuted),
                height: 1.3,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PipelineConnector extends StatelessWidget {
  const _PipelineConnector({required this.active, required this.colors});
  final bool active;
  final AppColorsExt colors;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 22),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          width: 20,
          height: 1.5,
          color: active ? AppPalette.gold400.withValues(alpha: 0.60) : colors.hairline,
        ),
      );
}

// ── Note section ──────────────────────────────────────────────────────────────

class _NoteSection extends StatelessWidget {
  const _NoteSection({
    required this.controller,
    required this.onSubmit,
    required this.working,
  });
  final TextEditingController controller;
  final VoidCallback onSubmit;
  final bool working;

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final colors = context.appColors;
    final theme  = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 3, height: 16,
              decoration: BoxDecoration(
                color: AppPalette.gold400,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(width: 8),
            Text(l10n.leadAddNote, style: theme.textTheme.titleSmall),
          ],
        ),
        const SizedBox(height: 10),
        Container(
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: colors.hairline),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: controller,
                minLines: 2,
                maxLines: 5,
                decoration: InputDecoration(
                  hintText: l10n.leadNoteHint,
                  contentPadding: const EdgeInsets.all(14),
                  border: InputBorder.none,
                  hintStyle: TextStyle(color: colors.inkMuted, fontSize: 14),
                ),
                style: TextStyle(fontSize: 14, color: colors.inkStrong),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(10, 0, 10, 10),
                child: Align(
                  alignment: AlignmentDirectional.centerEnd,
                  child: GestureDetector(
                    onTap: working ? null : onSubmit,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 18, vertical: 9),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [AppPalette.gold300, AppPalette.gold500],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(10),
                        boxShadow: [
                          BoxShadow(
                            color: AppPalette.gold400.withValues(alpha: 0.25),
                            blurRadius: 8, offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.send_rounded, size: 14,
                              color: const Color(0xFF0B1726)),
                          const SizedBox(width: 7),
                          Text(
                            'إرسال',
                            style: const TextStyle(
                              color: Color(0xFF0B1726),
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Timeline section ──────────────────────────────────────────────────────────

class _TimelineSection extends StatelessWidget {
  const _TimelineSection({required this.detail, required this.lang});
  final dynamic detail; // LeadDetail
  final String  lang;

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final colors = context.appColors;
    final theme  = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 3, height: 16,
              decoration: BoxDecoration(
                color: AppPalette.gold400,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(width: 8),
            Text(l10n.leadTimeline, style: theme.textTheme.titleSmall),
          ],
        ),
        const SizedBox(height: 12),
        if ((detail.timeline as List).isEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              l10n.leadTimelineEmpty,
              style: theme.textTheme.bodyMedium?.copyWith(color: colors.inkMuted),
            ),
          )
        else
          for (int i = 0; i < (detail.timeline as List).length; i++) ...[
            _TimelineTile(
              entry: detail.timeline[i],
              lang: lang,
              isLast: i == (detail.timeline as List).length - 1,
            ),
          ],
      ],
    );
  }
}

class _TimelineTile extends StatelessWidget {
  const _TimelineTile({
    required this.entry,
    required this.lang,
    required this.isLast,
  });
  final dynamic entry; // LeadTimelineEntry
  final String  lang;
  final bool    isLast;

  String _activityLabel(AppLocalizations l10n, String type) => switch (type) {
        'call'          => l10n.leadActivityCall,
        'email'         => l10n.leadActivityEmail,
        'status_change' => l10n.leadActivityStatusChange,
        'visit'         => l10n.leadActivityVisit,
        'note'          => l10n.leadActivityNote,
        'reservation'   => l10n.leadActivityReservation,
        _               => type,
      };

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final colors = context.appColors;
    final theme  = Theme.of(context);
    final isNote = entry.isNote as bool;
    final body   = isNote
        ? (entry.body as String)
        : _activityLabel(l10n, entry.body as String);
    final List<String> meta = [
      if ((entry.authorName as String?) != null) entry.authorName as String,
      if ((entry.createdAt as DateTime?) != null)
        DateFormatter.shortDate(entry.createdAt as DateTime, languageCode: lang),
    ];

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Vertical line + dot
          SizedBox(
            width: 28,
            child: Column(
              children: [
                Container(
                  width: 28, height: 28,
                  decoration: BoxDecoration(
                    color: isNote
                        ? AppPalette.gold400.withValues(alpha: 0.10)
                        : colors.hairline,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: isNote
                          ? AppPalette.gold400.withValues(alpha: 0.35)
                          : colors.hairline,
                    ),
                  ),
                  child: Icon(
                    isNote
                        ? Icons.sticky_note_2_outlined
                        : Icons.history_rounded,
                    size: 14,
                    color: isNote ? AppPalette.gold400 : colors.inkMuted,
                  ),
                ),
                if (!isLast)
                  Expanded(
                    child: Center(
                      child: Container(
                        width: 1.5,
                        color: colors.hairline,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 10),

          // Content
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 4),
                  Text(
                    body,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: isNote ? FontWeight.w500 : FontWeight.w400,
                    ),
                  ),
                  if (meta.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(
                      meta.join(' · '),
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: colors.inkMuted,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
