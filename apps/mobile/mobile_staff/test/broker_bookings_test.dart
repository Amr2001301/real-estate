import 'dart:convert';

import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/broker/reservations/view/broker_bookings_data.dart';

Map<String, dynamic> _row(String id, String status, {Object? amount, Object? pct}) => {
      'id': id,
      'status': status,
      'reservationNumber': 'R-$id',
      'client': {'fullName': 'Client $id', 'phone': '+2010$id'},
      'commissionLockedAmount': amount,
      'commissionLockedPct': pct,
    };

class _Adapter implements HttpClientAdapter {
  _Adapter(this.rows);
  final List<Map<String, dynamic>> rows;

  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<List<int>>? s, Future<void>? c) async {
    final body = jsonEncode({'data': rows, 'meta': {'total': rows.length}});
    return ResponseBody.fromString(body, 200, headers: {Headers.contentTypeHeader: ['application/json']});
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  group('BrokerBooking', () {
    test('keeps the locked commission, none when the portal hides it', () {
      final shown = BrokerBooking.fromJson(_row('1', 'APPROVED', amount: '12000', pct: '2'));
      expect(shown.commission?.amount, 12000);
      expect(shown.commission?.pct, 2);
      expect(BrokerBooking.fromJson(_row('2', 'APPROVED')).commission, isNull);
    });

    test('matches client, phone and number', () {
      final b = BrokerBooking.fromJson(_row('1', 'PENDING'));
      expect(b.matches('client 1'), isTrue);
      expect(b.matches('r-1'), isTrue);
      expect(b.matches('zzz'), isFalse);
    });
  });

  group('BrokerBookingsCubit', () {
    Future<BrokerBookingsCubit> loaded(List<Map<String, dynamic>> rows) async {
      final dio = Dio()..httpClientAdapter = _Adapter(rows);
      final c = BrokerBookingsCubit(BrokerBookingsRepository(dio));
      await c.load();
      return c;
    }

    test('empty → empty', () async {
      final c = await loaded([]);
      expect(c.state.data.status, DataStatus.empty);
    });

    test('counts, commission total and filter', () async {
      final c = await loaded([
        _row('1', 'PENDING'),
        _row('2', 'CONVERTED', amount: '5000'),
        _row('3', 'CONVERTED', amount: '7000'),
      ]);
      expect(c.state.converted, 2);
      expect(c.state.commission, 12000);
      expect(c.state.hasCommission, isTrue);
      c.setFilter('CONVERTED');
      expect(c.state.shown.length, 2);
      c.setFilter('CONVERTED');
      expect(c.state.filter, isNull);
      c.setSearch('client 1');
      expect(c.state.shown.single.row.number, 'R-1');
    });
  });
}
