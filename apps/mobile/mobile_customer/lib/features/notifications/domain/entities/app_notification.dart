import 'package:core/core_domain.dart';

/// An in-app notification. The backend resolves [title]/[body] from the
/// template + payload in the request locale; [templateCode]/[payload] remain
/// for client-side fallback. Domain entity (pure Dart).
class AppNotification extends Equatable {
  const AppNotification({
    required this.id,
    required this.templateCode,
    required this.title,
    required this.body,
    required this.payload,
    required this.read,
    this.createdAt,
  });

  final String id;
  final String templateCode;

  /// Backend-resolved, localized title/body (may be empty → use a fallback).
  final String title;
  final String body;
  final Map<String, dynamic> payload;
  final bool read;
  final DateTime? createdAt;

  @override
  List<Object?> get props => [id, templateCode, title, body, read, createdAt];
}
