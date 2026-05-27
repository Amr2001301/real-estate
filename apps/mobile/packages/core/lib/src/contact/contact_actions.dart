import 'package:url_launcher/url_launcher.dart';

/// Outbound contact actions. The WhatsApp number / phone are **client-owned**
/// (from `EnvConfig`), never returned by the API. Each returns false if it
/// can't be launched (e.g. no number configured) so callers can hide the CTA.
abstract final class ContactActions {
  static Future<bool> whatsApp({required String number, String? message}) async {
    final digits = number.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.isEmpty) return false;
    final text = (message == null || message.isEmpty)
        ? ''
        : '?text=${Uri.encodeComponent(message)}';
    return _launch(Uri.parse('https://wa.me/$digits$text'));
  }

  static Future<bool> call(String phone) async {
    final digits = phone.replaceAll(RegExp(r'[^0-9+]'), '');
    if (digits.isEmpty) return false;
    return _launch(Uri(scheme: 'tel', path: digits));
  }

  /// Opens the device's maps app at the coordinates.
  static Future<bool> openMap({
    required double lat,
    required double lng,
    String? label,
  }) {
    final query = label == null || label.isEmpty ? '$lat,$lng' : Uri.encodeComponent(label);
    final uri = Uri.parse(
      'https://www.google.com/maps/search/?api=1&query=$lat,$lng($query)',
    );
    return _launch(uri);
  }

  static Future<bool> openExternal(String url) => _launch(Uri.parse(url));

  static Future<bool> _launch(Uri uri) async {
    if (!await canLaunchUrl(uri)) return false;
    return launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}
