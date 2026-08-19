import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../cubit/forgot_staff_password_cubit.dart';

class ForgotStaffPasswordScreen extends StatefulWidget {
  const ForgotStaffPasswordScreen({super.key});

  @override
  State<ForgotStaffPasswordScreen> createState() => _ForgotStaffPasswordScreenState();
}

class _ForgotStaffPasswordScreenState extends State<ForgotStaffPasswordScreen> {
  final _emailCtrl = TextEditingController();
  final _tokenCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _emailFormKey = GlobalKey<FormState>();
  final _resetFormKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _emailCtrl.dispose();
    _tokenCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return BlocConsumer<ForgotStaffPasswordCubit, ForgotStaffPasswordState>(
      listenWhen: (a, b) =>
          (a.failure != b.failure && b.failure != null) ||
          (a.step != b.step && b.step == StaffForgotResetStep.done),
      listener: (context, state) {
        if (state.step == StaffForgotResetStep.done) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(l10n.authResetSuccess)));
          context.go('/login');
        } else if (state.failure != null) {
          showFailureSnackBar(context, state.failure!);
        }
      },
      builder: (context, state) {
        if (state.step == StaffForgotResetStep.resetForm) {
          return _ResetForm(
            l10n: l10n,
            tokenCtrl: _tokenCtrl,
            passwordCtrl: _passwordCtrl,
            formKey: _resetFormKey,
            submitting: state.submitting,
            onSubmit: () {
              if (_resetFormKey.currentState?.validate() ?? false) {
                context.read<ForgotStaffPasswordCubit>().submitReset(
                      _tokenCtrl.text.trim(),
                      _passwordCtrl.text,
                    );
              }
            },
          );
        }
        return _RequestForm(
          l10n: l10n,
          emailCtrl: _emailCtrl,
          formKey: _emailFormKey,
          submitting: state.submitting,
          onSubmit: () {
            if (_emailFormKey.currentState?.validate() ?? false) {
              context
                  .read<ForgotStaffPasswordCubit>()
                  .sendResetLink(_emailCtrl.text.trim());
            }
          },
        );
      },
    );
  }
}

class _RequestForm extends StatelessWidget {
  const _RequestForm({
    required this.l10n,
    required this.emailCtrl,
    required this.formKey,
    required this.submitting,
    required this.onSubmit,
  });
  final AppLocalizations l10n;
  final TextEditingController emailCtrl;
  final GlobalKey<FormState> formKey;
  final bool submitting;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.appColors.canvas,
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          AuthHeader(
            title: l10n.authForgotPasswordTitle,
            subtitle: l10n.authForgotPasswordSubtitle,
            onBack: () => context.canPop() ? context.pop() : context.go('/login'),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.xl,
              AppSpacing.lg,
              AppSpacing.lg + MediaQuery.of(context).padding.bottom,
            ),
            child: Column(
              children: [
                Form(
                  key: formKey,
                  child: AuthCard(
                    child: AuthField(
                      controller: emailCtrl,
                      label: l10n.fieldEmail,
                      icon: Icons.alternate_email_rounded,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.done,
                      validator: (v) =>
                          (v == null || v.trim().isEmpty) ? l10n.validationRequired : null,
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.xl),
                AppButton(
                  label: l10n.authForgotPasswordSend,
                  variant: AppButtonVariant.gold,
                  expand: true,
                  isLoading: submitting,
                  onPressed: submitting ? null : onSubmit,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ResetForm extends StatelessWidget {
  const _ResetForm({
    required this.l10n,
    required this.tokenCtrl,
    required this.passwordCtrl,
    required this.formKey,
    required this.submitting,
    required this.onSubmit,
  });
  final AppLocalizations l10n;
  final TextEditingController tokenCtrl;
  final TextEditingController passwordCtrl;
  final GlobalKey<FormState> formKey;
  final bool submitting;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.appColors.canvas,
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          AuthHeader(
            title: l10n.authResetPasswordTitle,
            subtitle: l10n.authResetPasswordSubtitle,
            onBack: null,
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.xl,
              AppSpacing.lg,
              AppSpacing.lg + MediaQuery.of(context).padding.bottom,
            ),
            child: Column(
              children: [
                Form(
                  key: formKey,
                  child: AuthCard(
                    child: Column(
                      children: [
                        AuthField(
                          controller: tokenCtrl,
                          label: l10n.authResetToken,
                          icon: Icons.key_rounded,
                          textInputAction: TextInputAction.next,
                          validator: (v) =>
                              (v == null || v.trim().isEmpty) ? l10n.validationRequired : null,
                        ),
                        const SizedBox(height: AppSpacing.md),
                        AuthPasswordField(
                          controller: passwordCtrl,
                          label: l10n.authNewPassword,
                          textInputAction: TextInputAction.done,
                          validator: (v) =>
                              (v == null || v.length < 8) ? l10n.validationPasswordShort : null,
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.xl),
                AppButton(
                  label: l10n.authResetSubmit,
                  variant: AppButtonVariant.gold,
                  expand: true,
                  isLoading: submitting,
                  onPressed: submitting ? null : onSubmit,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
