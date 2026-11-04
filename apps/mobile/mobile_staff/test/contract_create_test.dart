import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_staff/features/contracts/create/contract_create_data.dart';
import 'package:mobile_staff/features/contracts/create/convert_reservation_screen.dart';
import 'package:mobile_staff/features/contracts/create/manual_contract_screen.dart';

/// Converting an approved booking, and a manual contract (the admin).

Map<String, dynamic> _reservation({String booking = 'PAID', bool snapshot = true}) => {
      'id': 'r1',
      'reservationNumber': 'RES-2026-0029',
      'status': 'APPROVED',
      'bookingAmount': '100000',
      'bookingPaymentStatus': booking,
      'installmentPlanTemplateId': 'tp1',
      'selectedDurationMonths': 60,
      'snapshotDownPaymentAmount': snapshot ? '574000' : null,
      'snapshotMonthlyInstallment': '94565.33',
      'snapshotTotalPayable': '6347920',
      'lead': {'fullName': 'رانيا غالي'},
      'sales': {'fullName': 'محمود البنا'},
      'unit': {
        'code': 'DF-LB-Z01-301',
        'building': {
          'phase': {
            'project': {'name': 'لاجونا باي'},
          },
        },
      },
      'contract': null,
    };

class _Repo extends ContractCreateRepository {
  _Repo(this.json) : super(Dio());
  final Map<String, dynamic> json;
  final converts = <(String, DateTime?, DateTime?)>[];
  final manuals = <Map<String, Object?>>[];

  @override
  Future<Result<ConvertSource>> reservation(String id) async => Ok(ConvertSource.fromJson(json));

  @override
  Future<Result<CreatedContract>> convert(String reservationId, {DateTime? startsAt, DateTime? signedAt, PickedDocument? doc}) async {
    converts.add((reservationId, startsAt, signedAt));
    return const Ok((id: 'c9', signFailed: false));
  }

  @override
  Future<Result<CreatedContract>> createManual({
    required String customerId,
    required String unitId,
    required double total,
    double? down,
    String? number,
    bool preSystem = false,
    DateTime? signedAt,
    PickedDocument? doc,
  }) async {
    manuals.add({'customerId': customerId, 'unitId': unitId, 'total': total, 'preSystem': preSystem, 'signedAt': signedAt});
    return const Ok((id: 'c10', signFailed: false));
  }

  @override
  Future<List<PickHit>> searchClients(String q) async => const [PickHit('u1', 'خالد غالي', '+201009900005')];

  @override
  Future<List<PickHit>> searchUnits(String q) async => const [PickHit('x1', 'DF-NG-B01-202', 'نايل جاردنز', 6880000)];
}

Widget _app(Widget page) => MaterialApp.router(
      theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
      locale: const Locale('ar'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      routerConfig: GoRouter(routes: [
        GoRoute(path: '/', builder: (_, _) => page),
        GoRoute(path: '/contracts/:id', builder: (_, s) => Scaffold(body: Text('contract ${s.pathParameters['id']}'))),
      ]),
    );

void _tall(WidgetTester t) {
  t.view.physicalSize = const Size(390 * 3, 2400 * 3);
  t.view.devicePixelRatio = 3;
  addTearDown(t.view.reset);
}

void main() {
  test('an unpaid booking blocks; a plan without its saved term blocks; a paid one converts', () {
    expect(ConvertSource.fromJson(_reservation(booking: 'UNPAID')).bookingBlocks, isTrue);
    expect(ConvertSource.fromJson(_reservation(booking: 'UNPAID')).canConvert, isFalse);
    expect(ConvertSource.fromJson(_reservation(booking: 'WAIVED')).canConvert, isTrue);
    expect(ConvertSource.fromJson(_reservation(snapshot: false)).snapshotMissing, isTrue);
    final ok = ConvertSource.fromJson(_reservation());
    expect(ok.canConvert, isTrue);
    expect(ok.needsStart, isTrue);
    expect(ok.clientName, 'رانيا غالي'); // the lead's name when no client is linked
    expect(ok.projectName, 'لاجونا باي');
    expect(PickedDocument.mimeFor('contract.PDF'), 'application/pdf');
    expect(PickedDocument.mimeFor('x.exe'), isNull);
  });

  testWidgets('an unpaid booking: the warning and no confirm', (t) async {
    _tall(t);
    final repo = _Repo(_reservation(booking: 'UNPAID'));
    await t.pumpWidget(_app(ConvertReservationScreen(reservationId: 'r1', repository: repo)));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('convert-unpaid')), findsOneWidget);
    expect(t.widget<ButtonStyleButton>(find.byKey(const Key('convert-confirm'))).enabled, isFalse);
  });

  testWidgets('a paid booking: the plan, then convert opens the new contract', (t) async {
    _tall(t);
    final repo = _Repo(_reservation());
    await t.pumpWidget(_app(ConvertReservationScreen(reservationId: 'r1', repository: repo)));
    await t.pumpAndSettle();
    expect(find.text('محمود البنا'), findsOneWidget);
    expect(find.text('60 شهرًا'), findsOneWidget);
    expect(find.byKey(const Key('convert-starts')), findsOneWidget);
    await t.tap(find.byKey(const Key('convert-confirm')));
    await t.pumpAndSettle();
    expect(repo.converts.single.$1, 'r1');
    expect(repo.converts.single.$2, isNotNull); // the instalments' start
    expect(repo.converts.single.$3, isNull); // not signed
    expect(find.text('contract c9'), findsOneWidget);
  });

  testWidgets('manual: nothing is sent until the client, unit and value are there', (t) async {
    _tall(t);
    final repo = _Repo(_reservation());
    await t.pumpWidget(_app(ManualContractScreen(repository: repo)));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('manual-create')));
    await t.pumpAndSettle();
    expect(repo.manuals, isEmpty);
    expect(find.text('مطلوب'), findsNWidgets(3));

    await t.tap(find.byKey(const Key('manual-client')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('pick-client-u1')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('manual-unit')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('pick-unit-x1')));
    await t.pumpAndSettle();
    expect(find.widgetWithText(TextField, '6880000'), findsOneWidget); // the unit's price

    // Signed before the system needs its signing date.
    await t.tap(find.byKey(const Key('manual-presystem')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('manual-create')));
    await t.pumpAndSettle();
    expect(repo.manuals, isEmpty);
    expect(find.text('تاريخ التوقيع مطلوب للعقد المُبرم قبل النظام'), findsOneWidget);

    await t.tap(find.byKey(const Key('manual-presystem')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('manual-create')));
    await t.pumpAndSettle();
    expect(repo.manuals.single, {'customerId': 'u1', 'unitId': 'x1', 'total': 6880000.0, 'preSystem': false, 'signedAt': null});
    expect(find.text('contract c10'), findsOneWidget);
  });
}
