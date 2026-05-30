/// Response from `POST /me/payments/presign`. `uploadUrl` is a short-lived
/// signed PUT URL — treat as a secret: never log it. `publicUrl` is the
/// stable storage URL we then send back to `POST /me/deposits` for the
/// receipt linkage. Mirrors the maintenance presign shape.
class PresignResponseDto {
  const PresignResponseDto({
    required this.uploadUrl,
    required this.publicUrl,
    this.key,
  });

  final String uploadUrl;
  final String publicUrl;
  final String? key;

  factory PresignResponseDto.fromJson(Map<String, dynamic> json) =>
      PresignResponseDto(
        uploadUrl: json['uploadUrl'] as String? ?? '',
        publicUrl: json['publicUrl'] as String? ?? '',
        key: json['key'] as String?,
      );
}

/// Wire response from `POST /me/deposits` (submit) and
/// `POST /me/deposits/:id/resubmit`. We only render the id + new review
/// status; the full deposit is re-fetched via the installments list on the
/// next refresh.
class SubmittedProofDto {
  const SubmittedProofDto({
    required this.id,
    required this.reviewStatus,
  });

  final String id;
  final String reviewStatus;

  factory SubmittedProofDto.fromJson(Map<String, dynamic> json) =>
      SubmittedProofDto(
        id: json['id'] as String,
        reviewStatus: json['reviewStatus'] as String? ?? 'PENDING_REVIEW',
      );
}
