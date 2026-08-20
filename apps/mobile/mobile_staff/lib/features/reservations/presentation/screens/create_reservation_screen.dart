import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../cubit/create_reservation_cubit.dart';

/// "Reserve unit" form. Unit is fixed when launched from a unit; otherwise the
/// user picks a project then one of its units. Optional notes.
class CreateReservationScreen extends StatefulWidget {
  const CreateReservationScreen({super.key});

  @override
  State<CreateReservationScreen> createState() => _CreateReservationScreenState();
}

class _CreateReservationScreenState extends State<CreateReservationScreen> {
  @override
  void initState() {
    super.initState();
    context.read<CreateReservationCubit>().init();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      body: Column(
        children: [
          AppNavHeader(
            title: l10n.reservationNew,
            leadingAction: NavHeaderAction(
              icon: Icons.arrow_back_ios_new_rounded,
              onTap: () => context.pop(),
            ),
          ),
          Expanded(
            child: BlocConsumer<CreateReservationCubit, CreateReservationState>(
        listenWhen: (a, b) => a.submitted != b.submitted || a.submitFailure != b.submitFailure,
        listener: (context, state) {
          if (state.submitted) {
            ScaffoldMessenger.of(context)
              ..hideCurrentSnackBar()
              ..showSnackBar(SnackBar(content: Text(l10n.reservationCreated)));
            context.pop(true);
          } else if (state.submitFailure != null) {
            showFailureSnackBar(context, state.submitFailure!);
          }
        },
        builder: (context, state) {
          final cubit = context.read<CreateReservationCubit>();
          return ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              if (!state.fixedUnit) ...[
                Text(l10n.visitProject, style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: AppSpacing.sm),
                _ProjectDropdown(state: state),
                const SizedBox(height: AppSpacing.lg),
                Text(l10n.reservationUnit, style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: AppSpacing.sm),
                _UnitDropdown(state: state),
                if (state.showValidation && !state.hasUnit) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(l10n.reservationUnitRequired,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(color: context.appColors.error)),
                ],
                const SizedBox(height: AppSpacing.lg),
              ],
              AppTextField(
                label: l10n.leadAddNote,
                maxLines: 3,
                onChanged: cubit.setNotes,
              ),
              const SizedBox(height: AppSpacing.xl),
              AppButton(
                label: l10n.reservationCreate,
                icon: Icons.bookmark_add_rounded,
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

class _ProjectDropdown extends StatelessWidget {
  const _ProjectDropdown({required this.state});
  final CreateReservationState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final cubit = context.read<CreateReservationCubit>();
    if (state.projectsStatus == DataStatus.loading || state.projectsStatus == DataStatus.initial) {
      return const Padding(
        padding: EdgeInsets.all(AppSpacing.md),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (state.projectsStatus == DataStatus.failure) {
      return ErrorState(failure: state.projectsFailure, onRetry: cubit.init);
    }
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

class _UnitDropdown extends StatelessWidget {
  const _UnitDropdown({required this.state});
  final CreateReservationState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<CreateReservationCubit>();
    if (state.selectedProjectId == null) {
      return Text(l10n.reservationPickProjectFirst,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(color: context.appColors.inkMuted));
    }
    if (state.unitsStatus == DataStatus.loading) {
      return const Padding(
        padding: EdgeInsets.all(AppSpacing.md),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (state.unitsStatus == DataStatus.empty) {
      return Text(l10n.unitsEmptyMessage,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(color: context.appColors.inkMuted));
    }
    return DropdownButtonFormField<String>(
      initialValue: state.selectedUnitId,
      isExpanded: true,
      decoration: const InputDecoration(isDense: true),
      hint: Text(l10n.reservationSelectUnit),
      items: [
        for (final u in state.units)
          DropdownMenuItem(value: u.id, child: Text('${u.code}${u.type != null ? ' · ${u.type}' : ''}')),
      ],
      onChanged: (id) => id != null ? cubit.selectUnit(id) : null,
    );
  }
}
