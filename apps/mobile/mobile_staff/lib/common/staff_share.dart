import 'package:share_plus/share_plus.dart';

// Configure via --dart-define=PORTAL_URL=https://yourdomain.com
const String _kPortalBase = String.fromEnvironment(
  'PORTAL_URL',
  defaultValue: 'https://devora.com',
);

abstract final class StaffShare {
  static Future<void> project({
    required String projectId,
    required String projectName,
  }) async {
    final url = '$_kPortalBase/projects/$projectId';
    final message =
        '🏡 $projectName\n\n'
        'استعرض المشروع واكتشف الوحدات المتاحة:\n$url';
    await Share.share(message, subject: projectName);
  }

  static Future<void> unit({
    required String unitId,
    required String unitCode,
    required String projectName,
  }) async {
    final url = '$_kPortalBase/units/$unitId';
    final message =
        '🏠 وحدة $unitCode — $projectName\n\n'
        'استعرض تفاصيل الوحدة:\n$url';
    await Share.share(message, subject: '$unitCode – $projectName');
  }
}
