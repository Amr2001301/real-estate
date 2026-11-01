import 'package:core/core.dart';
import 'package:dio/dio.dart';

import '../../leads/presentation/follow_up_labels.dart';
import '../domain/security.dart';

class SecurityRepositoryImpl implements SecurityRepository {
  SecurityRepositoryImpl(this._dio);
  final Dio _dio;

  /// A code as typed ("123 456") → "123456".
  String _digits(String code) => latinDigits(code).replaceAll(RegExp(r'\s'), '');

  List<String> _codes(Map<String, dynamic>? body) =>
      ((body?['recoveryCodes'] as List?) ?? const []).whereType<String>().toList();

  @override
  Future<Result<List<DeviceSession>>> sessions() => guardApiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>('/auth/sessions');
        return ((res.data?['data'] as List?) ?? const []).whereType<Map<String, dynamic>>().map(DeviceSession.fromJson).toList();
      });

  @override
  Future<Result<void>> signOut(String sessionId) => guardApiCall(() async {
        await _dio.delete<void>('/auth/sessions/$sessionId');
      });

  @override
  Future<Result<int>> signOutOthers() => guardApiCall(() async {
        final res = await _dio.post<Map<String, dynamic>>('/auth/sessions/revoke-others');
        return (res.data?['ended'] as num?)?.toInt() ?? 0;
      });

  @override
  Future<Result<TwoFactorStatus>> twoFactor() => guardApiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>('/auth/2fa');
        return TwoFactorStatus.fromJson(res.data ?? const {});
      });

  @override
  Future<Result<TwoFactorSetup>> setupTwoFactor() => guardApiCall(() async {
        final res = await _dio.post<Map<String, dynamic>>('/auth/2fa/setup');
        return TwoFactorSetup(
          secret: (res.data?['secret'] as String?) ?? '',
          otpauthUrl: (res.data?['otpauthUrl'] as String?) ?? '',
        );
      });

  @override
  Future<Result<List<String>>> enableTwoFactor(String code) => guardApiCall(() async {
        final res = await _dio.post<Map<String, dynamic>>('/auth/2fa/enable', data: {'code': _digits(code)});
        return _codes(res.data);
      });

  @override
  Future<Result<void>> disableTwoFactor({required String password, required String code}) => guardApiCall(() async {
        await _dio.post<void>('/auth/2fa/disable', data: {'password': password, 'code': _digits(code)});
      });

  @override
  Future<Result<List<String>>> newRecoveryCodes(String code) => guardApiCall(() async {
        final res = await _dio.post<Map<String, dynamic>>('/auth/2fa/recovery-codes', data: {'code': _digits(code)});
        return _codes(res.data);
      });

  @override
  Future<Result<void>> changePassword({required String current, required String next}) => guardApiCall(() async {
        await _dio.post<void>('/auth/change-password', data: {'currentPassword': current, 'newPassword': next});
      });
}
