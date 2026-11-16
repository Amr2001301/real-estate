import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/account/presentation/account_screen.dart';
import 'package:mobile_customer/features/content/domain/content.dart';
import 'package:mobile_customer/features/notifications/domain/entities/app_notification.dart';
import 'package:mobile_customer/features/notifications/domain/repositories/notifications_repository.dart';
import 'package:mobile_customer/features/notifications/domain/usecases/notification_use_cases.dart';
import 'package:mobile_customer/features/notifications/presentation/unread_count_cubit.dart';

/// «حسابي»: the hero stays where it is while the list under it scrolls.

class _Notifications implements NotificationsRepository {
  @override
  Future<Result<int>> getUnreadCount() async => const Ok(0);
  @override
  Future<Result<List<AppNotification>>> getNotifications({int page = 1}) async => const Ok([]);
  @override
  Future<Result<void>> markRead(String id) async => const Ok(null);
  @override
  Future<Result<void>> markAllRead() async => const Ok(null);
  @override
  Future<Result<void>> registerDevice(String token, String platform) async => const Ok(null);
  @override
  Future<Result<void>> unregisterDevice(String token) async => const Ok(null);
}

class _Content implements ContentRepository {
  @override
  Future<Result<List<ContentBanner>>> banners() async => const Ok([]);
  @override
  Future<Result<List<ContentPage>>> pages() async => const Ok([]);
  @override
  Future<Result<ContentPage>> page(String slug) async => throw UnimplementedError();
}

void main() {
  testWidgets('the account hero does not scroll with the list', (tester) async {
    tester.view.physicalSize = const Size(390, 700);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(RepositoryProvider<ContentRepository>.value(
      value: _Content(),
      child: MultiBlocProvider(
        providers: [
          BlocProvider(create: (_) => SessionCubit(TokenStorage())..adoptSignedOut()),
          BlocProvider(create: (_) => UnreadCountCubit(GetUnreadCount(_Notifications()))),
        ],
        child: MaterialApp(
          theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
          locale: const Locale('ar'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: const Scaffold(body: AccountScreen()),
        ),
      ),
    ));
    await tester.pumpAndSettle();

    final hero = find.byKey(const Key('account-hero'));
    final before = tester.getTopLeft(hero);
    await tester.drag(find.byKey(const Key('account-list')), const Offset(0, -400));
    await tester.pumpAndSettle();

    expect(hero, findsOneWidget);
    expect(tester.getTopLeft(hero), before);
  });
}
