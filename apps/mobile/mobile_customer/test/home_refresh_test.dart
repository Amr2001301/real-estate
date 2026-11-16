import 'package:core/core.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/catalog/presentation/compare/compare_cubit.dart';
import 'package:mobile_customer/features/catalog/presentation/home/home_screen.dart';
import 'package:mobile_customer/features/content/domain/content.dart';
import 'package:mobile_customer/features/home_summary/domain/entities/home_summary.dart';
import 'package:mobile_customer/features/home_summary/domain/repositories/home_summary_repository.dart';
import 'package:mobile_customer/features/home_summary/presentation/home_summary_cubit.dart';
import 'package:mobile_customer/features/notifications/domain/entities/app_notification.dart';
import 'package:mobile_customer/features/notifications/domain/repositories/notifications_repository.dart';
import 'package:mobile_customer/features/notifications/domain/usecases/notification_use_cases.dart';
import 'package:mobile_customer/features/notifications/presentation/unread_count_cubit.dart';

/// A signed-in customer's home: pull-to-refresh starts under the pinned
/// header, not over it.

class _Summary implements HomeSummaryRepository {
  @override
  Future<Result<HomeSummary>> getHomeSummary() async =>
      Err(AppFailure(type: FailureType.network));
}

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
  testWidgets('the refresh indicator sits under the header', (tester) async {
    await tester.pumpWidget(RepositoryProvider<ContentRepository>.value(
      value: _Content(),
      child: MultiBlocProvider(
        providers: [
          BlocProvider(
            create: (_) => SessionCubit(TokenStorage())
              ..adopt(const Session(userId: 'u1', role: AppRole.customer, displayName: 'منى')),
          ),
          BlocProvider(create: (_) => CompareCubit()),
          BlocProvider(create: (_) => UnreadCountCubit(GetUnreadCount(_Notifications()))),
          BlocProvider(create: (_) => HomeSummaryCubit(_Summary())),
        ],
        child: MaterialApp(
          theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
          locale: const Locale('ar'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: const Scaffold(body: HomeScreen()),
        ),
      ),
    ));
    await tester.pump();

    final header = (tester.renderObject(find.byType(SliverPersistentHeader)) as RenderSliver).geometry!.paintExtent;
    final indicator = tester.widget<RefreshIndicator>(find.byKey(const Key('home-refresh')));
    expect(header, greaterThan(0));
    expect(indicator.edgeOffset, header);
  });
}
