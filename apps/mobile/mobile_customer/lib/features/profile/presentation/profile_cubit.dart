import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../domain/entities/user_profile.dart';
import '../domain/repositories/profile_repository.dart';
import '../domain/usecases/change_my_phone.dart';
import '../domain/usecases/get_my_profile.dart';
import '../domain/usecases/update_my_profile.dart';

class ProfileState extends Equatable {
  const ProfileState({
    this.status = DataStatus.initial,
    this.profile,
    this.failure,
    this.saving = false,
  });

  final DataStatus status;
  final UserProfile? profile;
  final AppFailure? failure;
  final bool saving;

  ProfileState copyWith({
    DataStatus? status,
    UserProfile? profile,
    AppFailure? failure,
    bool? saving,
  }) {
    return ProfileState(
      status: status ?? this.status,
      profile: profile ?? this.profile,
      failure: failure,
      saving: saving ?? this.saving,
    );
  }

  @override
  List<Object?> get props => [status, profile, failure, saving];
}

class ProfileCubit extends Cubit<ProfileState> {
  ProfileCubit(
    this._getProfile,
    this._updateProfile,
    this._requestPhoneChange,
    this._confirmPhoneChange,
  ) : super(const ProfileState());

  final GetMyProfile _getProfile;
  final UpdateMyProfile _updateProfile;
  final RequestPhoneChange _requestPhoneChange;
  final ConfirmPhoneChange _confirmPhoneChange;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading));
    final result = await _getProfile(const NoParams());
    result.when(
      ok: (profile) => emit(state.copyWith(status: DataStatus.success, profile: profile)),
      err: (failure) => emit(state.copyWith(status: DataStatus.failure, failure: failure)),
    );
  }

  /// Returns the failure on error (null on success) so the screen can react.
  Future<AppFailure?> save(UpdateProfileParams params) async {
    emit(state.copyWith(saving: true));
    final result = await _updateProfile(params);
    return result.when(
      ok: (profile) {
        emit(state.copyWith(status: DataStatus.success, profile: profile, saving: false));
        return null;
      },
      err: (failure) {
        emit(state.copyWith(saving: false));
        return failure;
      },
    );
  }

  /// Sends a code to the new number. Returns the failure, or null when sent.
  Future<AppFailure?> requestPhoneChange(String phone) async {
    return (await _requestPhoneChange(phone)).failureOrNull;
  }

  /// Confirms the new number with its code, then reloads the profile.
  Future<AppFailure?> confirmPhoneChange(String code) async {
    final failure = (await _confirmPhoneChange(code)).failureOrNull;
    if (failure == null) await load();
    return failure;
  }
}
