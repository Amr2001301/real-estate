import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../cubit/create_lead_cubit.dart';

class CreateLeadScreen extends StatefulWidget {
  const CreateLeadScreen({super.key});

  @override
  State<CreateLeadScreen> createState() => _CreateLeadScreenState();
}

class _CreateLeadScreenState extends State<CreateLeadScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    context.read<CreateLeadCubit>().submit(
          fullName: _nameCtrl.text.trim(),
          phone: _phoneCtrl.text.trim(),
          email: _emailCtrl.text.trim(),
          notes: _notesCtrl.text.trim(),
        );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return BlocListener<CreateLeadCubit, CreateLeadState>(
      listenWhen: (a, b) => a.status != b.status,
      listener: (context, state) {
        if (state.status == CreateLeadStatus.success) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(l10n.leadCreated)));
          context.pop(true);
        } else if (state.status == CreateLeadStatus.failure) {
          showFailureSnackBar(context, state.failure!);
        }
      },
      child: Scaffold(
        appBar: AppBar(title: Text(l10n.leadNew)),
        body: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              TextFormField(
                controller: _nameCtrl,
                textInputAction: TextInputAction.next,
                decoration: InputDecoration(labelText: l10n.leadFullName),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? l10n.leadFullNameRequired : null,
              ),
              const SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _phoneCtrl,
                keyboardType: TextInputType.phone,
                textInputAction: TextInputAction.next,
                decoration: InputDecoration(labelText: l10n.leadPhone),
              ),
              const SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _emailCtrl,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                decoration: InputDecoration(labelText: l10n.leadEmail),
              ),
              const SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _notesCtrl,
                maxLines: 3,
                textInputAction: TextInputAction.done,
                decoration: InputDecoration(labelText: l10n.leadNotes),
              ),
              const SizedBox(height: AppSpacing.xl),
              BlocBuilder<CreateLeadCubit, CreateLeadState>(
                buildWhen: (a, b) => a.status != b.status,
                builder: (context, state) => AppButton(
                  label: l10n.leadCreate,
                  size: AppButtonSize.large,
                  variant: AppButtonVariant.gold,
                  isLoading: state.status == CreateLeadStatus.submitting,
                  onPressed:
                      state.status == CreateLeadStatus.submitting ? null : _submit,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
