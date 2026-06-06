import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../router/auth_navigation.dart';
import 'auth_cubit.dart';
import 'auth_state.dart';
import 'auth_validators.dart';
import 'widgets/auth_widgets.dart';

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

  void _back() => context.canPop() ? context.pop() : context.go('/home');

  /// Auth screens are opened with `push`, so the router's redirect guard (which
  /// keys off `matchedLocation`, still the underlying route) can't move an
  /// authenticated user off them. Navigate ourselves: back to the route the
  /// user came from (`?redirect=`) or `/account` as a safe fallback.
  void _onAuthState(BuildContext context, AuthState state) {
    if (state.status == AuthStatus.success) {
      context.goPostAuth();
    } else if (state.failure != null) {
      showFailureSnackBar(context, state.failure!);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final v = AuthValidators(l10n);

    return Scaffold(
      backgroundColor: context.appColors.canvas,
      body: BlocConsumer<AuthCubit, AuthState>(
        listenWhen: (a, b) =>
            (a.failure != b.failure && b.failure != null) ||
            (a.status != b.status && b.status == AuthStatus.success),
        listener: _onAuthState,
        builder: (context, state) {
          return ListView(
            padding: EdgeInsets.zero,
            children: [
              AuthHeader(
                title: l10n.authWelcomeBack,
                subtitle: l10n.authLoginSubtitle,
                onBack: _back,
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
                      key: _formKey,
                      child: AuthCard(
                        child: Column(
                          children: [
                            AuthField(
                              controller: _email,
                              label: l10n.fieldEmail,
                              icon: Icons.alternate_email_rounded,
                              keyboardType: TextInputType.emailAddress,
                              textInputAction: TextInputAction.next,
                              validator: v.email,
                            ),
                            const SizedBox(height: AppSpacing.md),
                            AuthPasswordField(
                              controller: _password,
                              label: l10n.fieldPassword,
                              textInputAction: TextInputAction.done,
                              validator: v.password,
                              onFieldSubmitted: (_) => _submit(),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xl),
                    AppButton(
                      label: l10n.actionLogin,
                      icon: Icons.login_rounded,
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
                      onPressed: () => context.pushAuthRoute('/login/otp'),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    AuthFooterLink(
                      text: l10n.authNoAccountCta,
                      onTap: () => context.pushAuthRoute('/register'),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
