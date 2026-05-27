/// The build environment a mobile app instance runs against.
///
/// In Phase 1 the environment is selected by the entrypoint (`main_dev.dart`,
/// `main_staging.dart`, `main_prod.dart`) which calls [EnvConfig.initialize].
/// Native build flavors (separate bundle IDs / signing) are a documented
/// follow-up; nothing here depends on them.
enum AppEnvironment { dev, staging, prod }

extension AppEnvironmentX on AppEnvironment {
  bool get isProd => this == AppEnvironment.prod;
  bool get isDev => this == AppEnvironment.dev;

  String get label => switch (this) {
        AppEnvironment.dev => 'DEV',
        AppEnvironment.staging => 'STAGING',
        AppEnvironment.prod => 'PROD',
      };
}
