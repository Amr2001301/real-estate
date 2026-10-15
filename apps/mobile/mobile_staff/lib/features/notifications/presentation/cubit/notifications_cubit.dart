import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/app_notification.dart';
import '../../domain/usecases/notification_use_cases.dart';

typedef NotificationsState = DataState<List<AppNotification>>;

class NotificationsCubit extends Cubit<NotificationsState> {
  NotificationsCubit(this._get, this._markRead, this._markAll)
      : super(const NotificationsState.initial());

  final GetNotifications _get;
  final MarkNotificationRead _markRead;
  final MarkAllNotificationsRead _markAll;

  /// Matches the API's default page size.
  static const pageSize = 20;

  int _page = 1;
  bool _hasMore = false;
  bool _loadingMore = false;

  /// Older notifications exist beyond those loaded.
  bool get hasMore => _hasMore;

  Future<void> load() async {
    emit(state.toLoading());
    final result = await _get(const NoParams());
    result.when(
      ok: (items) {
        _page = 1;
        _hasMore = items.length >= pageSize;
        emit(items.isEmpty
            ? const NotificationsState.empty()
            : NotificationsState.success(items));
      },
      err: (failure) => emit(state.toFailure(failure)),
    );
  }

  /// Appends the next (older) page. A failure keeps what is shown.
  Future<void> loadMore() async {
    if (!_hasMore || _loadingMore) return;
    final current = state.data ?? const <AppNotification>[];
    _loadingMore = true;
    final result = await _get.page(_page + 1);
    _loadingMore = false;
    result.when(
      ok: (items) {
        _page += 1;
        _hasMore = items.length >= pageSize;
        emit(NotificationsState.success([...current, ...items]));
      },
      err: AppLog.failure,
    );
  }

  Future<void> markRead(String id) async {
    final failure = (await _markRead(id)).failureOrNull;
    if (failure != null) {
      AppLog.failure(failure);
      return;
    }
    await load();
  }

  Future<void> markAllRead() async {
    final failure = (await _markAll(const NoParams())).failureOrNull;
    if (failure != null) {
      AppLog.failure(failure);
      return;
    }
    await load();
  }
}
