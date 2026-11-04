import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/catalog/projects_list/projects_list_data.dart';
import 'package:mobile_staff/features/catalog/projects_list/projects_list_screen.dart';

/// The projects list: the website's projects page figures.

const _projects = <String, dynamic>{
  'data': [
    {
      'id': 'p1',
      'name': 'لاجونا باي — الساحل الشمالي',
      'city': 'الساحل الشمالي',
      'district': 'سيدي عبد الرحمن',
      'type': 'COASTAL',
      'status': 'PUBLISHED',
      'availableUnitsCount': 8,
      'totalUnitsCount': 16,
      'soldUnitsCount': 7,
      'startingPrice': 3895000,
      'unitTypes': ['3BR', 'Villa'],
    },
    {'id': 'p2', 'name': 'فيلات الجولف', 'city': 'Jeddah', 'status': 'DRAFT', 'unitTypes': <String>[]},
  ],
};
const _options = <String, dynamic>{
  'data': [
    {'id': 'p1', 'status': 'PUBLISHED', 'featured': true},
    {'id': 'p2', 'status': 'DRAFT', 'featured': false},
  ],
};
const _matrix = <String, dynamic>{
  'projects': [
    {'id': 'p1', 'available': 8, 'reserved': 1, 'sold': 7, 'total': 16},
  ],
};
const _units = <String, dynamic>{
  'meta': {
    'total': 52,
    'facets': {
      'counts': {'status': {'AVAILABLE': 21, 'RESERVED': 5, 'SOLD': 26}},
      'sums': {'price': '242397000'},
    },
  },
};
const _types = [
  {'code': '3BR', 'name': 'شقة 3 غرف نوم'},
  {'code': 'Villa', 'name': 'فيلا'},
];
const _summary = <String, dynamic>{
  'topProjects': [
    {'id': 'p1', 'contractValue': 28700000, 'signedContracts': 6},
  ],
};

ProjectsOverview _overview({bool admin = true}) => ProjectsListRepository.parse(
      _projects,
      options: _options,
      matrix: _matrix,
      units: _units,
      unitTypes: _types,
      summary: admin ? _summary : null,
      admin: admin,
    );

class _Repo implements ProjectsListRepository {
  _Repo(this.admin);
  @override
  final bool admin;
  @override
  Future<Result<ProjectsOverview>> load({String? search}) async => Ok(_overview(admin: admin));
  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

Future<void> _pump(WidgetTester t, {required bool admin}) async {
  t.view.physicalSize = const Size(390 * 3, 1800 * 3);
  t.view.devicePixelRatio = 3;
  addTearDown(t.view.reset);
  final cubit = ProjectsListCubit(_Repo(admin));
  addTearDown(cubit.close);
  await t.pumpWidget(BlocProvider.value(
    value: cubit,
    child: MaterialApp(
      theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
      locale: const Locale('ar'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: const ProjectsListScreen(),
    ),
  ));
  await t.pumpAndSettle();
}

void main() {
  test('reads the units by status, the types and the totals as the website does', () {
    final o = _overview();
    final p = o.rows.first;
    expect([p.available, p.reserved, p.sold, p.total], [8, 1, 7, 16]); // from the inventory matrix
    expect(p.featured, isTrue); // from the options, the list leaves it out
    expect(p.unitTypes, ['شقة 3 غرف نوم', 'فيلا']); // names, not codes
    expect(p.contractValue, 28700000);
    expect(o.rows.last.contractValue, 0); // the admin sees 0 for a project with no contracts
    expect([o.projects, o.published, o.drafts, o.featured], [2, 1, 1, 1]);
    expect([o.unitsTotal, o.unitsAvailable, o.unitsSold, o.unitsReserved], [52, 21, 26, 5]);
    expect(o.inventoryValue, 242397000);
    expect(_overview(admin: false).rows.first.contractValue, isNull); // not for sales
  });

  testWidgets('the admin sees the figures, the filters and the contract value', (t) async {
    await _pump(t, admin: true);
    expect(find.byKey(const Key('home-fig-projects')), findsOneWidget);
    expect(find.byKey(const Key('home-fig-inventory')), findsOneWidget);
    expect(find.text('قيمة المخزون (مليون)'), findsOneWidget);
    expect(find.byKey(const Key('project-card-p1')), findsOneWidget);
    expect(find.text('ساحلي'), findsOneWidget);
    expect(find.byKey(const Key('project-value-p1')), findsOneWidget);
    expect(find.text('فيلا'), findsOneWidget);

    await t.tap(find.byKey(const Key('home-pill-DRAFT')));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('project-card-p1')), findsNothing);
    expect(find.byKey(const Key('project-card-p2')), findsOneWidget);
  });

  testWidgets('sales do not see the contract value', (t) async {
    await _pump(t, admin: false);
    expect(find.byKey(const Key('project-from-p1')), findsOneWidget);
    expect(find.byKey(const Key('project-value-p1')), findsNothing);
  });
}
