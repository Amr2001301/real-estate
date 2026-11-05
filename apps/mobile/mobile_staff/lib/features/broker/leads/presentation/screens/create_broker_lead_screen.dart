import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../cubit/create_broker_lead_cubit.dart';
import '../../../../dashboard/home_kit/home_kit.dart';


// ─────────────────────────────────────────────────────────────────────────────
// Create Broker Lead Screen
// ─────────────────────────────────────────────────────────────────────────────

class CreateBrokerLeadScreen extends StatelessWidget {
  const CreateBrokerLeadScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: BlocConsumer<CreateBrokerLeadCubit, CreateBrokerLeadState>(
          listenWhen: (a, b) =>
              a.submitted != b.submitted || a.submitFailure != b.submitFailure,
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
            return Column(
              children: [
                const _FormHeader(),
                Expanded(
                  child: ListView(
                    padding: EdgeInsets.fromLTRB(
                      AppSpacing.lg,
                      AppSpacing.lg,
                      AppSpacing.lg,
                      AppSpacing.xl + MediaQuery.of(context).padding.bottom,
                    ),
                    children: [
                      AppFormSection(
                        step: '01',
                        title: l10n.brokerLeadSectionContact,
                        subtitle: l10n.brokerLeadSectionContactSubtitle,
                        child: Column(
                          children: [
                            AppTextField(
                              label: l10n.brokerLeadName,
                              prefixIcon: Icons.person_rounded,
                              keyboardType: TextInputType.name,
                              textInputAction: TextInputAction.next,
                              errorText: state.showValidation && !state.hasName
                                  ? l10n.validationRequired
                                  : null,
                              onChanged: cubit.setFullName,
                            ),
                            const SizedBox(height: AppSpacing.md),
                            AppTextField(
                              label: l10n.brokerLeadPhone,
                              prefixIcon: Icons.call_rounded,
                              keyboardType: TextInputType.phone,
                              textInputAction: TextInputAction.next,
                              errorText: state.showValidation && !state.hasPhone
                                  ? l10n.validationPhone
                                  : null,
                              onChanged: cubit.setPhone,
                            ),
                            const SizedBox(height: AppSpacing.md),
                            AppTextField(
                              label: l10n.brokerLeadEmail,
                              prefixIcon: Icons.email_rounded,
                              keyboardType: TextInputType.emailAddress,
                              onChanged: cubit.setEmail,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      AppFormSection(
                        step: '02',
                        title: l10n.leadNotes,
                        subtitle: l10n.brokerSectionNoteSubtitle,
                        child: AppTextField(
                          hint: l10n.leadNotesHint,
                          maxLines: 4,
                          onChanged: cubit.setNote,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xl),

                      // ── Submit ───────────────────────────────────────────
                      AppButton(
                        label: l10n.brokerLeadSubmit,
                        icon: Icons.person_add_alt_1_rounded,
                        variant: AppButtonVariant.gold,
                        expand: true,
                        isLoading: state.submitting,
                        onPressed: state.submitting ? null : cubit.submit,
                      ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

// ── Form header ───────────────────────────────────────────────────────────────

class _FormHeader extends StatelessWidget {
  const _FormHeader();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return HomeListHero(back: true, title: l10n.brokerLeadNew, subtitle: l10n.brokerLeadNewSubtitle);
  }
}
