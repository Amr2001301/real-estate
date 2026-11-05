import 'dart:convert';

import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/performance/brokers/brokers_perf_data.dart';

class _Adapter implements HttpClientAdapter {
  final calls = <String>[];

  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<List<int>>? s, Future<void>? c) async {
    calls.add(o.path);
    final body = switch (o.path) {
      '/broker-reports/summary' => {'totalBrokers': 2, 'activeBrokers': 2, 'leadsSubmitted': 8, 'leadsApproved': 5, 'reservationsCreated': 5, 'contractsSigned': 5, 'contractsCommissionPaid': 2, 'salesGross': '24711000', 'commissionsNet': '662130', 'commissionsPendingNet': '132000'},
      '/broker-reports/top-brokers' => {
          'data': [
            {'brokerId': 'b1', 'companyName': 'بيت الخبرة', 'code': 'BR1', 'status': 'ACTIVE', 'leads': 5, 'reservations': 3, 'contractsSigned': 3, 'salesGross': '15840000', 'commissionNet': '396000', 'payoutNet': '264000', 'conversionRate': 1},
          ],
        },
      '/broker-reports/monthly-trend' => [
          {'label': '2026-10', 'commissionsNet': '132000', 'contractsSigned': 1},
          {'label': '2026-11', 'commissionsNet': '0', 'contractsSigned': 0},
        ],
      '/broker-reports/projects' => {
          'data': [
            {'projectName': 'نايل جاردنز', 'city': 'القاهرة', 'contractsSigned': 4, 'salesGross': '20160000'},
          ],
        },
      '/portal/performance' => {
          'broker': {'commercialName': 'Beit El Khebra'},
          'summary': {'leadsSubmitted': 5, 'contractsSigned': 3, 'salesGross': '15840000', 'commissionsNet': '396000', 'commissionsPendingNet': '132000', 'payoutsPaid': 1, 'payoutsTotalNet': '264000'},
          'monthlyTrend': [],
          'projectBreakdown': [],
          'agentBreakdown': [
            {'brokerAgentId': 'a1', 'fullName': 'كريم حلمي', 'leadsSubmitted': 5, 'contractsSigned': 3, 'salesGross': '15840000'},
          ],
        },
      _ => {},
    };
    return ResponseBody.fromString(jsonEncode(body), 200, headers: {Headers.contentTypeHeader: ['application/json']});
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  BrokersPerfRepository repo(_Adapter a) => BrokersPerfRepository(Dio()..httpClientAdapter = a);

  test('the admin report reads the summary, brokers, trend and projects', () async {
    final r = (await repo(_Adapter()).all()).dataOrNull!;
    expect(r.summary.activeBrokers, 2);
    expect(r.summary.salesGross, 24711000);
    expect(r.summary.commissionsPendingNet, 132000);
    expect(r.brokers.single.name, 'بيت الخبرة');
    expect(r.brokers.single.payoutNet, 264000);
    expect(r.brokers.single.conversionRate, 1);
    expect(r.trend.length, 2);
    expect(r.projects.single.contractsSigned, 4);
  });

  test('the broker reads only their own portal report', () async {
    final a = _Adapter();
    final r = (await repo(a).mine()).dataOrNull!;
    expect(a.calls, ['/portal/performance']);
    expect(r.brokerName, 'Beit El Khebra');
    expect(r.summary.totalBrokers, isNull);
    expect(r.brokers.single.name, 'كريم حلمي');
    expect(r.summary.payoutsTotalNet, 264000);
  });

  test('the cubit is empty when there is nothing, success otherwise', () async {
    final ok = BrokersPerfCubit(repo(_Adapter()).all);
    await ok.load();
    expect(ok.state.status, DataStatus.success);
    final none = BrokersPerfCubit(() async => const Ok(BrokersPerf(summary: BrokersSummary())));
    await none.load();
    expect(none.state.status, DataStatus.empty);
  });
}
