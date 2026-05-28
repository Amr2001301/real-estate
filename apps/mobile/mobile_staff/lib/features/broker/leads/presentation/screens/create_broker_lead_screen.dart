import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../cubit/create_broker_lead_cubit.dart';

/// Broker "add lead" form. Project/unit interest comes from the launching
/// context; the form collects contact details + an optional note.
class CreateBrokerLeadScreen extends StatelessWidget {
  const CreateBrokerLeadScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.brokerLeadNew)),
      body: BlocConsumer<CreateBrokerLeadCubit, CreateBrokerLeadState>(
        listenWhen: (a, b) => a.submitted != b.submitted || a.submitFailure != b.submitFailure,
        listener: (context, state) {
          if (state.submitted) {
            ScaffoldMessenger.of(context)
              ..hideCurrentSnackBar()
              ..showSnackBar(SnackBar(content: Text(l10n.brokerLeadCreated)));
            context.pop(true);
          } else if (state.submitFailure != null) {
            showFailureSnackBar(context, state.submitFailure!);
          }
        },
        builder: (context, state) {
          final cubit = context.read<CreateBrokerLeadCubit>();
          return ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              AppTextField(
                label: l10n.brokerLeadName,
                onChanged: cubit.setFullName,
                errorText: state.showValidation && !state.hasName ? l10n.validationRequired : null,
              ),
              const SizedBox(height: AppSpacing.md),
              AppTextField(
                label: l10n.brokerLeadPhone,
                keyboardType: TextInputType.phone,
                onChanged: cubit.setPhone,
                errorText: state.showValidation && !state.hasPhone ? l10n.validationPhone : null,
              ),
              const SizedBox(height: AppSpacing.md),
              AppTextField(
                label: l10n.brokerLeadEmail,
                keyboardType: TextInputType.emailAddress,
                onChanged: cubit.setEmail,
              ),
              const SizedBox(height: AppSpacing.md),
              AppTextField(
                label: l10n.brokerLeadNote,
                maxLines: 3,
                onChanged: cubit.setNote,
              ),
              const SizedBox(height: AppSpacing.xl),
              AppButton(
                label: l10n.brokerLeadSubmit,
                icon: Icons.person_add_alt_1_rounded,
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
