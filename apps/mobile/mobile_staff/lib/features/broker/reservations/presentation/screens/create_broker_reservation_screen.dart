import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../cubit/create_broker_reservation_cubit.dart';

/// Broker "request reservation" form: pick lead (unless prefilled) + project →
/// unit, optional notes. Submits a reservation request for admin review.
class CreateBrokerReservationScreen extends StatelessWidget {
  const CreateBrokerReservationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.reservationNew)),
      body: BlocConsumer<CreateBrokerReservationCubit, CreateBrokerReservationState>(
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
          final cubit = context.read<CreateBrokerReservationCubit>();
          return ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              if (!state.fixedLead) ...[
                Text(l10n.navLeads, style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: AppSpacing.sm),
                DropdownButtonFormField<String>(
                  initialValue: state.selectedLeadId,
                  isExpanded: true,
                  decoration: const InputDecoration(isDense: true),
                  hint: Text(l10n.brokerSelectLead),
                  items: [
                    for (final lead in state.leads)
                      DropdownMenuItem(value: lead.id, child: Text(lead.fullName)),
                  ],
                  onChanged: (id) => id != null ? cubit.selectLead(id) : null,
                ),
                if (state.showValidation && !state.hasLead) ...[
                  const SizedBox(height: AppSpacing.xs),
                  _err(context, l10n.brokerSelectLead),
                ],
                const SizedBox(height: AppSpacing.lg),
              ],
              Text(l10n.visitProject, style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: AppSpacing.sm),
              DropdownButtonFormField<String>(
                initialValue: state.selectedProjectId,
                isExpanded: true,
                decoration: const InputDecoration(isDense: true),
                hint: Text(l10n.visitSelectProject),
                items: [
                  for (final p in state.projects)
                    DropdownMenuItem(value: p.id, child: Text(p.name.resolve(lang))),
                ],
                onChanged: (id) => id != null ? cubit.selectProject(id) : null,
              ),
              const SizedBox(height: AppSpacing.lg),
              Text(l10n.reservationUnit, style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: AppSpacing.sm),
              _UnitPicker(state: state),
              if (state.showValidation && !state.hasUnit) ...[
                const SizedBox(height: AppSpacing.xs),
                _err(context, l10n.reservationUnitRequired),
              ],
              const SizedBox(height: AppSpacing.lg),
              AppTextField(label: l10n.brokerLeadNote, maxLines: 3, onChanged: cubit.setNotes),
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
    );
  }

  Widget _err(BuildContext context, String text) => Text(
        text,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: context.appColors.error),
      );
}

class _UnitPicker extends StatelessWidget {
  const _UnitPicker({required this.state});
  final CreateBrokerReservationState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<CreateBrokerReservationCubit>();
    if (state.selectedProjectId == null) {
      return Text(l10n.reservationPickProjectFirst,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(color: context.appColors.inkMuted));
    }
    if (state.unitsStatus == DataStatus.loading) {
      return const Padding(padding: EdgeInsets.all(AppSpacing.md), child: Center(child: CircularProgressIndicator()));
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
