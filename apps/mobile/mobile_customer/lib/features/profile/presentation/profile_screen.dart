import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../domain/entities/user_profile.dart';
import '../domain/repositories/profile_repository.dart';
import '../../auth/presentation/auth_cubit.dart';
import 'profile_cubit.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyLight = Color(0xFF243F62);

// ─────────────────────────────────────────────────────────────────────────────
// Profile Screen
// ─────────────────────────────────────────────────────────────────────────────

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _editing = false;
  final _formKey = GlobalKey<FormState>();
  final _fullName = TextEditingController();
  final _phone = TextEditingController();
  String? _locale;

  @override
  void dispose() {
    _fullName.dispose();
    _phone.dispose();
    super.dispose();
  }

  void _startEditing(UserProfile p) {
    _fullName.text = p.fullName ?? '';
    _phone.text = p.phone ?? '';
    _locale = p.locale ?? 'ar';
    setState(() => _editing = true);
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final l10n = context.l10n;
    final cubit = context.read<ProfileCubit>();
    final newPhone = _phone.text.trim();
    // A new number is changed only with the code sent to it (below), never by
    // the profile save itself.
    final phoneChanged = newPhone.isNotEmpty && newPhone != (cubit.state.profile?.phone ?? '');
    final failure = await cubit.save(
      UpdateProfileParams(fullName: _fullName.text.trim(), locale: _locale),
    );
    if (!mounted) return;
    if (failure != null) {
      showFailureSnackBar(context, failure);
      return;
    }
    setState(() => _editing = false);
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(l10n.profileSaved)));
    if (phoneChanged) await _changePhone(cubit, newPhone);
  }

  /// Sends a code to [phone] and asks for it; the number changes only then.
  Future<void> _changePhone(ProfileCubit cubit, String phone) async {
    final sendFailure = await cubit.requestPhoneChange(phone);
    if (!mounted) return;
    if (sendFailure != null) {
      showFailureSnackBar(context, sendFailure);
      return;
    }
    final code = await showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _PhoneCodeDialog(phone: phone),
    );
    if (code == null || !mounted) return;
    final confirmFailure = await cubit.confirmPhoneChange(code);
    if (!mounted) return;
    if (confirmFailure != null) {
      showFailureSnackBar(context, confirmFailure);
    } else {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(context.l10n.phoneChanged)));
    }
  }

  /// "Delete my account": confirmed, then the account is deleted and the
  /// customer signed out. A live contract is refused with its reason.
  Future<void> _deleteAccount() async {
    final l10n = context.l10n;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.profileDeleteAccountTitle),
        content: Text(l10n.profileDeleteAccountBody),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: Text(l10n.actionCancel)),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: TextButton.styleFrom(foregroundColor: Theme.of(ctx).colorScheme.error),
            child: Text(l10n.profileDeleteAccountConfirm),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    final authCubit = context.read<AuthCubit>();
    final failure = await context.read<ProfileCubit>().deleteAccount();
    if (!mounted) return;
    if (failure != null) {
      showFailureSnackBar(context, failure);
      return;
    }
    await authCubit.logout();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      backgroundColor: context.appColors.canvas,
      body: Column(
        children: [
          AppNavHeader(title: l10n.profileTitle, compact: true, leadingAction: const NavHeaderBack()),
          Expanded(
            child: BlocBuilder<ProfileCubit, ProfileState>(
        builder: (context, state) {
          switch (state.status) {
            case DataStatus.initial:
            case DataStatus.loading:
              return const Center(child: CircularProgressIndicator());
            case DataStatus.failure:
              return ErrorState(
                failure: state.failure,
                onRetry: () => context.read<ProfileCubit>().load(),
              );
            case DataStatus.empty:
            case DataStatus.success:
              final p = state.profile;
              if (p == null) return const EmptyState();
              return _editing
                  ? _buildEdit(context, state, p)
                  : _buildView(context, p, l10n);
          }
        },
      ),
          ),
        ],
      ),
    );
  }

  // ── View mode ───────────────────────────────────────────────────────────────

  Widget _buildView(BuildContext context, UserProfile p, AppLocalizations l10n) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    final fields = [
      _Field(l10n.fieldFullName, p.fullName ?? '—', Icons.person_rounded),
      _Field(l10n.fieldEmail, p.email ?? '—', Icons.mail_rounded),
      _Field(l10n.fieldPhone, p.phone != null ? ltr(p.phone) : '—', Icons.phone_rounded),
      _Field(l10n.fieldLanguage, p.locale == 'en' ? 'English' : 'العربية', Icons.language_rounded),
    ];

    return ListView(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.md,
        110 + MediaQuery.paddingOf(context).bottom,
      ),
      children: [
        // Profile identity hero
        _ProfileHero(profile: p, l10n: l10n),
        const SizedBox(height: AppSpacing.xl),

        // Fields card
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          decoration: homeCard(context, radius: 22),
          child: Column(
            children: [
              for (var i = 0; i < fields.length; i++) ...[
                if (i > 0) Divider(height: 1, color: colors.hairline),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Row(children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: AppPalette.gold50,
                        border: Border.all(color: AppPalette.gold100),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(fields[i].icon, size: 18, color: AppPalette.gold500),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(fields[i].label, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                        const SizedBox(height: 2),
                        Text(fields[i].value, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                      ]),
                    ),
                  ]),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.xl),

        // Edit button
        GestureDetector(
          onTap: () => _startEditing(p),
          child: Container(
            height: 52,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [_navyLight, _navyDeep],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: _navyDeep.withValues(alpha: 0.3),
                  blurRadius: 16,
                  offset: const Offset(0, 5),
                ),
              ],
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  Icons.edit_outlined,
                  color: AppPalette.gold300,
                  size: 18,
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  l10n.profileEdit,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        Center(
          child: TextButton.icon(
            onPressed: _deleteAccount,
            icon: const Icon(Icons.delete_outline, size: 18),
            label: Text(l10n.profileDeleteAccount),
            style: TextButton.styleFrom(foregroundColor: theme.colorScheme.error),
          ),
        ),
      ],
    );
  }

  // ── Edit mode ───────────────────────────────────────────────────────────────

  Widget _buildEdit(
    BuildContext context,
    ProfileState state,
    UserProfile p,
  ) {
    final l10n = context.l10n;
    final colors = context.appColors;

    return ListView(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.xl + MediaQuery.paddingOf(context).bottom,
      ),
      children: [
        Form(
          key: _formKey,
          child: Container(
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: colors.hairline.withValues(alpha: 0.5)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.06),
                  blurRadius: 16,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              children: [
                TextFormField(
                  controller: _fullName,
                  decoration: InputDecoration(labelText: l10n.fieldFullName),
                  validator: (v) =>
                      (v == null || v.trim().isEmpty)
                          ? l10n.validationRequired
                          : null,
                ),
                const SizedBox(height: AppSpacing.md),
                TextFormField(
                  controller: _phone,
                  keyboardType: TextInputType.phone,
                  textDirection: TextDirection.ltr,
                  textAlign: Directionality.of(context) == TextDirection.rtl ? TextAlign.right : TextAlign.left,
                  decoration: InputDecoration(labelText: l10n.fieldPhone),
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) {
                      return l10n.validationRequired;
                    }
                    return RegExp(r'^\+?[1-9]\d{7,14}$').hasMatch(v.trim())
                        ? null
                        : l10n.validationPhone;
                  },
                ),
                const SizedBox(height: AppSpacing.md),
                DropdownButtonFormField<String>(
                  initialValue: _locale,
                  decoration: InputDecoration(labelText: l10n.fieldLanguage),
                  items: const [
                    DropdownMenuItem(value: 'ar', child: Text('العربية')),
                    DropdownMenuItem(value: 'en', child: Text('English')),
                  ],
                  onChanged: (v) => setState(() => _locale = v),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.xl),
        AppButton(
          label: l10n.actionSave,
          expand: true,
          isLoading: state.saving,
          onPressed: _save,
        ),
        const SizedBox(height: AppSpacing.sm),
        AppButton(
          label: l10n.actionCancel,
          variant: AppButtonVariant.ghost,
          expand: true,
          onPressed: () => setState(() => _editing = false),
        ),
      ],
    );
  }
}

// ── Profile hero ─────────────────────────────────────────────────────────────

class _ProfileHero extends StatelessWidget {
  const _ProfileHero({required this.profile, required this.l10n});
  final UserProfile profile;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: homeCard(context, radius: 24),
      child: Row(children: [
        Container(
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: AppPalette.gold400.withValues(alpha: 0.7), width: 2)),
          child: GradientAvatar(name: profile.fullName ?? profile.email, size: 64),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(profile.fullName ?? profile.email ?? '—', maxLines: 1, overflow: TextOverflow.ellipsis, style: homeDisplay(19, colors.inkStrong)),
            const SizedBox(height: 6),
            CatalogBadge.gold(l10n.accountRoleCustomer, icon: Icons.verified_rounded),
          ]),
        ),
      ]),
    );
  }
}

class _Field {
  const _Field(this.label, this.value, this.icon);
  final IconData icon;
  final String label;
  final String value;
}

// ── Premium app bar ───────────────────────────────────────────────────────────

// ── Dot texture ───────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// The code sent to a new phone number
// ─────────────────────────────────────────────────────────────────────────────

class _PhoneCodeDialog extends StatefulWidget {
  const _PhoneCodeDialog({required this.phone});
  final String phone;

  @override
  State<_PhoneCodeDialog> createState() => _PhoneCodeDialogState();
}

class _PhoneCodeDialogState extends State<_PhoneCodeDialog> {
  final _code = TextEditingController();

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AlertDialog(
      title: Text(l10n.phoneChangeTitle),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.authOtpSentTo(widget.phone)),
          const SizedBox(height: 12),
          TextField(
            controller: _code,
            autofocus: true,
            keyboardType: TextInputType.number,
            maxLength: 6,
            decoration: InputDecoration(labelText: l10n.fieldOtpCode),
            onChanged: (_) => setState(() {}),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(l10n.actionCancel),
        ),
        FilledButton(
          onPressed: _code.text.trim().length == 6
              ? () => Navigator.of(context).pop(_code.text.trim())
              : null,
          child: Text(l10n.phoneChangeConfirm),
        ),
      ],
    );
  }
}
