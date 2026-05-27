import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/project.dart';
import '../../domain/usecases/get_featured_projects.dart';

/// Home state: the featured projects to showcase.
typedef HomeState = DataState<List<ProjectListItem>>;

/// Loads featured projects. Depends on a use case only — no repository/Dio.
class HomeCubit extends Cubit<HomeState> {
  HomeCubit(this._getFeaturedProjects) : super(const HomeState.initial());

  final GetFeaturedProjects _getFeaturedProjects;

  Future<void> load() async {
    emit(state.toLoading());
    final result = await _getFeaturedProjects(const NoParams());
    result.when(
      ok: (projects) => emit(
        projects.isEmpty ? const HomeState.empty() : HomeState.success(projects),
      ),
      err: (failure) => emit(state.toFailure(failure)),
    );
  }
}
