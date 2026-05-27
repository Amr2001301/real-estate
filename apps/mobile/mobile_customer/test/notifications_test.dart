import 'package:core/core.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/notifications/data/dtos/notification_dto.dart';
import 'package:mobile_customer/features/notifications/data/mappers/notification_mapper.dart';
import 'package:mobile_customer/features/notifications/domain/entities/app_notification.dart';
import 'package:mobile_customer/features/notifications/domain/repositories/notifications_repository.dart';
import 'package:mobile_customer/features/notifications/domain/usecases/notification_use_cases.dart';
import 'package:mobile_customer/features/notifications/presentation/unread_count_cubit.dart';

class _FakeNotificationsRepository implements NotificationsRepository {
  _FakeNotificationsRepository({this.count = 0, this.countFailure});
  final int count;
  final AppFailure? countFailure;

  @override
  Future<Result<int>> getUnreadCount() async =>
      countFailure != null ? Result.err(countFailure!) : Result.ok(count);

  @override
  Future<Result<List<AppNotification>>> getNotifications() async => const Ok([]);
  @override
  Future<Result<void>> markRead(String id) async => const Ok(null);
  @override
  Future<Result<void>> markAllRead() async => const Ok(null);
  @override
  Future<Result<void>> registerDevice(String token, String platform) async =>
      const Ok(null);
}

void main() {
  group('NotificationDto → entity', () {
    test('uses backend-resolved title/body + read flag', () {
      final n = NotificationDto.fromJson({
        'id': 'n1',
        'templateCode': 'visit_approved',
        'title': 'Visit approved',
        'body': 'Your visit was approved',
        'payload': {'projectId': 'p1'},
        'read': true,
        'createdAt': '2026-06-01T00:00:00.000Z',
      }).toEntity();
      expect(n.title, 'Visit approved');
      expect(n.body, 'Your visit was approved');
      expect(n.read, isTrue);
      expect(n.createdAt, isNotNull);
    });

    test('tolerates legacy readAt and missing title/body', () {
      final n = NotificationDto.fromJson({
        'id': 'n2',
        'templateCode': 'x',
        'payload': {},
        'readAt': '2026-06-01T00:00:00.000Z',
      }).toEntity();
      expect(n.read, isTrue);
      expect(n.title, '');
    });
  });

  group('UnreadCountCubit', () {
    test('emits the count on success', () async {
      final cubit = UnreadCountCubit(GetUnreadCount(_FakeNotificationsRepository(count: 5)));
      await cubit.load();
      expect(cubit.state, 5);
    });

    test('emits 0 on failure (badge is non-critical)', () async {
      final cubit = UnreadCountCubit(
        GetUnreadCount(_FakeNotificationsRepository(
          countFailure: AppFailure(type: FailureType.network),
        )),
      );
      await cubit.load();
      expect(cubit.state, 0);
    });

    test('clear resets to 0', () async {
      final cubit = UnreadCountCubit(GetUnreadCount(_FakeNotificationsRepository(count: 3)));
      await cubit.load();
      expect(cubit.state, 3);
      cubit.clear();
      expect(cubit.state, 0);
    });
  });
}
