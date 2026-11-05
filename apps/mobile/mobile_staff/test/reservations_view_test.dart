import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/e_sign/domain/signature_request.dart';
import 'package:mobile_staff/features/reservations/view/reservation_page_screen.dart';
import 'package:mobile_staff/features/reservations/view/reservations_data.dart';
import 'package:mobile_staff/features/reservations/view/reservations_list_screen.dart';

/// The bookings list and a booking's page, as the website's, with what
/// each role may do.

Map<String, dynamic> _booking(String id, {String status = 'PENDING', String pay = 'UNPAID', String sales = 'rep1', bool broker = false}) => {
      'id': id,
      'reservationNumber': 'RES-2026-00$id',
      'status': status,
      'bookingAmount': '100000',
      'bookingPaymentStatus': pay,
      'bookingPaidAt': pay == 'PAID' ? '2026-11-01T09:00:00Z' : null,
      'salesId': sales,
      'sales': {'id': sales, 'fullName': 'محمود البنا'},
      'brokerId': broker ? 'b1' : null,
      'lead': {'fullName': 'رانيا غالي', 'phone': '+201009900025'},
      'unit': {
        'code': 'DF-LB-Z01-301',
        'price': '5740000',
        'building': {
          'phase': {
            'project': {'name': 'لاجونا باي'},
          },
        },
      },
      'selectedDurationMonths': 60,
      'snapshotMonthlyInstallment': '94565.33',
      'snapshotDownPaymentAmount': '574000',
      'snapshotTotalPayable': '6347920',
      'installmentPlanTemplate': {'name': 'خطة 5 سنوات'},
      'expiresAt': DateTime.now().add(const Duration(days: 10)).toIso8601String(),
      'createdAt': '2026-10-31T09:00:00Z',
      'approvedAt': status == 'PENDING' ? null : '2026-11-02T09:00:00Z',
      'contract': status == 'CONVERTED' ? {'id': 'c1', 'contractNumber': 'CON-2026-0029'} : null,
      'activities': [
        {'type': 'CREATED', 'createdAt': '2026-10-31T09:00:00Z', 'actor': {'fullName': 'محمود البنا'}},
      ],
      'reservationNotes': [
        {'body': 'تم التواصل مع العميل', 'createdAt': '2026-11-01T09:00:00Z', 'author': {'fullName': 'أحمد'}},
      ],
    };

class _Repo extends ReservationsViewRepository {
  _Repo({this.detail}) : super(Dio());
  final Map<String, dynamic>? detail;
  final calls = <String>[];
  ReservationsQuery? lastQuery;

  @override
  Future<ReservationsCounts> counts({String? projectId, String? salesId}) async =>
      const ReservationsCounts(all: 32, byStatus: {'PENDING': 2, 'APPROVED': 2, 'CONVERTED': 26, 'REJECTED': 1, 'CANCELLED': 1}, awaitingPayment: 1);

  @override
  Future<Result<(List<ReservationRow>, int)>> page(ReservationsQuery q, int page) async {
    lastQuery = q;
    final rows = [
      ReservationRow.fromJson(_booking('28')),
      ReservationRow.fromJson(_booking('30', status: 'APPROVED')),
      ReservationRow.fromJson(_booking('29', status: 'APPROVED', pay: 'PAID')),
    ];
    return Ok((q.filter == 'PENDING' ? rows.where((r) => r.status == 'PENDING').toList() : rows, 3));
  }

  @override
  Future<int?> count(ReservationsQuery q) async => 2;

  @override
  Future<(List<(String, String)>, List<(String, String)>)> options({required bool consultants}) async =>
      (const [('p1', 'لاجونا باي')], consultants ? const [('rep1', 'محمود البنا')] : const <(String, String)>[]);

  @override
  Future<Result<ReservationPage>> load(String id) async => Ok(ReservationPage.parse(detail ?? _booking(id)));

  @override
  Future<Result<void>> approve(String id) async {
    calls.add('approve:$id');
    return const Ok(null);
  }

  @override
  Future<Result<void>> reject(String id, String? reason) async {
    calls.add('reject:$id:$reason');
    return const Ok(null);
  }

  @override
  Future<Result<void>> confirmPayment(String id, {required DateTime paidAt, required String method}) async {
    calls.add('pay:$id:$method');
    return const Ok(null);
  }

  @override
  Future<Result<void>> addNote(String id, String body) async {
    calls.add('note:$id:$body');
    return const Ok(null);
  }
}

class _Signatures implements SignatureRequestsRepository {
  @override
  Future<Result<List<SignatureRequest>>> list(String reservationId) async => const Ok([]);
  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

Widget _app(Widget home, List<BlocProvider> providers, AppRole role, {String userId = 'u9'}) {
  final session = SessionCubit(TokenStorage())..adopt(Session(userId: userId, role: role, displayName: 'أحمد'));
  return RepositoryProvider<SignatureRequestsRepository>.value(
    value: _Signatures(),
    child: MultiBlocProvider(
      providers: [BlocProvider<SessionCubit>.value(value: session), ...providers],
      child: MaterialApp(
        theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
        locale: const Locale('ar'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: home,
      ),
    ),
  );
}

void _tall(WidgetTester t) {
  t.view.physicalSize = const Size(390 * 3, 2600 * 3);
  t.view.devicePixelRatio = 3;
  addTearDown(t.view.reset);
}

Future<void> _page(WidgetTester t, _Repo repo, AppRole role, {String userId = 'u9'}) async {
  _tall(t);
  final cubit = ReservationPageCubit(repo, reservationId: '29');
  addTearDown(cubit.close);
  await t.pumpWidget(_app(const ReservationPageScreen(), [BlocProvider<ReservationPageCubit>.value(value: cubit)], role, userId: userId));
  await t.pumpAndSettle();
}

void main() {
  test('reads a booking: the lead when no client, the plan, the state, who decides', () {
    final p = ReservationPage.parse(_booking('29', status: 'APPROVED', pay: 'PAID', broker: true));
    final r = p.row;
    expect(r.clientName, 'رانيا غالي');
    expect(r.projectName, 'لاجونا باي');
    expect(r.bookingSettled, isTrue);
    expect(r.viaBroker, isTrue);
    expect(r.daysLeft(DateTime.now()), inInclusiveRange(9, 10));
    expect(p.planName, 'خطة 5 سنوات');
    expect(p.unitPrice, 5740000);
    expect(p.events.first.isNote, isTrue); // newest first
    expect(const ReservationsQuery(filter: 'CLOSED').params(1, 20)['status'], 'REJECTED,CANCELLED,EXPIRED');

    final pending = ReservationRow.fromJson(_booking('28'));
    expect(canDecideBooking(pending, role: AppRole.admin, userId: 'x'), isTrue);
    expect(canDecideBooking(pending, role: AppRole.salesManager, userId: 'mgr'), isTrue);
    expect(canDecideBooking(pending, role: AppRole.salesManager, userId: 'rep1'), isFalse); // their own
    expect(canDecideBooking(pending, role: AppRole.sales, userId: 'x'), isFalse);
    expect(canDecideBooking(r, role: AppRole.admin, userId: 'x'), isFalse); // not pending
  });

  testWidgets('the list: figures, the pending filter, and approve right on the card', (t) async {
    _tall(t);
    final repo = _Repo();
    final cubit = ReservationsListCubit(repo);
    addTearDown(cubit.close);
    await t.pumpWidget(_app(const ReservationsListScreen(), [BlocProvider<ReservationsListCubit>.value(value: cubit)], AppRole.salesManager));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('home-fig-active')), findsOneWidget);
    expect(find.text('تحتاج قرارك'), findsOneWidget);
    expect(find.byType(ReservationCardView), findsNWidgets(3));
    expect(find.text('العربون لم يُدفع بعد'), findsOneWidget);
    expect(find.text('جاهز للتحويل إلى عقد'), findsOneWidget);
    expect(find.byKey(const Key('reservation-convert-29')), findsNothing); // the admin converts

    await t.tap(find.byKey(const Key('reservation-approve-28')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const ValueKey('reservation-approve-confirm')));
    await t.pumpAndSettle();
    expect(repo.calls, ['approve:28']);

    await t.tap(find.byKey(const Key('home-pill-PENDING')));
    await t.pumpAndSettle();
    expect(repo.lastQuery?.filter, 'PENDING');
    expect(find.byType(ReservationCardView), findsOneWidget);
  });

  testWidgets('a sales rep: no approve on the card, «قيد المراجعة» in the band', (t) async {
    _tall(t);
    final cubit = ReservationsListCubit(_Repo());
    addTearDown(cubit.close);
    await t.pumpWidget(_app(const ReservationsListScreen(), [BlocProvider<ReservationsListCubit>.value(value: cubit)], AppRole.sales, userId: 'rep1'));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('reservation-approve-28')), findsNothing);
    expect(find.text('تحتاج قرارك'), findsNothing);
  });

  testWidgets('the admin converts a paid, approved booking from the card', (t) async {
    _tall(t);
    final cubit = ReservationsListCubit(_Repo());
    addTearDown(cubit.close);
    await t.pumpWidget(_app(const ReservationsListScreen(), [BlocProvider<ReservationsListCubit>.value(value: cubit)], AppRole.admin));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('reservation-convert-29')), findsOneWidget);
  });

  testWidgets('a pending booking: the manager approves or rejects (with a reason)', (t) async {
    final repo = _Repo(detail: _booking('29'));
    await _page(t, repo, AppRole.salesManager, userId: 'mgr');
    expect(find.byKey(const Key('reservation-amount')), findsOneWidget);
    expect(find.text('الخطوة التالية'), findsOneWidget);
    await t.tap(find.byKey(const Key('reservation-reject')));
    await t.pumpAndSettle();
    await t.enterText(find.byType(TextField).last, 'السعر تغيّر');
    await t.tap(find.text('رفض').last);
    await t.pumpAndSettle();
    expect(repo.calls, ['reject:29:السعر تغيّر']);
  });

  testWidgets('approved, unpaid: the admin records the booking amount', (t) async {
    final repo = _Repo(detail: _booking('29', status: 'APPROVED'));
    await _page(t, repo, AppRole.admin);
    expect(find.byKey(const Key('reservation-convert')), findsNothing);
    await t.tap(find.byKey(const Key('reservation-record-payment')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('reservation-pay-method-BANK_TRANSFER')));
    await t.tap(find.byKey(const Key('reservation-pay-confirm')));
    await t.pumpAndSettle();
    expect(repo.calls, ['pay:29:BANK_TRANSFER']);
  });

  testWidgets('approved and paid: the admin converts; a rep sees no actions', (t) async {
    await _page(t, _Repo(detail: _booking('29', status: 'APPROVED', pay: 'PAID')), AppRole.admin);
    expect(find.byKey(const Key('reservation-convert')), findsOneWidget);
    expect(find.byKey(const Key('reservation-cancel')), findsOneWidget);
  });

  testWidgets('a rep: no bar; a converted booking links its contract; a note is sent', (t) async {
    final repo = _Repo(detail: _booking('29', status: 'CONVERTED', pay: 'PAID'));
    await _page(t, repo, AppRole.sales, userId: 'rep1');
    expect(find.byKey(const Key('reservation-convert')), findsNothing);
    expect(find.byKey(const Key('reservation-approve')), findsNothing);
    expect(find.byKey(const Key('reservation-contract')), findsOneWidget);
    await t.enterText(find.byKey(const Key('reservation-note')), 'اتصلت بالعميل');
    await t.tap(find.byKey(const Key('reservation-note-send')));
    await t.pumpAndSettle();
    expect(repo.calls, ['note:29:اتصلت بالعميل']);
  });
}
