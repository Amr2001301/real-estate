import 'package:core/core.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:mime/mime.dart' as mime;

import '../../domain/entities/installment.dart';
import '../cubit/submit_proof_cubit.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyCard = Color(0xFF1A3352);
const _navyLight = Color(0xFF243F62);

// ─────────────────────────────────────────────────────────────────────────────
// Submit Payment Proof Screen
// ─────────────────────────────────────────────────────────────────────────────

class SubmitProofScreen extends StatelessWidget {
  const SubmitProofScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<SubmitProofCubit, SubmitProofState>(
      listenWhen: (a, b) =>
          a.status != b.status && b.status == SubmitProofStatus.success,
      listener: (context, state) {
        ScaffoldMessenger.of(context).showSnackBar(
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
        return AnnotatedRegion<SystemUiOverlayStyle>(
          value: SystemUiOverlayStyle.light.copyWith(
            statusBarColor: Colors.transparent,
          ),
          child: Scaffold(
            backgroundColor: context.appColors.canvas,
            body: Column(
              children: [
                _ProofHeader(
                  isResubmit: installment.isResubmit,
                  l10n: l10n,
                ),
                Expanded(
                  child: _Body(installment: installment, state: state),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ── Header ────────────────────────────────────────────────────────────────────

class _ProofHeader extends StatelessWidget {
  const _ProofHeader({required this.isResubmit, required this.l10n});
  final bool isResubmit;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final topInset = MediaQuery.paddingOf(context).top;

    return Container(
      width: double.infinity,
      clipBehavior: Clip.antiAlias,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: [_navyLight, _navyCard, _navyDeep],
          stops: [0.0, 0.45, 1.0],
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(28),
          bottomRight: Radius.circular(28),
        ),
        boxShadow: [
          BoxShadow(
            color: Color(0x35000000),
            blurRadius: 22,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Stack(
        children: [
          const Positioned.fill(child: IgnorePointer(child: _DotTexture())),
          PositionedDirectional(
            end: 0,
            top: 0,
            child: Container(
              width: 160,
              height: 120,
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment.topRight,
                  radius: 1.0,
                  colors: [
                    AppPalette.gold400.withValues(alpha: 0.10),
                    AppPalette.gold400.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            bottom: 0,
            left: 48,
            right: 48,
            child: Container(
              height: 1,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppPalette.gold400.withValues(alpha: 0.0),
                    AppPalette.gold400.withValues(alpha: 0.5),
                    AppPalette.gold400.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.lg,
              topInset + AppSpacing.md,
              AppSpacing.lg,
              AppSpacing.xl,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                _BackBtn(),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        isResubmit
                            ? l10n.paymentProofResubmit
                            : l10n.paymentProofSubmit,
                        style: theme.textTheme.titleLarge?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          height: 1.1,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'أرفق إيصال الدفع للمراجعة',
                        style: TextStyle(
                          color: AppPalette.gold300,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.3,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [_navyLight, _navyDeep],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: AppPalette.gold400.withValues(alpha: 0.35),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: _navyDeep.withValues(alpha: 0.35),
                        blurRadius: 10,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.attach_file_rounded,
                    color: AppPalette.gold300,
                    size: 20,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Body ──────────────────────────────────────────────────────────────────────

class _Body extends StatelessWidget {
  const _Body({required this.installment, required this.state});
  final Installment installment;
  final SubmitProofState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final cubit = context.read<SubmitProofCubit>();
    final submitting = state.status == SubmitProofStatus.submitting;

    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.xl + MediaQuery.of(context).padding.bottom,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Installment summary card ─────────────────────────────────────
          _InstallmentCard(
            installment: installment,
            lang: lang,
            l10n: l10n,
          ),
          const SizedBox(height: AppSpacing.xl),

          // ── Payment method ───────────────────────────────────────────────
          _SectionLabel(label: l10n.paymentProofMethodLabel),
          const SizedBox(height: AppSpacing.md),
          _MethodSelector(state: state, onChanged: cubit.chooseMethod),
          const SizedBox(height: AppSpacing.xl),

          // ── Payment date ─────────────────────────────────────────────────
          _SectionLabel(label: l10n.depositPaidOn),
          const SizedBox(height: AppSpacing.md),
          _DatePickerRow(
            date: state.paidAt ?? DateTime.now(),
            lang: lang,
            enabled: !submitting,
            onChanged: cubit.setPaidAt,
          ),
          const SizedBox(height: AppSpacing.xl),

          // ── File attachment ──────────────────────────────────────────────
          _SectionLabel(label: l10n.paymentProofChooseFile),
          const SizedBox(height: AppSpacing.md),
          _FilePicker(
            state: state,
            enabled: !submitting,
            onPick: () => _pickFile(context, cubit),
          ),
          if (state.clientError != null) ...[
            const SizedBox(height: AppSpacing.sm),
            _ErrorRow(message: _clientErrorMessage(l10n, state.clientError!)),
          ],
          const SizedBox(height: AppSpacing.xl),

          // ── Note ─────────────────────────────────────────────────────────
          _SectionLabel(label: l10n.paymentProofNoteHint),
          const SizedBox(height: AppSpacing.md),
          _NoteField(enabled: !submitting, onChanged: cubit.setNote),
          const SizedBox(height: AppSpacing.xl),

          // ── Server error ─────────────────────────────────────────────────
          if (state.failure != null) ...[
            ErrorState(failure: state.failure, onRetry: cubit.submit),
            const SizedBox(height: AppSpacing.lg),
          ],

          // ── Submit ───────────────────────────────────────────────────────
          _SubmitButton(
            isResubmit: installment.isResubmit,
            submitting: submitting,
            l10n: l10n,
            onTap: submitting ? null : cubit.submit,
          ),
        ],
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
    final mimeType =
        mime.lookupMimeType(file.name, headerBytes: file.bytes) ??
            'application/octet-stream';
    cubit.attachFile(bytes: file.bytes!, fileName: file.name, mimeType: mimeType);
  }

  String _clientErrorMessage(AppLocalizations l10n, String code) =>
      switch (code) {
        'paymentProofFileTooLarge' => l10n.paymentProofFileTooLarge,
        'paymentProofUnsupportedType' => l10n.paymentProofUnsupportedType,
        'paymentProofNoFile' => l10n.paymentProofNoFile,
        _ => l10n.paymentProofUploadFailed,
      };
}

// ── Installment summary card ──────────────────────────────────────────────────

class _InstallmentCard extends StatelessWidget {
  const _InstallmentCard({
    required this.installment,
    required this.lang,
    required this.l10n,
  });
  final Installment installment;
  final String lang;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final isOverdue = installment.status == InstallmentStatus.overdue;
    final gradient = isOverdue
        ? [const Color(0xFF7A1E1E), const Color(0xFF4D1010), const Color(0xFF3D0F0F)]
        : [_navyLight, _navyCard, _navyDeep];
    final accent = isOverdue ? const Color(0xFFFCA5A5) : AppPalette.gold300;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.45)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.07),
            blurRadius: 20,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Colored strip ─────────────────────────────────────────────
          Container(
            height: 80,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: gradient,
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Stack(
              fit: StackFit.expand,
              children: [
                const IgnorePointer(child: _DotTexture()),
                Positioned(
                  bottom: 0,
                  left: 0,
                  right: 0,
                  child: Container(
                    height: 1,
                    color: accent.withValues(alpha: 0.3),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                    vertical: AppSpacing.md,
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              PriceFormatter.formatString(
                                installment.amount,
                                languageCode: lang,
                              ),
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w900,
                                fontSize: 22,
                                letterSpacing: -0.5,
                              ),
                            ),
                            Text(
                              l10n.installmentDueOn(
                                DateFormatter.shortDate(
                                  installment.dueDate,
                                  languageCode: lang,
                                ),
                              ),
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.7),
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: accent.withValues(alpha: 0.18),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(
                            color: accent.withValues(alpha: 0.4),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              isOverdue
                                  ? Icons.warning_amber_rounded
                                  : Icons.receipt_long_rounded,
                              color: accent,
                              size: 13,
                            ),
                            const SizedBox(width: 5),
                            Text(
                              isOverdue
                                  ? l10n.installmentStatusOverdue
                                  : l10n.installmentStatusPending,
                              style: TextStyle(
                                color: accent,
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Payment method selector ───────────────────────────────────────────────────

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
          .map((e) => _MethodChip(
                label: e.value,
                selected: state.method == e.key,
                onTap: () => onChanged(e.key),
              ))
          .toList(growable: false),
    );
  }
}

class _MethodChip extends StatelessWidget {
  const _MethodChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          gradient: selected
              ? const LinearGradient(
                  colors: [_navyLight, _navyDeep],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                )
              : null,
          color: selected ? null : colors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected
                ? AppPalette.gold400.withValues(alpha: 0.30)
                : colors.hairline.withValues(alpha: 0.7),
            width: 1.5,
          ),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: _navyDeep.withValues(alpha: 0.30),
                    blurRadius: 12,
                    offset: const Offset(0, 3),
                  ),
                ]
              : [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 4,
                    offset: const Offset(0, 1),
                  ),
                ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (selected) ...[
              const Icon(
                Icons.check_rounded,
                color: AppPalette.gold300,
                size: 14,
              ),
              const SizedBox(width: 6),
            ],
            Text(
              label,
              style: TextStyle(
                color: selected ? AppPalette.gold300 : colors.inkStrong,
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Date picker row ───────────────────────────────────────────────────────────

class _DatePickerRow extends StatelessWidget {
  const _DatePickerRow({
    required this.date,
    required this.lang,
    required this.enabled,
    required this.onChanged,
  });
  final DateTime date;
  final String lang;
  final bool enabled;
  final ValueChanged<DateTime> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    return GestureDetector(
      onTap: enabled
          ? () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: date,
                firstDate: DateTime(2020),
                lastDate: DateTime.now(),
              );
              if (picked != null) onChanged(picked);
            }
          : null,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: 14,
        ),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: colors.hairline.withValues(alpha: 0.6)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [_navyLight, _navyDeep],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                Icons.calendar_today_rounded,
                color: AppPalette.gold300,
                size: 16,
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Text(
                DateFormatter.mediumDate(date, languageCode: lang),
                style: TextStyle(
                  color: colors.inkStrong,
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                ),
              ),
            ),
            Icon(
              Icons.edit_calendar_rounded,
              size: 16,
              color: colors.inkMuted.withValues(alpha: 0.6),
            ),
          ],
        ),
      ),
    );
  }
}

// ── File picker ───────────────────────────────────────────────────────────────

class _FilePicker extends StatelessWidget {
  const _FilePicker({
    required this.state,
    required this.enabled,
    required this.onPick,
  });
  final SubmitProofState state;
  final bool enabled;
  final VoidCallback onPick;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final hasFile = state.hasFile;

    return GestureDetector(
      onTap: enabled ? onPick : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: hasFile
              ? const Color(0xFF0D5C3A).withValues(alpha: 0.06)
              : colors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: hasFile
                ? const Color(0xFF22C55E).withValues(alpha: 0.35)
                : AppPalette.gold300.withValues(alpha: 0.3),
            width: 1.5,
          ),
          boxShadow: [
            BoxShadow(
              color: hasFile
                  ? const Color(0xFF22C55E).withValues(alpha: 0.08)
                  : AppPalette.gold400.withValues(alpha: 0.08),
              blurRadius: 12,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                gradient: hasFile
                    ? const LinearGradient(
                        colors: [Color(0xFF0D5C3A), Color(0xFF052B1E)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      )
                    : const LinearGradient(
                        colors: [_navyLight, _navyDeep],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                borderRadius: BorderRadius.circular(13),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.2),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Icon(
                hasFile
                    ? Icons.check_circle_rounded
                    : Icons.attach_file_rounded,
                color: hasFile
                    ? const Color(0xFF4ADE80)
                    : AppPalette.gold300,
                size: 22,
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    hasFile ? state.fileName! : context.l10n.paymentProofChooseFile,
                    style: TextStyle(
                      color: hasFile
                          ? const Color(0xFF22C55E)
                          : colors.inkStrong,
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 3),
                  Text(
                    hasFile
                        ? 'الملف جاهز للإرسال'
                        : 'PDF · JPG · PNG · WebP (حتى 25 ميجابايت)',
                    style: TextStyle(
                      color: colors.inkMuted,
                      fontSize: 11.5,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: hasFile
                    ? const Color(0xFF22C55E).withValues(alpha: 0.1)
                    : colors.hairline.withValues(alpha: 0.4),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                hasFile ? Icons.swap_horiz_rounded : Icons.upload_file_rounded,
                size: 15,
                color: hasFile
                    ? const Color(0xFF22C55E)
                    : colors.inkMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Note field ────────────────────────────────────────────────────────────────

class _NoteField extends StatelessWidget {
  const _NoteField({required this.enabled, required this.onChanged});
  final bool enabled;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.6)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: TextField(
        maxLines: 4,
        maxLength: 500,
        enabled: enabled,
        onChanged: onChanged,
        decoration: InputDecoration(
          hintText: context.l10n.paymentProofNoteHint,
          hintStyle: TextStyle(
            color: colors.inkMuted.withValues(alpha: 0.6),
            fontSize: 14,
          ),
          contentPadding: const EdgeInsets.all(AppSpacing.md),
          border: InputBorder.none,
          counterStyle: TextStyle(
            color: colors.inkMuted,
            fontSize: 11,
          ),
        ),
      ),
    );
  }
}

// ── Submit button ─────────────────────────────────────────────────────────────

class _SubmitButton extends StatelessWidget {
  const _SubmitButton({
    required this.isResubmit,
    required this.submitting,
    required this.l10n,
    required this.onTap,
  });
  final bool isResubmit;
  final bool submitting;
  final AppLocalizations l10n;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        height: 56,
        decoration: BoxDecoration(
          gradient: onTap != null
              ? const LinearGradient(
                  colors: [_navyLight, _navyDeep],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                )
              : null,
          color: onTap == null
              ? _navyCard.withValues(alpha: 0.45)
              : null,
          borderRadius: BorderRadius.circular(16),
          boxShadow: onTap != null
              ? [
                  BoxShadow(
                    color: _navyDeep.withValues(alpha: 0.40),
                    blurRadius: 18,
                    offset: const Offset(0, 6),
                  ),
                ]
              : null,
        ),
        child: Center(
          child: submitting
              ? const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    color: AppPalette.gold300,
                  ),
                )
              : Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.send_rounded,
                      color: AppPalette.gold300,
                      size: 18,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      isResubmit
                          ? l10n.paymentProofResubmit
                          : l10n.paymentProofSubmit,
                      style: const TextStyle(
                        color: AppPalette.gold300,
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.3,
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}

// ── Section label ─────────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Row(
      children: [
        Container(
          width: 3,
          height: 16,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppPalette.gold400, AppPalette.gold300],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          label,
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w800,
            color: colors.inkStrong,
          ),
        ),
      ],
    );
  }
}

// ── Error row ─────────────────────────────────────────────────────────────────

class _ErrorRow extends StatelessWidget {
  const _ErrorRow({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Row(
      children: [
        Icon(Icons.error_outline_rounded, size: 14, color: colors.error),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            message,
            style: TextStyle(color: colors.error, fontSize: 12.5),
          ),
        ),
      ],
    );
  }
}

// ── Shared ────────────────────────────────────────────────────────────────────

class _BackBtn extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.pop(),
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(11),
          border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
        ),
        child: const Icon(
          Icons.arrow_back_ios_new_rounded,
          color: Colors.white,
          size: 16,
        ),
      ),
    );
  }
}

class _DotTexture extends StatelessWidget {
  const _DotTexture();
  @override
  Widget build(BuildContext context) =>
      const CustomPaint(painter: _DotPainter(), child: SizedBox.expand());
}

class _DotPainter extends CustomPainter {
  const _DotPainter();
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.04);
    const step = 20.0;
    for (var y = 6.0; y < size.height; y += step) {
      for (var x = 6.0; x < size.width; x += step) {
        canvas.drawCircle(Offset(x, y), 1.1, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DotPainter _) => false;
}
