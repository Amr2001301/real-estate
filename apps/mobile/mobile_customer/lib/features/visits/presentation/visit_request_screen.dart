import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../common/request_kit.dart';
import '../domain/repositories/visits_repository.dart';
import 'visit_request_cubit.dart';

/// The times a visit can be asked for, as hours of the day.
const visitHours = [10, 12, 14, 16, 18];

/// The next [days] days a visit can be booked for, from tomorrow.
List<DateTime> visitDays(DateTime now, {int days = 14}) =>
    [for (var i = 1; i <= days; i++) DateTime(now.year, now.month, now.day + i)];

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
  late final List<DateTime> _days = visitDays(DateTime.now());
  DateTime? _day;
  int? _hour;
  final _notes = TextEditingController();
  bool _missing = false;

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  DateTime? get _when => _day == null || _hour == null ? null : DateTime(_day!.year, _day!.month, _day!.day, _hour!);

  void _submit() {
    final when = _when;
    if (when == null) {
      setState(() => _missing = true);
      return;
    }
    context.read<VisitRequestCubit>().submit(CreateVisitParams(
          projectId: widget.projectId,
          unitId: widget.unitId,
          preferredDate: when,
          notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
        ));
  }

  String _timeLabel(int hour, String lang) {
    final h12 = hour > 12 ? hour - 12 : hour;
    final pm = hour >= 12;
    return lang == 'ar' ? '$h12:00 ${pm ? 'م' : 'ص'}' : '$h12:00 ${pm ? 'PM' : 'AM'}';
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
          AppNavHeader(title: l10n.visitRequestTitle, compact: true, leadingAction: const NavHeaderBack()),
          Expanded(
            child: BlocConsumer<VisitRequestCubit, VisitFormState>(
              listener: (context, state) {
                if (state.status == VisitFormStatus.failure && state.failure != null) {
                  showFailureSnackBar(context, state.failure!);
                }
              },
              builder: (context, state) {
                if (state.status == VisitFormStatus.success && when != null) {
                  return RequestDoneView(
                    title: l10n.visitDoneTitle,
                    message: l10n.visitDoneMessage,
                    detail: l10n.visitSummary(DateFormatter.mediumDate(when, languageCode: lang), _timeLabel(when.hour, lang)),
                  );
                }
                return ListView(
                  padding: EdgeInsets.fromLTRB(
                    AppSpacing.lg,
                    AppSpacing.lg,
                    AppSpacing.lg,
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
                    const SizedBox(height: AppSpacing.lg),
                    RequestLabel(l10n.visitPickDay),
                    const SizedBox(height: AppSpacing.sm),
                    SizedBox(
                      height: 78,
                      child: ListView.separated(
                        key: const Key('visit-days'),
                        scrollDirection: Axis.horizontal,
                        itemCount: _days.length,
                        separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
                        itemBuilder: (context, i) {
                          final d = _days[i];
                          final selected = _day == d;
                          return _Choice(
                            selected: selected,
                            width: 64,
                            onTap: () => setState(() {
                              _day = d;
                              _missing = false;
                            }),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  DateFormatter.weekdayShort(d, languageCode: lang),
                                  style: theme.textTheme.labelSmall?.copyWith(color: selected ? AppPalette.gold300 : colors.inkMuted),
                                ),
                                Text(
                                  '${d.day}',
                                  style: theme.textTheme.titleLarge?.copyWith(
                                    color: selected ? Colors.white : colors.inkStrong,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                                Text(
                                  DateFormatter.monthShort(d, languageCode: lang),
                                  style: theme.textTheme.labelSmall?.copyWith(color: selected ? Colors.white70 : colors.inkMuted),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    RequestLabel(l10n.visitPickTime),
                    const SizedBox(height: AppSpacing.sm),
                    Wrap(
                      key: const Key('visit-hours'),
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.sm,
                      children: [
                        for (final h in visitHours)
                          _Choice(
                            selected: _hour == h,
                            width: 96,
                            height: 44,
                            onTap: () => setState(() {
                              _hour = h;
                              _missing = false;
                            }),
                            child: Text(
                              _timeLabel(h, lang),
                              style: theme.textTheme.bodyMedium?.copyWith(
                                color: _hour == h ? Colors.white : colors.inkStrong,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                      ],
                    ),
                    if (_missing)
                      Padding(
                        padding: const EdgeInsets.only(top: AppSpacing.sm),
                        child: Text(l10n.validationRequired, style: TextStyle(color: colors.error)),
                      ),
                    const SizedBox(height: AppSpacing.lg),
                    RequestLabel(l10n.fieldNotes),
                    const SizedBox(height: AppSpacing.sm),
                    TextField(
                      controller: _notes,
                      minLines: 3,
                      maxLines: 5,
                      decoration: InputDecoration(hintText: l10n.visitNotesHint),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    const RequestContactCard(),
                    const SizedBox(height: AppSpacing.xl),
                    if (when != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                        child: Text(
                          l10n.visitSummary(DateFormatter.mediumDate(when, languageCode: lang), _timeLabel(when.hour, lang)),
                          textAlign: TextAlign.center,
                          style: theme.textTheme.bodyMedium?.copyWith(color: colors.inkStrong, fontWeight: FontWeight.w700),
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

class _Choice extends StatelessWidget {
  const _Choice({required this.selected, required this.onTap, required this.child, this.width, this.height});
  final bool selected;
  final VoidCallback onTap;
  final Widget child;
  final double? width;
  final double? height;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Material(
      color: selected ? AppPalette.navy : colors.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Container(
          width: width,
          height: height,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: selected ? AppPalette.gold400 : colors.hairline),
          ),
          child: child,
        ),
      ),
    );
  }
}
