import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/broker/contracts/broker_contracts_data.dart';
import 'package:mobile_staff/features/broker/contracts/broker_contracts_screens.dart';
import 'package:mobile_staff/features/contracts/view/contracts_list_screen.dart';
import 'package:mobile_staff/features/notifications/presentation/notification_route.dart';

/// The broker's contracts: the portal's list and a contract.

Map<String, dynamic> _contract(String id, {bool signed = true, bool money = true, String name = 'ريهام بدوي'}) => {
      'id': id,
      'contractNumber': 'CON-2026-00$id',
      'status': signed ? 'ACTIVE' : 'UNSIGNED',
      'totalAmount': '5838240',
      'downPayment': '528000',
      'signedAt': signed ? '2026-10-13T08:00:00.000Z' : null,
      'deliveryDate': '2028-06-30T00:00:00.000Z',
      'customer': {'fullName': name, 'phone': '+201009900019'},
      'unit': {
        'code': 'DF-NG-B02-2$id',
        'type': '3BR',
        'area': 165,
        'building': {
          'name': 'عمارة 2',
          'phase': {
            'project': {'name': 'نايل جاردنز ريزيدنس'},
          },
        },
      },
      'reservation': {'reservationNumber': 'RES-2026-00$id'},
      'brokerCommission': money ? {'commissionPct': '2.5', 'grossAmount': '132000', 'netAmount': '132000', 'status': 'PENDING'} : null,
      'installmentPlan': {'totalMonths': 60, 'monthlyAmount': '86837.33', 'startsAt': '2026-11-09T00:00:00.000Z'},
      'deposits': [
        {'id': 'd1'},
      ],
    };

class _Repo extends BrokerContractsRepository {
  _Repo({this.money = true}) : super(Dio());
  final bool money;

  @override
  Future<Result<List<BrokerContract>>> all() async => Ok([
        BrokerContract.fromJson(_contract('22', money: money)),
        BrokerContract.fromJson(_contract('24', signed: false, money: money, name: 'محمد الجمال')),
      ]);

  @override
  Future<Result<BrokerContract>> one(String id) async => Ok(BrokerContract.fromJson(_contract(id, money: money)));
}

Widget _app(Widget home, List<BlocProvider> providers) => MultiBlocProvider(
      providers: providers,
      child: MaterialApp(
        theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
        locale: const Locale('ar'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: home,
      ),
    );

void _tall(WidgetTester t) {
  t.view.physicalSize = const Size(390 * 3, 2400 * 3);
  t.view.devicePixelRatio = 3;
  addTearDown(t.view.reset);
}

void main() {
  test('reads the commission (or none when the agent may not see money), the unit and the payments', () {
    final c = BrokerContract.fromJson(_contract('22'));
    expect(c.commission?.pct, 2.5);
    expect(c.commission?.gross, 132000);
    expect(c.commission?.status, 'PENDING');
    expect(c.unitType, '3BR');
    expect(c.area, 165);
    expect(c.buildingName, 'عمارة 2');
    expect(c.payments, 1);
    expect(c.row.planMonths, 60);
    expect(BrokerContract.fromJson(_contract('22', money: false)).commission, isNull);
    expect(c.matches('ريهام'), isTrue);
    expect(c.matches('0019'), isTrue);
    expect(c.matches('CON-2026-0022'), isTrue);
    expect(c.matches('الجمال'), isFalse);
  });

  testWidgets('the list: figures, commission on the card, the filter and the search', (t) async {
    _tall(t);
    final cubit = BrokerContractsCubit(_Repo());
    addTearDown(cubit.close);
    await t.pumpWidget(_app(const BrokerContractsScreen(), [BlocProvider<BrokerContractsCubit>.value(value: cubit)]));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('home-fig-value')), findsOneWidget);
    expect(find.textContaining('11.68'), findsOneWidget); // two contracts' value, in millions
    expect(find.textContaining('عمولتك'), findsNWidgets(2));
    expect(find.byType(ContractCardView), findsNWidgets(2));

    await t.tap(find.byKey(const Key('home-pill-SIGNED')));
    await t.pumpAndSettle();
    expect(find.byType(ContractCardView), findsOneWidget);
    cubit.setFilter('SIGNED'); // off again
    cubit.setSearch('الجمال');
    await t.pumpAndSettle();
    expect(find.byType(ContractCardView), findsOneWidget);
    expect(find.text('محمد الجمال'), findsOneWidget);
  });

  testWidgets('no money for the agent: no commission on the cards', (t) async {
    _tall(t);
    final cubit = BrokerContractsCubit(_Repo(money: false));
    addTearDown(cubit.close);
    await t.pumpWidget(_app(const BrokerContractsScreen(), [BlocProvider<BrokerContractsCubit>.value(value: cubit)]));
    await t.pumpAndSettle();
    expect(find.textContaining('عمولتك'), findsNothing);
    expect(find.text('خطة السداد'), findsNWidgets(2)); // the plan instead
  });

  testWidgets('a contract: value, commission tiles, the client to call, the unit and the plan', (t) async {
    _tall(t);
    final cubit = BrokerContractCubit(_Repo(), contractId: '22');
    addTearDown(cubit.close);
    await t.pumpWidget(_app(const BrokerContractScreen(), [BlocProvider<BrokerContractCubit>.value(value: cubit)]));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('broker-contract-value')), findsOneWidget);
    expect(find.byKey(const Key('broker-contract-commission')), findsOneWidget);
    expect(find.textContaining('2.5%'), findsOneWidget);
    expect(find.byKey(const Key('contract-call')), findsOneWidget);
    expect(find.text('عمارة 2'), findsOneWidget);
    expect(find.text('60 شهرًا'), findsOneWidget);
  });

  testWidgets('a contract without money for the agent: no commission tiles', (t) async {
    _tall(t);
    final cubit = BrokerContractCubit(_Repo(money: false), contractId: '22');
    addTearDown(cubit.close);
    await t.pumpWidget(_app(const BrokerContractScreen(), [BlocProvider<BrokerContractCubit>.value(value: cubit)]));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('broker-contract-commission')), findsNothing);
  });

  test('a broker\'s contract notice opens the contract', () {
    expect(staffNotificationRoute('broker_contract_signed', {'entityType': 'contract', 'entityId': 'c1'}, isBroker: true), '/broker/contracts/c1');
    expect(staffNotificationRoute('broker_contract_created', const {}, isBroker: true), '/broker/contracts');
  });
}
