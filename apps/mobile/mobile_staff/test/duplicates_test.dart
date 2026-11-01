import 'dart:convert';

import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/duplicates/data/duplicates_repository_impl.dart';
import 'package:mobile_staff/features/duplicates/domain/duplicates.dart';
import 'package:mobile_staff/features/duplicates/presentation/duplicates_cubit.dart';
import 'package:mobile_staff/features/duplicates/presentation/duplicates_screen.dart';

/// DUP1 in the staff app: one customer's open leads, one kept, the rest merged in.

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

Map<String, dynamic> _lead(String id, String stage, {int reservations = 0, Map<String, dynamic>? broker, bool mergeable = true}) => {
      'id': id,
      'stage': stage,
      'createdAt': '2026-10-0${id.codeUnitAt(1) % 9 + 1}T10:00:00.000Z',
      'assignedSales': {'id': 'u1', 'fullName': 'Rep One'},
      'source': {'id': 's', 'name': 'Website'},
      'campaign': null,
      'projectInterest': {'id': 'p', 'name': {'ar': 'مشروع النيل', 'en': 'Nile'}},
      'broker': broker,
      '_count': {'notes': 3, 'reservations': reservations},
      'mergeable': mergeable,
    };

final _groupJson = {
  'client': {'id': 'c1', 'fullName': 'Mona Ahmed', 'phone': '+201001234567'},
  'leads': [_lead('l1', 'NEW'), _lead('l2', 'VISIT'), _lead('l3', 'INTERESTED')],
};

class _Repo implements DuplicatesRepository {
  _Repo(this.groups);
  List<DuplicateGroup> groups;
  final merges = <String>[];

  @override
  Future<Result<List<DuplicateGroup>>> list() async => Ok(groups);

  @override
  Future<Result<int>> merge(String keepId, List<String> duplicateIds) async {
    merges.add('$keepId<-${duplicateIds.join(',')}');
    groups = [];
    return Ok(duplicateIds.length);
  }
}

void main() {
  test('reads a group; keeps the furthest along by default', () {
    final g = DuplicateGroup.fromJson(_groupJson);
    expect(g.name, 'Mona Ahmed');
    expect(g.leads, hasLength(3));
    expect(g.leads.first.projectName, 'مشروع النيل');
    expect(g.leads.first.notes, 3);
    expect(g.suggestedKeep.id, 'l2');
  });

  test('a lead with a reservation or a broker is the one kept', () {
    final g = DuplicateGroup.fromJson({
      ..._groupJson,
      'leads': [
        _lead('l1', 'NEGOTIATION'),
        _lead('l2', 'NEW', broker: {'commercialName': 'Top Homes'}, mergeable: false),
      ],
    });
    expect(g.suggestedKeep.id, 'l2');
    expect(g.leads.last.brokerName, 'Top Homes');
  });

  test('the repository lists groups and merges into the kept lead', () async {
    final adapter = _Adapter({'groups': [_groupJson], 'total': 1, 'id': 'l2', 'merged': 2});
    final dio = Dio(BaseOptions(baseUrl: 'https://api.test'))..httpClientAdapter = adapter;
    final repo = DuplicatesRepositoryImpl(dio);
    expect((await repo.list()).dataOrNull!.single.leads, hasLength(3));
    expect((await repo.merge('l2', ['l1', 'l3'])).dataOrNull, 2);
    expect(adapter.requests.last.path, '/leads/l2/merge');
    expect(adapter.requests.last.data, {'duplicateIds': ['l1', 'l3']});
  });

  test('the cubit: keep another, untick one, merge the rest', () async {
    final repo = _Repo([DuplicateGroup.fromJson(_groupJson)]);
    final cubit = DuplicatesCubit(repo);
    await cubit.load();
    final g = cubit.state.groups.single;
    expect(cubit.state.keepOf(g), 'l2');
    expect(cubit.state.toMerge(g), ['l1', 'l3']);

    cubit.pickKeep(g, 'l1');
    expect(cubit.state.toMerge(g), ['l2', 'l3']);
    cubit.toggle(g, 'l3');
    expect(cubit.state.toMerge(g), ['l2']);

    await cubit.merge(g);
    expect(repo.merges, ['l1<-l2']);
    expect(cubit.state.merged, 1);
    expect(cubit.state.status, DataStatus.empty);
  });

  test('a locked lead is never ticked to merge', () async {
    final g = DuplicateGroup.fromJson({
      ..._groupJson,
      'leads': [_lead('l1', 'NEW'), _lead('l2', 'NEW', reservations: 1, mergeable: false), _lead('l3', 'NEW')],
    });
    final cubit = DuplicatesCubit(_Repo([g]));
    await cubit.load();
    cubit.pickKeep(g, 'l1');
    expect(cubit.state.toMerge(g), ['l3']);
  });

  testWidgets('the screen: a customer with its leads, merge after confirming', (t) async {
    final repo = _Repo([DuplicateGroup.fromJson(_groupJson)]);
    t.view.physicalSize = const Size(430, 1400);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.reset);
    await t.pumpWidget(MaterialApp(
      theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
      locale: const Locale('ar'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: BlocProvider(create: (_) => DuplicatesCubit(repo), child: const DuplicatesScreen()),
    ));
    await t.pump();
    await t.pump();
    expect(find.text('Mona Ahmed'), findsOneWidget);
    expect(find.text('3 فرص مفتوحة'), findsOneWidget);
    await t.tap(find.byKey(const ValueKey('dup-tick-l3')));
    await t.pump();
    expect(find.text('ادمج 1 في اللي بتفضل'), findsOneWidget);
    await t.tap(find.byKey(const ValueKey('dup-merge-c1')));
    await t.pump(const Duration(milliseconds: 300));
    await t.tap(find.widgetWithText(FilledButton, 'ادمج 1 في اللي بتفضل'));
    await t.pump();
    await t.pump();
    expect(repo.merges, ['l2<-l1']);
    expect(find.text('مفيش عملاء مكررين'), findsOneWidget);
  });
}
