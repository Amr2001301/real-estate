import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../domain/entities/user_profile.dart';
import '../domain/repositories/profile_repository.dart';
import 'profile_cubit.dart';

/// View + edit the authenticated user's profile (fullName / phone / locale).
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
    final failure = await context.read<ProfileCubit>().save(UpdateProfileParams(
          fullName: _fullName.text.trim(),
          phone: _phone.text.trim(),
          locale: _locale,
        ));
    if (!mounted) return;
    if (failure == null) {
      setState(() => _editing = false);
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(l10n.profileSaved)));
    } else {
      showFailureSnackBar(context, failure);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.profileTitle)),
      body: BlocBuilder<ProfileCubit, ProfileState>(
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
              return _editing ? _buildEdit(context, state) : _buildView(context, p);
          }
        },
      ),
    );
  }

  Widget _buildView(BuildContext context, UserProfile p) {
    final l10n = context.l10n;
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        _row(context, l10n.fieldFullName, p.fullName ?? '—'),
        _row(context, l10n.fieldEmail, p.email ?? '—'),
        _row(context, l10n.fieldPhone, p.phone ?? '—'),
        _row(context, l10n.fieldLanguage, p.locale == 'en' ? 'English' : 'العربية'),
        const SizedBox(height: AppSpacing.xl),
        AppButton(
          label: l10n.profileEdit,
          icon: Icons.edit_outlined,
          expand: true,
          onPressed: () => _startEditing(p),
        ),
      ],
    );
  }

  Widget _buildEdit(BuildContext context, ProfileState state) {
    final l10n = context.l10n;
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        Form(
          key: _formKey,
          child: Column(
            children: [
              TextFormField(
                controller: _fullName,
                decoration: InputDecoration(labelText: l10n.fieldFullName),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? l10n.validationRequired : null,
              ),
              const SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                decoration: InputDecoration(labelText: l10n.fieldPhone),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return l10n.validationRequired;
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

  Widget _row(BuildContext context, String label, String value) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: Theme.of(context)
                  .textTheme
                  .labelMedium
                  ?.copyWith(color: colors.inkMuted)),
          const SizedBox(height: 2),
          Text(value, style: Theme.of(context).textTheme.bodyLarge),
          const Divider(height: AppSpacing.lg),
        ],
      ),
    );
  }
}
