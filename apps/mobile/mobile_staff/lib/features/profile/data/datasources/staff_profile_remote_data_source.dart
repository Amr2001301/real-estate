import 'package:dio/dio.dart';

import '../dtos/staff_profile_dto.dart';

abstract interface class StaffProfileRemoteDataSource {
  Future<StaffProfileDto> getMyProfile();
}

class StaffProfileRemoteDataSourceImpl implements StaffProfileRemoteDataSource {
  StaffProfileRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<StaffProfileDto> getMyProfile() async {
    final res = await _dio.get<Map<String, dynamic>>('/users/me');
    return StaffProfileDto.fromJson(res.data ?? const {});
  }
}
