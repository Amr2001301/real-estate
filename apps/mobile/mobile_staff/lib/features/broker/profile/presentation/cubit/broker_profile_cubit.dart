import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/broker_profile.dart';
import '../../domain/usecases/get_broker_profile.dart';

typedef BrokerProfileState = DataState<BrokerProfile>;

class BrokerProfileCubit extends Cubit<BrokerProfileState> {
  BrokerProfileCubit(this._getProfile) : super(const BrokerProfileState.initial());

  final GetBrokerProfile _getProfile;

  /// Whether commissions are visible to this broker (false until loaded).
  bool get canViewCommissions => state.data?.canViewCommissions ?? false;

  Future<void> load() async {
    emit(state.toLoading());
    final result = await _getProfile(const NoParams());
    result.when(
      ok: (profile) => emit(BrokerProfileState.success(profile)),
      err: (failure) => emit(state.toFailure(failure)),
    );
  }
}
