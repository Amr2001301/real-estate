import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/permissions/staff_access_gate.dart';
import 'package:mobile_staff/features/permissions/staff_permissions.dart';

/// A page the menu hides, opened from a link, says it is not open to this
/// account rather than showing a screen whose calls all answer 403.

class _Perms extends StaffPermissionsCubit {
  _Perms() : super(Dio());
  void give(Set<String> codes) => emit(StaffPermissions(codes));
}

Future<(_Perms, SessionCubit)> _pump(WidgetTester t, AppRole role) async {
  final session = SessionCubit(TokenStorage())
    ..adopt(Session(userId: 'u1', role: role, displayName: 'Rep'));
  final perms = _Perms();
  addTearDown(session.close);
  addTearDown(perms.close);
  await t.pumpWidget(MultiBlocProvider(
    providers: [
      BlocProvider.value(value: session),
      BlocProvider<StaffPermissionsCubit>.value(value: perms),
    ],
    child: MaterialApp(
      theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
      locale: const Locale('ar'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: const StaffAccessGate(allows: StaffAccess.ledger, child: Text('ledger-page')),
    ),
  ));
  await t.pump();
  return (perms, session);
}

void main() {
  testWidgets('a rep without the code sees the no-access page, not the screen', (t) async {
    await _pump(t, AppRole.sales);
    expect(find.text('ledger-page'), findsNothing);
    expect(find.byKey(const Key('page-no-access')), findsOneWidget);
    expect(find.text('هذه الصفحة غير متاحة لحسابك'), findsWidgets);
  });

  testWidgets('the page opens once the code arrives after sign-in', (t) async {
    final (perms, _) = await _pump(t, AppRole.sales);
    perms.give({'reports:financial:read'});
    await t.pump(); // the cubit's stream delivers
    await t.pump(); // the gate rebuilds
    expect(find.text('ledger-page'), findsOneWidget);
  });

  testWidgets('the admin opens it by role', (t) async {
    await _pump(t, AppRole.admin);
    expect(find.text('ledger-page'), findsOneWidget);
  });
}
