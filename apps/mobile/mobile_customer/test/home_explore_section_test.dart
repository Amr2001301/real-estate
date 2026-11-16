import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_customer/features/catalog/domain/entities/catalog_enums.dart';
import 'package:mobile_customer/features/catalog/domain/entities/project.dart';
import 'package:mobile_customer/features/catalog/domain/entities/unit.dart';
import 'package:mobile_customer/features/catalog/domain/repositories/catalog_repository.dart';
import 'package:mobile_customer/features/catalog/domain/usecases/get_projects.dart';
import 'package:mobile_customer/features/catalog/presentation/home/home_explore_section.dart';
import 'package:mobile_customer/features/catalog/presentation/projects/projects_cubit.dart';
import 'package:mobile_customer/features/favorites/domain/entities/favorite.dart';
import 'package:mobile_customer/features/favorites/domain/repositories/favorites_repository.dart';
import 'package:mobile_customer/features/favorites/domain/usecases/add_favorite.dart';
import 'package:mobile_customer/features/favorites/domain/usecases/get_favorites.dart';
import 'package:mobile_customer/features/favorites/domain/usecases/remove_favorite.dart';
import 'package:mobile_customer/features/favorites/presentation/favorites_cubit.dart';
import 'package:mobile_customer/features/catalog/presentation/widgets/project_card.dart';

/// An owner's tab bar has no catalog tabs; «استكشف مشاريعنا» on their home
/// leads to the company's projects (the guest home's project cards, in a
/// horizontal slider), units,
/// compare and a visit request.

class _Favorites implements FavoritesRepository {
  @override
  Future<Result<List<Favorite>>> getFavorites() async => const Ok([]);
  @override
  Future<Result<Favorite>> addProject(String projectId) => throw UnimplementedError();
  @override
  Future<Result<Favorite>> addUnit(String unitId) => throw UnimplementedError();
  @override
  Future<Result<void>> remove(String favoriteId) => throw UnimplementedError();
}
/// Lists projects in two cities and honours the `city` filter, like the API.
class _Repo implements CatalogRepository {
  final all = [_project('a', 'Riyadh'), _project('b', 'Jeddah'), _project('c', 'Riyadh')];

  @override
  Future<Result<Paginated<ProjectListItem>>> listProjects({
    String? query,
    String? city,
    bool? featured,
    ProjectSort sort = ProjectSort.newest,
    int page = 1,
    int pageSize = 12,
  }) async {
    await Future<void>.delayed(Duration.zero);
    final rows = all.where((p) => city == null || p.city == city).toList();
    return Result.ok(Paginated(
      data: rows,
      meta: PageMeta(page: 1, pageSize: 12, total: rows.length, totalPages: 1),
    ));
  }

  @override
  Future<Result<ProjectDetail>> getProject(String id) => throw UnimplementedError();
  @override
  Future<Result<Paginated<Unit>>> listUnits({
    String? projectId,
    String? city,
    String? type,
    UnitStatus? status,
    num? priceMin,
    num? priceMax,
    num? areaMin,
    num? areaMax,
    int? bedrooms,
    UnitSort sort = UnitSort.newest,
    int page = 1,
    int pageSize = 12,
  }) =>
      throw UnimplementedError();
  @override
  Future<Result<Unit>> getUnit(String id) => throw UnimplementedError();
  @override
  Future<Result<List<InstallmentOffer>>> getUnitPlans(String unitId) => throw UnimplementedError();
  @override
  Future<Result<ProjectPlanSummary>> getProjectPlans(String projectId) => throw UnimplementedError();
}

ProjectListItem _project(String id, String city) => ProjectListItem(
      id: id,
      name: const Translatable(ar: 'مشروع', en: 'Project'),
      description: const Translatable(ar: '', en: ''),
      city: city,
      services: const [],
      featured: false,
      availableUnitsCount: 1,
    );


/// What each opened page received as `extra`, in order.
final _extras = <Object?>[];

Future<List<String>> _pump(WidgetTester tester) async {
  final visited = <String>[];
  _extras.clear();
  final router = GoRouter(routes: [
    GoRoute(
      path: '/',
      builder: (_, _) => Scaffold(
        body: MultiBlocProvider(
          providers: [
            BlocProvider(create: (_) => SessionCubit(TokenStorage())..adoptSignedOut()),
            BlocProvider(create: (_) => FavoritesCubit(GetFavorites(_Favorites()), AddFavorite(_Favorites()), RemoveFavorite(_Favorites()))),
            BlocProvider(create: (_) => ProjectsCubit(GetProjects(_Repo()))),
          ],
          child: const SingleChildScrollView(child: HomeExploreSection()),
        ),
      ),
    ),
    for (final p in ['/explore/projects', '/explore/units', '/explore/compare', '/visit-request', '/projects/:id'])
      GoRoute(
        path: p,
        builder: (_, s) {
          visited.add(s.uri.toString());
          _extras.add(s.extra);
          return Scaffold(body: Text('page $p'));
        },
      ),
  ]);
  await tester.pumpWidget(MaterialApp.router(
    theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
    locale: const Locale('ar'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    routerConfig: router,
  ));
  await tester.pumpAndSettle();
  return visited;
}

Future<void> _tap(WidgetTester tester, Finder f) async {
  await tester.ensureVisible(f);
  await tester.pumpAndSettle();
  await tester.tap(f);
}

void main() {
  testWidgets('shows the company projects and opens the lists', (tester) async {
    final visited = await _pump(tester);
    expect(find.text('استكشف مشاريعنا'), findsOneWidget);
    expect(find.byKey(const Key('home-explore-project-a')), findsOneWidget);
    // The same card as the guest home and the projects list, in a slider.
    final slider = tester.widget<ListView>(find.byKey(const Key('home-explore-slider')));
    expect(slider.scrollDirection, Axis.horizontal);
    expect(find.byType(ProjectCard), findsWidgets);

    await _tap(tester, find.byKey(const Key('home-explore-units')));
    await tester.pumpAndSettle();
    expect(visited, ['/explore/units']);
  });

  testWidgets('«كل المشاريع» and a project card open them', (tester) async {
    final visited = await _pump(tester);
    await _tap(tester, find.byKey(const Key('home-explore-all')));
    await tester.pumpAndSettle();
    expect(visited.last, '/explore/projects');
  });

  testWidgets('a project card opens the project', (tester) async {
    final visited = await _pump(tester);
    await _tap(tester, find.byType(ProjectCard).first);
    await tester.pumpAndSettle();
    expect(visited.last, '/projects/a');
  });

  testWidgets('a visit request asks for the project first', (tester) async {
    final visited = await _pump(tester);
    await _tap(tester, find.byKey(const Key('home-explore-visit')));
    await tester.pumpAndSettle();
    expect(find.text('اختر المشروع'), findsOneWidget);
    await _tap(tester, find.byKey(const Key('visit-pick-b')));
    await tester.pumpAndSettle();
    expect(visited.last, '/visit-request');
    expect((_extras.last as Map)['projectId'], 'b');
  });
}
