import 'package:core/core_domain.dart';

class StaffDocument extends Equatable {
  const StaffDocument({
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

  bool get isPdf =>
      (mimeType ?? '').contains('pdf') ||
      (fileName ?? '').toLowerCase().endsWith('.pdf');

  @override
  List<Object?> get props => [id, title, fileName, mimeType, category];
}
