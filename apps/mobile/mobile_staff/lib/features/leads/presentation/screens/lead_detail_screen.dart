import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/lead_stage_label.dart';
import '../../../../common/staff_contact_actions.dart';
import '../cubit/lead_detail_cubit.dart';

/// Lead detail: contact, stage control, add-note, and the merged timeline.
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

  Future<void> _pickStage() async {
    final l10n = context.l10n;
    final cubit = context.read<LeadDetailCubit>();
    final stage = await showModalBottomSheet<String>(
      context: context,
      builder: (sheetCtx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final s in kLeadStages)
              ListTile(
                leading: Icon(Icons.circle, size: 14, color: _toneColor(context, leadStageTone(s))),
                title: Text(leadStageLabel(l10n, s)),
                onTap: () => Navigator.of(sheetCtx).pop(s),
              ),
          ],
        ),
      ),
    );
    if (stage != null) cubit.changeStage(stage);
  }

  Color _toneColor(BuildContext context, BadgeTone tone) {
    final c = context.appColors;
    return switch (tone) {
      BadgeTone.success => c.success,
      BadgeTone.warning => c.warning,
      BadgeTone.error => c.error,
      BadgeTone.info => c.info,
      BadgeTone.gold => c.brandGold,
      _ => c.inkMuted,
    };
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
      appBar: AppBar(title: Text(widget.fallbackName ?? l10n.navLeads)),
      body: BlocConsumer<LeadDetailCubit, LeadDetailState>(
        listenWhen: (a, b) => a.actionFailure != b.actionFailure && b.actionFailure != null,
        listener: (context, state) => showFailureSnackBar(context, state.actionFailure!),
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
                onPickStage: _pickStage,
                onSubmitNote: _submitNote,
              );
          }
        },
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({
    required this.state,
    required this.noteController,
    required this.onPickStage,
    required this.onSubmitNote,
  });

  final LeadDetailState state;
  final TextEditingController noteController;
  final VoidCallback onPickStage;
  final VoidCallback onSubmitNote;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final detail = state.detail!;
    final lead = detail.lead;

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        AppCard(
          elevation: AppCardElevation.soft,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(lead.fullName, style: Theme.of(context).textTheme.titleLarge),
                  ),
                  StatusBadge(label: leadStageLabel(l10n, lead.stage), tone: leadStageTone(lead.stage)),
                ],
              ),
              if (lead.projectInterest != null) ...[
                const SizedBox(height: AppSpacing.xs),
                Text('${l10n.leadInterest}: ${lead.projectInterest}'
                    '${detail.unitInterest != null ? ' · ${detail.unitInterest}' : ''}',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: colors.inkMuted)),
              ],
              if (lead.assignedSalesName != null) ...[
                const SizedBox(height: AppSpacing.xxs),
                Text('${l10n.leadAssignedTo}: ${lead.assignedSalesName}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
              ],
              const SizedBox(height: AppSpacing.md),
              StaffContactButtons(phone: lead.phone),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        AppButton(
          label: l10n.leadChangeStage,
          icon: Icons.flag_outlined,
          variant: AppButtonVariant.outline,
          expand: true,
          isLoading: state.working,
          onPressed: state.working ? null : onPickStage,
        ),
        const SizedBox(height: AppSpacing.sm),
        AppButton(
          label: l10n.visitNew,
          icon: Icons.event_outlined,
          variant: AppButtonVariant.outline,
          expand: true,
          onPressed: () => context.push('/visits/new', extra: {'leadId': lead.id}),
        ),
        const SizedBox(height: AppSpacing.lg),
        Text(l10n.leadAddNote, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: AppSpacing.sm),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: TextField(
                controller: noteController,
                minLines: 1,
                maxLines: 3,
                decoration: InputDecoration(hintText: l10n.leadNoteHint, isDense: true),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            IconButton.filled(
              onPressed: state.working ? null : onSubmitNote,
              icon: const Icon(Icons.send_rounded),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        Text(l10n.leadTimeline, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: AppSpacing.sm),
        if (detail.timeline.isEmpty)
          Text(l10n.leadTimelineEmpty,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: colors.inkMuted))
        else
          for (final entry in detail.timeline) ...[
            _TimelineTile(
              body: entry.isNote ? entry.body : _activityLabel(l10n, entry.body),
              isNote: entry.isNote,
              meta: [
                if (entry.authorName != null) entry.authorName!,
                if (entry.createdAt != null)
                  DateFormatter.shortDate(entry.createdAt!, languageCode: lang),
              ].join(' · '),
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
      ],
    );
  }

  String _activityLabel(AppLocalizations l10n, String type) => switch (type) {
        'call' => l10n.leadActivityCall,
        'email' => l10n.leadActivityEmail,
        'status_change' => l10n.leadActivityStatusChange,
        'visit' => l10n.leadActivityVisit,
        'note' => l10n.leadActivityNote,
        'reservation' => l10n.leadActivityReservation,
        _ => type,
      };
}

class _TimelineTile extends StatelessWidget {
  const _TimelineTile({required this.body, required this.isNote, required this.meta});
  final String body;
  final bool isNote;
  final String meta;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return AppCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            isNote ? Icons.sticky_note_2_outlined : Icons.history_rounded,
            size: 18,
            color: isNote ? colors.brandGold : colors.inkMuted,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(body, style: Theme.of(context).textTheme.bodyMedium),
                if (meta.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(meta, style: Theme.of(context).textTheme.labelSmall?.copyWith(color: colors.inkMuted)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
