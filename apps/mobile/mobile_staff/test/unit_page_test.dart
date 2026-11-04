import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/catalog/unit_page/unit_page_data.dart';
import 'package:mobile_staff/features/catalog/unit_page/unit_page_screen.dart';

/// A unit's page: the website's unit page.

Map<String, dynamic> _unit(String status) => {
      'id': 'u1',
      'code': 'DF-NG-B02-501',
      'type': '2BR',
      'typeName': 'شقة غرفتين نوم',
      'status': status,
      'area': 185,
      'netArea': 152,
      'finishing': 'SEMI_FINISHED',
      'bedrooms': 3,
      'bathrooms': 3,
      'floor': 5,
      'price': '5920000',
      'updatedAt': '2026-11-04T09:02:32.919Z',
      'effectiveDeliveryDate': '2028-06-30',
      'building': {
        'name': 'عمارة 2',
        'phase': {
          'name': 'المرحلة الأولى',
          'project': {'id': 'p1', 'name': 'نايل جاردنز ريزيدنس', 'city': 'القاهرة الجديدة'},
        },
      },
      'history': [
        {'oldStatus': 'AVAILABLE', 'newStatus': 'RESERVED', 'reason': 'Reservation RES-2026-0030', 'changedAt': '2026-11-04T09:02:32Z'},
      ],
    };

const _reservations = [
  {
    'id': 'r1',
    'reservationNumber': 'RES-2026-0030',
    'status': 'APPROVED',
    'lead': {'fullName': 'شريف إبراهيم'},
    'sales': {'fullName': 'هالة عبد الرحمن'},
    'expiresAt': '2026-11-14T09:02:32Z',
  },
  {'id': 'r0', 'reservationNumber': 'RES-2026-0001', 'status': 'EXPIRED', 'client': {'fullName': 'أحمد'}, 'createdAt': '2026-06-01T09:00:00Z'},
];

class _Repo implements UnitPageRepository {
  _Repo(this.status);
  final String status;
  @override
  Future<Result<UnitPage>> load(String id) async => Ok(UnitPage.parse(_unit(status), reservations: _reservations));
  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

Future<void> _pump(WidgetTester t, String status) async {
  t.view.physicalSize = const Size(390 * 3, 3200 * 3);
  t.view.devicePixelRatio = 3;
  addTearDown(t.view.reset);
  final cubit = UnitPageCubit(_Repo(status), unitId: 'u1');
  addTearDown(cubit.close);
  await t.pumpWidget(BlocProvider.value(
    value: cubit,
    child: MaterialApp(
      theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
      locale: const Locale('ar'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: const UnitPageScreen(),
    ),
  ));
  await t.pump();
  await t.pump(const Duration(milliseconds: 300));
}

void main() {
  test('reads where the unit sits, the live and past reservations, and the history', () {
    final p = UnitPage.parse(_unit('RESERVED'), reservations: _reservations);
    expect(p.phaseName, 'المرحلة الأولى');
    expect(p.buildingName, 'عمارة 2');
    expect(p.typeName, 'شقة غرفتين نوم');
    expect(p.active?.client, 'شريف إبراهيم'); // the lead when there is no client yet
    expect(p.active?.sales, 'هالة عبد الرحمن');
    expect(p.past.single.number, 'RES-2026-0001');
    expect(p.history.single.to, 'RESERVED');
    expect(p.unit.specs.netArea, 152);
  });

  testWidgets('a reserved unit: price, specs, the live reservation, the project; no booking button', (t) async {
    await _pump(t, 'RESERVED');
    expect(find.byKey(const Key('unit-price')), findsOneWidget);
    expect(find.byKey(const Key('unit-calculator')), findsOneWidget);
    expect(find.byKey(const Key('unit-share')), findsOneWidget); // on the cover
    expect(find.byKey(const Key('unit-spec-table')), findsOneWidget);
    expect(find.text('نصف تشطيب'), findsOneWidget);
    expect(find.byKey(const Key('unit-active-reservation')), findsOneWidget);
    expect(find.text('شريف إبراهيم'), findsOneWidget);
    expect(find.text('عمارة 2'), findsOneWidget);
    expect(find.byKey(const Key('unit-reserve')), findsNothing);
  });

  testWidgets('a free unit has the one booking button at the bottom', (t) async {
    await _pump(t, 'AVAILABLE');
    expect(find.byKey(const Key('unit-reserve')), findsOneWidget);
  });
}
