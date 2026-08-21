import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/lead_stage_label.dart';
import '../../../../common/staff_contact_actions.dart';
import '../cubit/lead_detail_cubit.dart';

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
    final l10n = context.l10n;

    return Scaffold(
      backgroundColor: context.appColors.canvas,
      body: Column(
        children: [
          // ── Header — compact: back + name on same row ──────────────────
          BlocBuilder<LeadDetailCubit, LeadDetailState>(
            buildWhen: (a, b) =>
                a.detail?.lead.fullName != b.detail?.lead.fullName,
            builder: (context, state) => AppNavHeader(
              title: state.detail?.lead.fullName ??
                  widget.fallbackName ??
                  l10n.navLeads,
              compact: true,
              leadingAction: NavHeaderAction(
                icon: Icons.arrow_back_ios_new_rounded,
                onTap: () => context.pop(),
              ),
            ),
          ),

          // ── Content ────────────────────────────────────────────────────
          Expanded(
            child: BlocConsumer<LeadDetailCubit, LeadDetailState>(
              listenWhen: (a, b) =>
                  a.actionFailure != b.actionFailure &&
                  b.actionFailure != null,
              listener: (context, state) =>
                  showFailureSnackBar(context, state.actionFailure!),
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const Center(
                      child: CircularProgressIndicator(
                          color: AppPalette.gold400),
                    );
                  case DataStatus.failure:
                    return ErrorState(
                      failure: state.failure,
                      onRetry: () =>
                          context.read<LeadDetailCubit>().load(),
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

// ══════════════════════════════════════════════════════════════════════════════
// Body
// ══════════════════════════════════════════════════════════════════════════════

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
          AppSpacing.lg, AppSpacing.lg, AppSpacing.lg, AppSpacing.xxl),
      children: [

        // ── Premium info card ──────────────────────────────────────────
        _InfoCard(lead: lead, detail: detail),

        const SizedBox(height: AppSpacing.md),

        // ── Stage pipeline ─────────────────────────────────────────────
        _StagePipeline(
          currentStage: lead.stage,
          isWorking: state.working,
          onStageSelected: (stage) {
            if (stage != lead.stage && !state.working) {
              cubit.changeStage(stage);
            }
          },
        ),

        const SizedBox(height: AppSpacing.md),

        // ── Quick action: schedule visit ───────────────────────────────
        _ActionCard(
          icon: Icons.event_rounded,
          label: l10n.visitNew,
          onTap: () =>
              context.push('/visits/new', extra: {'leadId': lead.id}),
        ),

        const SizedBox(height: AppSpacing.lg),

        // ── Add note ───────────────────────────────────────────────────
        _NoteCard(
          controller: noteController,
          onSubmit: onSubmitNote,
          working: state.working,
        ),

        const SizedBox(height: AppSpacing.lg),

        // ── Timeline ───────────────────────────────────────────────────
        _TimelineSection(detail: detail, lang: lang),
      ],
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Premium info card
// ══════════════════════════════════════════════════════════════════════════════

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.lead, required this.detail});
  final dynamic lead;
  final dynamic detail;

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final colors = context.appColors;
    final theme  = Theme.of(context);
    final tone        = leadStageTone(lead.stage as String);
    final stageColor  = _toneColor(colors, tone);
    final name        = lead.fullName as String;
    final initials    = _initials(name);
    final hasInterest = (lead.projectInterest as String?) != null;
    final hasSales    = (lead.assignedSalesName as String?) != null;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.xl),
        border: Border.all(color: colors.hairline),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 16,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Gold shimmer accent strip
          Container(
            height: 2,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  Color(0x00B8941F),
                  AppPalette.gold400,
                  AppPalette.gold300,
                  Color(0x00B8941F),
                ],
              ),
            ),
          ),

          // Identity block
          Padding(
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg, AppSpacing.lg,
                AppSpacing.lg, AppSpacing.md),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Avatar
                Container(
                  width: 60,
                  height: 60,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [AppPalette.gold300, AppPalette.gold600],
                    ),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: AppPalette.gold400.withValues(alpha: 0.30),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    initials,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.md),

                // Name + stage + meta
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Expanded(
                            child: Text(
                              name,
                              style: theme.textTheme.titleLarge?.copyWith(
                                fontWeight: FontWeight.w800,
                                height: 1.15,
                              ),
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          // Stage pill
                          _StagePill(
                            label: leadStageLabel(l10n, lead.stage as String),
                            color: stageColor,
                          ),
                        ],
                      ),
                      if (hasInterest) ...[
                        const SizedBox(height: 6),
                        _MetaRow(
                          icon: Icons.apartment_rounded,
                          text:
                              '${lead.projectInterest as String}'
                              '${(detail.unitInterest as String?) != null ? ' · ${detail.unitInterest}' : ''}',
                        ),
                      ],
                      if (hasSales) ...[
                        const SizedBox(height: 3),
                        _MetaRow(
                          icon: Icons.person_rounded,
                          text:
                              '${l10n.leadAssignedTo}: ${lead.assignedSalesName as String}',
                        ),
                      ],
                      if ((lead.email as String?) != null) ...[
                        const SizedBox(height: 3),
                        _MetaRow(
                          icon: Icons.mail_outline_rounded,
                          text: lead.email as String,
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),

          Divider(height: 1, color: colors.hairline),

          // Contact actions
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: StaffContactButtons(phone: lead.phone as String?),
          ),
        ],
      ),
    );
  }

  static String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    final a = parts.first.characters.firstOrNull ?? '?';
    if (parts.length >= 2) {
      final b = parts.last.characters.firstOrNull ?? '';
      return '$a$b'.toUpperCase();
    }
    return a.toUpperCase();
  }

  static Color _toneColor(AppColorsExt c, BadgeTone tone) => switch (tone) {
        BadgeTone.success => c.success,
        BadgeTone.warning => c.warning,
        BadgeTone.error   => c.error,
        BadgeTone.info    => c.info,
        BadgeTone.gold    => c.brandGold,
        _                 => c.inkMuted,
      };
}

class _StagePill extends StatelessWidget {
  const _StagePill({required this.label, required this.color});
  final String label;
  final Color  color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(AppRadii.pill),
          border: Border.all(color: color.withValues(alpha: 0.30)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 5,
              height: 5,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      );
}

class _MetaRow extends StatelessWidget {
  const _MetaRow({required this.icon, required this.text});
  final IconData icon;
  final String   text;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Row(
      children: [
        Icon(icon, size: 13, color: colors.inkMuted),
        const SizedBox(width: 5),
        Expanded(
          child: Text(
            text,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: colors.inkMuted,
                ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Stage pipeline
// ══════════════════════════════════════════════════════════════════════════════

class _StagePipeline extends StatelessWidget {
  const _StagePipeline({
    required this.currentStage,
    required this.isWorking,
    required this.onStageSelected,
  });
  final String currentStage;
  final bool isWorking;
  final ValueChanged<String> onStageSelected;

  @override
  Widget build(BuildContext context) {
    final l10n    = context.l10n;
    final colors  = context.appColors;
    final theme   = Theme.of(context);
    final currentIndex = kLeadStages.indexOf(currentStage);

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.xl),
        border: Border.all(color: colors.hairline),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.md, AppSpacing.md, AppSpacing.md, AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 3,
                height: 16,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [AppPalette.gold300, AppPalette.gold500],
                  ),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                l10n.leadChangeStage,
                style: theme.textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              const Spacer(),
              if (isWorking)
                const SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: AppPalette.gold400),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),

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
                      _Connector(
                          active: i < currentIndex, colors: colors),
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

  Color get _color => switch (tone) {
        BadgeTone.success => colors.success,
        BadgeTone.warning => colors.warning,
        BadgeTone.error   => colors.error,
        BadgeTone.info    => colors.info,
        BadgeTone.gold    => colors.brandGold,
        _                 => colors.inkMuted,
      };

  @override
  Widget build(BuildContext context) {
    final color    = _color;
    final isActive = isCurrent || isPast;

    return GestureDetector(
      onTap: isWorking ? null : onTap,
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: 68,
        child: Column(
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              width: isCurrent ? 38 : 28,
              height: isCurrent ? 38 : 28,
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
                          color: color.withValues(alpha: 0.35),
                          blurRadius: 10,
                          spreadRadius: 1,
                        ),
                      ]
                    : null,
              ),
              child: isActive
                  ? Icon(
                      isPast ? Icons.check_rounded : Icons.circle,
                      size: isCurrent ? 17 : 11,
                      color: Colors.white,
                    )
                  : null,
            ),
            const SizedBox(height: 7),
            Text(
              label,
              textAlign: TextAlign.center,
              maxLines: 2,
              style: TextStyle(
                fontSize: isCurrent ? 11 : 10,
                fontWeight:
                    isCurrent ? FontWeight.w700 : FontWeight.w500,
                color: isCurrent
                    ? color
                    : (isPast ? colors.inkStrong : colors.inkMuted),
                height: 1.3,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Connector extends StatelessWidget {
  const _Connector({required this.active, required this.colors});
  final bool active;
  final AppColorsExt colors;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 26),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          width: 18,
          height: 2,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(1),
            color: active
                ? AppPalette.gold400.withValues(alpha: 0.65)
                : colors.hairline,
          ),
        ),
      );
}

// ══════════════════════════════════════════════════════════════════════════════
// Action card row (schedule visit etc.)
// ══════════════════════════════════════════════════════════════════════════════

class _ActionCard extends StatelessWidget {
  const _ActionCard({
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme  = Theme.of(context);

    return Material(
      color: colors.surface,
      borderRadius: BorderRadius.circular(AppRadii.lg),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        child: Container(
          padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg, vertical: AppSpacing.md),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadii.lg),
            border: Border.all(color: colors.hairline),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [AppPalette.gold300, AppPalette.gold500],
                  ),
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                ),
                child: Icon(icon, size: 18, color: Colors.white),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Text(
                  label,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: colors.inkStrong,
                  ),
                ),
              ),
              Icon(Icons.arrow_forward_ios_rounded,
                  size: 14, color: colors.inkMuted),
            ],
          ),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Note card
// ══════════════════════════════════════════════════════════════════════════════

class _NoteCard extends StatelessWidget {
  const _NoteCard({
    required this.controller,
    required this.onSubmit,
    required this.working,
  });
  final TextEditingController controller;
  final VoidCallback onSubmit;
  final bool working;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _SectionHeader(label: l10n.leadAddNote),
        const SizedBox(height: AppSpacing.sm),
        AppTextField(
          controller: controller,
          hint: l10n.leadNoteHint,
          maxLines: 5,
        ),
        const SizedBox(height: AppSpacing.sm),
        AppButton(
          label: l10n.leadAddNote,
          onPressed: working ? null : onSubmit,
          variant: AppButtonVariant.gold,
          size: AppButtonSize.large,
          icon: Icons.arrow_upward_rounded,
          isLoading: working,
          expand: true,
        ),
      ],
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Timeline section
// ══════════════════════════════════════════════════════════════════════════════

class _TimelineSection extends StatelessWidget {
  const _TimelineSection({required this.detail, required this.lang});
  final dynamic detail;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final l10n  = context.l10n;
    final theme = Theme.of(context);
    final colors = context.appColors;
    final items = detail.timeline as List;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(label: l10n.leadTimeline),
        const SizedBox(height: AppSpacing.sm),
        if (items.isEmpty)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.sm),
            child: Text(
              l10n.leadTimelineEmpty,
              style: theme.textTheme.bodyMedium
                  ?.copyWith(color: colors.inkMuted),
            ),
          )
        else
          _TimelineList(items: items, lang: lang),
      ],
    );
  }
}

class _TimelineList extends StatelessWidget {
  const _TimelineList({required this.items, required this.lang});
  final List items;
  final String lang;

  static const _kCfg = <String, ({IconData icon, Color color})>{
    'note':          (icon: Icons.sticky_note_2_rounded, color: Color(0xFFC8A24B)),
    'call':          (icon: Icons.phone_rounded,         color: Color(0xFF2E7D32)),
    'email':         (icon: Icons.mail_rounded,          color: Color(0xFF1565C0)),
    'visit':         (icon: Icons.event_rounded,         color: Color(0xFF6A1B9A)),
    'reservation':   (icon: Icons.assignment_rounded,    color: Color(0xFF00838F)),
    'status_change': (icon: Icons.swap_horiz_rounded,    color: Color(0xFF546E7A)),
    'created':       (icon: Icons.person_add_rounded,    color: Color(0xFF2E7D32)),
  };

  static String _label(AppLocalizations l10n, String type) => switch (type) {
        'call'          => l10n.leadActivityCall,
        'email'         => l10n.leadActivityEmail,
        'status_change' => l10n.leadActivityStatusChange,
        'visit'         => l10n.leadActivityVisit,
        'note'          => l10n.leadActivityNote,
        'reservation'   => l10n.leadActivityReservation,
        'created'       => l10n.leadActivityCreated,
        _               => type,
      };

  static String _time(DateTime dt) {
    final h = dt.hour.toString().padLeft(2, '0');
    final m = dt.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }

  @override
  Widget build(BuildContext context) {
    // Group by date string
    final Map<String, List<dynamic>> byDay = {};
    for (final e in items) {
      final dt  = e.createdAt as DateTime?;
      final key = dt != null
          ? DateFormatter.shortDate(dt, languageCode: lang)
          : '—';
      (byDay[key] ??= []).add(e);
    }

    final colors = context.appColors;
    final theme  = Theme.of(context);
    final l10n   = context.l10n;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final group in byDay.entries) ...[
          const SizedBox(height: AppSpacing.sm),

          // ── Day card ─────────────────────────────────────────────────
          Container(
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: BorderRadius.circular(AppRadii.xl),
              border: Border.all(color: colors.hairline),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 10,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Day header
                Container(
                  color: colors.canvas,
                  padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.lg, vertical: 10),
                  child: Row(
                    children: [
                      // Date label (right in RTL)
                      Text(
                        group.key,
                        style: theme.textTheme.labelMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: colors.inkStrong,
                        ),
                      ),
                      const Spacer(),
                      // Entry count (left in RTL)
                      Text(
                        '${group.value.length}',
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: colors.inkMuted,
                        ),
                      ),
                      const SizedBox(width: 3),
                      Icon(Icons.history_rounded,
                          size: 12, color: colors.inkMuted),
                    ],
                  ),
                ),
                Divider(height: 1, color: colors.hairline),

                // Entries
                for (int i = 0; i < group.value.length; i++) ...[
                  _buildEntry(
                    context,
                    l10n,
                    colors,
                    theme,
                    group.value[i],
                  ),
                  if (i < group.value.length - 1)
                    Divider(
                      height: 1,
                      color: colors.hairline,
                      indent: AppSpacing.lg,
                      endIndent: AppSpacing.lg,
                    ),
                ],
              ],
            ),
          ),
        ],
        const SizedBox(height: AppSpacing.lg),
      ],
    );
  }

  Widget _buildEntry(
    BuildContext context,
    AppLocalizations l10n,
    AppColorsExt colors,
    ThemeData theme,
    dynamic e,
  ) {
    final isNote   = e.isNote as bool;
    final rawType  = isNote ? 'note' : (e.body as String);
    final cfg      = _kCfg[rawType] ??
        (icon: Icons.history_rounded, color: colors.inkMuted);
    final bodyText = isNote
        ? (e.body as String)
        : _label(l10n, e.body as String);
    final author   = e.authorName as String?;
    final dt       = e.createdAt as DateTime?;

    return Container(
      color: isNote
          ? AppPalette.gold400.withValues(alpha: 0.04)
          : Colors.transparent,
      padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Type icon — rightmost in RTL (first child) ────────────
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: cfg.color.withValues(alpha: 0.10),
              shape: BoxShape.circle,
            ),
            child: Icon(cfg.icon, size: 16, color: cfg.color),
          ),
          const SizedBox(width: 12),

          // ── Body text — expands to fill center ────────────────────
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  bodyText,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: colors.inkStrong,
                    fontWeight:
                        isNote ? FontWeight.w700 : FontWeight.w500,
                    height: 1.5,
                  ),
                ),
                if (author != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    author,
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: colors.inkMuted,
                    ),
                  ),
                ],
              ],
            ),
          ),

          // ── Time — leftmost in RTL (last child) ───────────────────
          if (dt != null) ...[
            const SizedBox(width: 8),
            Text(
              _time(dt),
              style: theme.textTheme.labelSmall?.copyWith(
                color: colors.inkMuted,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Shared: section header with gold left bar
// ══════════════════════════════════════════════════════════════════════════════

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Container(
          width: 3,
          height: 18,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [AppPalette.gold300, AppPalette.gold500],
            ),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          label,
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}
