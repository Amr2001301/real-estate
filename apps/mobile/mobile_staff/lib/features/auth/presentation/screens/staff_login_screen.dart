import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../cubit/staff_auth_cubit.dart';

/// Staff email/password login using the shared premium auth UI from core.
/// On success the app-wide SessionCubit becomes authenticated and the router
/// redirects to the appropriate workspace shell.
class StaffLoginScreen extends StatefulWidget {
  const StaffLoginScreen({super.key});

  @override
  State<StaffLoginScreen> createState() => _StaffLoginScreenState();
}

class _StaffLoginScreenState extends State<StaffLoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  void _submit() {
    if (_formKey.currentState?.validate() != true) return;
    FocusScope.of(context).unfocus();
    context.read<StaffAuthCubit>().login(_email.text, _password.text);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      body: BlocListener<StaffAuthCubit, StaffAuthState>(
        listenWhen: (a, b) => a.failure != b.failure && b.failure != null,
        listener: (context, state) => showFailureSnackBar(context, state.failure!),
        child: SingleChildScrollView(
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Premium navy hero header shared with customer app
                AuthHeader(
                  title: l10n.staffAppTitle,
                  subtitle: l10n.staffLoginSubtitle,
                ),
                // Form card
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.lg,
                    AppSpacing.xl,
                    AppSpacing.lg,
                    AppSpacing.lg,
                  ),
                  child: AuthCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        AuthField(
                          controller: _email,
                          label: l10n.fieldEmail,
                          icon: Icons.email_outlined,
                          keyboardType: TextInputType.emailAddress,
                          textInputAction: TextInputAction.next,
                          autofillHints: const [AutofillHints.email],
                          validator: (v) =>
                              (v == null || !v.contains('@'))
                                  ? l10n.validationEmail
                                  : null,
                        ),
                        const SizedBox(height: AppSpacing.md),
                        AuthPasswordField(
                          controller: _password,
                          label: l10n.fieldPassword,
                          textInputAction: TextInputAction.done,
                          onFieldSubmitted: (_) => _submit(),
                          validator: (v) =>
                              (v == null || v.isEmpty)
                                  ? l10n.validationRequired
                                  : null,
                        ),
                        const SizedBox(height: AppSpacing.xl),
                        BlocBuilder<StaffAuthCubit, StaffAuthState>(
                          builder: (context, state) => AppButton(
                            label: l10n.actionLogin,
                            icon: Icons.login_rounded,
                            expand: true,
                            isLoading: state.isSubmitting,
                            onPressed: state.isSubmitting ? null : _submit,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        AuthFooterLink(
                          text: l10n.authForgotPassword,
                          onTap: () => context.push('/forgot-password'),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
