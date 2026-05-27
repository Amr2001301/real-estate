import 'package:dio/dio.dart';

import 'app_failure.dart';
import 'dio_error_mapper.dart';
import 'result.dart';

/// Runs an API call and converts any thrown error into an [AppFailure] via the
/// [DioErrorMapper]. The single choke point so no `DioException` escapes the
/// data layer. **Data layer only** — depends on Dio, so it is not part of the
/// domain-safe surface.
Future<Result<T>> guardApiCall<T>(Future<T> Function() request) async {
  try {
    return Ok(await request());
  } on DioException catch (e) {
    return Err(DioErrorMapper.map(e));
  } catch (e, st) {
    return Err(AppFailure.unexpected(e, st));
  }
}
