import '../error/result.dart';

/// Base contract for a use case (interactor) in the domain layer.
///
/// A use case wraps a single business operation. It returns a [Result] so the
/// presentation layer only ever deals with entities + [AppFailure] — never raw
/// exceptions. Pure Dart: no Flutter, no Dio, no DTOs.
///
/// - [Out]: the success payload (a domain entity / value).
/// - [In]: the input params ([NoParams] when none are needed).
abstract interface class UseCase<Out, In> {
  Future<Result<Out>> call(In params);
}

/// Marker for use cases that take no parameters.
class NoParams {
  const NoParams();
}
