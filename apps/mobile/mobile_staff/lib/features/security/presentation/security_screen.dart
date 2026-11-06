import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../common/staff_list_skeleton.dart';
import '../../leads/presentation/follow_up_labels.dart';
import '../domain/security.dart';
import 'security_cubit.dart';

String deviceLabel(AppLocalizations l10n, DeviceSession s) {
  final browser = browserOf(s.userAgent);
  final os = switch (s.kind) {
    DeviceKind.iphone => l10n.securityDeviceIphone,
    DeviceKind.android => l10n.securityDeviceAndroid,
    DeviceKind.windows => 'Windows',
    DeviceKind.mac => 'Mac',
    DeviceKind.linux => 'Linux',
    DeviceKind.web => l10n.securityDeviceBrowser,
    DeviceKind.unknown => l10n.securityDeviceUnknown,
  };
  return browser == null ? os : l10n.securityBrowserOn(browser, os);
}

IconData deviceIcon(DeviceKind k) => switch (k) {
      DeviceKind.iphone || DeviceKind.android => Icons.smartphone_rounded,
      DeviceKind.windows || DeviceKind.mac || DeviceKind.linux => Icons.laptop_rounded,
      DeviceKind.web => Icons.language_rounded,
      DeviceKind.unknown => Icons.devices_other_rounded,
    };

/// SES1 / TFA1 — «الأمان»: the devices signed in to this account (sign one
/// or all the others out), two-step sign-in, and the password.
class SecurityScreen extends StatefulWidget {
  const SecurityScreen({super.key});

  @override
  State<SecurityScreen> createState() => _SecurityScreenState();
}

class _SecurityScreenState extends State<SecurityScreen> {
  @override
  void initState() {
    super.initState();
    context.read<SecurityCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<SecurityCubit>();
    return Scaffold(
      backgroundColor: context.appColors.canvas,
      body: Column(
        children: [
          HomeListHero(
            back: true,
            title: l10n.settingsSecurity,
          ),
          Expanded(
            child: BlocBuilder<SecurityCubit, SecurityState>(
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const StaffListSkeleton(rows: 3);
                  case DataStatus.failure:
                    return ErrorState(failure: state.failure, onRetry: cubit.load);
                  case DataStatus.empty:
                  case DataStatus.success:
                    return RefreshIndicator(
                      onRefresh: cubit.load,
                      child: ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: EdgeInsets.fromLTRB(
                          AppSpacing.md,
                          AppSpacing.md,
                          AppSpacing.md,
                          MediaQuery.paddingOf(context).bottom + 40,
                        ),
                        children: [
                          _DevicesCard(state: state),
                          if (state.twoFactor?.available == true) ...[
                            const SizedBox(height: AppSpacing.md),
                            _TwoFactorCard(status: state.twoFactor!, busy: state.busy),
                          ],
                          const SizedBox(height: AppSpacing.md),
                          const _PasswordCard(),
                        ],
                      ),
                    );
                }
              },
            ),
          ),
        ],
      ),
    );
  }
}

void _say(BuildContext context, String text) =>
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

Future<bool> _confirm(BuildContext context, {required String title, required String body, required String action, bool danger = false}) async {
  final l10n = context.l10n;
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: Text(body),
      actions: [
        TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: Text(l10n.actionCancel)),
        FilledButton(
          style: danger ? FilledButton.styleFrom(backgroundColor: context.appColors.error) : null,
          onPressed: () => Navigator.of(ctx).pop(true),
          child: Text(action),
        ),
      ],
    ),
  );
  return ok == true;
}

// ── Devices ───────────────────────────────────────────────────────────────────

class _DevicesCard extends StatelessWidget {
  const _DevicesCard({required this.state});
  final SecurityState state;

  Future<void> _signOut(BuildContext context, DeviceSession s) async {
    final l10n = context.l10n;
    if (!await _confirm(context,
        title: l10n.securitySignOutTitle, body: l10n.securitySignOutBody(deviceLabel(l10n, s)), action: l10n.securitySignOut, danger: true)) {
      return;
    }
    if (!context.mounted) return;
    final result = await context.read<SecurityCubit>().signOut(s.id);
    if (context.mounted) _say(context, result.failureOrNull?.userMessage(l10n) ?? l10n.securitySignedOut);
  }

  Future<void> _signOutOthers(BuildContext context) async {
    final l10n = context.l10n;
    if (!await _confirm(context,
        title: l10n.securitySignOutOthersTitle, body: l10n.securitySignOutOthersBody, action: l10n.securitySignOutOthers, danger: true)) {
      return;
    }
    if (!context.mounted) return;
    final result = await context.read<SecurityCubit>().signOutOthers();
    if (context.mounted) {
      _say(context, result.failureOrNull?.userMessage(l10n) ?? l10n.securitySignedOutOthers(latinDigits('${result.dataOrNull ?? 0}')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    return _Card(
      key: const Key('security-devices'),
      icon: Icons.devices_rounded,
      title: l10n.securityDevices,
      subtitle: l10n.securityDevicesHint,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < state.sessions.length; i++) ...[
            if (i > 0) Divider(height: 1, color: colors.hairline),
            Builder(builder: (context) {
              final s = state.sessions[i];
              final seen = s.lastSeenAt ?? s.createdAt;
              return Padding(
                key: ValueKey('session-${s.id}'),
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: Row(
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: (s.current ? colors.success : colors.inkMuted).withValues(alpha: 0.10),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(deviceIcon(s.kind), size: 19, color: s.current ? colors.success : colors.inkMuted),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  deviceLabel(l10n, s),
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: colors.inkStrong),
                                ),
                              ),
                              if (s.current) ...[
                                const SizedBox(width: 6),
                                StatusBadge(label: l10n.securityThisDevice, tone: BadgeTone.success),
                              ],
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            [
                              if (seen != null) l10n.securityLastSeen(followUpWhen(seen, l10n, lang)),
                              if (s.ip != null) '\u2066${s.ip}\u2069',
                            ].join(' · '),
                            style: TextStyle(fontSize: 12, color: colors.inkMuted),
                          ),
                        ],
                      ),
                    ),
                    if (!s.current)
                      TextButton(
                        key: ValueKey('session-out-${s.id}'),
                        onPressed: state.busy ? null : () => _signOut(context, s),
                        style: TextButton.styleFrom(foregroundColor: colors.error),
                        child: Text(l10n.securitySignOut),
                      ),
                  ],
                ),
              );
            }),
          ],
          if (state.otherDevices > 0) ...[
            const SizedBox(height: AppSpacing.xs),
            OutlinedButton.icon(
              key: const Key('security-sign-out-others'),
              onPressed: state.busy ? null : () => _signOutOthers(context),
              icon: const Icon(Icons.logout_rounded, size: 18),
              label: Text(l10n.securitySignOutOthers),
              style: OutlinedButton.styleFrom(
                foregroundColor: colors.error,
                side: BorderSide(color: colors.error.withValues(alpha: 0.4)),
                minimumSize: const Size.fromHeight(46),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.md)),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ── Two-step sign-in ─────────────────────────────────────────────────────────

class _TwoFactorCard extends StatelessWidget {
  const _TwoFactorCard({required this.status, required this.busy});
  final TwoFactorStatus status;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final on = status.enabled;
    return _Card(
      key: const Key('security-2fa'),
      icon: Icons.verified_user_rounded,
      title: l10n.staffTfaTitle,
      subtitle: l10n.securityTfaHint,
      trailing: StatusBadge(label: on ? l10n.securityOn : l10n.securityOff, tone: on ? BadgeTone.success : BadgeTone.neutral),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (status.required)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: Text(l10n.securityTfaRequired, style: TextStyle(fontSize: 12.5, color: colors.inkMuted)),
            ),
          if (on) ...[
            Text(
              l10n.securityRecoveryLeft(latinDigits('${status.recoveryCodesLeft}')),
              style: TextStyle(fontSize: 13, color: status.recoveryCodesLeft <= 2 ? colors.warning : colors.ink),
            ),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    key: const Key('security-new-codes'),
                    onPressed: busy ? null : () => _newCodes(context),
                    style: _outlined(context),
                    child: Text(l10n.securityNewCodes, textAlign: TextAlign.center),
                  ),
                ),
                if (!status.required) ...[
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: OutlinedButton(
                      key: const Key('security-2fa-off'),
                      onPressed: busy ? null : () => _turnOff(context),
                      style: _outlined(context, danger: true),
                      child: Text(l10n.securityTfaTurnOff),
                    ),
                  ),
                ],
              ],
            ),
          ] else
            _GoldButton(
              key: const Key('security-2fa-on'),
              label: l10n.securityTfaTurnOn,
              icon: Icons.shield_rounded,
              onTap: busy ? null : () => _turnOn(context),
            ),
        ],
      ),
    );
  }

  Future<void> _turnOn(BuildContext context) async {
    final l10n = context.l10n;
    final cubit = context.read<SecurityCubit>();
    final setup = await cubit.repo.setupTwoFactor();
    if (!context.mounted) return;
    final s = setup.dataOrNull;
    if (s == null) {
      _say(context, setup.failureOrNull!.userMessage(l10n));
      return;
    }
    final codes = await showModalBottomSheet<List<String>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => BlocProvider.value(value: cubit, child: _EnableSheet(setup: s)),
    );
    if (codes != null && context.mounted) {
      await cubit.load();
      if (context.mounted) await _showCodes(context, codes);
    }
  }

  Future<void> _turnOff(BuildContext context) async {
    final l10n = context.l10n;
    final cubit = context.read<SecurityCubit>();
    final done = await showDialog<bool>(
      context: context,
      builder: (_) => BlocProvider.value(
        value: cubit,
        child: _CodeDialog(
          title: l10n.securityTfaTurnOff,
          body: l10n.securityTfaOffBody,
          action: l10n.securityTfaTurnOff,
          askPassword: true,
          danger: true,
          submit: (code, password) => cubit.run((r) => r.disableTwoFactor(password: password!, code: code)),
        ),
      ),
    );
    if (done == true && context.mounted) _say(context, l10n.securityTfaOffDone);
  }

  Future<void> _newCodes(BuildContext context) async {
    final l10n = context.l10n;
    final cubit = context.read<SecurityCubit>();
    List<String>? codes;
    final done = await showDialog<bool>(
      context: context,
      builder: (_) => BlocProvider.value(
        value: cubit,
        child: _CodeDialog(
          title: l10n.securityNewCodes,
          body: l10n.securityNewCodesBody,
          action: l10n.securityNewCodes,
          submit: (code, _) async {
            final r = await cubit.run((repo) => repo.newRecoveryCodes(code));
            codes = r.dataOrNull;
            return r;
          },
        ),
      ),
    );
    if (done == true && codes != null && context.mounted) await _showCodes(context, codes!);
  }
}

ButtonStyle _outlined(BuildContext context, {bool danger = false}) {
  final c = context.appColors;
  return OutlinedButton.styleFrom(
    foregroundColor: danger ? c.error : c.inkStrong,
    side: BorderSide(color: danger ? c.error.withValues(alpha: 0.4) : c.hairline),
    minimumSize: const Size.fromHeight(46),
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.md)),
  );
}

/// The recovery codes, shown once.
Future<void> _showCodes(BuildContext context, List<String> codes) {
  final l10n = context.l10n;
  return showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (ctx) => AlertDialog(
      key: const Key('security-codes'),
      title: Text(l10n.staffTfaCodesTitle),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.staffTfaCodesHint, style: const TextStyle(fontSize: 13, height: 1.5)),
          const SizedBox(height: AppSpacing.sm),
          Container(
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(color: ctx.appColors.surfaceSoft, borderRadius: BorderRadius.circular(AppRadii.sm)),
            child: Directionality(
              textDirection: TextDirection.ltr,
              child: Wrap(
                spacing: AppSpacing.md,
                runSpacing: 6,
                children: [
                  for (final c in codes)
                    Text(c, style: const TextStyle(fontFamily: 'monospace', fontSize: 14, fontWeight: FontWeight.w700)),
                ],
              ),
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () async {
            await Clipboard.setData(ClipboardData(text: codes.join('\n')));
            if (ctx.mounted) _say(ctx, l10n.staffTfaCopied);
          },
          child: Text(l10n.staffTfaCopy),
        ),
        FilledButton(onPressed: () => Navigator.of(ctx).pop(), child: Text(l10n.staffTfaCodesContinue)),
      ],
    ),
  );
}

/// Step 1: add the key to the authenticator app; step 2: type its code.
class _EnableSheet extends StatefulWidget {
  const _EnableSheet({required this.setup});
  final TwoFactorSetup setup;

  @override
  State<_EnableSheet> createState() => _EnableSheetState();
}

class _EnableSheetState extends State<_EnableSheet> {
  final _code = TextEditingController();
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _enable() async {
    final l10n = context.l10n;
    final code = latinDigits(_code.text).replaceAll(RegExp(r'\s'), '');
    if (!RegExp(r'^\d{6}$').hasMatch(code)) {
      setState(() => _error = l10n.staffTfaInvalidFormat);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final result = await context.read<SecurityCubit>().repo.enableTwoFactor(code);
    if (!mounted) return;
    final codes = result.dataOrNull;
    if (codes != null) {
      Navigator.of(context).pop(codes);
      return;
    }
    setState(() {
      _busy = false;
      _error = result.failureOrNull?.code == 'TWO_FACTOR_INVALID' ? l10n.staffTfaWrongCode : result.failureOrNull?.userMessage(l10n);
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final c = context.appColors;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Container(
        key: const Key('security-enable-sheet'),
        decoration: BoxDecoration(color: c.surface, borderRadius: AppRadii.sheet),
        padding: EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.lg + MediaQuery.paddingOf(context).bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l10n.securityTfaTurnOn, style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: c.inkStrong)),
            const SizedBox(height: AppSpacing.xs),
            Text(l10n.securityTfaSetupHint, style: TextStyle(fontSize: 13, height: 1.6, color: c.inkMuted)),
            const SizedBox(height: AppSpacing.md),
            OutlinedButton.icon(
              onPressed: () async {
                final opened = await ContactActions.openExternal(widget.setup.otpauthUrl);
                if (!opened && context.mounted) _say(context, l10n.staffTfaNoApp);
              },
              icon: const Icon(Icons.open_in_new_rounded, size: 18),
              label: Text(l10n.staffTfaOpenApp),
              style: _outlined(context),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(l10n.staffTfaKeyLabel, style: TextStyle(fontSize: 12, color: c.inkMuted)),
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: c.surfaceSoft,
                borderRadius: BorderRadius.circular(AppRadii.sm),
                border: Border.all(color: c.hairline),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Directionality(
                      textDirection: TextDirection.ltr,
                      child: SelectableText(
                        widget.setup.secret,
                        key: const Key('security-secret'),
                        style: const TextStyle(fontFamily: 'monospace', fontSize: 13.5, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: l10n.staffTfaCopy,
                    icon: const Icon(Icons.copy_rounded, size: 18),
                    onPressed: () async {
                      await Clipboard.setData(ClipboardData(text: widget.setup.secret));
                      if (context.mounted) _say(context, l10n.staffTfaCopied);
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            TextField(
              key: const Key('security-enable-code'),
              controller: _code,
              keyboardType: TextInputType.number,
              maxLength: 7,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 20, letterSpacing: 6, fontWeight: FontWeight.w700),
              decoration: InputDecoration(
                labelText: l10n.staffTfaCodeLabel,
                counterText: '',
                errorText: _error,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppRadii.md)),
              ),
              onSubmitted: (_) => _enable(),
            ),
            const SizedBox(height: AppSpacing.md),
            _GoldButton(
              key: const Key('security-enable-submit'),
              label: l10n.staffTfaEnable,
              icon: Icons.check_rounded,
              busy: _busy,
              onTap: _busy ? null : _enable,
            ),
          ],
        ),
      ),
    );
  }
}

/// A code from the app (and, to turn it off, the password).
class _CodeDialog extends StatefulWidget {
  const _CodeDialog({
    required this.title,
    required this.body,
    required this.action,
    required this.submit,
    this.askPassword = false,
    this.danger = false,
  });
  final String title;
  final String body;
  final String action;
  final bool askPassword;
  final bool danger;
  final Future<Result<Object?>> Function(String code, String? password) submit;

  @override
  State<_CodeDialog> createState() => _CodeDialogState();
}

class _CodeDialogState extends State<_CodeDialog> {
  final _code = TextEditingController();
  final _password = TextEditingController();
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _code.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _go() async {
    final l10n = context.l10n;
    final code = latinDigits(_code.text).replaceAll(RegExp(r'\s'), '');
    if (code.length < 6 || (widget.askPassword && _password.text.isEmpty)) {
      setState(() => _error = l10n.staffTfaInvalidFormat);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final result = await widget.submit(code, widget.askPassword ? _password.text : null);
    if (!mounted) return;
    final f = result.failureOrNull;
    if (f == null) {
      Navigator.of(context).pop(true);
      return;
    }
    setState(() {
      _busy = false;
      _error = f.code == 'TWO_FACTOR_INVALID'
          ? l10n.staffTfaWrongCode
          : f.code == 'TWO_FACTOR_LOCKED'
              ? l10n.staffTfaLocked
              : f.userMessage(l10n);
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AlertDialog(
      title: Text(widget.title),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(widget.body, style: const TextStyle(fontSize: 13, height: 1.5)),
          if (widget.askPassword) ...[
            const SizedBox(height: AppSpacing.sm),
            TextField(
              key: const Key('security-dialog-password'),
              controller: _password,
              obscureText: true,
              decoration: InputDecoration(labelText: l10n.securityCurrentPassword),
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          TextField(
            key: const Key('security-dialog-code'),
            controller: _code,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(labelText: l10n.staffTfaCodeLabel, errorText: _error),
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: _busy ? null : () => Navigator.of(context).pop(false), child: Text(l10n.actionCancel)),
        FilledButton(
          key: const Key('security-dialog-submit'),
          style: widget.danger ? FilledButton.styleFrom(backgroundColor: context.appColors.error) : null,
          onPressed: _busy ? null : _go,
          child: Text(widget.action),
        ),
      ],
    );
  }
}

// ── Password ──────────────────────────────────────────────────────────────────

class _PasswordCard extends StatelessWidget {
  const _PasswordCard();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return _Card(
      key: const Key('security-password'),
      icon: Icons.password_rounded,
      title: l10n.fieldPassword,
      subtitle: l10n.securityPasswordHint,
      child: OutlinedButton(
        key: const Key('security-change-password'),
        onPressed: () async {
          final cubit = context.read<SecurityCubit>();
          final done = await showModalBottomSheet<bool>(
            context: context,
            isScrollControlled: true,
            backgroundColor: Colors.transparent,
            builder: (_) => BlocProvider.value(value: cubit, child: const _PasswordSheet()),
          );
          if (done == true && context.mounted) {
            await cubit.load();
            if (context.mounted) _say(context, l10n.securityPasswordChanged);
          }
        },
        style: _outlined(context),
        child: Text(l10n.securityChangePassword),
      ),
    );
  }
}

class _PasswordSheet extends StatefulWidget {
  const _PasswordSheet();

  @override
  State<_PasswordSheet> createState() => _PasswordSheetState();
}

class _PasswordSheetState extends State<_PasswordSheet> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _again = TextEditingController();
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _again.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final l10n = context.l10n;
    if (_current.text.isEmpty) {
      setState(() => _error = l10n.securityCurrentPassword);
      return;
    }
    if (_next.text.length < 8) {
      setState(() => _error = l10n.validationPasswordShort);
      return;
    }
    if (_next.text != _again.text) {
      setState(() => _error = l10n.securityPasswordMismatch);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final result = await context.read<SecurityCubit>().repo.changePassword(current: _current.text, next: _next.text);
    if (!mounted) return;
    final f = result.failureOrNull;
    if (f == null) {
      Navigator.of(context).pop(true);
      return;
    }
    setState(() {
      _busy = false;
      _error = f.userMessage(l10n);
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final c = context.appColors;
    InputDecoration deco(String label) =>
        InputDecoration(labelText: label, border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppRadii.md)));
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Container(
        decoration: BoxDecoration(color: c.surface, borderRadius: AppRadii.sheet),
        padding: EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.lg + MediaQuery.paddingOf(context).bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l10n.securityChangePassword, style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: c.inkStrong)),
            const SizedBox(height: AppSpacing.md),
            TextField(key: const Key('pw-current'), controller: _current, obscureText: true, decoration: deco(l10n.securityCurrentPassword)),
            const SizedBox(height: AppSpacing.sm),
            TextField(key: const Key('pw-next'), controller: _next, obscureText: true, decoration: deco(l10n.authNewPassword)),
            const SizedBox(height: AppSpacing.sm),
            TextField(key: const Key('pw-again'), controller: _again, obscureText: true, decoration: deco(l10n.securityPasswordAgain)),
            if (_error != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(_error!, key: const Key('pw-error'), style: TextStyle(fontSize: 12.5, color: c.error)),
            ],
            const SizedBox(height: AppSpacing.md),
            _GoldButton(
              key: const Key('pw-save'),
              label: l10n.securityChangePassword,
              icon: Icons.check_rounded,
              busy: _busy,
              onTap: _busy ? null : _save,
            ),
          ],
        ),
      ),
    );
  }
}

// ── Pieces ────────────────────────────────────────────────────────────────────

class _Card extends StatelessWidget {
  const _Card({super.key, required this.icon, required this.title, required this.child, this.subtitle, this.trailing});
  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final c = context.appColors;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: homeCard(context, radius: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(color: AppPalette.gold50, borderRadius: BorderRadius.circular(12)),
                child: Icon(icon, size: 19, color: AppPalette.gold600),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: c.inkStrong)),
                    if (subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(subtitle!, style: TextStyle(fontSize: 12.5, height: 1.5, color: c.inkMuted)),
                    ],
                  ],
                ),
              ),
              ?trailing,
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          child,
        ],
      ),
    );
  }
}

class _GoldButton extends StatelessWidget {
  const _GoldButton({super.key, required this.label, required this.icon, this.onTap, this.busy = false});
  final String label;
  final IconData icon;
  final VoidCallback? onTap;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: onTap == null && !busy ? 0.5 : 1,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppRadii.md),
          child: Ink(
            height: 46,
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [AppPalette.gold600, AppPalette.gold400]),
              borderRadius: BorderRadius.circular(AppRadii.md),
            ),
            child: Center(
              child: busy
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(icon, size: 17, color: Colors.white),
                        const SizedBox(width: 6),
                        Text(label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14)),
                      ],
                    ),
            ),
          ),
        ),
      ),
    );
  }
}
