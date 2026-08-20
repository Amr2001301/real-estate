import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../cubit/create_visit_cubit.dart';

/// "Schedule visit" form. Project is fixed when launched from a unit/lead,
/// otherwise picked from a dropdown. Date/time + optional location & notes.
class CreateVisitScreen extends StatefulWidget {
  const CreateVisitScreen({super.key});

  @override
  State<CreateVisitScreen> createState() => _CreateVisitScreenState();
}

class _CreateVisitScreenState extends State<CreateVisitScreen> {
  @override
  void initState() {
    super.initState();
    context.read<CreateVisitCubit>().init();
  }

  Future<void> _pickDateTime() async {
    final cubit = context.read<CreateVisitCubit>();
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
      initialDate: now,
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(context: context, initialTime: TimeOfDay.now());
    if (time == null) return;
    cubit.setSchedule(DateTime(date.year, date.month, date.day, time.hour, time.minute));
  }

  @override
  Widget build(BuildContext context) {
    final l10n  = context.l10n;
    final lang  = Localizations.localeOf(context).languageCode;
    return Scaffold(
      body: Column(
        children: [
          AppNavHeader(
            title: l10n.visitNew,
            leadingAction: NavHeaderAction(
              icon: Icons.arrow_back_ios_new_rounded,
              onTap: () => context.pop(),
            ),
          ),
          Expanded(
            child: BlocConsumer<CreateVisitCubit, CreateVisitState>(
        listenWhen: (a, b) => a.submitted != b.submitted || a.submitFailure != b.submitFailure,
        listener: (context, state) {
          if (state.submitted) {
            ScaffoldMessenger.of(context)
              ..hideCurrentSnackBar()
              ..showSnackBar(SnackBar(content: Text(l10n.visitCreated)));
            context.pop(true);
          } else if (state.submitFailure != null) {
            showFailureSnackBar(context, state.submitFailure!);
          }
        },
        builder: (context, state) {
          final cubit   = context.read<CreateVisitCubit>();
          final colors  = context.appColors;
          return ListView(
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.xl),
            children: [
              if (!state.fixedProject) ...[
                _SectionLabel(l10n.visitProject),
                _ProjectPicker(state: state),
                if (state.showValidation && !state.hasProject) ...[
                  const SizedBox(height: AppSpacing.xs),
                  _Err(l10n.visitProjectRequired),
                ],
                const SizedBox(height: AppSpacing.lg),
              ],
              _SectionLabel(l10n.visitWhen),
              Container(
                decoration: BoxDecoration(
                  color: colors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: colors.hairline),
                ),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: _pickDateTime,
                    borderRadius: BorderRadius.circular(16),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
                      child: Row(
                        children: [
                          Container(
                            width: 36, height: 36,
                            decoration: BoxDecoration(
                              color: colors.brandGold.withValues(alpha: 0.10),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Icon(Icons.event_outlined,
                                color: colors.brandGold, size: 18),
                          ),
                          const SizedBox(width: AppSpacing.md),
                          Expanded(
                            child: Text(
                              state.scheduledAt == null
                                  ? l10n.visitPickDateTime
                                  : DateFormatter.mediumDate(
                                      state.scheduledAt!, languageCode: lang),
                              style: state.scheduledAt == null
                                  ? Theme.of(context).textTheme.bodyLarge
                                      ?.copyWith(color: colors.inkMuted)
                                  : Theme.of(context).textTheme.bodyLarge
                                      ?.copyWith(
                                          fontWeight: FontWeight.w600,
                                          color: colors.inkStrong),
                            ),
                          ),
                          Icon(
                            Icons.chevron_right_rounded,
                            color: colors.inkMuted,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              if (state.showValidation && !state.hasSchedule) ...[
                const SizedBox(height: AppSpacing.xs),
                _Err(l10n.visitScheduleRequired),
              ],
              const SizedBox(height: AppSpacing.lg),
              AppTextField(
                label: l10n.visitLocation,
                onChanged: cubit.setLocation,
              ),
              const SizedBox(height: AppSpacing.md),
              AppTextField(
                label: l10n.visitNotes,
                maxLines: 3,
                onChanged: cubit.setNotes,
              ),
              const SizedBox(height: AppSpacing.xl),
              AppButton(
                label: l10n.visitCreate,
                icon: Icons.event_available_rounded,
                variant: AppButtonVariant.gold,
                expand: true,
                isLoading: state.submitting,
                onPressed: state.submitting ? null : cubit.submit,
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

class _ProjectPicker extends StatelessWidget {
  const _ProjectPicker({required this.state});
  final CreateVisitState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final cubit = context.read<CreateVisitCubit>();

    switch (state.projectsStatus) {
      case DataStatus.initial:
      case DataStatus.loading:
        return const Padding(
          padding: EdgeInsets.all(AppSpacing.md),
          child: Center(child: CircularProgressIndicator()),
        );
      case DataStatus.failure:
        return ErrorState(failure: state.projectsFailure, onRetry: cubit.init);
      case DataStatus.empty:
        return EmptyState(icon: Icons.apartment_outlined, title: l10n.projectsEmptyTitle);
      case DataStatus.success:
        return DropdownButtonFormField<String>(
          initialValue: state.selectedProjectId,
          isExpanded: true,
          decoration: const InputDecoration(isDense: true),
          hint: Text(l10n.visitSelectProject),
          items: [
            for (final p in state.projects)
              DropdownMenuItem(value: p.id, child: Text(p.name.resolve(lang))),
          ],
          onChanged: (id) => id != null ? cubit.selectProject(id) : null,
        );
    }
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.sm),
        child: Row(
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
              text,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      );
}

class _Err extends StatelessWidget {
  const _Err(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Text(
        text,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: context.appColors.error),
      );
}
