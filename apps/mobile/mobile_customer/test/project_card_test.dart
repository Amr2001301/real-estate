import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/catalog/data/dtos/project_dto.dart';
import 'package:mobile_customer/features/catalog/data/mappers/project_mapper.dart';
import 'package:mobile_customer/features/catalog/domain/entities/project.dart';
import 'package:mobile_customer/features/catalog/presentation/widgets/project_card.dart';
import 'package:mobile_customer/features/favorites/domain/entities/favorite.dart';
import 'package:mobile_customer/features/favorites/domain/repositories/favorites_repository.dart';
import 'package:mobile_customer/features/favorites/domain/usecases/add_favorite.dart';
import 'package:mobile_customer/features/favorites/domain/usecases/get_favorites.dart';
import 'package:mobile_customer/features/favorites/domain/usecases/remove_favorite.dart';
import 'package:mobile_customer/features/favorites/presentation/favorites_cubit.dart';

/// The project card says what is on offer — «يبدأ من» the lowest available
/// price and the available unit types — not the project's amenities.

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

ProjectListItem _project() => ProjectListItemDto.fromJson({
      'id': 'p1',
      'name': {'ar': 'لاجونا باي', 'en': 'Laguna Bay'},
      'description': {'ar': '', 'en': ''},
      'city': 'الساحل الشمالي',
      'services': [
        {'ar': 'نادي اجتماعي', 'en': 'Club'},
        {'ar': 'أمن 24/7', 'en': 'Security'},
      ],
      'featured': true,
      'availableUnitsCount': 8,
      'coverImage': null,
      'startingPrice': '3895000.00',
      'unitTypes': ['2BR', '3BR', 'Villa', 'Studio'],
    }).toEntity();

void main() {
  test('the list item reads the starting price and unit types', () {
    final p = _project();
    expect(p.startingPrice, '3895000.00');
    expect(p.unitTypes, ['2BR', '3BR', 'Villa', 'Studio']);
    final old = ProjectListItemDto.fromJson({'id': 'x', 'name': 'x', 'description': '', 'city': ''}).toEntity();
    expect(old.startingPrice, isNull);
    expect(old.unitTypes, isEmpty);
  });

  testWidgets('shows the starting price and unit types, not the services', (tester) async {
    await tester.pumpWidget(MultiBlocProvider(
      providers: [
        BlocProvider(create: (_) => SessionCubit(TokenStorage())..adoptSignedOut()),
        BlocProvider(create: (_) => FavoritesCubit(GetFavorites(_Favorites()), AddFavorite(_Favorites()), RemoveFavorite(_Favorites()))),
      ],
      child: MaterialApp(
        theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
        locale: const Locale('ar'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(body: SingleChildScrollView(child: ProjectCard(project: _project()))),
      ),
    ));
    await tester.pump();

    expect(find.byKey(const Key('project-card-from')), findsOneWidget);
    expect(find.textContaining('3,895,000', findRichText: true), findsOneWidget);
    expect(find.text('+1'), findsOneWidget); // four types: three shown, then «+1»
    expect(find.text('نادي اجتماعي'), findsNothing);
    expect(find.text('أمن 24/7'), findsNothing);
  });
}
