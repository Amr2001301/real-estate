import 'package:core/core_domain.dart';

/// A project/unit media entry. Domain entity (pure Dart).
class MediaItem extends Equatable {
  const MediaItem({required this.url, required this.type, required this.order});

  final String url;

  /// 'IMAGE' | 'VIDEO'.
  final String type;
  final int order;

  bool get isImage => type.toUpperCase() == 'IMAGE';

  @override
  List<Object?> get props => [url, type, order];
}

/// Sorted image URLs from a media list.
List<String> imageUrls(List<MediaItem> media) {
  final sorted = [...media]..sort((a, b) => a.order.compareTo(b.order));
  return sorted.where((m) => m.isImage).map((m) => m.url).toList();
}
