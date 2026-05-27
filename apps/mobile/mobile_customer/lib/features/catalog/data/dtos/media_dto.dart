/// Wire shape of a media entry. Data layer only.
class MediaDto {
  const MediaDto({required this.url, required this.type, required this.order});

  final String url;
  final String type;
  final int order;

  factory MediaDto.fromJson(Map<String, dynamic> json) => MediaDto(
        url: json['url'] as String? ?? '',
        type: json['type'] as String? ?? 'IMAGE',
        order: (json['order'] as num?)?.toInt() ?? 0,
      );
}
