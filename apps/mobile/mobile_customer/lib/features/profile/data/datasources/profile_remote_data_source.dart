import 'package:dio/dio.dart';

import '../dtos/user_profile_dto.dart';

/// Raw network access to the profile endpoints. **Authenticated** (bearer is
/// injected by the AuthInterceptor — no skipAuth). May throw.
abstract interface class ProfileRemoteDataSource {
  Future<UserProfileDto> getMe();
  Future<UserProfileDto> updateMe(Map<String, dynamic> body);
}

class ProfileRemoteDataSourceImpl implements ProfileRemoteDataSource {
  ProfileRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<UserProfileDto> getMe() async {
    final res = await _dio.get<Map<String, dynamic>>('/users/me');
    return UserProfileDto.fromJson(res.data!);
  }

  @override
  Future<UserProfileDto> updateMe(Map<String, dynamic> body) async {
    final res = await _dio.patch<Map<String, dynamic>>('/users/me', data: body);
    return UserProfileDto.fromJson(res.data!);
  }
}
