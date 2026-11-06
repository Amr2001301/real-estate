import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../common/request_kit.dart';
import '../domain/repositories/visits_repository.dart';
import 'visit_request_cubit.dart';

/// The times a visit can be asked for, as hours of the day.

/// Asks for a visit to a project (and a unit), as on the website: what it is
/// about, a day and a time, a note, and who the company will call. Signed in.
class VisitRequestScreen extends StatefulWidget {
  const VisitRequestScreen({
    super.key,
    required this.projectId,
    this.unitId,
    this.title,
    this.subtitle,
    this.imageUrl,
  });

  final String projectId;
  final String? unitId;

  /// The unit or project, for the card at the top (from the page it was
  /// opened on).
  final String? title;
  final String? subtitle;
  final String? imageUrl;

  @override
  State<VisitRequestScreen> createState() => _VisitRequestScreenState();
}

class _VisitRequestScreenState extends State<VisitRequestScreen> {
  DateTime? _day;
  TimeOfDay? _time;
  final _notes = TextEditingController();
  bool _missing = false;

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  DateTime? get _when => _day == null || _time == null
      ? null
      : DateTime(
          _day!.year,
          _day!.month,
          _day!.day,
          _time!.hour,
          _time!.minute,
        );

  Future<void> _pickDay() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _day ?? now.add(const Duration(days: 1)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 120)),
    );
    if (picked != null && mounted) {
      setState(() {
        _day = picked;
        _missing = false;
      });
    }
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _time ?? const TimeOfDay(hour: 11, minute: 0),
    );
    if (picked != null && mounted) {
      setState(() {
        _time = picked;
        _missing = false;
      });
    }
  }

  void _submit() {
    final when = _when;
    if (when == null) {
      setState(() => _missing = true);
      return;
    }
    context.read<VisitRequestCubit>().submit(
      CreateVisitParams(
        projectId: widget.projectId,
        unitId: widget.unitId,
        preferredDate: when,
        notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
      ),
    );
  }

  String _timeLabel(TimeOfDay time, String lang) {
    final h12 = time.hourOfPeriod == 0 ? 12 : time.hourOfPeriod;
    final mm = time.minute.toString().padLeft(2, '0');
    final pm = time.period == DayPeriod.pm;
    return lang == 'ar'
        ? '${ltr('$h12:$mm')} ${pm ? 'م' : 'ص'}'
        : '$h12:$mm ${pm ? 'PM' : 'AM'}';
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    final when = _when;

    return Scaffold(
      body: Column(
        children: [
          AppNavHeader(
            title: l10n.visitRequestTitle,
            compact: true,
            leadingAction: const NavHeaderBack(),
          ),
          Expanded(
            child: BlocConsumer<VisitRequestCubit, VisitFormState>(
              listener: (context, state) {
                if (state.status == VisitFormStatus.failure &&
                    state.failure != null) {
                  showFailureSnackBar(context, state.failure!);
                }
              },
              builder: (context, state) {
                if (state.status == VisitFormStatus.success && when != null) {
                  return RequestDoneView(
                    title: l10n.visitDoneTitle,
                    message: l10n.visitDoneMessage,
                    detail: l10n.visitSummary(
                      DateFormatter.mediumDate(when, languageCode: lang),
                      _timeLabel(_time!, lang),
                    ),
                  );
                }
                return ListView(
                  padding: EdgeInsets.fromLTRB(
                    AppSpacing.md,
                    AppSpacing.md,
                    AppSpacing.md,
                    AppSpacing.xl + MediaQuery.paddingOf(context).bottom,
                  ),
                  children: [
                    const RequestReplyNote(),
                    if (widget.title != null) ...[
                      const SizedBox(height: AppSpacing.md),
                      RequestSubjectCard(
                        title: widget.title!,
                        subtitle: widget.subtitle,
                        imageUrl: widget.imageUrl,
                        isUnit: widget.unitId != null,
                      ),
                    ],
                    RequestStep(
                      icon: Icons.event_available_rounded,
                      title: l10n.visitPickDay,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _PickTile(
                            key: const Key('visit-day'),
                            icon: Icons.calendar_month_rounded,
                            label: _day == null
                                ? l10n.visitPickDay
                                : DateFormatter.mediumDate(
                                    _day!,
                                    languageCode: lang,
                                  ),
                            chosen: _day != null,
                            onTap: _pickDay,
                          ),
                          const SizedBox(height: 10),
                          _PickTile(
                            key: const Key('visit-time'),
                            icon: Icons.schedule_rounded,
                            label: _time == null
                                ? l10n.visitPickTime
                                : _timeLabel(_time!, lang),
                            chosen: _time != null,
                            onTap: _pickTime,
                          ),
                          if (_missing)
                            Padding(
                              padding: const EdgeInsets.only(
                                top: AppSpacing.sm,
                              ),
                              child: Text(
                                l10n.validationRequired,
                                style: TextStyle(color: colors.error),
                              ),
                            ),
                        ],
                      ),
                    ),
                    RequestStep(
                      icon: Icons.edit_note_rounded,
                      title: l10n.fieldNotes,
                      child: TextField(
                        controller: _notes,
                        minLines: 3,
                        maxLines: 5,
                        decoration: InputDecoration(
                          hintText: l10n.visitNotesHint,
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    const RequestContactCard(),
                    const SizedBox(height: AppSpacing.xl),
                    if (when != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                        child: Text(
                          l10n.visitSummary(
                            DateFormatter.mediumDate(when, languageCode: lang),
                            _timeLabel(_time!, lang),
                          ),
                          textAlign: TextAlign.center,
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: colors.inkStrong,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    AppButton(
                      label: l10n.visitSubmit,
                      icon: Icons.event_available_rounded,
                      variant: AppButtonVariant.gold,
                      expand: true,
                      isLoading: state.isSubmitting,
                      onPressed: state.isSubmitting ? null : _submit,
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// A tappable field that opens the system date or time picker.
class _PickTile extends StatelessWidget {
  const _PickTile({
    super.key,
    required this.icon,
    required this.label,
    required this.chosen,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final bool chosen;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Material(
      color: chosen ? AppPalette.navy : colors.surface,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          height: 54,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: chosen ? AppPalette.gold400 : colors.hairline,
            ),
          ),
          child: Row(
            children: [
              Icon(
                icon,
                size: 20,
                color: chosen ? AppPalette.gold300 : AppPalette.gold500,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w700,
                    color: chosen ? Colors.white : colors.inkStrong,
                  ),
                ),
              ),
              Icon(
                Icons.expand_more_rounded,
                size: 20,
                color: chosen ? Colors.white70 : colors.inkMuted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
