import 'dart:convert';

import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/permissions/staff_permissions.dart';

/// PRM in the staff app: a permission code opens a page beyond the role.

class _Adapter implements HttpClientAdapter {
  _Adapter(this.body, {this.status = 200});
  final Object body;
  final int status;
  final requests = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(RequestOptions options, _, _) async {
    requests.add(options);
    return ResponseBody.fromString(jsonEncode(body), status, headers: {
      Headers.contentTypeHeader: ['application/json'],
    });
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  test('managers see the money pages by role; a rep only with the code', () {
    const none = StaffPermissions();
    expect(StaffAccess.cheques(AppRole.admin, none), isTrue);
    // The API asks a sales manager for the code too (not in their starting set).
    expect(StaffAccess.cheques(AppRole.salesManager, none), isFalse);
    expect(StaffAccess.cheques(AppRole.salesManager, const StaffPermissions({'payment-instruments:manage'})), isTrue);
    expect(StaffAccess.cheques(AppRole.sales, none), isFalse);
    expect(StaffAccess.campaigns(AppRole.sales, none), isFalse);
    expect(StaffAccess.paymentsReview(AppRole.sales, none), isFalse);

    const given = StaffPermissions({'payment-instruments:manage', 'campaigns:manage', 'deposits:read:all'});
    expect(StaffAccess.cheques(AppRole.sales, given), isTrue);
    expect(StaffAccess.campaigns(AppRole.sales, given), isTrue);
    expect(StaffAccess.paymentsReview(AppRole.sales, given), isTrue);
    // One code opens only its own page.
    const chequesOnly = StaffPermissions({'payment-instruments:manage'});
    expect(StaffAccess.campaigns(AppRole.sales, chequesOnly), isFalse);
  });

  test('the codes are read after sign-in and cleared at sign-out', () async {
    final adapter = _Adapter({'role': 'SALES', 'codes': ['campaigns:manage', 'leads:read']});
    final cubit = StaffPermissionsCubit(Dio(BaseOptions(baseUrl: 'https://api.test'))..httpClientAdapter = adapter);
    await cubit.load();
    expect(adapter.requests.single.path, '/me/permissions');
    expect(cubit.state.has('campaigns:manage'), isTrue);
    cubit.reset();
    expect(cubit.state.codes, isEmpty);
  });

  test('when the codes cannot be read, the role alone decides', () async {
    final cubit = StaffPermissionsCubit(
      Dio(BaseOptions(baseUrl: 'https://api.test'))..httpClientAdapter = _Adapter({'message': 'down'}, status: 500),
    );
    await cubit.load();
    expect(cubit.state.codes, isEmpty);
  });
}
