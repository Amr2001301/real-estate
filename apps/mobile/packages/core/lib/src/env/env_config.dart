import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;

import 'app_environment.dart';

/// Immutable, per-environment configuration.
///
/// Holds only **non-secret** values. There is no AI provider key here (and
/// there never will be): the chat assistant talks to backend endpoints only.
/// The WhatsApp number is owned by the client per the chat API contract.
class EnvConfig {
  const EnvConfig({
    required this.environment,
    required this.apiBaseUrl,
    required this.whatsappNumber,
    required this.contactPhone,
    this.appStoreUrl,
    this.googlePlayUrl,
    this.enableLogging = true,
  });

  /// Which environment this build targets.
  final AppEnvironment environment;

  /// Base URL including the `/v1` API version prefix.
  final String apiBaseUrl;

  /// Digits-only WhatsApp number used to build `wa.me` deep links.
  /// Empty string hides WhatsApp CTAs.
  final String whatsappNumber;

  /// Phone number for tap-to-call.
  final String contactPhone;

  final String? appStoreUrl;
  final String? googlePlayUrl;

  /// Verbose network/error logging. Disabled in prod by default.
  final bool enableLogging;

  // ---- Named environment presets -------------------------------------------

  static const EnvConfig dev = EnvConfig(
    environment: AppEnvironment.dev,
    apiBaseUrl: 'http://localhost:4000/v1',
    whatsappNumber: '',
    contactPhone: '',
  );

  static const EnvConfig staging = EnvConfig(
    environment: AppEnvironment.staging,
    apiBaseUrl: 'https://staging-api.example.com/v1',
    whatsappNumber: '',
    contactPhone: '',
  );

  static const EnvConfig prod = EnvConfig(
    environment: AppEnvironment.prod,
    apiBaseUrl: 'https://api.example.com/v1',
    whatsappNumber: '',
    contactPhone: '',
    enableLogging: false,
  );

  // ---- Ambient singleton ----------------------------------------------------

  static EnvConfig? _current;

  /// The active config. Throws if [initialize] was not called by the entrypoint.
  static EnvConfig get current {
    final config = _current;
    if (config == null) {
      throw StateError(
        'EnvConfig.initialize() must be called from the app entrypoint '
        '(main_dev.dart / main_staging.dart / main_prod.dart) before use.',
      );
    }
    return config;
  }

  /// Called once from the entrypoint. `--dart-define` values can override the
  /// preset (e.g. pointing dev at a LAN backend) without code changes.
  ///
  /// For dev builds on Android emulator, `localhost` is automatically remapped
  /// to `10.0.2.2` (the host machine alias). Override with
  /// `--dart-define=API_BASE_URL=http://192.168.x.x:4000/v1` for a real device
  /// on LAN, or any time you need to point at a non-default host.
  static EnvConfig initialize(EnvConfig base) {
    const overrideUrl = String.fromEnvironment('API_BASE_URL');

    String resolvedUrl = base.apiBaseUrl;
    if (overrideUrl.isNotEmpty) {
      resolvedUrl = overrideUrl;
    } else if (base.environment == AppEnvironment.dev &&
        !kIsWeb &&
        Platform.isAndroid) {
      // On Android emulator, localhost/127.0.0.1 resolves to the emulator
      // itself, not the host machine. The host is reachable via 10.0.2.2.
      resolvedUrl = resolvedUrl
          .replaceFirst('localhost', '10.0.2.2')
          .replaceFirst('127.0.0.1', '10.0.2.2');
    }

    final resolved = resolvedUrl == base.apiBaseUrl
        ? base
        : EnvConfig(
            environment: base.environment,
            apiBaseUrl: resolvedUrl,
            whatsappNumber: base.whatsappNumber,
            contactPhone: base.contactPhone,
            appStoreUrl: base.appStoreUrl,
            googlePlayUrl: base.googlePlayUrl,
            enableLogging: base.enableLogging,
          );
    _current = resolved;
    return resolved;
  }
}
