import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/clients/client_detail_screen.dart';
import 'package:mobile_staff/features/clients/clients_data.dart';
import 'package:mobile_staff/features/clients/clients_screen.dart';
import 'package:mobile_staff/features/leads/domain/entities/lead.dart';
import 'package:mobile_staff/features/permissions/staff_permissions.dart';

/// The clients pages: admins only, with the website's data.

final _client = ClientRow(
  id: 'c1',
  name: 'رانيا غالي',
  role: 'CUSTOMER',
  active: true,
  phone: '+201000000025',
  email: 'rania@example.com',
  createdAt: DateTime(2026, 10, 1),
);

class _Repo implements AdminClientsRepository {
  final active = <bool>[];
  @override
  Future<Result<Paginated<ClientRow>>> list({String? role, String? q, int page = 1}) async =>
      Ok(Paginated(data: [_client], meta: PageMeta(page: 1, pageSize: 20, total: 1, totalPages: 1)));
  @override
  Future<Result<ClientCounts>> counts() async => const Ok(ClientCounts(browsers: 9, owners: 5, suspended: 1));
  @override
  Future<Result<ClientProfile>> profile(String id) async => Ok(ClientProfile(
        client: _client,
        locale: 'ar',
        details: const {'nationalId': '29001011234567', 'occupation': 'مهندسة'},
        leads: [
          Lead(
            id: 'l1',
            fullName: 'رانيا غالي',
            stage: 'NEGOTIATION',
            assignedSalesName: 'محمود البنا',
            nextActionAt: DateTime.now().subtract(const Duration(hours: 3)),
            projectName: Translatable.fromJson('نايل كريست'),
          ),
        ],
        contracts: [ClientItem(id: 'k1', number: 'CN-2026-0004', unitCode: 'NC-301', amount: 4320000, status: 'SIGNED', at: DateTime(2026, 10, 16))],
        documents: const [ClientItem(id: 'd1', number: 'عقد البيع.pdf', status: 'CONTRACT', extra: 'هالة')],
      ));
  @override
  Future<Result<void>> setActive(String id, bool value) async {
    active.add(value);
    return const Ok(null);
  }
}

Widget _app(Widget home, BlocProvider provider) => BlocProvider.value(
      value: SessionCubit(TokenStorage())..adopt(const Session(userId: 'a1', role: AppRole.admin)),
      child: MultiBlocProvider(
        providers: [provider],
        child: MaterialApp(
          theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
          locale: const Locale('ar'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: home,
        ),
      ),
    );

void main() {
  test('the clients page is for admins only', () {
    const none = StaffPermissions();
    expect(StaffAccess.clients(AppRole.admin, none), isTrue);
    expect(StaffAccess.clients(AppRole.salesManager, none), isFalse);
    expect(StaffAccess.clients(AppRole.sales, none), isFalse);
    expect(StaffAccess.clients(AppRole.sales, const StaffPermissions({'users:read'})), isFalse);
  });

  testWidgets('the list shows the counts and the client card', (t) async {
    t.view.physicalSize = const Size(390 * 3, 1400 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    final cubit = ClientsCubit(_Repo());
    addTearDown(cubit.close);
    await t.pumpWidget(_app(const ClientsScreen(), BlocProvider<ClientsCubit>.value(value: cubit)));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('home-fig-suspended')), findsOneWidget);
    expect(find.byKey(const Key('client-c1')), findsOneWidget);
    expect(find.text('مالك'), findsWidgets);
  });

  testWidgets('the detail shows the account, details, leads with follow-ups, contracts, documents; suspends', (t) async {
    t.view.physicalSize = const Size(390 * 3, 3000 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    final repo = _Repo();
    final cubit = ClientDetailCubit(repo, clientId: 'c1');
    addTearDown(cubit.close);
    await t.pumpWidget(_app(const ClientDetailScreen(), BlocProvider<ClientDetailCubit>.value(value: cubit)));
    await t.pumpAndSettle();
    expect(find.text('الرقم القومي'), findsOneWidget);
    expect(find.byKey(const Key('client-lead-l1')), findsOneWidget);
    expect(find.textContaining('متابعة متأخرة'), findsOneWidget);
    expect(find.byKey(const Key('client-contract-k1')), findsOneWidget);
    expect(find.text('عقد البيع.pdf'), findsOneWidget);

    await t.tap(find.byKey(const Key('client-toggle-active')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('client-suspend-confirm')));
    await t.pumpAndSettle();
    expect(repo.active, [false]);
  });
}
