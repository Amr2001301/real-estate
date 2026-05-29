import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/usecases/notification_use_cases.dart';

/// App-wide unread-notification count for the bell badge. Loaded on sign-in
/// and refreshed after the user reads notifications. Errors are swallowed (a
/// badge is non-critical) and reported via [AppLog].
class UnreadCountCubit extends Cubit<int> {
  UnreadCountCubit(this._getUnreadCount) : super(0);

  final GetUnreadCount _getUnreadCount;

  Future<void> load() async {
    final result = await _getUnreadCount(const NoParams());
    result.when(
      ok: emit,
      err: (failure) {
        AppLog.failure(failure);
        emit(0);
      },
    );
  }

  void clear() => emit(0);
}
