import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../cubit/staff_auth_cubit.dart';

/// TFA1 — the second sign-in step on the login screen: the code from the
/// authenticator app (or a recovery code); where the company requires it and
/// it is not on yet, adding the key to the app first; then the recovery codes.
class StaffTwoFactorPanel extends StatefulWidget {
  const StaffTwoFactorPanel({super.key});

  @override
  State<StaffTwoFactorPanel> createState() => _StaffTwoFactorPanelState();
}

class _StaffTwoFactorPanelState extends State<StaffTwoFactorPanel> {
  final _formKey = GlobalKey<FormState>();
  final _code = TextEditingController();
  bool _recovery = false;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  void _submit(StaffAuthState state) {
    if (_formKey.currentState?.validate() != true) return;
    FocusScope.of(context).unfocus();
    final cubit = context.read<StaffAuthCubit>();
    if (state.twoFactor?.setupRequired == true) {
      cubit.finishSetup(_code.text);
    } else {
      cubit.verifyCode(_code.text);
    }
  }

  Future<void> _copy(String text) async {
    final l10n = context.l10n;
    final messenger = ScaffoldMessenger.of(context);
    await Clipboard.setData(ClipboardData(text: text));
    messenger.showSnackBar(SnackBar(content: Text(l10n.staffTfaCopied)));
  }

  Future<void> _openApp(String url) async {
    final l10n = context.l10n;
    final messenger = ScaffoldMessenger.of(context);
    final opened = await ContactActions.openExternal(url);
    if (!opened) messenger.showSnackBar(SnackBar(content: Text(l10n.staffTfaNoApp)));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final colors = context.appColors;

    return BlocBuilder<StaffAuthCubit, StaffAuthState>(
      builder: (context, state) {
        final codes = state.recoveryCodes;
        if (codes != null) {
          return Column(
            key: const Key('staff-recovery-codes'),
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(l10n.staffTfaCodesTitle, style: text.titleMedium),
              const SizedBox(height: AppSpacing.sm),
              Text(l10n.staffTfaCodesHint, style: text.bodySmall?.copyWith(color: colors.inkMuted)),
              const SizedBox(height: AppSpacing.md),
              Container(
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: colors.surfaceSoft,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: colors.hairline),
                ),
                child: Directionality(
                  textDirection: TextDirection.ltr,
                  child: Wrap(
                    spacing: AppSpacing.lg,
                    runSpacing: AppSpacing.sm,
                    children: [
                      for (final c in codes)
                        Text(c, style: text.titleSmall?.copyWith(fontFamily: 'monospace')),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: TextButton.icon(
                  onPressed: () => _copy(codes.join('\n')),
                  icon: const Icon(Icons.copy_rounded, size: 18),
                  label: Text(l10n.staffTfaCopy),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              AppButton(
                label: l10n.staffTfaCodesContinue,
                icon: Icons.check_rounded,
                expand: true,
                onPressed: () => context.read<StaffAuthCubit>().acknowledgeRecoveryCodes(),
              ),
            ],
          );
        }

        final setupRequired = state.twoFactor?.setupRequired == true;
        final setup = state.setup;
        return Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(setupRequired ? l10n.staffTfaSetupTitle : l10n.staffTfaTitle, style: text.titleMedium),
              const SizedBox(height: AppSpacing.sm),
              Text(
                setupRequired ? l10n.staffTfaSetupHint : l10n.staffTfaCodeHint,
                style: text.bodySmall?.copyWith(color: colors.inkMuted),
              ),
              if (setupRequired && setup != null) ...[
                const SizedBox(height: AppSpacing.md),
                AppButton(
                  label: l10n.staffTfaOpenApp,
                  icon: Icons.open_in_new_rounded,
                  variant: AppButtonVariant.outline,
                  expand: true,
                  onPressed: () => _openApp(setup.otpauthUrl),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(l10n.staffTfaKeyLabel, style: text.labelMedium),
                const SizedBox(height: AppSpacing.xs),
                Row(
                  children: [
                    Expanded(
                      child: Directionality(
                        textDirection: TextDirection.ltr,
                        child: SelectableText(
                          setup.secret,
                          key: const Key('staff-totp-secret'),
                          style: text.titleSmall?.copyWith(fontFamily: 'monospace'),
                        ),
                      ),
                    ),
                    IconButton(
                      tooltip: l10n.staffTfaCopy,
                      onPressed: () => _copy(setup.secret),
                      icon: const Icon(Icons.copy_rounded),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: AppSpacing.md),
              AuthField(
                key: ValueKey(_recovery),
                controller: _code,
                label: _recovery ? l10n.staffTfaRecoveryLabel : l10n.staffTfaCodeLabel,
                icon: _recovery ? Icons.key_rounded : Icons.verified_user_outlined,
                keyboardType: _recovery ? TextInputType.text : TextInputType.number,
                textInputAction: TextInputAction.done,
                autofillHints: _recovery ? null : const [AutofillHints.oneTimeCode],
                onFieldSubmitted: (_) => _submit(state),
                validator: (v) {
                  final value = (v ?? '').trim();
                  if (_recovery) return value.length >= 8 ? null : l10n.validationRequired;
                  return RegExp(r'^\d{6}$').hasMatch(value) ? null : l10n.staffTfaInvalidFormat;
                },
              ),
              const SizedBox(height: AppSpacing.xl),
              AppButton(
                label: setupRequired ? l10n.staffTfaEnable : l10n.staffTfaVerify,
                icon: Icons.lock_open_rounded,
                expand: true,
                isLoading: state.isSubmitting,
                onPressed: state.isSubmitting || (setupRequired && setup == null) ? null : () => _submit(state),
              ),
              const SizedBox(height: AppSpacing.md),
              if (!setupRequired)
                AuthFooterLink(
                  text: _recovery ? l10n.staffTfaUseApp : l10n.staffTfaUseRecovery,
                  onTap: () => setState(() {
                    _recovery = !_recovery;
                    _code.clear();
                  }),
                ),
              AuthFooterLink(
                text: l10n.staffTfaBack,
                onTap: () => context.read<StaffAuthCubit>().cancelTwoFactor(),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// The message for a failure of the second step (null: not one of its own).
String? staffTwoFactorMessage(AppLocalizations l10n, AppFailure failure) => switch (failure.code) {
      'TWO_FACTOR_INVALID' => l10n.staffTfaWrongCode,
      'TWO_FACTOR_LOCKED' => l10n.staffTfaLocked,
      'CHALLENGE_EXPIRED' => l10n.staffTfaExpired,
      _ => null,
    };
