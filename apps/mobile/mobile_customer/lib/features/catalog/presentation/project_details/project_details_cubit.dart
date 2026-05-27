import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/project.dart';
import '../../domain/entities/unit.dart';
import '../../domain/usecases/get_project_detail.dart';
import '../../domain/usecases/get_units.dart';

class ProjectDetailsState extends Equatable {
  const ProjectDetailsState({
    this.status = DataStatus.initial,
    this.project,
    this.previewUnits = const [],
    this.failure,
  });

  final DataStatus status;
  final ProjectDetail? project;
  final List<Unit> previewUnits;
  final AppFailure? failure;

  ProjectDetailsState copyWith({
    DataStatus? status,
    ProjectDetail? project,
    List<Unit>? previewUnits,
    AppFailure? failure,
  }) {
    return ProjectDetailsState(
      status: status ?? this.status,
      project: project ?? this.project,
      previewUnits: previewUnits ?? this.previewUnits,
      failure: failure,
    );
  }

  @override
  List<Object?> get props => [status, project, previewUnits, failure];
}

/// Loads a project's detail plus a short preview of its units. Depends on the
/// [GetProjectDetail] and [GetUnits] use cases.
class ProjectDetailsCubit extends Cubit<ProjectDetailsState> {
  ProjectDetailsCubit(this._getProject, this._getUnits, this.projectId)
      : super(const ProjectDetailsState()) {
    load();
  }

  final GetProjectDetail _getProject;
  final GetUnits _getUnits;
  final String projectId;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading));
    final result = await _getProject(projectId);
    await result.when(
      ok: (project) async {
        // Units preview is best-effort: failure here must not fail the screen.
        final units = await _getUnits(GetUnitsParams(projectId: projectId, pageSize: 6));
        emit(state.copyWith(
          status: DataStatus.success,
          project: project,
          previewUnits: units.dataOrNull?.data ?? const [],
        ));
      },
      err: (failure) async =>
          emit(state.copyWith(status: DataStatus.failure, failure: failure)),
    );
  }
}
