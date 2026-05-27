import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../domain/repositories/auth_repository.dart';
import 'auth_cubit.dart';
import 'auth_state.dart';
import 'auth_validators.dart';

/// Customer registration (email + password).
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _fullName = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _acceptTerms = false;
  bool _termsError = false;

  @override
  void dispose() {
    _fullName.dispose();
    _phone.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  void _submit() {
    final formOk = _formKey.currentState?.validate() ?? false;
    setState(() => _termsError = !_acceptTerms);
    if (!formOk || !_acceptTerms) return;
    context.read<AuthCubit>().register(RegisterParams(
          fullName: _fullName.text.trim(),
          phone: _phone.text.trim(),
          email: _email.text.trim(),
          password: _password.text,
        ));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final v = AuthValidators(l10n);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.authCreateAccount)),
      body: BlocConsumer<AuthCubit, AuthState>(
        listenWhen: (a, b) => a.failure != b.failure && b.failure != null,
        listener: (context, state) => showFailureSnackBar(context, state.failure!),
        builder: (context, state) {
          return SafeArea(
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              children: [
                Form(
                  key: _formKey,
                  child: Column(
                    children: [
                      TextFormField(
                        controller: _fullName,
                        textInputAction: TextInputAction.next,
                        decoration: InputDecoration(labelText: l10n.fieldFullName),
                        validator: v.required,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      TextFormField(
                        controller: _phone,
                        keyboardType: TextInputType.phone,
                        textInputAction: TextInputAction.next,
                        decoration: InputDecoration(labelText: l10n.fieldPhone),
                        validator: v.phone,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      TextFormField(
                        controller: _email,
                        keyboardType: TextInputType.emailAddress,
                        textInputAction: TextInputAction.next,
                        decoration: InputDecoration(labelText: l10n.fieldEmail),
                        validator: v.email,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      TextFormField(
                        controller: _password,
                        obscureText: true,
                        decoration: InputDecoration(labelText: l10n.fieldPassword),
                        validator: v.password,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                CheckboxListTile(
                  value: _acceptTerms,
                  onChanged: (val) =>
                      setState(() => _acceptTerms = val ?? false),
                  title: Text(l10n.authAcceptTerms,
                      style: Theme.of(context).textTheme.bodyMedium),
                  controlAffinity: ListTileControlAffinity.leading,
                  contentPadding: EdgeInsets.zero,
                  subtitle: _termsError
                      ? Text(l10n.validationAcceptTerms,
                          style: TextStyle(color: context.appColors.error))
                      : null,
                ),
                const SizedBox(height: AppSpacing.lg),
                AppButton(
                  label: l10n.actionRegister,
                  expand: true,
                  isLoading: state.isSubmitting,
                  onPressed: _submit,
                ),
                const SizedBox(height: AppSpacing.md),
                Center(
                  child: TextButton(
                    onPressed: () => context.pop(),
                    child: Text(l10n.authHaveAccountCta),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
