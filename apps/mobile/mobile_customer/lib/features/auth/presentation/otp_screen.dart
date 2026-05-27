import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

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
          final sent = state.status == AuthStatus.otpSent ||
              (state.otpPhone != null && state.status != AuthStatus.idle);
          return SafeArea(
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              children: [
                const SizedBox(height: AppSpacing.lg),
                Text(l10n.authLoginWithPhone,
                    style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: AppSpacing.xl),
                TextField(
                  controller: _phone,
                  enabled: !sent,
                  keyboardType: TextInputType.phone,
                  decoration: InputDecoration(
                    labelText: l10n.fieldPhone,
                    errorText: _phoneError,
                  ),
                ),
                if (!sent) ...[
                  const SizedBox(height: AppSpacing.xl),
                  AppButton(
                    label: l10n.authSendCode,
                    expand: true,
                    isLoading: state.isSubmitting,
                    onPressed: () {
                      final err = v.phone(_phone.text);
                      setState(() => _phoneError = err);
                      if (err == null) {
                        context.read<AuthCubit>().requestOtp(_phone.text.trim());
                      }
                    },
                  ),
                ] else ...[
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    l10n.authOtpSentTo(state.otpPhone ?? _phone.text.trim()),
                    style: Theme.of(context)
                        .textTheme
                        .bodyMedium
                        ?.copyWith(color: context.appColors.inkMuted),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  TextField(
                    controller: _fullName,
                    decoration: InputDecoration(
                      labelText: '${l10n.fieldFullName} (${l10n.filterAny})',
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  TextField(
                    controller: _code,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: l10n.fieldOtpCode,
                      errorText: _codeError,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  AppButton(
                    label: l10n.authVerifyCode,
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
              ],
            ),
          );
        },
      ),
    );
  }
}
