import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../domain/entities/lead.dart';
import '../cubit/lead_detail_cubit.dart';
import '../follow_up_labels.dart';

/// FU1 — opens «سجّل تواصل» over the lead, on the lead's own cubit.
Future<void> openLogActivity(BuildContext context, LeadDetailCubit cubit, {String? leadName, DateTime? currentNext}) {
  return Navigator.of(context).push(MaterialPageRoute<void>(
    builder: (_) => LogActivityScreen(cubit: cubit, leadName: leadName, currentNext: currentNext),
  ));
}

/// What logging does to the lead's next follow-up.
enum _NextMode { keep, none, set }

/// The ready-made follow-up times.
enum _Preset { in1h, tomorrow, in3Days, week }

/// FU1 — «سجّل تواصل», laid out like the other staff forms (create visit,
/// create reservation): numbered section cards, segmented choices, one date
/// tile, and the gold button at the end.
///
/// 01 What happened — the kind (call, meeting, WhatsApp, note, follow-up)
///    and, for a call, how it went.
/// 02 Details — what was said.
/// 03 Next follow-up — keep it, none, or a time (quick picks or the date
///    tile), its type and a note.
class LogActivityScreen extends StatefulWidget {
  const LogActivityScreen({
    super.key,
    required this.cubit,
    this.leadName,
    this.currentNext,
    this.now = DateTime.now,
  });
  final LeadDetailCubit cubit;
  final String? leadName;

  /// The lead's follow-up today, if it has one: "keep it" is then the default.
  final DateTime? currentNext;
  final DateTime Function() now;

  @override
  State<LogActivityScreen> createState() => _LogActivityScreenState();
}

class _LogActivityScreenState extends State<LogActivityScreen> {
  final _body = TextEditingController();
  final _nextNote = TextEditingController();
  String _kind = 'CALL';
  String? _callResult;
  late _NextMode _mode = widget.currentNext != null ? _NextMode.keep : _NextMode.none;
  _Preset? _preset;
  DateTime? _at;
  String? _nextType;
  bool _saving = false;
  bool _showErrors = false;
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

  DateTime _presetTime(_Preset p) {
    final now = widget.now();
    return switch (p) {
      _Preset.in1h => now.add(const Duration(hours: 1)),
      _Preset.tomorrow => DateTime(now.year, now.month, now.day + 1, 10),
      _Preset.in3Days => DateTime(now.year, now.month, now.day + 3, 10),
      _Preset.week => DateTime(now.year, now.month, now.day + 7, 10),
    };
  }

  void _pickPreset(_Preset p) => setState(() {
        _mode = _NextMode.set;
        _preset = p;
        _at = _presetTime(p);
        _error = null;
      });

  Future<void> _pickDateTime() async {
    final now = widget.now();
    final start = _at ?? DateTime(now.year, now.month, now.day + 1, 10);
    final date = await showDatePicker(
      context: context,
      initialDate: start.isBefore(now) ? now : start,
      firstDate: DateTime(now.year, now.month, now.day),
      lastDate: now.add(const Duration(days: 365)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(start));
    if (time == null || !mounted) return;
    setState(() {
      _mode = _NextMode.set;
      _preset = null;
      _at = DateTime(date.year, date.month, date.day, time.hour, time.minute);
      _error = null;
    });
  }

  Future<void> _save() async {
    final l10n = context.l10n;
    final body = _body.text.trim();
    if (_saving) return;
    if (body.isEmpty) {
      setState(() => _showErrors = true);
      return;
    }
    final setting = _mode == _NextMode.set;
    if (setting && (_at == null || !_at!.isAfter(widget.now()))) {
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
      nextChange: switch (_mode) {
        _NextMode.set => NextActionChange.set,
        _NextMode.none when widget.currentNext != null => NextActionChange.clear,
        _ => NextActionChange.keep,
      },
      nextActionAt: setting ? _at : null,
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

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;

    return Scaffold(
      backgroundColor: colors.canvas,
      body: Column(
        children: [
          AppNavHeader(
            compact: true,
            title: l10n.leadLogActivity,
            subtitle: widget.leadName,
            leadingAction: NavHeaderAction(
              icon: Icons.arrow_back_ios_new_rounded,
              onTap: () => Navigator.of(context).maybePop(),
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.lg, AppSpacing.lg, AppSpacing.xxl),
              children: [
                // ── 01 What happened ─────────────────────────────────────
                AppFormSection(
                  step: '01',
                  title: l10n.activityWhatHappened,
                  subtitle: l10n.activitySectionWhatSubtitle,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _Segmented<String>(
                        options: [
                          for (final k in kNoteKinds)
                            (value: k, icon: noteKindIcon(k), label: noteKindLabel(l10n, k), key: 'kind-$k'),
                        ],
                        selected: _kind,
                        onChanged: (k) => setState(() => _kind = k),
                      ),
                      if (_kind == 'CALL') ...[
                        const SizedBox(height: AppSpacing.md),
                        _FieldLabel(l10n.callResultLabel),
                        const SizedBox(height: AppSpacing.xs),
                        _Segmented<String>(
                          options: [
                            for (final r in kCallResults)
                              (value: r, icon: null, label: callResultLabel(l10n, r), key: 'result-$r'),
                          ],
                          selected: _callResult,
                          onChanged: (r) => setState(() => _callResult = _callResult == r ? null : r),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.md),

                // ── 02 Details ───────────────────────────────────────────
                AppFormSection(
                  step: '02',
                  title: l10n.activitySectionDetails,
                  subtitle: l10n.activitySectionDetailsSubtitle,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      AppTextField(
                        key: const Key('activity-body'),
                        controller: _body,
                        hint: l10n.activityBodyHint,
                        maxLines: 4,
                      ),
                      if (_showErrors && _body.text.trim().isEmpty) ...[
                        const SizedBox(height: AppSpacing.xs),
                        _ErrorText(l10n.activityBodyHint),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.md),

                // ── 03 Next follow-up ────────────────────────────────────
                AppFormSection(
                  step: '03',
                  title: l10n.leadNextAction,
                  subtitle: l10n.activitySectionNextSubtitle,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _Segmented<_NextMode>(
                        options: [
                          if (widget.currentNext != null)
                            (value: _NextMode.keep, icon: Icons.event_available_rounded, label: l10n.activityNextKeep, key: 'next-keep'),
                          (value: _NextMode.none, icon: Icons.event_busy_rounded, label: l10n.activityNextNone, key: 'next-none'),
                          (value: _NextMode.set, icon: Icons.event_repeat_rounded, label: l10n.activityNextSet, key: 'next-set'),
                        ],
                        selected: _mode,
                        onChanged: (m) => setState(() {
                          _mode = m;
                          _error = null;
                          if (m == _NextMode.set && _at == null) {
                            _preset = _Preset.tomorrow;
                            _at = _presetTime(_Preset.tomorrow);
                          }
                        }),
                      ),
                      if (_mode == _NextMode.keep && widget.currentNext != null) ...[
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          followUpWhen(widget.currentNext!, l10n, lang, now: widget.now()),
                          style: TextStyle(fontSize: 13, color: colors.inkMuted),
                        ),
                      ],
                      if (_mode == _NextMode.set) ...[
                        const SizedBox(height: AppSpacing.md),
                        Row(
                          children: [
                            for (final p in _Preset.values) ...[
                              if (p != _Preset.values.first) const SizedBox(width: 6),
                              Expanded(
                                child: _QuickPick(
                                  key: ValueKey('next-${p.name}'),
                                  label: switch (p) {
                                    _Preset.in1h => l10n.activityNextIn1h,
                                    _Preset.tomorrow => l10n.activityNextTomorrow,
                                    _Preset.in3Days => l10n.activityNextIn3Days,
                                    _Preset.week => l10n.activityNextWeek,
                                  },
                                  selected: _preset == p,
                                  onTap: () => _pickPreset(p),
                                ),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        _DateTimeTile(
                          key: const Key('next-pick'),
                          label: _at == null
                              ? l10n.activityNextPick
                              : followUpWhen(_at!, l10n, lang, now: widget.now()),
                          filled: _at != null,
                          onTap: _pickDateTime,
                        ),
                        if (_error != null) ...[
                          const SizedBox(height: AppSpacing.xs),
                          _ErrorText(_error!, key: const Key('activity-error')),
                        ],
                        const SizedBox(height: AppSpacing.md),
                        _FieldLabel(l10n.activityNextType),
                        const SizedBox(height: AppSpacing.xs),
                        _Segmented<String>(
                          options: [
                            for (final t in kNextActionTypes)
                              (value: t, icon: noteKindIcon(t), label: noteKindLabel(l10n, t), key: 'next-type-$t'),
                          ],
                          selected: _nextType ?? nextTypeFor(_kind),
                          onChanged: (t) => setState(() => _nextType = t),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        AppTextField(
                          key: const Key('next-note'),
                          controller: _nextNote,
                          label: l10n.activityNextNote,
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.xl),

                AppButton(
                  key: const Key('activity-save'),
                  label: l10n.activitySave,
                  icon: Icons.check_rounded,
                  variant: AppButtonVariant.gold,
                  size: AppButtonSize.large,
                  expand: true,
                  isLoading: _saving,
                  onPressed: _saving ? null : _save,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Section card — same design as create_visit / create_reservation
// ═════════════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════════════
// Segmented choice — the create-visit client-type control, for any options
// ═════════════════════════════════════════════════════════════════════════════

typedef _Option<T> = ({T value, IconData? icon, String label, String key});

class _Segmented<T> extends StatelessWidget {
  const _Segmented({required this.options, required this.selected, required this.onChanged});
  final List<_Option<T>> options;
  final T? selected;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      decoration: BoxDecoration(
        color: colors.surfaceSoft,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: colors.hairline),
      ),
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < options.length; i++) ...[
              if (i > 0) Container(width: 1, color: colors.hairline),
              Expanded(
                child: _Segment(
                  key: ValueKey(options[i].key),
                  icon: options[i].icon,
                  label: options[i].label,
                  selected: options[i].value == selected,
                  onTap: () => onChanged(options[i].value),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Segment extends StatelessWidget {
  const _Segment({super.key, required this.icon, required this.label, required this.selected, required this.onTap});
  final IconData? icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: EdgeInsets.symmetric(vertical: icon == null ? 12 : 10),
        color: selected ? AppPalette.gold400.withValues(alpha: 0.11) : Colors.transparent,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (icon != null) ...[
              AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: selected ? AppPalette.gold400.withValues(alpha: 0.15) : Colors.transparent,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 17, color: selected ? AppPalette.gold600 : colors.inkMuted),
              ),
              const SizedBox(height: 4),
            ],
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 3),
              child: Text(
                label,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 11.5,
                  height: 1.25,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  color: selected ? AppPalette.gold600 : colors.inkMuted,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A ready-made follow-up time: one tap sets it.
class _QuickPick extends StatelessWidget {
  const _QuickPick({super.key, required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        decoration: BoxDecoration(
          color: selected ? colors.brandNavy : colors.surface,
          borderRadius: BorderRadius.circular(AppRadii.md),
          border: Border.all(color: selected ? colors.brandNavy : colors.hairline),
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          maxLines: 2,
          style: TextStyle(
            fontSize: 12,
            height: 1.25,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
            color: selected ? Colors.white : colors.inkStrong,
          ),
        ),
      ),
    );
  }
}

/// The chosen follow-up time; tap to pick another date and time.
class _DateTimeTile extends StatelessWidget {
  const _DateTimeTile({super.key, required this.label, required this.filled, required this.onTap});
  final String label;
  final bool filled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final text = Theme.of(context).textTheme;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadii.md),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: colors.surfaceSoft,
            borderRadius: BorderRadius.circular(AppRadii.md),
            border: Border.all(color: colors.hairline),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppPalette.gold400.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.event_rounded, color: AppPalette.gold400, size: 18),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Text(
                  label,
                  key: const Key('next-when'),
                  style: filled
                      ? text.bodyLarge?.copyWith(fontWeight: FontWeight.w600, color: colors.inkStrong)
                      : text.bodyLarge?.copyWith(color: colors.inkMuted),
                ),
              ),
              Icon(Icons.edit_calendar_rounded, size: 18, color: colors.inkMuted),
            ],
          ),
        ),
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Text(
        text,
        style: Theme.of(context).textTheme.labelLarge?.copyWith(
              fontWeight: FontWeight.w700,
              color: context.appColors.inkStrong,
            ),
      );
}

class _ErrorText extends StatelessWidget {
  const _ErrorText(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) => Text(
        text,
        style: TextStyle(fontSize: 12, color: context.appColors.error),
      );
}
