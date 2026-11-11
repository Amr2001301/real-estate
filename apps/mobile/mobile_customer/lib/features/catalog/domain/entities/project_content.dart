import 'package:core/core_domain.dart';

/// A project's page content from the dashboard: titled sections, its own FAQ,
/// amenities with an icon and a group, and the construction progress by stage.

/// A titled block of text (location, details, nearby services…).
class ProjectSection extends Equatable {
  const ProjectSection({required this.title, required this.body});
  final Translatable title;
  final Translatable body;

  @override
  List<Object?> get props => [title, body];
}

/// One of the project's own questions; one without an answer is not shown.
class ProjectFaq extends Equatable {
  const ProjectFaq({required this.question, required this.answer});
  final Translatable question;
  final Translatable answer;

  @override
  List<Object?> get props => [question, answer];
}

/// Inside the project, or around it (nearby services and landmarks).
enum AmenityGroup { inside, around }

/// An amenity: its name, an icon key from the shared list and its group.
class ProjectAmenity extends Equatable {
  const ProjectAmenity({required this.name, required this.icon, required this.group});
  final Translatable name;
  final String icon;
  final AmenityGroup group;

  @override
  List<Object?> get props => [name, icon, group];
}

/// A construction stage and how far along it is (0–100).
class ProgressStage extends Equatable {
  const ProgressStage({required this.name, required this.percent});
  final Translatable name;
  final int percent;

  bool get isDone => percent >= 100;
  bool get isActive => percent > 0 && percent < 100;

  @override
  List<Object?> get props => [name, percent];
}

/// The construction progress: the stages, their average and the last update.
class ProjectProgress extends Equatable {
  const ProjectProgress({required this.overall, required this.stages, this.updatedAt});
  final int overall;
  final List<ProgressStage> stages;
  final DateTime? updatedAt;

  bool get isComplete => overall >= 100;

  @override
  List<Object?> get props => [overall, stages, updatedAt];
}
