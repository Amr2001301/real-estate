import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../domain/security.dart';

class SecurityState extends Equatable {
  const SecurityState({
    this.status = DataStatus.initial,
    this.sessions = const [],
    this.twoFactor,
    this.failure,
    this.busy = false,
  });

  final DataStatus status;

  /// This phone first, then the most recently seen.
  final List<DeviceSession> sessions;
  final TwoFactorStatus? twoFactor;
  final AppFailure? failure;

  /// A change is being made.
  final bool busy;

  int get otherDevices => sessions.where((s) => !s.current).length;

  SecurityState copyWith({
    DataStatus? status,
    List<DeviceSession>? sessions,
    TwoFactorStatus? twoFactor,
    AppFailure? failure,
    bool? busy,
  }) =>
      SecurityState(
        status: status ?? this.status,
        sessions: sessions ?? this.sessions,
        twoFactor: twoFactor ?? this.twoFactor,
        failure: failure ?? this.failure,
        busy: busy ?? this.busy,
      );

  @override
  List<Object?> get props => [status, sessions, twoFactor, failure, busy];
}

/// «الأمان»: the account's devices and two-step sign-in. Each change returns
/// its result so the screen can say what happened.
class SecurityCubit extends Cubit<SecurityState> {
  SecurityCubit(this._repo) : super(const SecurityState());
  final SecurityRepository _repo;

  SecurityRepository get repo => _repo;

  Future<void> load() async {
    if (state.status != DataStatus.success) emit(state.copyWith(status: DataStatus.loading));
    final results = await Future.wait([_repo.sessions(), _repo.twoFactor()]);
    final sessions = results[0] as Result<List<DeviceSession>>;
    final tfa = results[1] as Result<TwoFactorStatus>;
    final failure = sessions.failureOrNull;
    if (failure != null) {
      emit(state.copyWith(status: DataStatus.failure, failure: failure));
      return;
    }
    final list = [...sessions.dataOrNull!]..sort((a, b) {
        if (a.current != b.current) return a.current ? -1 : 1;
        final x = a.lastSeenAt ?? a.createdAt ?? DateTime(0);
        final y = b.lastSeenAt ?? b.createdAt ?? DateTime(0);
        return y.compareTo(x);
      });
    emit(state.copyWith(status: DataStatus.success, sessions: list, twoFactor: tfa.dataOrNull));
  }

  /// Runs a change, then reads everything again.
  Future<Result<T>> run<T>(Future<Result<T>> Function(SecurityRepository repo) change) async {
    emit(state.copyWith(busy: true));
    final result = await change(_repo);
    if (result.failureOrNull == null) await load();
    emit(state.copyWith(busy: false));
    return result;
  }

  Future<Result<void>> signOut(String id) => run((r) => r.signOut(id));
  Future<Result<int>> signOutOthers() => run((r) => r.signOutOthers());
}
