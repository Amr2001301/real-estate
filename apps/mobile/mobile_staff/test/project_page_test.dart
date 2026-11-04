import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/catalog/project_page/project_page_data.dart';
import 'package:mobile_staff/features/catalog/project_page/project_page_screen.dart';

/// A project's page: the website's project page.

const _project = <String, dynamic>{
  'id': 'p1',
  'name': 'لاجونا باي — الساحل الشمالي',
  'description': 'قرية ساحلية على شاطئ رملي.',
  'city': 'الساحل الشمالي',
  'district': 'سيدي عبد الرحمن',
  'type': 'COASTAL',
  'totalArea': 240000,
  'licenseNumber': 'LIC-1',
  'lat': 30.96,
  'lng': 28.74,
  'status': 'PUBLISHED',
  'featured': true,
  'services': ['نادي اجتماعي', 'أمن 24/7'],
  'media': [
    {'url': 'https://x/1.jpg', 'type': 'IMAGE'},
    {'url': 'https://x/plan.jpg', 'type': 'FLOORPLAN'},
  ],
  'phases': [
    {
      'id': 'ph1',
      'name': 'المرحلة الأولى',
      'deliveryDate': '2027-07-01T00:00:00.000Z',
      'buildings': [
        {'id': 'b1', 'name': 'زون الشاليهات', 'totalFloors': 3, '_count': {'units': 8}},
        {'id': 'b2', 'name': 'زون اللاجون', 'totalFloors': 3, '_count': {'units': 8}},
      ],
    },
  ],
};
const _meta = <String, dynamic>{
  'total': 16,
  'facets': {
    'counts': {'status': {'AVAILABLE': 8, 'RESERVED': 1, 'SOLD': 7}},
  },
};
const _free = <String, dynamic>{
  'data': [
    {'id': 'u1', 'code': 'DF-LB-Z02-102', 'status': 'AVAILABLE', 'price': '3895000', 'area': 95, 'bedrooms': 2},
  ],
};
const _matrix = <String, dynamic>{
  'projects': [
    {
      'id': 'p1',
      'phases': [
        {
          'buildings': [
            {'id': 'b1', 'available': 1, 'sold': 6},
            {'id': 'b2', 'available': 7, 'sold': 1},
          ],
        },
      ],
    },
  ],
};

ProjectPage _page() => ProjectPage.parse(_project, unitsMeta: _meta, free: _free, matrix: _matrix);

class _Repo implements ProjectPageRepository {
  @override
  // No coordinates here: the map would fetch tiles in the test.
  Future<Result<ProjectPage>> load(String id) async =>
      Ok(ProjectPage.parse({..._project, 'lat': null, 'lng': null}, unitsMeta: _meta, free: _free, matrix: _matrix));
  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

void main() {
  test('reads the units by status, the phases and buildings, and the cheapest free unit', () {
    final p = _page();
    expect([p.available, p.reserved, p.sold, p.total], [8, 1, 7, 16]);
    expect(p.occupancy, 50); // (1 + 7) of 16, as the website
    expect(p.buildings, 2);
    expect(p.phases.single.units, 16);
    expect(p.phases.single.buildings.first.available, 1); // from the inventory matrix
    expect(p.startingPrice, 3895000);
    expect(p.photos, ['https://x/1.jpg']);
    expect(p.floorPlans, ['https://x/plan.jpg']);
    expect(p.delivery, DateTime.utc(2027, 7));
    expect(p.maxFloors, 3);
  });

  testWidgets('the page: occupancy, the band, the facts, the phases and the free units', (t) async {
    t.view.physicalSize = const Size(390 * 3, 4000 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    final cubit = ProjectPageCubit(_Repo(), projectId: 'p1');
    addTearDown(cubit.close);
    await t.pumpWidget(BlocProvider.value(
      value: cubit,
      child: MaterialApp(
        theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
        locale: const Locale('ar'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: const ProjectPageScreen(),
      ),
    ));
    await t.pump();
    await t.pump(const Duration(milliseconds: 300));
    expect(find.textContaining('50%'), findsOneWidget);
    expect(find.byKey(const Key('home-fig-units')), findsOneWidget);
    expect(find.text('ساحلي'), findsOneWidget);
    expect(find.text('LIC-1'), findsNothing); // isolated by ltr()
    expect(find.textContaining('LIC-1'), findsOneWidget);
    expect(find.byKey(const Key('project-phase-ph1')), findsOneWidget);
    expect(find.text('زون الشاليهات'), findsOneWidget);
    expect(find.byKey(const Key('unit-card-u1')), findsOneWidget);
    expect(find.byKey(const Key('project-add-lead')), findsOneWidget);
  });
}
