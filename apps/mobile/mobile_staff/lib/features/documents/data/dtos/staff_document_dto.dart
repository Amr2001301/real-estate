class StaffDocumentDto {
  const StaffDocumentDto({
    required this.id,
    required this.title,
    this.fileName,
    this.mimeType,
    this.category,
    this.createdAt,
  });

  final String id;
  final String title;
  final String? fileName;
  final String? mimeType;
  final String? category;
  final String? createdAt;

  factory StaffDocumentDto.fromJson(Map<String, dynamic> json) =>
      StaffDocumentDto(
        id: json['id'] as String,
        title: json['title'] as String? ?? '',
        fileName: json['fileName'] as String?,
        mimeType: json['mimeType'] as String?,
        category: json['category'] as String?,
        createdAt: json['createdAt'] as String?,
      );
}

class StaffDocumentDownloadDto {
  const StaffDocumentDownloadDto({
    required this.url,
    this.fileName,
    this.contentType,
    this.expiresIn,
  });

  final String url;
  final String? fileName;
  final String? contentType;
  final int? expiresIn;

  factory StaffDocumentDownloadDto.fromJson(Map<String, dynamic> json) =>
      StaffDocumentDownloadDto(
        url: json['url'] as String? ?? '',
        fileName: json['fileName'] as String?,
        contentType: json['contentType'] as String?,
        expiresIn: (json['expiresIn'] as num?)?.toInt(),
      );
}
