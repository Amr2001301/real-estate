import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

/// Secure persistence for auth tokens and the chat `anonymousId`.
///
/// Tokens live in the platform keystore/keychain via [FlutterSecureStorage] —
/// never in plaintext prefs or files (per project security guidance).
class TokenStorage {
  TokenStorage([FlutterSecureStorage? storage])
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
              iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
            );

  final FlutterSecureStorage _storage;

  static const _kAccess = 'auth.accessToken';
  static const _kRefresh = 'auth.refreshToken';
  static const _kSession = 'auth.session';
  static const _kAnonId = 'chat.anonymousId';

  Future<String?> readAccessToken() => _storage.read(key: _kAccess);
  Future<String?> readRefreshToken() => _storage.read(key: _kRefresh);

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _storage.write(key: _kAccess, value: accessToken);
    await _storage.write(key: _kRefresh, value: refreshToken);
  }

  Future<void> saveAccessToken(String accessToken) =>
      _storage.write(key: _kAccess, value: accessToken);

  /// Reads (or lazily creates) the stable anonymous id used by the chat
  /// assistant. Generated on first use and reused across sessions.
  Future<String?> readAnonymousId() => _storage.read(key: _kAnonId);
  Future<void> saveAnonymousId(String id) =>
      _storage.write(key: _kAnonId, value: id);

  /// Returns the persisted anonymous id, generating + storing one on first use.
  Future<String> ensureAnonymousId() async {
    final existing = await readAnonymousId();
    if (existing != null && existing.isNotEmpty) return existing;
    final id = const Uuid().v4();
    await saveAnonymousId(id);
    return id;
  }

  Future<bool> get hasSession async =>
      (await readAccessToken())?.isNotEmpty ?? false;

  /// The serialized [Session] JSON (identity + role), stored alongside tokens.
  Future<String?> readSessionJson() => _storage.read(key: _kSession);
  Future<void> saveSessionJson(String json) =>
      _storage.write(key: _kSession, value: json);

  /// Clears auth tokens and session (keeps the anonymous chat id).
  Future<void> clear() async {
    await _storage.delete(key: _kAccess);
    await _storage.delete(key: _kRefresh);
    await _storage.delete(key: _kSession);
  }
}
