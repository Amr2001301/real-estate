import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/notifications/data/datasources/notifications_remote_data_source.dart';
import 'package:mobile_staff/features/notifications/data/dtos/notification_dto.dart';
import 'package:mobile_staff/features/notifications/data/mappers/notification_mapper.dart';
import 'package:mobile_staff/features/notifications/data/repositories/notifications_repository_impl.dart';
import 'package:mobile_staff/features/notifications/domain/entities/app_notification.dart';
import 'package:mobile_staff/features/notifications/domain/repositories/notifications_repository.dart';
import 'package:mobile_staff/features/notifications/domain/usecases/notification_use_cases.dart';
import 'package:mobile_staff/features/notifications/presentation/cubit/notifications_cubit.dart';
import 'package:mobile_staff/features/notifications/presentation/cubit/unread_count_cubit.dart';
import 'package:mobile_staff/router/app_router.dart';

class _FakeRemote implements NotificationsRemoteDataSource {
  _FakeRemote({
    this.rows = const [],
    this.count = 0,
    this.error,
    this.markReadError,
    this.markAllError,
  });
  final List<NotificationDto> rows;
  final int count;
  final DioException? error;
  final DioException? markReadError;
  final DioException? markAllError;

  int markReadCalls = 0;
  int markAllCalls = 0;

  @override
  Future<List<NotificationDto>> list() async {
    if (error != null) throw error!;
    return rows;
  }

  @override
  Future<int> unreadCount() async {
    if (error != null) throw error!;
    return count;
  }

  @override
  Future<void> markRead(String id) async {
    markReadCalls++;
    if (markReadError != null) throw markReadError!;
  }

  @override
  Future<void> markAllRead() async {
    markAllCalls++;
    if (markAllError != null) throw markAllError!;
  }

  @override
  Future<void> registerDevice(String token, String platform) async {}
}

class _FakeRepo implements NotificationsRepository {
  _FakeRepo({this.listResult, this.countResult, this.markReadResult, this.markAllResult});
  final Result<List<AppNotification>>? listResult;
  final Result<int>? countResult;
  final Result<void>? markReadResult;
  final Result<void>? markAllResult;

  int markReadCalls = 0;
  int markAllCalls = 0;
  int listCalls = 0;

  @override
  Future<Result<List<AppNotification>>> getNotifications() async {
    listCalls++;
    return listResult ?? const Ok([]);
  }

  @override
  Future<Result<int>> getUnreadCount() async => countResult ?? const Ok(0);

  @override
  Future<Result<void>> markRead(String id) async {
    markReadCalls++;
    return markReadResult ?? const Ok(null);
  }

  @override
  Future<Result<void>> markAllRead() async {
    markAllCalls++;
    return markAllResult ?? const Ok(null);
  }

  @override
  Future<Result<void>> registerDevice(String token, String platform) async =>
      const Ok(null);
}

DioException _dio(int status) => DioException(
      requestOptions: RequestOptions(path: '/me/notifications'),
      type: DioExceptionType.badResponse,
      response: Response(
        requestOptions: RequestOptions(path: '/me/notifications'),
        statusCode: status,
      ),
    );

void main() {
  group('NotificationDto → entity', () {
    test('uses backend-resolved title/body + read flag', () {
      final n = NotificationDto.fromJson({
        'id': 'n1',
        'templateCode': 'reservation_status_changed',
        'title': 'Reservation update',
        'body': 'Status changed to APPROVED',
        'payload': {'reservationId': 'r1'},
        'read': true,
        'createdAt': '2026-06-01T00:00:00.000Z',
      }).toEntity();
      expect(n.id, 'n1');
      expect(n.title, 'Reservation update');
      expect(n.body, 'Status changed to APPROVED');
      expect(n.templateCode, 'reservation_status_changed');
      expect(n.read, isTrue);
      expect(n.createdAt, isNotNull);
      expect(n.payload['reservationId'], 'r1');
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
      expect(n.body, '');
    });

    test('unread when neither read nor readAt is present', () {
      final n = NotificationDto.fromJson({
        'id': 'n3',
        'templateCode': 'x',
        'payload': {},
      }).toEntity();
      expect(n.read, isFalse);
    });
  });

  group('NotificationsRepositoryImpl', () {
    test('list 500 → Err(server)', () async {
      final repo = NotificationsRepositoryImpl(_FakeRemote(error: _dio(500)));
      final result = await repo.getNotifications();
      expect(result.failureOrNull?.type, FailureType.server);
    });

    test('list success maps DTOs → entities', () async {
      final repo = NotificationsRepositoryImpl(_FakeRemote(rows: [
        NotificationDto.fromJson(const {
          'id': 'n1',
          'templateCode': 'visit_scheduled',
          'title': 'Visit scheduled',
          'body': '',
          'payload': {},
          'read': false,
        }),
      ]));
      final result = await repo.getNotifications();
      expect(result.dataOrNull, hasLength(1));
      expect(result.dataOrNull!.first.title, 'Visit scheduled');
    });

    test('unreadCount 401 → Err(unauthorized)', () async {
      final repo = NotificationsRepositoryImpl(_FakeRemote(error: _dio(401)));
      final result = await repo.getUnreadCount();
      expect(result.failureOrNull?.type, FailureType.unauthorized);
    });

    test('unreadCount success returns int', () async {
      final repo = NotificationsRepositoryImpl(_FakeRemote(count: 7));
      final result = await repo.getUnreadCount();
      expect(result.dataOrNull, 7);
    });

    test('markRead error → Err(server)', () async {
      final repo = NotificationsRepositoryImpl(_FakeRemote(markReadError: _dio(500)));
      final result = await repo.markRead('n1');
      expect(result.failureOrNull?.type, FailureType.server);
    });

    test('markAllRead error → Err(server)', () async {
      final repo = NotificationsRepositoryImpl(_FakeRemote(markAllError: _dio(500)));
      final result = await repo.markAllRead();
      expect(result.failureOrNull?.type, FailureType.server);
    });
  });

  group('NotificationsCubit', () {
    test('load empty list → empty status', () async {
      final repo = _FakeRepo(listResult: const Ok([]));
      final cubit = NotificationsCubit(
        GetNotifications(repo),
        MarkNotificationRead(repo),
        MarkAllNotificationsRead(repo),
      );
      await cubit.load();
      expect(cubit.state.status, DataStatus.empty);
    });

    test('load success → success status with items', () async {
      final repo = _FakeRepo(listResult: const Ok([
        AppNotification(
          id: 'n1',
          templateCode: 'visit_scheduled',
          title: 'Visit scheduled',
          body: '',
          payload: {},
          read: false,
        ),
      ]));
      final cubit = NotificationsCubit(
        GetNotifications(repo),
        MarkNotificationRead(repo),
        MarkAllNotificationsRead(repo),
      );
      await cubit.load();
      expect(cubit.state.status, DataStatus.success);
      expect(cubit.state.data, hasLength(1));
    });

    test('load failure → failure status', () async {
      final repo = _FakeRepo(
        listResult: Result.err(AppFailure(type: FailureType.network)),
      );
      final cubit = NotificationsCubit(
        GetNotifications(repo),
        MarkNotificationRead(repo),
        MarkAllNotificationsRead(repo),
      );
      await cubit.load();
      expect(cubit.state.status, DataStatus.failure);
      expect(cubit.state.failure?.type, FailureType.network);
    });

    test('markRead success → reloads list', () async {
      final repo = _FakeRepo(listResult: const Ok([]));
      final cubit = NotificationsCubit(
        GetNotifications(repo),
        MarkNotificationRead(repo),
        MarkAllNotificationsRead(repo),
      );
      await cubit.markRead('n1');
      expect(repo.markReadCalls, 1);
      expect(repo.listCalls, 1); // reload after mark
    });

    test('markRead failure → no reload (swallowed)', () async {
      final repo = _FakeRepo(
        listResult: const Ok([]),
        markReadResult: Result.err(AppFailure(type: FailureType.server)),
      );
      final cubit = NotificationsCubit(
        GetNotifications(repo),
        MarkNotificationRead(repo),
        MarkAllNotificationsRead(repo),
      );
      await cubit.markRead('n1');
      expect(repo.markReadCalls, 1);
      expect(repo.listCalls, 0); // did not reload after failure
    });

    test('markAllRead success → reloads list', () async {
      final repo = _FakeRepo(listResult: const Ok([]));
      final cubit = NotificationsCubit(
        GetNotifications(repo),
        MarkNotificationRead(repo),
        MarkAllNotificationsRead(repo),
      );
      await cubit.markAllRead();
      expect(repo.markAllCalls, 1);
      expect(repo.listCalls, 1);
    });

    test('markAllRead failure → no reload (swallowed)', () async {
      final repo = _FakeRepo(
        listResult: const Ok([]),
        markAllResult: Result.err(AppFailure(type: FailureType.server)),
      );
      final cubit = NotificationsCubit(
        GetNotifications(repo),
        MarkNotificationRead(repo),
        MarkAllNotificationsRead(repo),
      );
      await cubit.markAllRead();
      expect(repo.markAllCalls, 1);
      expect(repo.listCalls, 0);
    });
  });

  group('UnreadCountCubit', () {
    test('emits the count on success', () async {
      final repo = _FakeRepo(countResult: const Ok(5));
      final cubit = UnreadCountCubit(GetUnreadCount(repo));
      await cubit.load();
      expect(cubit.state, 5);
    });

    test('emits 0 on failure (badge is non-critical)', () async {
      final repo = _FakeRepo(
        countResult: Result.err(AppFailure(type: FailureType.network)),
      );
      final cubit = UnreadCountCubit(GetUnreadCount(repo));
      await cubit.load();
      expect(cubit.state, 0);
    });

    test('clear resets to 0', () async {
      final repo = _FakeRepo(countResult: const Ok(3));
      final cubit = UnreadCountCubit(GetUnreadCount(repo));
      await cubit.load();
      expect(cubit.state, 3);
      cubit.clear();
      expect(cubit.state, 0);
    });
  });

  group('NotificationsRemoteDataSourceImpl.parseUnreadCount', () {
    test('bare int', () {
      expect(NotificationsRemoteDataSourceImpl.parseUnreadCount(7), 7);
    });

    test('bare num (double)', () {
      expect(NotificationsRemoteDataSourceImpl.parseUnreadCount(3.0), 3);
    });

    test('bare string', () {
      expect(NotificationsRemoteDataSourceImpl.parseUnreadCount('5'), 5);
    });

    test('map with int count', () {
      expect(NotificationsRemoteDataSourceImpl.parseUnreadCount({'count': 4}), 4);
    });

    test('map with string count — {"count": "5"}', () {
      expect(NotificationsRemoteDataSourceImpl.parseUnreadCount({'count': '5'}), 5);
    });

    test('null or unrecognised shape → 0', () {
      expect(NotificationsRemoteDataSourceImpl.parseUnreadCount(null), 0);
      expect(NotificationsRemoteDataSourceImpl.parseUnreadCount({}), 0);
    });
  });

  group('staffRedirect — /notifications is shared', () {
    SessionState signedIn(AppRole role) => SessionState.authenticated(
          Session(userId: 'u1', role: role),
        );

    test('SALES can reach /notifications', () {
      expect(staffRedirect(signedIn(AppRole.sales), '/notifications'), isNull);
    });

    test('BROKER can reach /notifications (shared, not bounced to /broker/home)', () {
      expect(staffRedirect(signedIn(AppRole.broker), '/notifications'), isNull);
    });

    test('BROKER still bounced off /home', () {
      expect(staffRedirect(signedIn(AppRole.broker), '/home'), '/broker/home');
    });

    test('SALES still bounced off /broker/home', () {
      expect(staffRedirect(signedIn(AppRole.sales), '/broker/home'), '/home');
    });
  });
}
