import 'package:core/core.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:mime/mime.dart' as mime;

import '../../domain/entities/installment.dart';
import '../cubit/submit_proof_cubit.dart';

/// Submit / resubmit a payment proof for a specific installment. The cubit
/// owns the form state + the 3-step async submission; this screen is a
/// thin Cubit consumer.
class SubmitProofScreen extends StatelessWidget {
  const SubmitProofScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<SubmitProofCubit, SubmitProofState>(
      listenWhen: (a, b) =>
          a.status != b.status && b.status == SubmitProofStatus.success,
      listener: (context, state) {
        final messenger = ScaffoldMessenger.of(context);
        messenger.showSnackBar(
          SnackBar(
            content: Text(context.l10n.paymentProofSubmittedSuccess),
            behavior: SnackBarBehavior.floating,
          ),
        );
        Navigator.of(context).pop(true);
      },
      builder: (context, state) {
        final l10n = context.l10n;
        final installment = context.read<SubmitProofCubit>().installment;
        return Scaffold(
          appBar: AppBar(
            title: Text(
              installment.isResubmit
                  ? l10n.paymentProofResubmit
                  : l10n.paymentProofSubmit,
            ),
          ),
          body: _Body(installment: installment, state: state),
        );
      },
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.installment, required this.state});
  final Installment installment;
  final SubmitProofState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    final cubit = context.read<SubmitProofCubit>();
    final submitting = state.status == SubmitProofStatus.submitting;

    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Installment summary
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    PriceFormatter.formatString(installment.amount, languageCode: lang),
                    style: theme.textTheme.titleMedium,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    l10n.installmentDueOn(
                      DateFormatter.shortDate(installment.dueDate, languageCode: lang),
                    ),
                    style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),

            // Payment method
            Text(l10n.paymentProofMethodLabel, style: theme.textTheme.titleSmall),
            const SizedBox(height: AppSpacing.sm),
            _MethodSelector(state: state, onChanged: cubit.chooseMethod),
            const SizedBox(height: AppSpacing.lg),

            // File picker
            FilledButton.tonalIcon(
              onPressed: submitting
                  ? null
                  : () => _pickFile(context, cubit),
              icon: const Icon(Icons.attach_file),
              label: Text(state.hasFile
                  ? state.fileName!
                  : l10n.paymentProofChooseFile),
            ),
            if (state.clientError != null) ...[
              const SizedBox(height: AppSpacing.xs),
              Text(
                _clientErrorMessage(l10n, state.clientError!),
                style: theme.textTheme.bodySmall?.copyWith(color: colors.error),
              ),
            ],
            const SizedBox(height: AppSpacing.lg),

            // Optional note
            TextField(
              maxLines: 3,
              maxLength: 500,
              enabled: !submitting,
              decoration: InputDecoration(
                labelText: l10n.paymentProofNoteHint,
                border: const OutlineInputBorder(),
              ),
              onChanged: cubit.setNote,
            ),
            const SizedBox(height: AppSpacing.lg),

            // Server failure banner — never raw, always l10n via userMessage.
            if (state.failure != null)
              ErrorState(
                failure: state.failure,
                onRetry: cubit.submit,
              ),

            FilledButton(
              onPressed: submitting ? null : cubit.submit,
              child: submitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(installment.isResubmit
                      ? l10n.paymentProofResubmit
                      : l10n.paymentProofSubmit),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickFile(BuildContext context, SubmitProofCubit cubit) async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
      withData: true,
    );
    final file = result?.files.singleOrNull;
    if (file == null || file.bytes == null) return;
    final mimeType = mime.lookupMimeType(file.name, headerBytes: file.bytes) ??
        'application/octet-stream';
    cubit.attachFile(
      bytes: file.bytes!,
      fileName: file.name,
      mimeType: mimeType,
    );
  }

  String _clientErrorMessage(AppLocalizations l10n, String code) {
    switch (code) {
      case 'paymentProofFileTooLarge':
        return l10n.paymentProofFileTooLarge;
      case 'paymentProofUnsupportedType':
        return l10n.paymentProofUnsupportedType;
      case 'paymentProofNoFile':
        return l10n.paymentProofNoFile;
      default:
        return l10n.paymentProofUploadFailed;
    }
  }
}

class _MethodSelector extends StatelessWidget {
  const _MethodSelector({required this.state, required this.onChanged});
  final SubmitProofState state;
  final ValueChanged<PaymentMethod> onChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final options = <PaymentMethod, String>{
      PaymentMethod.bankTransfer: l10n.paymentProofMethodBankTransfer,
      PaymentMethod.cash: l10n.paymentProofMethodCashDeposit,
      PaymentMethod.cheque: l10n.paymentProofMethodManualCard,
      PaymentMethod.other: l10n.paymentProofMethodOther,
    };
    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: options.entries
          .map((e) => ChoiceChip(
                label: Text(e.value),
                selected: state.method == e.key,
                onSelected: (_) => onChanged(e.key),
              ))
          .toList(growable: false),
    );
  }
}
