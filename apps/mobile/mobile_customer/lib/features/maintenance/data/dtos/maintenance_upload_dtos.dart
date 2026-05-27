// Wire shapes for the maintenance photo upload flow. Data layer only.

/// Response from `POST /me/maintenance-requests/:id/documents/presign`.
/// `uploadUrl` is a short-lived signed PUT URL — treat as a secret: never log
/// it. `publicUrl` is what we register the document with afterwards.
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
