import 'package:core/core_domain.dart';

/// Owner entity a document is attached to (matches backend DocumentOwnerType
/// for customer-reachable types).
enum DocumentOwnerType {
  contract('CONTRACT'),
  deposit('DEPOSIT'),
  maintenanceRequest('MAINTENANCE_REQUEST');

  const DocumentOwnerType(this.wire);
  final String wire;
}

/// Customer-visible document metadata. **No file URL** — downloads go only
/// through a just-in-time signed link.
class CustomerDocument extends Equatable {
  const CustomerDocument({
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
  final DateTime? createdAt;

  bool get isPdf => (mimeType ?? '').contains('pdf') ||
      (fileName ?? '').toLowerCase().endsWith('.pdf');

  @override
  List<Object?> get props => [id, title, fileName, mimeType, category];
}

/// A short-lived signed download link, fetched just-in-time.
class DocumentDownloadLink extends Equatable {
  const DocumentDownloadLink({
    required this.url,
    this.fileName,
    this.contentType,
    this.expiresIn,
  });

  final String url;
  final String? fileName;
  final String? contentType;
  final int? expiresIn;

  @override
  List<Object?> get props => [url, fileName, contentType, expiresIn];
}
