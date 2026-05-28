import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/staff_profile.dart';
import '../../domain/usecases/get_staff_profile.dart';

typedef StaffProfileState = DataState<StaffProfile>;

class StaffProfileCubit extends Cubit<StaffProfileState> {
  StaffProfileCubit(this._getProfile) : super(const StaffProfileState.initial());

  final GetStaffProfile _getProfile;

  Future<void> load() async {
    emit(state.toLoading());
    final result = await _getProfile(const NoParams());
    result.when(
      ok: (profile) => emit(StaffProfileState.success(profile)),
      err: (failure) => emit(state.toFailure(failure)),
    );
  }
}
