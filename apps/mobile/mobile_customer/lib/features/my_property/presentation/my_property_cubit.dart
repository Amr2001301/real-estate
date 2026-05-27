import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../domain/entities/property.dart';
import '../domain/usecases/get_my_properties.dart';

typedef MyPropertyState = DataState<List<Property>>;

class MyPropertyCubit extends Cubit<MyPropertyState> {
  MyPropertyCubit(this._getMyProperties) : super(const MyPropertyState.initial());

  final GetMyProperties _getMyProperties;

  Future<void> load() async {
    emit(state.toLoading());
    final result = await _getMyProperties(const NoParams());
    result.when(
      ok: (properties) => emit(
        properties.isEmpty
            ? const MyPropertyState.empty()
            : MyPropertyState.success(properties),
      ),
      err: (failure) => emit(state.toFailure(failure)),
    );
  }
}
