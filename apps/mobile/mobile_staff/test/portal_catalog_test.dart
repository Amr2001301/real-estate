import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/broker/catalog/domain/repositories/broker_catalog_repository.dart';
import 'package:mobile_staff/features/broker/catalog/portal/portal_catalog_data.dart';
import 'package:mobile_staff/features/broker/catalog/portal/portal_catalog_screens.dart';

/// The broker's catalog: the portal's projects and units pages.

Map<String, dynamic> _grant(String id, {bool active = true, Object? pct, bool featured = true}) => {
      'project': {
        'id': id,
        'name': id == 'p1' ? 'لاجونا باي — الساحل الشمالي' : 'نايل جاردنز ريزيدنس',
        'city': 'الساحل الشمالي',
        'status': 'PUBLISHED',
        'featured': featured,
        'services': ['نادي اجتماعي', 'أمن 24/7', 'مول تجاري', 'حدائق'],
        'media': [
          {'url': 'https://x/1.jpg', 'type': 'IMAGE'},
        ],
      },
      'access': {'commissionPct': pct, 'fixedAmountPerUnit': null, 'startsAt': null, 'endsAt': null, 'active': active},
    };

Map<String, dynamic> _unit(String status) => {
      'id': 'u1',
      'code': 'DF-LB-Z02-102',
      'type': '3BR',
      'status': status,
      'area': 95,
      'netArea': 78,
      'finishing': 'FULLY_FINISHED',
      'bedrooms': 2,
      'bathrooms': 2,
      'floor': 1,
      'price': '3895000',
      'accessSource': 'PROJECT_ACCESS',
      'building': {
        'name': 'زون اللاجون',
        'phase': {
          'name': 'المرحلة الأولى',
          'project': {'id': 'p1', 'name': 'لاجونا باي — الساحل الشمالي', 'city': 'الساحل الشمالي'},
        },
      },
      'media': const [],
    };

class _Repo implements PortalCatalogRepository {
  @override
  Future<Result<(List<PortalProjectRow>, double?)>> projects() async => Ok((
        [
          PortalProjectRow.fromJson(_grant('p1'), available: 8),
          PortalProjectRow.fromJson(_grant('p2', active: false, pct: '3', featured: false), available: 0),
        ],
        2.5,
      ));
  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

class _Catalog implements BrokerCatalogRepository {
  @override
  Future<Result<List<InstallmentOffer>>> unitPlans(String unitId) async => const Ok([]);
  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

Widget _app(Widget home, {List<BlocProvider> providers = const []}) {
  final app = MaterialApp(
    theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
    locale: const Locale('ar'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: home,
  );
  return RepositoryProvider<BrokerCatalogRepository>.value(
    value: _Catalog(),
    child: providers.isEmpty ? app : MultiBlocProvider(providers: providers, child: app),
  );
}

void main() {
  test('reads the grant, the rate (or the firm\'s default) and the unit\'s type name', () {
    final p = PortalProjectRow.fromJson(_grant('p1'), available: 8);
    expect(p.active, isTrue);
    expect(p.coverUrl, 'https://x/1.jpg');
    expect(portalCommission(p, 2.5, 'ج.م'), (text: '2.50%', isDefault: true)); // the default, as the portal
    final own = PortalProjectRow.fromJson(_grant('p2', pct: '3'));
    expect(portalCommission(own, 2.5, 'ج.م'), (text: '3.00%', isDefault: false));
    final u = PortalUnit.fromJson(_unit('AVAILABLE'));
    expect(u.row.typeName, 'شقة بثلاث غرف نوم'); // the code's name, the portal sends no name
    expect(u.row.projectName, 'لاجونا باي — الساحل الشمالي');
    expect(u.phaseName, 'المرحلة الأولى');
    expect(u.accessSource, 'PROJECT_ACCESS');
    expect(u.specs.netArea, 78);
  });

  testWidgets('the projects tab: the figures, "ready to market" and the rate', (t) async {
    t.view.physicalSize = const Size(390 * 3, 2400 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    final cubit = PortalProjectsCubit(_Repo());
    addTearDown(cubit.close);
    await t.pumpWidget(_app(const PortalProjectsScreen(), providers: [BlocProvider<PortalProjectsCubit>.value(value: cubit)]));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('home-fig-ready')), findsOneWidget);
    expect(find.byKey(const Key('portal-project-p1')), findsOneWidget);
    expect(find.textContaining('2.50%'), findsOneWidget);
    expect(find.textContaining('3.00%'), findsOneWidget);
    expect(find.text('موقوف'), findsOneWidget);

    await t.tap(find.byKey(const Key('home-pill-READY')));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('portal-project-p2')), findsNothing); // paused
  });

  testWidgets('a free unit: price, specs with the access, and the one booking button', (t) async {
    t.view.physicalSize = const Size(390 * 3, 2600 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    await t.pumpWidget(_app(PortalUnitPage(unit: PortalUnit.fromJson(_unit('AVAILABLE')))));
    await t.pump();
    await t.pump(const Duration(milliseconds: 300));
    expect(find.byKey(const Key('unit-price')), findsOneWidget);
    expect(find.text('صلاحية مشروع'), findsOneWidget);
    expect(find.byKey(const Key('portal-unit-reserve')), findsOneWidget);
  });

  testWidgets('a reserved unit has no booking button', (t) async {
    t.view.physicalSize = const Size(390 * 3, 2600 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    await t.pumpWidget(_app(PortalUnitPage(unit: PortalUnit.fromJson(_unit('RESERVED')))));
    await t.pump();
    await t.pump(const Duration(milliseconds: 300));
    expect(find.byKey(const Key('portal-unit-reserve')), findsNothing);
  });
}
