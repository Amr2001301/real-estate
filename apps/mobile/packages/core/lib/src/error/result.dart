import 'app_failure.dart';

/// Success-or-[AppFailure] wrapper returned by repositories/use cases. Pure Dart
/// (no Dio) so the **domain** layer can depend on it. The Dio-aware
/// `guardApiCall` lives separately in `api_guard.dart` (data layer only).
sealed class Result<T> {
  const Result();

  factory Result.ok(T data) = Ok<T>;
  factory Result.err(AppFailure failure) = Err<T>;

  bool get isOk => this is Ok<T>;
  bool get isErr => this is Err<T>;

  T? get dataOrNull => switch (this) {
        Ok<T>(:final data) => data,
        Err<T>() => null,
      };

  AppFailure? get failureOrNull => switch (this) {
        Ok<T>() => null,
        Err<T>(:final failure) => failure,
      };

  R when<R>({
    required R Function(T data) ok,
    required R Function(AppFailure failure) err,
  }) {
    return switch (this) {
      Ok<T>(:final data) => ok(data),
      Err<T>(:final failure) => err(failure),
    };
  }

  Result<R> map<R>(R Function(T data) transform) {
    return switch (this) {
      Ok<T>(:final data) => Ok<R>(transform(data)),
      Err<T>(:final failure) => Err<R>(failure),
    };
  }
}

final class Ok<T> extends Result<T> {
  const Ok(this.data);
  final T data;
}

final class Err<T> extends Result<T> {
  const Err(this.failure);
  final AppFailure failure;
}
