import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../cubit/staff_auth_cubit.dart';

/// Staff email/password login. On success the app-wide SessionCubit becomes
/// authenticated and the router redirects to the shell (or broker placeholder).
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
    final colors = context.appColors;

    return Scaffold(
      body: SafeArea(
        child: BlocListener<StaffAuthCubit, StaffAuthState>(
          listenWhen: (a, b) => a.failure != b.failure && b.failure != null,
          listener: (context, state) => showFailureSnackBar(context, state.failure!),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: AppSpacing.xxl),
                  Icon(Icons.business_center_rounded, size: 56, color: colors.brandGold),
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    l10n.staffAppTitle,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    l10n.staffLoginSubtitle,
                    textAlign: TextAlign.center,
                    style: Theme.of(context)
                        .textTheme
                        .bodyMedium
                        ?.copyWith(color: colors.inkMuted),
                  ),
                  const SizedBox(height: AppSpacing.xxl),
                  TextFormField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.next,
                    autofillHints: const [AutofillHints.email],
                    decoration: InputDecoration(labelText: l10n.fieldEmail),
                    validator: (v) =>
                        (v == null || !v.contains('@')) ? l10n.validationEmail : null,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  TextFormField(
                    controller: _password,
                    obscureText: true,
                    textInputAction: TextInputAction.done,
                    autofillHints: const [AutofillHints.password],
                    decoration: InputDecoration(labelText: l10n.fieldPassword),
                    validator: (v) =>
                        (v == null || v.isEmpty) ? l10n.validationRequired : null,
                    onFieldSubmitted: (_) => _submit(),
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
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
