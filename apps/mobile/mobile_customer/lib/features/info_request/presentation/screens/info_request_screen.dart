import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../cubit/info_request_cubit.dart';

class InfoRequestScreen extends StatefulWidget {
  const InfoRequestScreen({super.key, this.projectId, this.unitId});

  final String? projectId;
  final String? unitId;

  @override
  State<InfoRequestScreen> createState() => _InfoRequestScreenState();
}

class _InfoRequestScreenState extends State<InfoRequestScreen> {
  final _formKey = GlobalKey<FormState>();
  final _messageCtrl = TextEditingController();

  @override
  void dispose() {
    _messageCtrl.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    context.read<InfoRequestCubit>().submit(
          message: _messageCtrl.text.trim(),
          projectId: widget.projectId,
          unitId: widget.unitId,
        );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.infoRequestTitle)),
      body: BlocConsumer<InfoRequestCubit, InfoRequestState>(
        listener: (context, state) {
          if (state.status == InfoRequestStatus.success) {
            Navigator.of(context).pop();
            ScaffoldMessenger.of(context)
              ..hideCurrentSnackBar()
              ..showSnackBar(SnackBar(content: Text(l10n.infoRequestSuccess)));
          } else if (state.status == InfoRequestStatus.failure &&
              state.failure != null) {
            showFailureSnackBar(context, state.failure!);
          }
        },
        builder: (context, state) {
          return Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              children: [
                Text(
                  l10n.infoRequestMessage,
                  style: Theme.of(context)
                      .textTheme
                      .labelLarge
                      ?.copyWith(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: AppSpacing.sm),
                TextFormField(
                  controller: _messageCtrl,
                  minLines: 4,
                  maxLines: 8,
                  textInputAction: TextInputAction.newline,
                  decoration: InputDecoration(
                    hintText: l10n.infoRequestMessageHint,
                    alignLabelWithHint: true,
                  ),
                  validator: (v) => (v == null || v.trim().isEmpty)
                      ? l10n.infoRequestMessageRequired
                      : null,
                ),
                const SizedBox(height: AppSpacing.xl),
                AppButton(
                  label: l10n.infoRequestSubmit,
                  icon: Icons.send_rounded,
                  variant: AppButtonVariant.gold,
                  expand: true,
                  isLoading: state.isSubmitting,
                  onPressed: state.isSubmitting ? null : _submit,
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
