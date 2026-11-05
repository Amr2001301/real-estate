import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/broker/commissions/data/dtos/broker_commission_dto.dart';
import 'package:mobile_staff/features/broker/commissions/data/mappers/broker_commission_mapper.dart';
import 'package:mobile_staff/features/broker/commissions/view/broker_payouts_data.dart';

class _Adapter implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<List<int>>? s, Future<void>? c) async => ResponseBody.fromString(
        jsonEncode({
          'data': [
            {'id': 'p1', 'payoutNumber': 'PAY-2026-0001', 'period': '2026-10', 'status': 'PAID', 'totalNet': '264000', 'paidAt': '2026-10-29T09:02:10.712Z', 'paymentMethod': 'BANK_TRANSFER'},
            {'id': 'p2', 'payoutNumber': 'PAY-2026-0002', 'period': '2026-11', 'status': 'DRAFT', 'totalNet': '100'},
          ],
        }),
        200,
        headers: {Headers.contentTypeHeader: ['application/json']},
      );

  @override
  void close({bool force = false}) {}
}

void main() {
  test('a commission keeps its number, client, contract, basis and payout', () {
    final c = BrokerCommissionDto.fromJson({
      'id': 'c1',
      'commissionNumber': 'COM-2026-0001',
      'status': 'PENDING',
      'netAmount': '132000',
      'grossAmount': '132000',
      'basisAmount': '5280000',
      'commissionPct': '2.5',
      'earnedAt': '2026-10-13T08:00:00.000Z',
      'contractId': 'k1',
      'payoutId': null,
      'contract': {'contractNumber': 'CON-2026-0022', 'customer': {'fullName': 'ريهام بدوي'}},
    }).toEntity();
    expect(c.number, 'COM-2026-0001');
    expect(c.contractNumber, 'CON-2026-0022');
    expect(c.clientName, 'ريهام بدوي');
    expect(c.basisAmount, '5280000');
    expect(c.commissionPct, '2.5');
    expect(c.earnedAt, isNotNull);
    expect(c.payoutId, isNull);
  });

  test('the payout statements load and the paid total counts only paid ones', () async {
    final cubit = BrokerPayoutsCubit(BrokerPayoutsRepository(Dio()..httpClientAdapter = _Adapter()));
    await cubit.load();
    expect(cubit.state.length, 2);
    expect(cubit.state.first.number, 'PAY-2026-0001');
    expect(cubit.paidTotal, 264000);
  });
}
