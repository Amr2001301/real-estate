import 'package:core/core.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/auth/data/dtos/staff_auth_dtos.dart';
import 'package:mobile_staff/features/auth/data/mappers/staff_auth_mapper.dart';
import 'package:mobile_staff/features/brokerage/brokerage_data.dart';

/// BRK-6c — the brokerage screens read the API's shapes as they come.
void main() {
  test('the session keeps the company type from sign-in', () {
    final s = AuthUserDto.fromJson({'id': 'u1', 'role': 'SALES', 'companyType': 'BROKERAGE'}).toSession();
    expect(s.companyType, 'BROKERAGE');
    // A session saved before the field reads back without it.
    expect(Session.fromJson({'userId': 'u1', 'role': 'SALES'}).companyType, isNull);
    expect(Session.fromJson(s.toJson()).companyType, 'BROKERAGE');
  });

  test('a deal reads money as strings, its splits and the outside broker', () {
    final d = BxDeal.fromJson({
      'id': 'd1',
      'code': 'D-0007',
      'kind': 'RESALE',
      'status': 'CLOSED',
      'customerName': 'رانيا',
      'dealValue': '6000000.00',
      'closedOn': '2026-11-14T00:00:00.000Z',
      'commissionTotal': '150000.00',
      'commissionReceived': '150000.00',
      'agent': {'id': 'a', 'fullName': 'كريم'},
      'listing': null,
      'coBrokerName': 'مكتب الريادة',
      'coBrokerPct': '30',
      'coBrokerAmount': '45000.00',
      'coBrokerPaidAt': null,
      'splits': [
        {'id': 's1', 'role': 'AGENT', 'sharePct': '40', 'amount': '42000.00', 'paidAt': null, 'user': {'fullName': 'كريم'}},
        {'id': 's2', 'role': 'MANAGER', 'sharePct': '5', 'amount': '5250.00', 'paidAt': '2026-11-15T10:00:00.000Z'},
      ],
    });
    expect(d.commissionTotal, 150000);
    expect(d.fullyCollected, isTrue);
    expect(d.outstanding, 0);
    expect(d.listingTitle, isNull);
    expect(d.coBrokerAmount, 45000);
    expect(d.coBrokerPct, 30);
    expect(d.splits.map((s) => s.amount), [42000, 5250]);
    expect(d.splits.last.paidAt, isNotNull);
  });

  test('a target row without a target has no progress', () {
    final none = BxTargetRow.fromJson({
      'user': {'id': 'u1', 'fullName': 'سارة', 'role': 'SALES_MANAGER'},
      'target': null,
      'actual': {'commission': 0, 'deals': 0},
      'progress': null,
      'bonus': 'NONE',
    });
    expect(none.hasTarget, isFalse);
    expect(none.commissionPct, isNull);

    final met = BxTargetRow.fromJson({
      'user': {'id': 'u2', 'fullName': 'كريم', 'role': 'SALES'},
      'target': {'id': 't', 'period': '2026-11', 'commissionTarget': '400000.00', 'dealsTarget': 3, 'bonusAmount': '15000.00'},
      'actual': {'commission': 597000, 'deals': 3},
      'progress': {'commissionPct': 149, 'dealsPct': 100, 'achieved': true},
      'bonus': 'EARNED',
    });
    expect(met.commissionTarget, 400000);
    expect(met.commissionPct, 149);
    expect(met.achieved, isTrue);
    expect(met.bonus, 'EARNED');
  });

  test('a launch reads its counts, the held money and the queue', () {
    final l = BxLaunch.fromJson({
      'id': 'l1',
      'name': 'إطلاق المرحلة الثالثة',
      'developerName': 'ماونتن فيو',
      'developerProject': {'id': 'p', 'name': {'ar': 'آي سيتي', 'en': 'iCity'}},
      'launchDate': '2026-12-05T00:00:00.000Z',
      'eoiAmount': '100000.00',
      'status': 'OPEN',
      'counts': {'total': 5, 'pending': 1, 'paid': 3, 'allocated': 1, 'refunded': 0},
      'held': 400000,
      'queueLength': 2,
      'eois': [
        {'id': 'e1', 'customerName': 'منى', 'customerPhone': '011', 'amount': '100000.00', 'status': 'PAID', 'queue': 1, 'agent': {'fullName': 'كريم'}},
      ],
    }, 'ar');
    expect(l.projectName, 'آي سيتي');
    expect(l.paid, 3);
    expect(l.held, 400000);
    expect(l.eois.single.queue, 1);
    expect(l.eois.single.agentName, 'كريم');
  });

  test('a listing reads its place and money', () {
    final x = BxListing.fromJson({
      'id': 'x',
      'code': 'L-0007',
      'kind': 'RENT',
      'status': 'CLOSED',
      'title': 'استوديو',
      'city': 'القاهرة',
      'district': 'الزمالك',
      'compound': null,
      'area': 55,
      'price': '24000.00',
      'agent': null,
    });
    expect(x.place, 'الزمالك، القاهرة');
    expect(x.price, 24000);
    expect(x.agentName, isNull);
  });

  test('the month key pads the month', () {
    expect(bxPeriod(DateTime(2026, 3, 9)), '2026-03');
  });
}
