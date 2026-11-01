import 'dart:convert';

import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/security/data/security_repository_impl.dart';
import 'package:mobile_staff/features/security/domain/security.dart';
import 'package:mobile_staff/features/security/presentation/security_cubit.dart';
import 'package:mobile_staff/features/security/presentation/security_screen.dart';

/// SES1 / TFA1 in the staff app: devices, two-step sign-in, password.

class _Adapter implements HttpClientAdapter {
  _Adapter(this.body);
  final Object body;
  final requests = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(RequestOptions options, _, _) async {
    requests.add(options);
    return ResponseBody.fromString(jsonEncode(body), 200, headers: {
      Headers.contentTypeHeader: ['application/json'],
    });
  }

  @override
  void close({bool force = false}) {}
}

class _Repo implements SecurityRepository {
  _Repo({this.tfa = const TwoFactorStatus(available: true)});
  List<DeviceSession> devices = [
    DeviceSession(id: 'other', userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0', ip: '10.0.0.2', lastSeenAt: DateTime(2026, 10, 30, 9)),
    DeviceSession(id: 'me', userAgent: 'Dart/3.5 (dart:io) android', current: true, lastSeenAt: DateTime(2026, 10, 1)),
  ];
  TwoFactorStatus tfa;
  final calls = <String>[];

  @override
  Future<Result<List<DeviceSession>>> sessions() async => Ok(devices);

  @override
  Future<Result<void>> signOut(String sessionId) async {
    calls.add('out:$sessionId');
    devices = devices.where((d) => d.id != sessionId).toList();
    return const Ok(null);
  }

  @override
  Future<Result<int>> signOutOthers() async {
    calls.add('others');
    final n = devices.where((d) => !d.current).length;
    devices = devices.where((d) => d.current).toList();
    return Ok(n);
  }

  @override
  Future<Result<TwoFactorStatus>> twoFactor() async => Ok(tfa);

  @override
  Future<Result<TwoFactorSetup>> setupTwoFactor() async =>
      const Ok(TwoFactorSetup(secret: 'JBSWY3DPEHPK3PXP', otpauthUrl: 'otpauth://totp/x?secret=JBSWY3DPEHPK3PXP'));

  @override
  Future<Result<List<String>>> enableTwoFactor(String code) async {
    calls.add('enable:$code');
    if (code != '123456') return Err(AppFailure(type: FailureType.validation, code: 'TWO_FACTOR_INVALID'));
    tfa = const TwoFactorStatus(available: true, enabled: true, recoveryCodesLeft: 10);
    return const Ok(['aaaa-1111', 'bbbb-2222']);
  }

  @override
  Future<Result<void>> disableTwoFactor({required String password, required String code}) async {
    calls.add('disable:$password:$code');
    tfa = const TwoFactorStatus(available: true);
    return const Ok(null);
  }

  @override
  Future<Result<List<String>>> newRecoveryCodes(String code) async => const Ok(['cccc-3333']);

  @override
  Future<Result<void>> changePassword({required String current, required String next}) async {
    calls.add('pw:$current:$next');
    return const Ok(null);
  }
}

Future<void> _pump(WidgetTester t, _Repo repo) async {
  t.view.physicalSize = const Size(430, 1600);
  t.view.devicePixelRatio = 1;
  addTearDown(t.view.reset);
  await t.pumpWidget(MaterialApp(
    theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
    locale: const Locale('ar'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: BlocProvider(create: (_) => SecurityCubit(repo), child: const SecurityScreen()),
  ));
  await t.pump();
  await t.pump();
}

void main() {
  test('devices are read from their user agent', () {
    expect(deviceKindOf('Dart/3.5 (dart:io) iOS'), DeviceKind.iphone);
    expect(deviceKindOf('Mozilla/5.0 (Linux; Android 14) Chrome/120'), DeviceKind.android);
    expect(deviceKindOf('Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari/605'), DeviceKind.mac);
    expect(deviceKindOf(null), DeviceKind.unknown);
    expect(browserOf('Mozilla/5.0 Chrome/120 Edg/120'), 'Edge');
  });

  test('the repository: sessions, signing others out, codes sent as six digits', () async {
    final adapter = _Adapter({
      'data': [
        {'id': 's1', 'userAgent': 'x', 'ipAddress': '1.2.3.4', 'createdAt': '2026-10-01T10:00:00Z', 'lastSeenAt': null, 'current': true},
      ],
      'ended': 2,
      'recoveryCodes': ['a', 'b'],
    });
    final repo = SecurityRepositoryImpl(Dio(BaseOptions(baseUrl: 'https://api.test'))..httpClientAdapter = adapter);
    final list = (await repo.sessions()).dataOrNull!;
    expect(list.single.current, isTrue);
    expect(list.single.ip, '1.2.3.4');
    expect((await repo.signOutOthers()).dataOrNull, 2);
    expect((await repo.enableTwoFactor('١٢٣ ٤٥٦')).dataOrNull, ['a', 'b']);
    expect(adapter.requests.last.data, {'code': '123456'});
    expect(adapter.requests.map((r) => '${r.method} ${r.path}'), [
      'GET /auth/sessions',
      'POST /auth/sessions/revoke-others',
      'POST /auth/2fa/enable',
    ]);
  });

  test('the cubit puts this phone first', () async {
    final cubit = SecurityCubit(_Repo());
    await cubit.load();
    expect(cubit.state.sessions.first.id, 'me');
    expect(cubit.state.otherDevices, 1);
  });

  testWidgets('devices: this phone, another signed out after asking', (t) async {
    final repo = _Repo();
    await _pump(t, repo);
    expect(find.text('الجهاز ده'), findsOneWidget);
    expect(find.text('Chrome على Windows'), findsOneWidget);
    await t.tap(find.byKey(const ValueKey('session-out-other')));
    await t.pump(const Duration(milliseconds: 300));
    await t.tap(find.widgetWithText(FilledButton, 'خروج'));
    await t.pump();
    await t.pump();
    expect(repo.calls, ['out:other']);
    expect(find.text('Chrome على Windows'), findsNothing);
    expect(find.byKey(const Key('security-sign-out-others')), findsNothing);
  });

  testWidgets('two-step sign-in: turned on with a code, then the recovery codes', (t) async {
    final repo = _Repo();
    await _pump(t, repo);
    await t.tap(find.byKey(const Key('security-2fa-on')));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('security-enable-sheet')), findsOneWidget);
    expect(find.text('JBSWY3DPEHPK3PXP'), findsOneWidget);

    await t.enterText(find.byKey(const Key('security-enable-code')), '000000');
    await t.tap(find.byKey(const Key('security-enable-submit')));
    await t.pump();
    expect(find.text('الكود غير صحيح — تأكد من الكود الحالي في التطبيق'), findsOneWidget);

    await t.enterText(find.byKey(const Key('security-enable-code')), '123456');
    await t.tap(find.byKey(const Key('security-enable-submit')));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('security-codes')), findsOneWidget);
    expect(find.text('aaaa-1111'), findsOneWidget);
    await t.tap(find.text('حفظتها — متابعة'));
    await t.pumpAndSettle();
    expect(find.text('فاضل 10 كود احتياطي'), findsOneWidget);
    expect(find.text('شغّال'), findsOneWidget);
  });

  testWidgets('required by the company: no way to turn it off', (t) async {
    await _pump(t, _Repo(tfa: const TwoFactorStatus(available: true, enabled: true, required: true, recoveryCodesLeft: 2)));
    expect(find.byKey(const Key('security-2fa-off')), findsNothing);
    expect(find.text('شركتك بتطلب التحقق بخطوتين، فمينفعش يتقفل.'), findsOneWidget);
  });

  testWidgets('turned off with the password and a code', (t) async {
    final repo = _Repo(tfa: const TwoFactorStatus(available: true, enabled: true, recoveryCodesLeft: 8));
    await _pump(t, repo);
    await t.tap(find.byKey(const Key('security-2fa-off')));
    await t.pumpAndSettle();
    await t.enterText(find.byKey(const Key('security-dialog-password')), 'Secret123!');
    await t.enterText(find.byKey(const Key('security-dialog-code')), '654321');
    await t.tap(find.byKey(const Key('security-dialog-submit')));
    await t.pumpAndSettle();
    expect(repo.calls, ['disable:Secret123!:654321']);
    expect(find.text('مقفول'), findsOneWidget);
  });

  testWidgets('password: the two must match, then it is changed', (t) async {
    final repo = _Repo();
    await _pump(t, repo);
    await t.tap(find.byKey(const Key('security-change-password')));
    await t.pumpAndSettle();
    await t.enterText(find.byKey(const Key('pw-current')), 'Old12345');
    await t.enterText(find.byKey(const Key('pw-next')), 'New123456');
    await t.enterText(find.byKey(const Key('pw-again')), 'New12345x');
    await t.tap(find.byKey(const Key('pw-save')));
    await t.pump();
    expect(find.text('كلمتين المرور مش زي بعض'), findsOneWidget);
    await t.enterText(find.byKey(const Key('pw-again')), 'New123456');
    await t.tap(find.byKey(const Key('pw-save')));
    await t.pumpAndSettle();
    expect(repo.calls, ['pw:Old12345:New123456']);
  });
}
