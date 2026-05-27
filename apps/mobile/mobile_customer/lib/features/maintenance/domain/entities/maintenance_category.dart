import 'package:core/core_domain.dart';

/// A selectable maintenance category (e.g. plumbing, electrical). Domain entity.
class MaintenanceCategory extends Equatable {
  const MaintenanceCategory({required this.id, required this.name});

  final String id;
  final Translatable name;

  @override
  List<Object?> get props => [id, name];
}
