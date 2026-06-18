import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../router/auth_navigation.dart';
import '../domain/repositories/auth_repository.dart';
import 'auth_cubit.dart';
import 'auth_state.dart';
import 'auth_validators.dart';
import 'widgets/auth_widgets.dart';

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

  void _back() => context.canPop() ? context.pop() : context.go('/home');

  /// Auth screens are opened with `push`, so the router's redirect guard can't
  /// move an authenticated user off them. Navigate to the route the user came
  /// from (`?redirect=`) or `/account` as a safe fallback.
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
                title: l10n.authCreateAccount,
                subtitle: l10n.authRegisterSubtitle,
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
                              controller: _fullName,
                              label: l10n.fieldFullName,
                              icon: Icons.person_outline_rounded,
                              textInputAction: TextInputAction.next,
                              validator: v.required,
                            ),
                            const SizedBox(height: AppSpacing.md),
                            AuthField(
                              controller: _phone,
                              label: l10n.fieldPhone,
                              icon: Icons.phone_outlined,
                              keyboardType: TextInputType.phone,
                              textInputAction: TextInputAction.next,
                              validator: v.phone,
                            ),
                            const SizedBox(height: AppSpacing.md),
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
                    const SizedBox(height: AppSpacing.md),
                    _TermsRow(
                      value: _acceptTerms,
                      error: _termsError,
                      label: l10n.authAcceptTerms,
                      errorText: l10n.validationAcceptTerms,
                      onChanged: (val) => setState(() {
                        _acceptTerms = val;
                        if (val) _termsError = false;
                      }),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    AppButton(
                      label: l10n.actionRegister,
                      icon: Icons.person_add_alt_1_rounded,
                      variant: AppButtonVariant.gold,
                      expand: true,
                      isLoading: state.isSubmitting,
                      onPressed: _submit,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    AuthFooterLink(
                      text: l10n.authHaveAccountCta,
                      onTap: _back,
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

/// A premium terms checkbox row with an inline error.
class _TermsRow extends StatelessWidget {
  const _TermsRow({
    required this.value,
    required this.error,
    required this.label,
    required this.errorText,
    required this.onChanged,
  });

  final bool value;
  final bool error;
  final String label;
  final String errorText;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        InkWell(
          onTap: () => onChanged(!value),
          borderRadius: BorderRadius.circular(AppRadii.md),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
            child: Row(
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    color: value ? colors.brandGold : Colors.transparent,
                    borderRadius: BorderRadius.circular(AppRadii.xs),
                    border: Border.all(
                      color: value
                          ? colors.brandGold
                          : (error ? colors.error : colors.hairline),
                      width: 1.5,
                    ),
                  ),
                  child: value
                      ? Icon(Icons.check_rounded,
                          size: 16, color: colors.brandNavy)
                      : null,
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    label,
                    style: theme.textTheme.bodyMedium
                        ?.copyWith(color: colors.inkStrong),
                  ),
                ),
              ],
            ),
          ),
        ),
        if (error)
          Padding(
            padding: const EdgeInsetsDirectional.only(start: 32, top: 2),
            child: Text(
              errorText,
              style: theme.textTheme.labelSmall?.copyWith(color: colors.error),
            ),
          ),
      ],
    );
  }
}
