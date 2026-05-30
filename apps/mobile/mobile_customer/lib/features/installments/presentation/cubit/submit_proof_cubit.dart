import 'dart:typed_data';

import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/installment.dart';
import '../../domain/repositories/installments_repository.dart';
import '../../domain/usecases/submit_payment_proof.dart';

enum SubmitProofStatus { idle, submitting, success, failure }

/// 25 MiB matches the backend cap (DocumentsService.ALLOWED max size).
const int kPaymentProofMaxBytes = 25 * 1024 * 1024;

/// Whitelisted MIME types — client-side guard mirrors the backend
/// whitelist (PDF + JPEG + PNG + WebP).
const Set<String> kPaymentProofAllowedMime = {
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
};

class SubmitProofState extends Equatable {
  const SubmitProofState({
    this.status = SubmitProofStatus.idle,
    this.method = PaymentMethod.bankTransfer,
    this.paidAt,
    this.bytes,
    this.fileName,
    this.mimeType,
    this.note = '',
    this.failure,
    this.clientError,
  });

  final SubmitProofStatus status;
  final PaymentMethod method;
  final DateTime? paidAt;
  final Uint8List? bytes;
  final String? fileName;
  final String? mimeType;
  final String note;
  final AppFailure? failure;

  /// Client-side validation error (file too large / unsupported MIME / no
  /// file). Cleared on the next pickFile / submit attempt.
  final String? clientError;

  bool get hasFile => bytes != null && fileName != null && mimeType != null;

  SubmitProofState copyWith({
    SubmitProofStatus? status,
    PaymentMethod? method,
    DateTime? paidAt,
    Uint8List? bytes,
    String? fileName,
    String? mimeType,
    String? note,
    AppFailure? failure,
    String? clientError,
    bool clearFailure = false,
    bool clearClientError = false,
  }) {
    return SubmitProofState(
      status: status ?? this.status,
      method: method ?? this.method,
      paidAt: paidAt ?? this.paidAt,
      bytes: bytes ?? this.bytes,
      fileName: fileName ?? this.fileName,
      mimeType: mimeType ?? this.mimeType,
      note: note ?? this.note,
      failure: clearFailure ? null : failure ?? this.failure,
      clientError: clearClientError ? null : clientError ?? this.clientError,
    );
  }

  @override
  List<Object?> get props => [
        status,
        method,
        paidAt,
        // Compare bytes by length+identity to keep equality cheap.
        bytes?.length,
        fileName,
        mimeType,
        note,
        failure,
        clientError,
      ];
}

/// Drives the submit-proof / resubmit-proof flow. Backed by either
/// [SubmitPaymentProof] (first submission, against an installment) or
/// [ResubmitPaymentProof] (against a deposit currently REJECTED). The
/// cubit decides which use case to invoke from [resubmitDepositId].
class SubmitProofCubit extends Cubit<SubmitProofState> {
  SubmitProofCubit({
    required SubmitPaymentProof submit,
    required ResubmitPaymentProof resubmit,
    required this.installment,
  })  : _submit = submit,
        _resubmit = resubmit,
        super(SubmitProofState(paidAt: DateTime.now()));

  final SubmitPaymentProof _submit;
  final ResubmitPaymentProof _resubmit;
  final Installment installment;

  String? get resubmitDepositId =>
      installment.isResubmit ? installment.latestProof?.depositId : null;

  void chooseMethod(PaymentMethod method) {
    emit(state.copyWith(method: method, clearClientError: true));
  }

  void setPaidAt(DateTime paidAt) {
    emit(state.copyWith(paidAt: paidAt));
  }

  void setNote(String note) {
    emit(state.copyWith(note: note));
  }

  /// Validates and stores the picked file. Returns true on success so the
  /// caller can avoid a redundant rebuild when the user re-picks the same
  /// file. Client-side guards mirror the backend; the server is still
  /// authoritative on its 400 response if any check is missed.
  bool attachFile({
    required Uint8List bytes,
    required String fileName,
    required String mimeType,
  }) {
    if (bytes.length > kPaymentProofMaxBytes) {
      emit(state.copyWith(clientError: 'paymentProofFileTooLarge'));
      return false;
    }
    if (!kPaymentProofAllowedMime.contains(mimeType.toLowerCase())) {
      emit(state.copyWith(clientError: 'paymentProofUnsupportedType'));
      return false;
    }
    emit(state.copyWith(
      bytes: bytes,
      fileName: fileName,
      mimeType: mimeType.toLowerCase(),
      clearClientError: true,
    ));
    return true;
  }

  Future<void> submit() async {
    if (!state.hasFile) {
      emit(state.copyWith(clientError: 'paymentProofNoFile'));
      return;
    }
    emit(state.copyWith(
      status: SubmitProofStatus.submitting,
      clearFailure: true,
      clearClientError: true,
    ));

    final paidAt = state.paidAt ?? DateTime.now();
    final note = state.note.trim().isEmpty ? null : state.note.trim();
    final result = resubmitDepositId == null
        ? await _submit(SubmitProofParams(
            installmentId: installment.id,
            amount: num.tryParse(installment.amount) ?? 0,
            paidAt: paidAt,
            method: state.method,
            bytes: state.bytes!,
            fileName: state.fileName!,
            mimeType: state.mimeType!,
            note: note,
          ))
        : await _resubmit(ResubmitProofParams(
            depositId: resubmitDepositId!,
            method: state.method,
            bytes: state.bytes!,
            fileName: state.fileName!,
            mimeType: state.mimeType!,
            paidAt: paidAt,
            note: note,
          ));

    result.when(
      ok: (_) => emit(state.copyWith(status: SubmitProofStatus.success)),
      err: (failure) {
        AppLog.failure(failure);
        emit(state.copyWith(
          status: SubmitProofStatus.failure,
          failure: failure,
        ));
      },
    );
  }
}
