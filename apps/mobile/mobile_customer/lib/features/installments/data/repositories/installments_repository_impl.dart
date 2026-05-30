import 'package:core/core.dart';

import '../../domain/entities/installment.dart';
import '../../domain/repositories/installments_repository.dart';
import '../datasources/installments_remote_data_source.dart';
import '../dtos/proof_deposit_dto.dart';
import '../mappers/installment_mapper.dart';

class InstallmentsRepositoryImpl implements InstallmentsRepository {
  InstallmentsRepositoryImpl(this._remote);
  final InstallmentsRemoteDataSource _remote;

  /// Merges /me/installments with /me/deposits so each installment carries
  /// its latest proof state. The backend doesn't (yet) embed the proof on
  /// the installment row — this merge is an implementation detail of the
  /// data layer and never leaks into domain/presentation.
  ///
  /// "Latest" deposit is the one with the largest createdAt (fallback
  /// paidAt). Ties are improbable in practice; if they happen the row
  /// chosen is deterministic but unspecified.
  @override
  Future<Result<List<Installment>>> getMyInstallments() {
    return guardApiCall(() async {
      final installmentsFuture = _remote.listMyInstallments();
      final depositsFuture = _remote.listMyDeposits();
      final installmentDtos = await installmentsFuture;
      final depositDtos = await depositsFuture;

      // Index deposits by installmentId, keeping the latest by createdAt
      // (fallback paidAt). Used to enrich each installment row with its
      // current proof status.
      final byInstallmentId = <String, ProofDepositDto>{};
      for (final d in depositDtos) {
        final iid = d.installmentId;
        if (iid == null) continue;
        final existing = byInstallmentId[iid];
        if (existing == null) {
          byInstallmentId[iid] = d;
        } else {
          final a = DateTime.tryParse(existing.createdAt ?? existing.paidAt ?? '');
          final b = DateTime.tryParse(d.createdAt ?? d.paidAt ?? '');
          if (a == null || (b != null && b.isAfter(a))) {
            byInstallmentId[iid] = d;
          }
        }
      }

      return installmentDtos.map((dto) {
        final entity = dto.toEntity();
        final proof = byInstallmentId[entity.id];
        if (proof == null) return entity;
        return Installment(
          id: entity.id,
          amount: entity.amount,
          dueDate: entity.dueDate,
          status: entity.status,
          type: entity.type,
          paidAt: entity.paidAt,
          contractId: entity.contractId,
          contractNumber: entity.contractNumber,
          unitCode: entity.unitCode,
          unitType: entity.unitType,
          projectNameAr: entity.projectNameAr,
          projectNameEn: entity.projectNameEn,
          latestProof: PaymentProofSummary(
            depositId: proof.id,
            reviewStatus: PaymentProofStatus.fromWire(proof.reviewStatus),
            paymentMethod: proof.paymentMethod == null
                ? null
                : PaymentMethod.fromWire(proof.paymentMethod),
            rejectionReason: proof.rejectionReason,
            submittedAt:
                DateTime.tryParse(proof.createdAt ?? proof.paidAt ?? ''),
          ),
        );
      }).toList();
    });
  }

  @override
  Future<Result<void>> submitProof(SubmitProofParams params) {
    return guardApiCall(() async {
      final presign = await _remote.presign(
        contentType: params.mimeType,
        sizeBytes: params.bytes.length,
        fileName: params.fileName,
      );
      await _remote.putToSignedUrl(
        uploadUrl: presign.uploadUrl,
        bytes: params.bytes,
        contentType: params.mimeType,
      );
      await _remote.submitProof(
        installmentId: params.installmentId,
        amount: params.amount,
        paidAtIso: params.paidAt.toUtc().toIso8601String(),
        paymentMethod: params.method.wire,
        receiptUrl: presign.publicUrl,
        fileName: params.fileName,
        mimeType: params.mimeType,
        sizeBytes: params.bytes.length,
        note: params.note,
      );
    });
  }

  @override
  Future<Result<void>> resubmitProof(ResubmitProofParams params) {
    return guardApiCall(() async {
      final presign = await _remote.presign(
        contentType: params.mimeType,
        sizeBytes: params.bytes.length,
        fileName: params.fileName,
      );
      await _remote.putToSignedUrl(
        uploadUrl: presign.uploadUrl,
        bytes: params.bytes,
        contentType: params.mimeType,
      );
      await _remote.resubmitProof(
        depositId: params.depositId,
        paymentMethod: params.method.wire,
        receiptUrl: presign.publicUrl,
        fileName: params.fileName,
        mimeType: params.mimeType,
        sizeBytes: params.bytes.length,
        paidAtIso: params.paidAt?.toUtc().toIso8601String(),
        note: params.note,
      );
    });
  }
}
