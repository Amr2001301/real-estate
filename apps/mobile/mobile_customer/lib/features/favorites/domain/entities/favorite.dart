import 'package:core/core_domain.dart';

/// A saved favorite (project or unit). Domain entity (pure Dart).
class Favorite extends Equatable {
  const Favorite({
    required this.id,
    required this.targetId,
    required this.isProject,
    required this.title,
    this.subtitle,
    this.coverImage,
  });

  /// The favorite record id (used to delete).
  final String id;

  /// The project or unit id this favorite points to.
  final String targetId;
  final bool isProject;
  final Translatable title;
  final String? subtitle;
  final String? coverImage;

  /// In-app route to the target's detail screen.
  String get route => isProject ? '/projects/$targetId' : '/units/$targetId';

  @override
  List<Object?> get props => [id, targetId, isProject];
}
