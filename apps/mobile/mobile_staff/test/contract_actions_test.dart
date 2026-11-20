import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/contracts/view/contract_actions.dart';
import 'package:mobile_staff/features/contracts/view/contracts_data.dart';

/// The admin's handover and cancellation, sent as the website sends them.

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
  ContractActionsRepository repoWith(_Adapter a) => ContractActionsRepository(Dio(BaseOptions(baseUrl: 'https://api.test'))..httpClientAdapter = a);

  test('the handover carries the date, the checklist and the notes', () async {
    final adapter = _Adapter({});
    await repoWith(adapter).handover('c1', date: DateTime(2026, 11, 5), checklist: {'keys': true, 'meters': false}, notes: ' ok ');
    final r = adapter.requests.single;
    expect(r.path, '/contracts/c1/handover');
    expect(r.data, {
      'handedOverAt': '2026-11-05',
      'checklist': [
        {'key': 'keys', 'done': true},
        {'key': 'meters', 'done': false},
      ],
      'notes': 'ok',
    });
  });

  test('the cancellation is pre-filled by the policy and sends the amounts', () async {
    final adapter = _Adapter({'totalCollected': '50000', 'suggestedRetained': '50000', 'suggestedRefund': '0'});
    final repo = repoWith(adapter);
    final s = (await repo.suggestion('c1')).dataOrNull!;
    expect(adapter.requests.single.path, '/contracts/c1/cancellation-suggestion');
    expect((s.collected, s.retained, s.refund), (50000.0, 50000.0, 0.0));

    await repo.cancel('c1', reason: 'customer withdrew', retained: 50000, refund: 0);
    final r = adapter.requests.last;
    expect(r.path, '/contracts/c1/cancel');
    expect(r.data, {'reason': 'customer withdrew', 'retainedAmount': 50000.0, 'refundAmount': 0.0});
  });

  test('a contract page knows when the unit was handed over', () {
    const base = {'id': 'c1', 'status': 'ACTIVE'};
    expect(ContractPage.parse({...base}).handedOver, isFalse);
    expect(ContractPage.parse({...base, 'handover': {'handedOverAt': '2026-11-05'}}).handedOver, isTrue);
  });
}
