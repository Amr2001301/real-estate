import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/catalog/units_list/units_list_data.dart';
import 'package:mobile_staff/features/catalog/units_list/units_list_screen.dart';

/// The units list: the website's units page.

Map<String, dynamic> _unit(String id, String code, String status, {String? until}) => {
      'id': id,
      'code': code,
      'status': status,
      'type': '2BR',
      'typeName': 'شقة غرفتين نوم',
      'area': 185,
      'bedrooms': 3,
      'bathrooms': 3,
      'floor': 0,
      'price': '5920000',
      'reservationExpiresAt': until,
      'building': {
        'name': 'عمارة 2',
        'phase': {
          'project': {'id': 'p1', 'name': 'نايل جاردنز ريزيدنس'},
        },
      },
    };

class _Repo implements UnitsListRepository {
  final queries = <UnitsQuery>[];
  @override
  Future<Result<UnitsPage>> page(UnitsQuery q, int page) async {
    queries.add(q);
    return Ok(UnitsPage(rows: [
      CatalogUnitRow.fromJson(_unit('u1', 'DF-NG-B02-501', 'RESERVED', until: '2026-11-14T09:00:00Z')),
      CatalogUnitRow.fromJson(_unit('u2', 'A-101', 'AVAILABLE')),
    ], total: 2));
  }

  @override
  Future<Result<UnitsStrip>> strip() async => Ok(UnitsStrip.fromMeta(const {
        'total': 52,
        'facets': {
          'counts': {'status': {'AVAILABLE': 21, 'RESERVED': 5, 'SOLD': 26}},
          'sums': {'price': '242397000'},
        },
      }));

  @override
  Future<Result<List<(String, String)>>> projects() async => const Ok([('p1', 'نايل جاردنز ريزيدنس')]);

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

void main() {
  test('a row reads the project, building, type and when its reservation lapses', () {
    final r = CatalogUnitRow.fromJson(_unit('u1', 'X', 'RESERVED', until: '2026-11-14T09:00:00Z'));
    expect(r.projectName, 'نايل جاردنز ريزيدنس');
    expect(r.buildingName, 'عمارة 2');
    expect(r.typeName, 'شقة غرفتين نوم');
    expect(r.price, 5920000);
    expect(r.reservedUntil, isNotNull);
    expect(CatalogUnitRow.fromJson(_unit('u2', 'Y', 'AVAILABLE', until: '2026-11-14T09:00:00Z')).reservedUntil, isNull);
    expect(const UnitsQuery(status: 'SOLD', bedrooms: 2, search: 'A-').params(1, 20),
        {'page': 1, 'pageSize': 20, 'status': 'SOLD', 'bedrooms': 2, 'q': 'A-'});
  });

  testWidgets('the strip, the status filter and the cards', (t) async {
    t.view.physicalSize = const Size(390 * 3, 1600 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    final repo = _Repo();
    final cubit = UnitsListCubit(repo);
    addTearDown(cubit.close);
    await t.pumpWidget(BlocProvider.value(
      value: cubit,
      child: MaterialApp(
        theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
        locale: const Locale('ar'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: const UnitsListScreen(),
      ),
    ));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('home-fig-inventory')), findsOneWidget);
    expect(find.text('قيمة المخزون (مليون)'), findsOneWidget);
    expect(find.byKey(const Key('unit-card-u1')), findsOneWidget);
    expect(find.byKey(const Key('unit-reserved-u1')), findsOneWidget);
    expect(find.byKey(const Key('unit-reserved-u2')), findsNothing);
    expect(find.text('الدور الأرضي'), findsNWidgets(2));
    expect(find.textContaining('5,920,000'), findsNWidgets(2));

    await t.tap(find.byKey(const Key('home-pill-AVAILABLE')));
    await t.pumpAndSettle();
    expect(repo.queries.last.status, 'AVAILABLE');

    await t.tap(find.byKey(const Key('units-filters')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('units-project-p1')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('units-apply')));
    await t.pumpAndSettle();
    expect(repo.queries.last.projectId, 'p1');
    expect(repo.queries.last.status, 'AVAILABLE'); // kept
    // The pick shows as a chip; ✕ drops it.
    expect(find.byKey(const Key('units-chip-project')), findsOneWidget);
    await t.tap(find.descendant(of: find.byKey(const Key('units-chip-project')), matching: find.byIcon(Icons.close_rounded)));
    await t.pumpAndSettle();
    expect(repo.queries.last.projectId, isNull);
    expect(find.byKey(const Key('units-chip-project')), findsNothing);
  });
}
