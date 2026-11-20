import 'dart:convert';

import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/maintenance/domain/entities/maintenance_request.dart';
import 'package:mobile_staff/features/maintenance/presentation/admin/admin_maintenance.dart';
import 'package:mobile_staff/features/permissions/staff_permissions.dart';
import 'package:mobile_staff/features/splash/splash_screen.dart';
import 'package:mobile_staff/router/app_router.dart';

/// The admin's maintenance pages, and the access rules that keep a page a role
/// cannot use from opening as a screen full of 403s.

class _Adapter implements HttpClientAdapter {
  _Adapter(this.body);
  final Object body;
  final requests = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(RequestOptions options, _, _) async {
    requests.add(options);
    return ResponseBody.fromString(jsonEncode(body), 200, headers: {
      Headers.contentTypeHeader: ['application/json'],
    });
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  setUp(() => SplashScreen.splashDone.value = true);
  tearDown(() => SplashScreen.splashDone.value = false);

  const none = StaffPermissions();

  test('maintenance is the admin\'s (the API is ADMIN-only); the supervisor keeps her own pages', () {
    expect(StaffAccess.maintenance(AppRole.admin, none), isTrue);
    expect(StaffAccess.maintenance(AppRole.salesManager, none), isFalse);
    expect(StaffAccess.maintenance(AppRole.sales, none), isFalse);
  });

  test('duplicates and team targets are for managers; broker reports for the admin or its code', () {
    expect(StaffAccess.duplicates(AppRole.sales, none), isFalse);
    expect(StaffAccess.duplicates(AppRole.salesManager, none), isTrue);
    expect(StaffAccess.teamTargets(AppRole.sales, none), isFalse);
    expect(StaffAccess.teamTargets(AppRole.admin, none), isTrue);
    expect(StaffAccess.brokerReports(AppRole.salesManager, none), isFalse);
    expect(StaffAccess.brokerReports(AppRole.salesManager, const StaffPermissions({'broker_reports:read'})), isTrue);
    expect(StaffAccess.brokerReports(AppRole.admin, none), isTrue);
  });

  test('the brokerage pages open only for a brokerage company', () {
    const developer = SessionState.authenticated(Session(userId: '1', role: AppRole.admin, companyType: 'DEVELOPER'));
    const brokerage = SessionState.authenticated(Session(userId: '1', role: AppRole.admin, companyType: 'BROKERAGE'));
    expect(staffRedirect(developer, '/bx/deals'), '/home');
    expect(staffRedirect(developer, '/bx/launches/1'), '/home');
    expect(staffRedirect(brokerage, '/bx/deals'), isNull);
  });

  test('the supervisor\'s /maintenance is still not the admin\'s page', () {
    const admin = SessionState.authenticated(Session(userId: '1', role: AppRole.admin));
    expect(staffRedirect(admin, '/maintenance'), '/home');
    expect(staffRedirect(admin, '/admin-maintenance'), isNull);
  });

  test('the status steps offered match the dashboard', () {
    expect(adminNextStatuses(MaintenanceStatus.open), [MaintenanceStatus.assigned, MaintenanceStatus.inProgress]);
    expect(adminNextStatuses(MaintenanceStatus.resolved), [MaintenanceStatus.closed, MaintenanceStatus.inProgress]);
    expect(adminNextStatuses(MaintenanceStatus.closed), isEmpty);
  });

  test('the list, approve, assign and status calls go to the admin endpoints', () async {
    final adapter = _Adapter({
      'data': [
        {'id': 'r1', 'description': 'leak', 'status': 'OPEN', 'priority': 'HIGH', 'reviewStatus': 'PENDING', 'assignedAdminId': 'u1', 'assignedAdmin': {'fullName': 'Sayed'}},
      ],
      'meta': {'page': 1, 'pageSize': 20, 'total': 1, 'totalPages': 1},
    });
    final repo = AdminMaintenanceRepository(Dio(BaseOptions(baseUrl: 'https://api.test'))..httpClientAdapter = adapter);

    final page = (await repo.list(status: 'OPEN', reviewStatus: 'PENDING', q: ' leak ')).dataOrNull!;
    expect(page.data.single.assignedName, 'Sayed');
    expect(page.data.single.request.status, MaintenanceStatus.open);
    expect(adapter.requests.last.path, '/maintenance-requests');
    expect(adapter.requests.last.queryParameters, containsPair('reviewStatus', 'PENDING'));
    expect(adapter.requests.last.queryParameters, containsPair('q', 'leak'));

    await repo.approve('r1');
    expect(adapter.requests.last.path, '/maintenance-requests/r1/approve');
    await repo.assign('r1', 'u2');
    expect(adapter.requests.last.path, '/maintenance-requests/r1/assign');
    expect(adapter.requests.last.data, {'assignedAdminId': 'u2'});
    await repo.setStatus('r1', MaintenanceStatus.inProgress);
    expect(adapter.requests.last.path, '/maintenance-requests/r1/status');
    expect(adapter.requests.last.data, {'status': 'IN_PROGRESS'});
  });
}
