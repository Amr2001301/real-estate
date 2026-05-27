/// Pure-Dart subset of `core` for **domain layers** to import.
///
/// Contains only Flutter-free, Dio-free types: value objects, the [Result] /
/// [AppFailure] error model, pagination, and the [UseCase] base. Domain code
/// must import THIS, never `package:core/core.dart` (which pulls in Flutter).
library;

export 'package:equatable/equatable.dart';

export 'src/common/translatable.dart';
export 'src/common/paginated.dart';
export 'src/error/app_failure.dart';
export 'src/error/failure_type.dart';
export 'src/error/result.dart';
export 'src/usecase/use_case.dart';

// Auth primitives are pure Dart and shared across feature domains.
export 'src/auth/app_role.dart';
export 'src/auth/session.dart';
