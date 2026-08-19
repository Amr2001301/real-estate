import 'package:dio/dio.dart';

abstract interface class InfoRequestRemoteDataSource {
  Future<void> create({
    required String message,
    String? projectId,
    String? unitId,
  });
}

class InfoRequestRemoteDataSourceImpl implements InfoRequestRemoteDataSource {
  InfoRequestRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<void> create({
    required String message,
    String? projectId,
    String? unitId,
  }) async {
    await _dio.post<void>('/me/info-requests', data: {
      'message': message,
      'projectId': ?projectId,
      'unitId': ?unitId,
    });
  }
}
