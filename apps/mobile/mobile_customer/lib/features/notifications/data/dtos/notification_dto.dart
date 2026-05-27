// Wire shape of /me/notifications rows (now resolved server-side). Data layer only.
class NotificationDto {
  const NotificationDto({
    required this.id,
    required this.templateCode,
    required this.title,
    required this.body,
    required this.payload,
    required this.read,
    this.createdAt,
  });

  final String id;
  final String templateCode;
  final String title;
  final String body;
  final Map<String, dynamic> payload;
  final bool read;
  final String? createdAt;

  factory NotificationDto.fromJson(Map<String, dynamic> json) => NotificationDto(
        id: json['id'] as String,
        templateCode: json['templateCode'] as String? ?? '',
        title: json['title'] as String? ?? '',
        body: json['body'] as String? ?? '',
        payload: Map<String, dynamic>.from(json['payload'] as Map? ?? const {}),
        // Backend returns `read` (bool); tolerate legacy `readAt`.
        read: json['read'] as bool? ?? (json['readAt'] != null),
        createdAt: json['createdAt'] as String?,
      );
}
