import 'dart:convert';

import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/campaigns/data/campaigns_repository_impl.dart';
import 'package:mobile_staff/features/campaigns/domain/campaign.dart';
import 'package:mobile_staff/features/campaigns/presentation/campaign_detail_screen.dart';
import 'package:mobile_staff/features/campaigns/presentation/campaigns_cubit.dart';
import 'package:mobile_staff/features/campaigns/presentation/campaigns_screen.dart';
import 'package:mobile_staff/features/leads/data/dtos/lead_dtos.dart';
import 'package:mobile_staff/features/leads/data/mappers/lead_mapper.dart';

/// MC1 in the staff app: the campaigns managers read, the picker on a new
/// lead, and the campaign a lead came from.

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

Dio _dio(_Adapter a) => Dio(BaseOptions(baseUrl: 'https://api.test'))..httpClientAdapter = a;

final _row = {
  'id': 'c1',
  'name': 'Nile Launch',
  'code': 'nile-launch',
  'channel': 'FACEBOOK',
  'status': 'ACTIVE',
  'budget': 20000,
  'startDate': '2026-10-01T00:00:00.000Z',
  'endDate': null,
  'project': {'id': 'p1', 'name': {'ar': 'مشروع النيل', 'en': 'Nile Project'}},
  'source': {'id': 's1', 'name': 'Facebook'},
  'stats': {'leads': 40, 'qualified': 12, 'won': 2, 'lost': 5, 'spend': 15000, 'cpl': 375, 'cpa': 7500},
};

class _Repo implements CampaignsRepository {
  final calls = <String>[];

  @override
  Future<Result<List<CampaignOption>>> options() async => const Ok([]);

  @override
  Future<Result<CampaignsPage>> list({String? status}) async {
    calls.add('list:$status');
    final items = status == 'ENDED' ? <Campaign>[] : [Campaign.fromJson(_row)];
    return Ok(CampaignsPage(items: items, totals: const CampaignStats(leads: 40, won: 2, spend: 15000, cpl: 375, cpa: 7500)));
  }

  @override
  Future<Result<Campaign>> get(String id) async => Ok(Campaign.fromJson({
        ..._row,
        'spend': [
          {'id': 'sp1', 'amount': 10000, 'spentOn': '2026-10-05T00:00:00.000Z', 'note': 'Boost'},
          {'id': 'sp2', 'amount': '5000', 'spentOn': '2026-10-12T00:00:00.000Z'},
        ],
        'platforms': [
          {'platform': 'INSTAGRAM', 'leads': 25, 'won': 1},
          {'platform': null, 'leads': 15, 'won': 1},
        ],
      }));
}

Widget _app(Widget child) => MaterialApp(
      theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
      locale: const Locale('ar'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: child,
    );

void main() {
  test('a campaign: project, budget used, stats', () {
    final c = Campaign.fromJson(_row);
    expect(c.projectName, 'مشروع النيل');
    expect(c.sourceName, 'Facebook');
    expect(c.startsOn, DateTime.utc(2026, 10, 1));
    expect(c.stats.leads, 40);
    expect(c.stats.cpl, 375);
    expect(c.budgetUsed, 0.75);
    expect(Campaign.fromJson({..._row, 'budget': null}).budgetUsed, isNull);
  });

  test('the list asks for a status and reads the totals', () async {
    final adapter = _Adapter({
      'data': [_row],
      'totals': {'leads': 40, 'won': 2, 'spend': 15000, 'cpl': 375, 'cpa': 7500},
    });
    final page = (await CampaignsRepositoryImpl(_dio(adapter)).list(status: 'ACTIVE')).dataOrNull!;
    expect(page.items.single.name, 'Nile Launch');
    expect(page.totals.spend, 15000);
    expect(adapter.requests.single.path, '/campaigns');
    expect(adapter.requests.single.queryParameters, {'status': 'ACTIVE'});
  });

  test('a lead names the campaign that brought it', () {
    final lead = LeadRowDto.fromJson({
      'id': 'l1',
      'fullName': 'Mona',
      'stage': 'NEW',
      'campaign': {'id': 'c1', 'name': 'Nile Launch', 'channel': 'FACEBOOK'},
    }).toEntity();
    expect(lead.campaignName, 'Nile Launch');
    expect(lead.campaignChannel, 'FACEBOOK');
  });

  test('the cubit switches status and says when there are none', () async {
    final repo = _Repo();
    final cubit = CampaignsCubit(repo);
    await cubit.load();
    expect(cubit.state.status, DataStatus.success);
    await cubit.setFilter('ENDED');
    expect(cubit.state.status, DataStatus.empty);
    expect(repo.calls, ['list:null', 'list:ENDED']);
  });

  testWidgets('the list: totals, a campaign with its numbers and budget', (t) async {
    await t.pumpWidget(_app(BlocProvider(create: (_) => CampaignsCubit(_Repo()), child: const CampaignsScreen())));
    await t.pump();
    await t.pump();
    expect(find.byKey(const Key('campaigns-totals')), findsOneWidget);
    expect(find.text('Nile Launch'), findsOneWidget);
    expect(find.text('40 عميل'), findsOneWidget);
    expect(find.text('75%'), findsOneWidget);
    expect(find.text('ميتا (فيسبوك + إنستجرام) · مشروع النيل'), findsOneWidget);
  });

  testWidgets('the detail: stats, platforms and the spend log', (t) async {
    await t.pumpWidget(_app(BlocProvider(
      create: (_) => CampaignDetailCubit(_Repo(), id: 'c1'),
      child: const CampaignDetailScreen(),
    )));
    await t.pump();
    await t.pump();
    expect(find.text('Nile Launch'), findsOneWidget);
    await t.scrollUntilVisible(find.text('إنستجرام'), 200, scrollable: find.byType(Scrollable).first);
    expect(find.text('إنستجرام'), findsOneWidget);
    expect(find.text('مش معروف'), findsOneWidget);
    await t.scrollUntilVisible(find.byKey(const Key('campaign-spend')), 200, scrollable: find.byType(Scrollable).first);
    expect(find.text('Boost'), findsOneWidget);
  });

  test('labels', () {
    expect(campaignChannelColor('FACEBOOK'), const Color(0xFF1877F2));
    expect(campaignStatusTone('PAUSED'), BadgeTone.warning);
  });
}
