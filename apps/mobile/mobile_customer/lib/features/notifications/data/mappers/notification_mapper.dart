import '../../domain/entities/app_notification.dart';
import '../dtos/notification_dto.dart';

extension NotificationDtoMapper on NotificationDto {
  AppNotification toEntity() => AppNotification(
        id: id,
        templateCode: templateCode,
        title: title,
        body: body,
        payload: payload,
        read: read,
        createdAt: DateTime.tryParse(createdAt ?? ''),
      );
}
