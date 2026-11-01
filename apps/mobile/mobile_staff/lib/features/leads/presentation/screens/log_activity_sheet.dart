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
          Text(l10n.leadLogActivity, style: text.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 2),
          Text(l10n.leadLogActivityHint, style: text.bodySmall?.copyWith(color: colors.inkMuted)),
          const SizedBox(height: AppSpacing.md),

          // ── What happened ──────────────────────────────────────────────
          _Label(l10n.activityWhatHappened),
          const SizedBox(height: AppSpacing.xs),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              for (final k in kNoteKinds)
                _Pill(
                  key: ValueKey('kind-$k'),
                  icon: noteKindIcon(k),
                  iconColor: noteKindColor(k),
                  label: noteKindLabel(l10n, k),
                  active: _kind == k,
                  onTap: () => setState(() => _kind = k),
                ),
            ],
          ),

          // ── How the call went (calls only) ─────────────────────────────
          if (_kind == 'CALL') ...[
            const SizedBox(height: AppSpacing.md),
            _Label(l10n.callResultLabel),
            const SizedBox(height: AppSpacing.xs),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: [
                for (final r in kCallResults)
                  _Pill(
                    key: ValueKey('result-$r'),
                    label: callResultLabel(l10n, r),
                    active: _callResult == r,
                    onTap: () => setState(() => _callResult = _callResult == r ? null : r),
                  ),
              ],
            ),
          ],

          const SizedBox(height: AppSpacing.md),
          AppTextField(
            key: const Key('activity-body'),
            controller: _body,
            hint: l10n.activityBodyHint,
            maxLines: 4,
          ),

          // ── The next follow-up ─────────────────────────────────────────
          const SizedBox(height: AppSpacing.md),
          _Label(l10n.leadNextAction),
          const SizedBox(height: AppSpacing.xs),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              for (final p in presets)
                _Pill(
                  key: ValueKey('next-${p.name}'),
                  icon: p == _NextPreset.pick ? Icons.edit_calendar_rounded : null,
                  label: _presetLabel(l10n, p),
                  active: _preset == p,
                  onTap: () {
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
            _Label(l10n.activityNextType),
            const SizedBox(height: AppSpacing.xs),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: [
                for (final t in kNextActionTypes)
                  _Pill(
                    key: ValueKey('next-type-$t'),
                    icon: noteKindIcon(t),
                    iconColor: noteKindColor(t),
                    label: noteKindLabel(l10n, t),
                    active: (_nextType ?? nextTypeFor(_kind)) == t,
                    onTap: () => setState(() => _nextType = t),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            AppTextField(
              key: const Key('next-note'),
              controller: _nextNote,
              hint: l10n.activityNextNote,
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

/// A section label in the sheet, with the gold bar the lead screen uses.
class _Label extends StatelessWidget {
  const _Label(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Container(
            width: 3,
            height: 14,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [AppPalette.gold300, AppPalette.gold500],
              ),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 6),
          Text(text, style: Theme.of(context).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w700)),
        ],
      );
}

/// The staff app's filter pill (navy when picked), as on the lists.
class _Pill extends StatelessWidget {
  const _Pill({super.key, required this.label, required this.active, required this.onTap, this.icon, this.iconColor});
  final String label;
  final bool active;
  final VoidCallback onTap;
  final IconData? icon;
  final Color? iconColor;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm + 4, vertical: 10),
        decoration: BoxDecoration(
          color: active ? colors.brandNavy : colors.surface,
          borderRadius: AppRadii.pillAll,
          border: Border.all(color: active ? colors.brandNavy : colors.hairline, width: active ? 0 : 1),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 15, color: active ? Colors.white : (iconColor ?? colors.inkMuted)),
              const SizedBox(width: 6),
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
