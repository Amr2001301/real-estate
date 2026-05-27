import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../domain/entities/app_notification.dart';
import '../domain/usecases/notification_use_cases.dart';

typedef NotificationsState = DataState<List<AppNotification>>;

class NotificationsCubit extends Cubit<NotificationsState> {
  NotificationsCubit(this._get, this._markRead, this._markAll)
      : super(const NotificationsState.initial());

  final GetNotifications _get;
  final MarkNotificationRead _markRead;
  final MarkAllNotificationsRead _markAll;

  Future<void> load() async {
    emit(state.toLoading());
    final result = await _get(const NoParams());
    result.when(
      ok: (items) => emit(items.isEmpty
          ? const NotificationsState.empty()
          : NotificationsState.success(items)),
      err: (failure) => emit(state.toFailure(failure)),
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
