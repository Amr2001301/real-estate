import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/contracts/view/contract_page_screen.dart';
import 'package:mobile_staff/features/contracts/view/contracts_data.dart';
import 'package:mobile_staff/features/contracts/view/contracts_list_screen.dart';

/// The contracts list and a contract's page, as the website's.

Map<String, dynamic> _contract({String id = 'c1', bool signed = true, String? reservation = 'RES-2026-0005'}) => {
      'id': id,
      'contractNumber': 'CON-2026-00${id.substring(1)}',
      'status': signed ? 'ACTIVE' : 'UNSIGNED',
      'totalAmount': '6880000',
      'downPayment': '688000',
      'signedAt': signed ? '2026-10-01T08:00:00.000Z' : null,
      'customer': {'id': 'u1', 'fullName': 'خالد غالي', 'phone': '+201009900005'},
      'unit': {
        'id': 'x1',
        'code': 'DF-NG-B01-202',
        'building': {
          'phase': {
            'project': {'name': 'نايل جاردنز'},
          },
        },
      },
      'reservation': reservation == null
          ? null
          : {
              'reservationNumber': reservation,
              'sales': {'fullName': 'محمود البنا'},
            },
      'installmentPlan': {
        'totalMonths': 36,
        'monthlyAmount': '171111.11',
        'startsAt': '2026-10-01T00:00:00.000Z',
        'installments': [
          {'id': 'i0', 'type': 'DOWN_PAYMENT', 'dueDate': '2026-10-01T00:00:00.000Z', 'amount': '688000', 'status': 'PAID'},
          {'id': 'i1', 'type': 'INSTALLMENT', 'dueDate': '2026-10-15T00:00:00.000Z', 'amount': '171111.11', 'status': 'OVERDUE'},
          {'id': 'i2', 'type': 'INSTALLMENT', 'dueDate': '2099-11-01T00:00:00.000Z', 'amount': '171111.11', 'status': 'PENDING'},
        ],
      },
      'deposits': [
        {'id': 'd1', 'type': 'DOWN_PAYMENT', 'amount': '688000', 'paidAt': '2026-10-01T08:00:00.000Z', 'paymentMethod': 'BANK_TRANSFER'},
      ],
    };

const _statement = {
  'totals': {'contractValue': '6880000', 'paid': '688000', 'balance': '6192000', 'overdue': '171111.11', 'openFees': '0', 'upcoming': '0'},
  'lines': [
    {'kind': 'CONTRACT', 'date': '2026-10-01', 'debit': '6880000', 'credit': '0', 'balance': '6880000'},
    {'kind': 'PAYMENT', 'rowType': 'DOWN_PAYMENT', 'date': '2026-10-01', 'debit': '0', 'credit': '688000', 'balance': '6192000'},
  ],
};

class _Repo extends ContractsViewRepository {
  _Repo() : super(Dio());
  ContractsQuery? lastQuery;

  @override
  Future<int?> count(ContractsQuery q) async => q.source == 'MANUAL' ? (q.filter == 'SIGNED' ? 3 : 4) : 22;

  @override
  Future<ContractsCounts> counts() async => const ContractsCounts(all: 2, signed: 1, unsigned: 1, delayed: 0);

  @override
  Future<Result<(List<ContractRow>, int)>> page(ContractsQuery q, int page) async {
    lastQuery = q;
    final rows = [ContractRow.fromJson(_contract()), ContractRow.fromJson(_contract(id: 'c2', signed: false, reservation: null))];
    return Ok((q.filter == 'SIGNED' ? rows.where((r) => r.signedAt != null).toList() : rows, 2));
  }

  @override
  Future<Result<ContractPage>> load(String id) async => Ok(ContractPage.parse(_contract(), statement: _statement));
}

Widget _app(Widget home, {required List<BlocProvider> providers, AppRole role = AppRole.admin}) {
  final session = SessionCubit(TokenStorage())..adopt(Session(userId: 'a1', role: role, displayName: 'أحمد'));
  return MultiBlocProvider(
    providers: [BlocProvider<SessionCubit>.value(value: session), ...providers],
    child: MaterialApp(
      theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
      locale: const Locale('ar'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: home,
    ),
  );
}

void main() {
  test('reads the contract, the plan, the parties and the statement\'s totals', () {
    final p = ContractPage.parse(_contract(), statement: _statement);
    expect(p.row.projectName, 'نايل جاردنز');
    expect(p.row.reservationNumber, 'RES-2026-0005');
    expect(p.salesName, 'محمود البنا');
    expect(p.collectedPct, 10);
    expect(p.remaining, 6192000);
    expect(p.lateCount(DateTime(2026, 11, 4)), 1);
    expect(p.nextUnpaid?.id, 'i1');
    expect(p.lines, hasLength(2));
    expect(p.payments.single.method, 'BANK_TRANSFER');
    expect(const ContractsQuery(filter: 'UNSIGNED', source: 'MANUAL', search: 'خالد').params(1, 20),
        {'page': 1, 'pageSize': 20, 'signed': 'no', 'hasReservation': 'no', 'q': 'خالد'});
  });

  testWidgets('the list: the figures, the cards and the signed filter', (t) async {
    t.view.physicalSize = const Size(390 * 3, 2400 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    final repo = _Repo();
    final cubit = ContractsListCubit(repo);
    addTearDown(cubit.close);
    await t.pumpWidget(_app(const ContractsListScreen(), providers: [BlocProvider<ContractsListCubit>.value(value: cubit)]));
    await t.pumpAndSettle();
    expect(find.byType(ContractCardView), findsNWidgets(2));
    expect(find.text('خالد غالي'), findsNWidgets(2));

    await t.tap(find.byKey(const Key('home-pill-SIGNED')));
    await t.pumpAndSettle();
    expect(repo.lastQuery?.filter, 'SIGNED');
    expect(find.byType(ContractCardView), findsOneWidget);

    await t.tap(find.byKey(const Key('contracts-filters')));
    await t.pumpAndSettle();
    expect(find.text('فلتر واحد مفعّل'), findsOneWidget); // signed, from the pill
    await t.tap(find.byKey(const Key('contracts-source-MANUAL')));
    await t.pumpAndSettle();
    expect(find.text('فلتران مفعّلان'), findsOneWidget);
    expect(find.text('عرض 3 عقود'), findsOneWidget);
    await t.tap(find.byKey(const Key('contracts-apply')));
    await t.pumpAndSettle();
    expect(repo.lastQuery, const ContractsQuery(filter: 'SIGNED', source: 'MANUAL'));
  });

  testWidgets('a contract: value, collected, late, the tabs and the admin\'s record button', (t) async {
    t.view.physicalSize = const Size(390 * 3, 2600 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    final cubit = ContractPageCubit(_Repo(), contractId: 'c1');
    addTearDown(cubit.close);
    await t.pumpWidget(_app(const ContractPageScreen(), providers: [BlocProvider<ContractPageCubit>.value(value: cubit)]));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('contract-value')), findsOneWidget);
    expect(find.textContaining('10%'), findsOneWidget);
    expect(find.byKey(const Key('contract-overdue')), findsOneWidget);
    expect(find.text('محمود البنا'), findsOneWidget);
    expect(find.byKey(const Key('contract-record')), findsOneWidget);

    await t.ensureVisible(find.byKey(const Key('contract-tab-statement')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('contract-tab-statement')));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('statement-paid')), findsOneWidget);

    await t.ensureVisible(find.byKey(const Key('contract-tab-payments')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('contract-tab-payments')));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('contract-payment-d1')), findsOneWidget);
  });

  testWidgets('a sales rep sees no record button', (t) async {
    t.view.physicalSize = const Size(390 * 3, 2600 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    final cubit = ContractPageCubit(_Repo(), contractId: 'c1');
    addTearDown(cubit.close);
    await t.pumpWidget(_app(const ContractPageScreen(), providers: [BlocProvider<ContractPageCubit>.value(value: cubit)], role: AppRole.sales));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('contract-record')), findsNothing);
    expect(find.byKey(const Key('contract-inst-record-i1')), findsNothing);
  });
}
