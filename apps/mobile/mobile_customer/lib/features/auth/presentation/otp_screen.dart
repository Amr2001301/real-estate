import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../router/auth_navigation.dart';
import 'auth_cubit.dart';
import 'auth_state.dart';
import 'auth_validators.dart';

/// Phone (OTP) login/register: request a code, then verify it.
class OtpScreen extends StatefulWidget {
  const OtpScreen({super.key});

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  final _phone = TextEditingController();
  final _code = TextEditingController();
  final _fullName = TextEditingController();
  String? _phoneError;
  String? _codeError;

  @override
  void dispose() {
    _phone.dispose();
    _code.dispose();
    _fullName.dispose();
    super.dispose();
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
          final sent = state.status == AuthStatus.otpSent ||
              (state.otpPhone != null && state.status != AuthStatus.idle);
          return ListView(
            padding: EdgeInsets.zero,
            children: [
              AuthHeader(
                title: l10n.authLoginWithPhone,
                subtitle: l10n.authPhoneSubtitle,
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
                    AuthCard(
                      child: Column(
                        children: [
                          AuthField(
                            controller: _phone,
                            label: l10n.fieldPhone,
                            icon: Icons.phone_outlined,
                            enabled: !sent,
                            keyboardType: TextInputType.phone,
                            errorText: _phoneError,
                          ),
                          if (sent) ...[
                            const SizedBox(height: AppSpacing.sm),
                            // Confirmation that the code was sent.
                            Row(
                              children: [
                                Icon(Icons.mark_email_read_outlined,
                                    size: 16,
                                    color: context.appColors.brandGold),
                                const SizedBox(width: AppSpacing.xs),
                                Expanded(
                                  child: Text(
                                    l10n.authOtpSentTo(
                                        state.otpPhone ?? _phone.text.trim()),
                                    style: Theme.of(context)
                                        .textTheme
                                        .bodySmall
                                        ?.copyWith(
                                          color: context.appColors.inkMuted,
                                        ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: AppSpacing.md),
                            AuthField(
                              controller: _fullName,
                              label:
                                  '${l10n.fieldFullName} (${l10n.filterAny})',
                              icon: Icons.person_outline_rounded,
                            ),
                            const SizedBox(height: AppSpacing.md),
                            AuthField(
                              controller: _code,
                              label: l10n.fieldOtpCode,
                              icon: Icons.password_rounded,
                              keyboardType: TextInputType.number,
                              errorText: _codeError,
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xl),
                    if (!sent)
                      AppButton(
                        label: l10n.authSendCode,
                        icon: Icons.sms_outlined,
                        variant: AppButtonVariant.gold,
                        expand: true,
                        isLoading: state.isSubmitting,
                        onPressed: () {
                          final err = v.phone(_phone.text);
                          setState(() => _phoneError = err);
                          if (err == null) {
                            context
                                .read<AuthCubit>()
                                .requestOtp(_phone.text.trim());
                          }
                        },
                      )
                    else
                      AppButton(
                        label: l10n.authVerifyCode,
                        icon: Icons.verified_outlined,
                        variant: AppButtonVariant.gold,
                        expand: true,
                        isLoading: state.isSubmitting,
                        onPressed: () {
                          final err = v.code(_code.text);
                          setState(() => _codeError = err);
                          if (err == null) {
                            context.read<AuthCubit>().verifyOtp(
                                  _code.text.trim(),
                                  fullName: _fullName.text.trim().isEmpty
                                      ? null
                                      : _fullName.text.trim(),
                                );
                          }
                        },
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
