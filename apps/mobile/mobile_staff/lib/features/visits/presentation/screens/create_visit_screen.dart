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
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.visitNew)),
      body: BlocConsumer<CreateVisitCubit, CreateVisitState>(
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
          final cubit = context.read<CreateVisitCubit>();
          return ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              if (!state.fixedProject) ...[
                Text(l10n.visitProject, style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: AppSpacing.sm),
                _ProjectPicker(state: state),
                if (state.showValidation && !state.hasProject) ...[
                  const SizedBox(height: AppSpacing.xs),
                  _Err(l10n.visitProjectRequired),
                ],
                const SizedBox(height: AppSpacing.lg),
              ],
              Text(l10n.visitWhen, style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: AppSpacing.sm),
              AppCard(
                onTap: _pickDateTime,
                child: Row(
                  children: [
                    Icon(Icons.event_outlined, color: context.appColors.brandGold),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Text(
                        state.scheduledAt == null
                            ? l10n.visitPickDateTime
                            : DateFormatter.mediumDate(state.scheduledAt!, languageCode: lang),
                        style: Theme.of(context).textTheme.bodyLarge,
                      ),
                    ),
                    const Icon(Icons.chevron_right_rounded),
                  ],
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

class _Err extends StatelessWidget {
  const _Err(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Text(
        text,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: context.appColors.error),
      );
}
