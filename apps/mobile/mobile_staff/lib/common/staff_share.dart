import 'package:core/core.dart';
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
    required AppLocalizations l10n,
  }) async {
    final url = '$_kPortalBase/projects/$projectId';
    final message = '🏡 $projectName\n\n${l10n.shareProjectBody}\n$url';
    await Share.share(message, subject: projectName);
  }

  static Future<void> unit({
    required String unitId,
    required String unitCode,
    required String projectName,
    required AppLocalizations l10n,
  }) async {
    final url = '$_kPortalBase/units/$unitId';
    final message = '🏠 ${l10n.unitTitle(unitCode)} — $projectName\n\n${l10n.shareUnitBody}\n$url';
    await Share.share(message, subject: '$unitCode – $projectName');
  }
}
