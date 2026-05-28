import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/staff_project.dart';
import '../../domain/usecases/staff_catalog_use_cases.dart';

class StaffProjectsState extends Equatable {
  const StaffProjectsState({
    this.status = DataStatus.initial,
    this.projects = const [],
    this.failure,
    this.search = '',
  });

  final DataStatus status;
  final List<StaffProject> projects;
  final AppFailure? failure;
  final String search;

  StaffProjectsState copyWith({
    DataStatus? status,
    List<StaffProject>? projects,
    AppFailure? failure,
    String? search,
  }) =>
      StaffProjectsState(
        status: status ?? this.status,
        projects: projects ?? this.projects,
        failure: failure ?? this.failure,
        search: search ?? this.search,
      );

  @override
  List<Object?> get props => [status, projects, failure, search];
}

class StaffProjectsCubit extends Cubit<StaffProjectsState> {
  StaffProjectsCubit(this._getProjects) : super(const StaffProjectsState());

  final GetStaffProjects _getProjects;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading));
    final result = await _getProjects(state.search.isEmpty ? null : state.search);
    result.when(
      ok: (projects) => emit(state.copyWith(
        status: projects.isEmpty ? DataStatus.empty : DataStatus.success,
        projects: projects,
      )),
      err: (failure) => emit(state.copyWith(status: DataStatus.failure, failure: failure)),
    );
  }

  Future<void> setSearch(String search) async {
    emit(state.copyWith(search: search));
    await load();
  }
}
