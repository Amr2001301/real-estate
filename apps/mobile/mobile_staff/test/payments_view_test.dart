import 'dart:convert';

import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/deposits/view/payments_data.dart';

Map<String, dynamic> _row(String id, String state, {String method = 'CASH', String type = 'INSTALLMENT', String name = 'وليد حنا', Object? amount = '1000'}) => {
      'id': id,
      'type': type,
      'amount': amount,
      'paidAt': '2026-11-04T08:00:00.000Z',
      'state': state,
      'paymentMethod': method,
      'paymentInstrumentId': method == 'CHEQUE' ? 'i-$id' : null,
      'proofDocumentId': state == 'PENDING_REVIEW' ? 'doc' : null,
      'contract': {
        'id': 'c1',
        'contractNumber': 'CON-2026-0008',
        'customer': {'fullName': name},
        'unit': {'code': 'DF-NG-B01-302'},
      },
      'installment': {'dueDate': '2026-11-14T00:00:00.000Z', 'amount': '113222.22'},
      'paymentInstrument': method == 'CHEQUE' ? {'chequeNumber': '101050'} : null,
    };

class _Adapter implements HttpClientAdapter {
  _Adapter(this.rows);
  final List<Map<String, dynamic>> rows;
  final calls = <String>[];

  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<List<int>>? s, Future<void>? c) async {
    calls.add('${o.method} ${o.path}');
    final body = o.method == 'GET' && o.path == '/deposits'
        ? jsonEncode({
            'data': rows,
            'meta': {'total': rows.length},
            'totals': {'totalAmount': '5000.5', 'count': rows.length},
          })
        : '{}';
    return ResponseBody.fromString(body, 200, headers: {Headers.contentTypeHeader: ['application/json']});
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  group('PaymentRow', () {
    test('reads the client, reference, unit, cheque and group', () {
      final p = PaymentRow.fromJson(_row('1', 'CHEQUE_PENDING', method: 'CHEQUE'));
      expect(p.clientName, 'وليد حنا');
      expect(p.reference, 'CON-2026-0008');
      expect(p.unitCode, 'DF-NG-B01-302');
      expect(p.chequeNumber, '101050');
      expect(p.instrumentId, 'i-1');
      expect(p.installmentAmount, 113222.22);
      expect(p.group, PaymentGroup.cheque);
    });

    test('a booking payment takes the client or lead of the booking', () {
      final p = PaymentRow.fromJson({
        'id': 'b',
        'type': 'BOOKING_AMOUNT',
        'amount': 100000,
        'state': 'COLLECTED',
        'reservation': {'reservationNumber': 'RES-1', 'lead': {'fullName': 'رانيا غالي'}, 'unit': {'code': 'U-1'}},
      });
      expect(p.clientName, 'رانيا غالي');
      expect(p.reference, 'RES-1');
      expect(p.unitCode, 'U-1');
    });

    test('groups by state', () {
      PaymentGroup g(String s) => PaymentRow.fromJson(_row('x', s)).group;
      expect(g('PENDING_REVIEW'), PaymentGroup.review);
      expect(g('COLLECTED'), PaymentGroup.collected);
      expect([g('REJECTED'), g('BOUNCED'), g('REVERSED')], everyElement(PaymentGroup.closed));
    });
  });

  group('PaymentsListCubit', () {
    Future<(PaymentsListCubit, _Adapter)> loaded(List<Map<String, dynamic>> rows) async {
      final a = _Adapter(rows);
      final c = PaymentsListCubit(PaymentsRepository(Dio()..httpClientAdapter = a));
      await c.load();
      return (c, a);
    }

    test('empty → empty', () async {
      final (c, _) = await loaded([]);
      expect(c.state.data.status, DataStatus.empty);
    });

    test('counts, total, filter and search', () async {
      final (c, _) = await loaded([
        _row('1', 'PENDING_REVIEW'),
        _row('2', 'CHEQUE_PENDING', method: 'CHEQUE'),
        _row('3', 'COLLECTED', name: 'تامر سليمان'),
        _row('4', 'BOUNCED', method: 'CHEQUE'),
      ]);
      expect(c.state.totals.amount, 5000.5);
      expect(c.state.count(PaymentGroup.review), 1);
      expect(c.state.count(PaymentGroup.closed), 1);
      c.setFilter(PaymentGroup.cheque);
      expect(c.state.shown.single.id, '2');
      c.setFilter(PaymentGroup.cheque);
      expect(c.state.filter, isNull);
      c.setSearch('تامر');
      expect(c.state.shown.single.id, '3');
    });

    test('approving posts and reloads', () async {
      final (c, a) = await loaded([_row('1', 'PENDING_REVIEW')]);
      final f = await c.decide('1', approve: true);
      expect(f, isNull);
      expect(a.calls, contains('POST /deposits/1/approve'));
      expect(a.calls.where((x) => x == 'GET /deposits').length, 2);
    });

    test('rejecting sends the reason', () async {
      final (c, a) = await loaded([_row('1', 'PENDING_REVIEW')]);
      await c.decide('1', approve: false, reason: 'unclear');
      expect(a.calls, contains('POST /deposits/1/reject'));
    });
  });

  group('PaymentCubit', () {
    test('keeps the row it opened from when the reread is refused', () async {
      final row = PaymentRow.fromJson(_row('9', 'COLLECTED'));
      final dio = Dio()
        ..httpClientAdapter = (_Refuse());
      final c = PaymentCubit(PaymentsRepository(dio), paymentId: '9', initial: row);
      await c.load();
      expect(c.state.data?.id, '9');
      expect(c.state.status, DataStatus.success);
    });
  });
}

class _Refuse implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<List<int>>? s, Future<void>? c) async =>
      ResponseBody.fromString('{"message":"Forbidden"}', 403, headers: {Headers.contentTypeHeader: ['application/json']});

  @override
  void close({bool force = false}) {}
}
