import 'package:equatable/equatable.dart';

/// Pagination metadata mirroring the backend `paginate()` envelope. Pure Dart.
class PageMeta extends Equatable {
  const PageMeta({
    required this.page,
    required this.pageSize,
    required this.total,
    required this.totalPages,
  });

  final int page;
  final int pageSize;
  final int total;
  final int totalPages;

  bool get hasMore => page < totalPages;

  factory PageMeta.fromJson(Map<String, dynamic> json) => PageMeta(
        page: (json['page'] as num?)?.toInt() ?? 1,
        pageSize: (json['pageSize'] as num?)?.toInt() ?? 0,
        total: (json['total'] as num?)?.toInt() ?? 0,
        totalPages: (json['totalPages'] as num?)?.toInt() ?? 1,
      );

  @override
  List<Object?> get props => [page, pageSize, total, totalPages];
}

/// A generic `{ data, meta }` page of [T].
class Paginated<T> extends Equatable {
  const Paginated({required this.data, required this.meta});

  final List<T> data;
  final PageMeta meta;

  bool get hasMore => meta.hasMore;

  /// Builds a page from a JSON envelope (data-layer helper).
  factory Paginated.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic> item) fromItem,
  ) {
    final list = (json['data'] as List? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(fromItem)
        .toList();
    return Paginated(
      data: list,
      meta: PageMeta.fromJson(json['meta'] as Map<String, dynamic>? ?? const {}),
    );
  }

  /// Transforms each item (e.g. DTO page → entity page), preserving [meta].
  Paginated<R> map<R>(R Function(T item) transform) =>
      Paginated(data: data.map(transform).toList(), meta: meta);

  @override
  List<Object?> get props => [data, meta];
}
