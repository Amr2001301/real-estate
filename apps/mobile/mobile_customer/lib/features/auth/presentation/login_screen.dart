import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import 'auth_cubit.dart';
import 'auth_state.dart';
import 'auth_validators.dart';

/// Customer email/password login. Links to register and phone (OTP) login.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
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
    if (_formKey.currentState?.validate() ?? false) {
      context.read<AuthCubit>().loginEmail(_email.text.trim(), _password.text);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final v = AuthValidators(l10n);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.actionLogin)),
      body: BlocConsumer<AuthCubit, AuthState>(
        listenWhen: (a, b) => a.failure != b.failure && b.failure != null,
        listener: (context, state) => showFailureSnackBar(context, state.failure!),
        builder: (context, state) {
          return SafeArea(
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              children: [
                const SizedBox(height: AppSpacing.lg),
                Text(l10n.authWelcomeBack,
                    style: Theme.of(context).textTheme.headlineMedium),
                const SizedBox(height: AppSpacing.xl),
                Form(
                  key: _formKey,
                  child: Column(
                    children: [
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
                        textInputAction: TextInputAction.done,
                        decoration: InputDecoration(labelText: l10n.fieldPassword),
                        validator: v.password,
                        onFieldSubmitted: (_) => _submit(),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.xl),
                AppButton(
                  label: l10n.actionLogin,
                  expand: true,
                  isLoading: state.isSubmitting,
                  onPressed: _submit,
                ),
                const SizedBox(height: AppSpacing.sm),
                AppButton(
                  label: l10n.authLoginWithPhone,
                  icon: Icons.phone_android_rounded,
                  variant: AppButtonVariant.outline,
                  expand: true,
                  onPressed: () => context.push('/login/otp'),
                ),
                const SizedBox(height: AppSpacing.lg),
                Center(
                  child: TextButton(
                    onPressed: () => context.push('/register'),
                    child: Text(l10n.authNoAccountCta),
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
