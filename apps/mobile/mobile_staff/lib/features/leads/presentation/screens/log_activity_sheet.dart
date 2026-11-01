import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../domain/entities/lead.dart';
import '../cubit/lead_detail_cubit.dart';
import '../follow_up_labels.dart';

/// FU1 — "what happened?", as on the dashboard: the kind of activity (a call
/// and how it went, a meeting, a WhatsApp chat, a note), what was said, and
/// when to follow up next.
Future<void> showLogActivitySheet(BuildContext context, LeadDetailCubit cubit, {DateTime? currentNext}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(child: LogActivitySheet(cubit: cubit, currentNext: currentNext)),
    ),
  );
}

/// The ready-made follow-up times, and "pick another".
enum _NextPreset { keep, none, in1h, tomorrow, in3Days, week, pick }

class LogActivitySheet extends StatefulWidget {
  const LogActivitySheet({super.key, required this.cubit, this.currentNext, this.now = DateTime.now});
  final LeadDetailCubit cubit;

  /// The lead's follow-up today, if it has one: "keep it" is then the default.
  final DateTime? currentNext;
  final DateTime Function() now;

  @override
  State<LogActivitySheet> createState() => _LogActivitySheetState();
}

class _LogActivitySheetState extends State<LogActivitySheet> {
  final _body = TextEditingController();
  final _nextNote = TextEditingController();
  String _kind = 'CALL';
  String? _callResult;
  late _NextPreset _preset = widget.currentNext != null ? _NextPreset.keep : _NextPreset.none;
  DateTime? _picked;
  String? _nextType;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _body.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _body.dispose();
    _nextNote.dispose();
    super.dispose();
  }

  /// When the chosen preset falls.
  DateTime? _nextAt() {
    final now = widget.now();
    return switch (_preset) {
      _NextPreset.in1h => now.add(const Duration(hours: 1)),
      _NextPreset.tomorrow => DateTime(now.year, now.month, now.day + 1, 10),
      _NextPreset.in3Days => DateTime(now.year, now.month, now.day + 3, 10),
      _NextPreset.week => DateTime(now.year, now.month, now.day + 7, 10),
      _NextPreset.pick => _picked,
      _ => null,
    };
  }

  Future<void> _pickDateTime() async {
    final now = widget.now();
    final date = await showDatePicker(
      context: context,
      initialDate: now,
      firstDate: DateTime(now.year, now.month, now.day),
      lastDate: now.add(const Duration(days: 365)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(context: context, initialTime: const TimeOfDay(hour: 10, minute: 0));
    if (time == null || !mounted) return;
    setState(() {
      _picked = DateTime(date.year, date.month, date.day, time.hour, time.minute);
      _preset = _NextPreset.pick;
    });
  }

  Future<void> _save() async {
    final l10n = context.l10n;
    final body = _body.text.trim();
    if (body.isEmpty || _saving) return;
    final at = _nextAt();
    final setting = _preset != _NextPreset.keep && _preset != _NextPreset.none;
    if (setting && (at == null || !at.isAfter(widget.now()))) {
      setState(() => _error = l10n.activityPastDate);
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    final ok = await widget.cubit.logActivity(LeadNoteInput(
      body: body,
      kind: _kind,
      callResult: _kind == 'CALL' ? _callResult : null,
      nextChange: setting
          ? NextActionChange.set
          : (_preset == _NextPreset.none && widget.currentNext != null ? NextActionChange.clear : NextActionChange.keep),
      nextActionAt: setting ? at : null,
      nextActionType: setting ? (_nextType ?? nextTypeFor(_kind)) : null,
      nextActionNote: setting ? _nextNote.text : null,
    ));
    if (!mounted) return;
    if (ok) {
      Navigator.of(context).maybePop();
    } else {
      setState(() => _saving = false);
    }
  }

  String _presetLabel(AppLocalizations l10n, _NextPreset p) => switch (p) {
        _NextPreset.keep => l10n.activityNextKeep,
        _NextPreset.none => l10n.activityNextNone,
        _NextPreset.in1h => l10n.activityNextIn1h,
        _NextPreset.tomorrow => l10n.activityNextTomorrow,
        _NextPreset.in3Days => l10n.activityNextIn3Days,
        _NextPreset.week => l10n.activityNextWeek,
        _NextPreset.pick => _picked != null
            ? followUpWhen(_picked!, l10n, Localizations.localeOf(context).languageCode, now: widget.now())
            : l10n.activityNextPick,
      };

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final text = Theme.of(context).textTheme;
    final lang = Localizations.localeOf(context).languageCode;
    final presets = [
      if (widget.currentNext != null) _NextPreset.keep,
      _NextPreset.none,
      _NextPreset.in1h,
      _NextPreset.tomorrow,
      _NextPreset.in3Days,
      _NextPreset.week,
      _NextPreset.pick,
    ];
    final setting = _preset != _NextPreset.keep && _preset != _NextPreset.none;
    final at = _nextAt();

    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.lg),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.leadLogActivity, style: text.titleMedium),
          const SizedBox(height: AppSpacing.md),

          // ── What happened ──────────────────────────────────────────────
          Text(l10n.activityWhatHappened, style: text.labelLarge),
          const SizedBox(height: AppSpacing.xs),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              for (final k in kNoteKinds)
                ChoiceChip(
                  key: ValueKey('kind-$k'),
                  avatar: Icon(noteKindIcon(k), size: 16, color: noteKindColor(k)),
                  label: Text(noteKindLabel(l10n, k)),
                  selected: _kind == k,
                  onSelected: (_) => setState(() => _kind = k),
                ),
            ],
          ),

          // ── How the call went (calls only) ─────────────────────────────
          if (_kind == 'CALL') ...[
            const SizedBox(height: AppSpacing.md),
            Text(l10n.callResultLabel, style: text.labelLarge),
            const SizedBox(height: AppSpacing.xs),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: [
                for (final r in kCallResults)
                  ChoiceChip(
                    key: ValueKey('result-$r'),
                    label: Text(callResultLabel(l10n, r)),
                    selected: _callResult == r,
                    onSelected: (on) => setState(() => _callResult = on ? r : null),
                  ),
              ],
            ),
          ],

          const SizedBox(height: AppSpacing.md),
          TextField(
            key: const Key('activity-body'),
            controller: _body,
            maxLength: 5000,
            minLines: 2,
            maxLines: 5,
            decoration: InputDecoration(hintText: l10n.activityBodyHint, counterText: ''),
          ),

          // ── The next follow-up ─────────────────────────────────────────
          const SizedBox(height: AppSpacing.md),
          Text(l10n.leadNextAction, style: text.labelLarge),
          const SizedBox(height: AppSpacing.xs),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              for (final p in presets)
                ChoiceChip(
                  key: ValueKey('next-${p.name}'),
                  label: Text(_presetLabel(l10n, p)),
                  selected: _preset == p,
                  onSelected: (_) {
                    if (p == _NextPreset.pick) {
                      _pickDateTime();
                    } else {
                      setState(() {
                        _preset = p;
                        _error = null;
                      });
                    }
                  },
                ),
            ],
          ),
          if (setting) ...[
            if (at != null) ...[
              const SizedBox(height: AppSpacing.xs),
              Text(
                followUpWhen(at, l10n, lang, now: widget.now()),
                key: const Key('next-when'),
                style: text.bodySmall?.copyWith(color: colors.inkMuted),
              ),
            ],
            const SizedBox(height: AppSpacing.sm),
            Text(l10n.activityNextType, style: text.labelMedium),
            const SizedBox(height: AppSpacing.xs),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: [
                for (final t in kNextActionTypes)
                  ChoiceChip(
                    key: ValueKey('next-type-$t'),
                    label: Text(noteKindLabel(l10n, t)),
                    selected: (_nextType ?? nextTypeFor(_kind)) == t,
                    onSelected: (_) => setState(() => _nextType = t),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              key: const Key('next-note'),
              controller: _nextNote,
              maxLength: 500,
              decoration: InputDecoration(labelText: l10n.activityNextNote, counterText: ''),
            ),
          ],

          if (_error != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(_error!, key: const Key('activity-error'), style: text.bodySmall?.copyWith(color: colors.error)),
          ],

          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: AppButton(
                  label: l10n.actionCancel,
                  variant: AppButtonVariant.ghost,
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: AppButton(
                  key: const Key('activity-save'),
                  label: l10n.activitySave,
                  icon: Icons.check_rounded,
                  variant: AppButtonVariant.gold,
                  isLoading: _saving,
                  onPressed: _body.text.trim().isEmpty || _saving ? null : _save,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
