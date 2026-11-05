import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_staff/features/catalog/domain/entities/staff_project.dart';
import 'package:mobile_staff/features/catalog/domain/repositories/staff_catalog_repository.dart';
import 'package:mobile_staff/features/catalog/domain/usecases/staff_catalog_use_cases.dart';
import 'package:mobile_staff/features/installments/domain/entities/installment.dart';
import 'package:mobile_staff/features/installments/domain/repositories/installments_repository.dart';
import 'package:mobile_staff/features/installments/domain/usecases/installment_use_cases.dart';
import 'package:mobile_staff/features/leads/domain/entities/lead.dart';
import 'package:mobile_staff/features/leads/domain/repositories/leads_repository.dart';
import 'package:mobile_staff/features/leads/domain/usecases/lead_use_cases.dart';
import 'package:mobile_staff/features/reservations/domain/entities/reservation.dart';
import 'package:mobile_staff/features/reservations/domain/repositories/reservations_repository.dart';
import 'package:mobile_staff/features/reservations/domain/usecases/reservation_use_cases.dart';
import 'package:mobile_staff/features/reservations/presentation/cubit/create_reservation_cubit.dart';
import 'package:mobile_staff/features/reservations/view/new_reservation_screen.dart';

/// The new booking form: the client, the unit, the plan cards, the booking
/// amount; what is sent.

class _Catalog implements StaffCatalogRepository {
  @override
  Future<Result<List<StaffProject>>> getProjects({String? search}) async =>
      Ok([StaffProject(id: 'p1', name: Translatable.fromJson('لاجونا باي'), status: 'PUBLISHED', city: 'الساحل')]);

  @override
  Future<Result<StaffProjectDetail>> getProjectDetail(String id) async => Ok(StaffProjectDetail(
        project: StaffProject(id: 'p1', name: Translatable.fromJson('لاجونا باي'), status: 'PUBLISHED'),
        units: const [
          StaffUnit(id: 'u1', code: 'DF-LB-Z01-301', status: 'AVAILABLE', price: '5740000'),
          StaffUnit(id: 'u2', code: 'DF-LB-Z01-302', status: 'SOLD', price: '5900000'),
        ],
      ));

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

class _Leads implements LeadsRepository {
  @override
  Future<Result<Paginated<Lead>>> getLeads(LeadsQuery query) async => Ok(Paginated(
        data: const [Lead(id: 'l1', fullName: 'رانيا غالي', stage: 'NEW', phone: '+201009900025'), Lead(id: 'l2', fullName: 'طارق رزق', stage: 'NEW', phone: '+201009900024')],
        meta: const PageMeta(page: 1, pageSize: 20, total: 2, totalPages: 1),
      ));

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

class _PlansOfAnotherUnit extends _Plans {
  @override
  Future<Result<List<InstallmentOffer>>> unitOffers({required String projectId, required String unitId}) async => const Ok([]);
}

class _Plans implements InstallmentsRepository {
  @override
  Future<Result<List<InstallmentPlanTemplate>>> getPlanTemplates({String? projectId}) async => const Ok([
        InstallmentPlanTemplate(id: 't1', name: 'خطة 5 سنوات', durations: [PlanDuration(durationMonths: 60, increasePercentage: 12)]),
      ]);

  @override
  Future<Result<List<InstallmentOffer>>> unitOffers({required String projectId, required String unitId}) async => const Ok([
        InstallmentOffer(
          name: 'خطة 5 سنوات',
          netPrice: 5740000,
          booking: 100000,
          downPayment: 474000,
          options: [InstallmentOfferOption(durationMonths: 60, period: InstallmentPeriod.monthly, count: 60, amount: 94565, totalPayable: 6347920)],
        ),
      ]);

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

class _Reservations implements ReservationsRepository {
  final sent = <NewReservation>[];

  @override
  Future<Result<Reservation>> createReservation(NewReservation r) async {
    sent.add(r);
    return const Ok(Reservation(id: 'r1', status: 'PENDING'));
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

CreateReservationCubit _cubit(_Reservations res, {String? unitId, String? projectId}) => CreateReservationCubit(
      GetStaffProjects(_Catalog()),
      GetStaffProjectDetail(_Catalog()),
      CreateReservation(res),
      GetLeads(_Leads()),
      GetPlanTemplates(_Plans()),
      unitId: unitId,
      projectId: projectId,
    );

Widget _app(CreateReservationCubit cubit, {InstallmentsRepository? plans}) => RepositoryProvider<InstallmentsRepository>.value(
      value: plans ?? _Plans(),
      child: MaterialApp.router(
        theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
        locale: const Locale('ar'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        routerConfig: GoRouter(initialLocation: '/new', routes: [
          GoRoute(
            path: '/',
            builder: (_, _) => const Scaffold(body: Text('list')),
            routes: [
              GoRoute(
                path: 'new',
                builder: (_, _) => BlocProvider.value(value: cubit, child: const NewReservationScreen()),
              ),
            ],
          ),
        ]),
      ),
    );

void _tall(WidgetTester t) {
  t.view.physicalSize = const Size(390 * 3, 3000 * 3);
  t.view.devicePixelRatio = 3;
  addTearDown(t.view.reset);
}

void main() {
  testWidgets('nothing is sent until the client and the unit are chosen', (t) async {
    _tall(t);
    final res = _Reservations();
    final cubit = _cubit(res);
    addTearDown(cubit.close);
    await t.pumpWidget(_app(cubit));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('new-res-submit')));
    await t.pumpAndSettle();
    expect(res.sent, isEmpty);
    expect(cubit.state.showValidation, isTrue);
  });

  testWidgets('client, project, unit, plan card, booking amount: the summary and what is sent', (t) async {
    _tall(t);
    final res = _Reservations();
    final cubit = _cubit(res);
    addTearDown(cubit.close);
    await t.pumpWidget(_app(cubit));
    await t.pumpAndSettle();

    await t.tap(find.byKey(const Key('new-res-client')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('new-res-client-l1')));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('new-res-client-picked')), findsOneWidget);

    await t.tap(find.byKey(const Key('new-res-project')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('new-res-project-p1')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('new-res-unit')));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('new-res-unit-u2')), findsNothing); // sold: not offered
    await t.tap(find.byKey(const Key('new-res-unit-u1')));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('new-res-unit-picked')), findsOneWidget);

    // The plan cards, with the unit's figures.
    expect(find.byKey(const Key('new-res-plan-t1')), findsOneWidget);
    expect(find.textContaining('94,565'), findsOneWidget);
    await t.tap(find.byKey(const Key('new-res-plan-t1')));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('new-res-summary')), findsOneWidget);

    // A fixed booking amount.
    await t.tap(find.byKey(const Key('new-res-mode-FIXED')));
    await t.pumpAndSettle();
    await t.enterText(find.byKey(const Key('new-res-amount')), '150000');
    await t.tap(find.byKey(const Key('new-res-expiry-168')));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('new-res-hold-until')), findsOneWidget); // when it ends
    await t.tap(find.byKey(const Key('new-res-submit')));
    await t.pumpAndSettle();

    final s = res.sent.single;
    expect(s.unitId, 'u1');
    expect(s.leadId, 'l1');
    expect(s.installmentPlanTemplateId, 't1');
    expect(s.bookingAmountMode, 'FIXED');
    expect(s.bookingAmount, 150000);
    expect(s.expiresInHours, 168);
    expect(find.text('list'), findsOneWidget); // back to the list once created
  });

  testWidgets('from a unit: the unit is fixed and only the client is asked', (t) async {
    _tall(t);
    final res = _Reservations();
    final cubit = _cubit(res, unitId: 'u1', projectId: 'p1');
    addTearDown(cubit.close);
    await t.pumpWidget(_app(cubit));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('new-res-unit-fixed')), findsOneWidget);
    expect(find.byKey(const Key('new-res-project')), findsNothing);
    expect(find.byKey(const Key('new-res-plan-t1')), findsOneWidget);
  });

  testWidgets('a unit with no plan of its own is not offered the project\'s other plans', (t) async {
    _tall(t);
    final cubit = _cubit(_Reservations(), unitId: 'u1', projectId: 'p1');
    addTearDown(cubit.close);
    await t.pumpWidget(_app(cubit, plans: _PlansOfAnotherUnit()));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('new-res-plan-none')), findsOneWidget);
    expect(find.byKey(const Key('new-res-plan-t1')), findsNothing);
  });
}
