import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/company_discovery/domain/entities/discovered_company.dart';
import 'package:mobile_customer/features/company_discovery/domain/repositories/company_discovery_repository.dart';
import 'package:mobile_customer/features/company_discovery/domain/usecases/resolve_company.dart';
import 'package:mobile_customer/features/company_discovery/domain/usecases/search_companies.dart';
import 'package:mobile_customer/features/company_discovery/presentation/cubit/company_discovery_cubit.dart';
import 'package:mobile_customer/features/company_discovery/presentation/screens/company_selector_screen.dart';
import 'package:mobile_customer/storage/customer_tenant_storage.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _Repo implements CompanyDiscoveryRepository {
  @override
  Future<Result<List<DiscoveredCompany>>> search(String query) async =>
      const Ok([DiscoveredCompany(slug: 'devora', name: 'Devora Developments')]);

  @override
  Future<Result<DiscoveredCompany?>> resolveBySlug(String slug) async => const Ok(null);
}

/// The company found by the search is shown on one line with its name
/// readable — its select button used to take the whole row and squeeze the
/// name into a column one letter wide.
void main() {
  testWidgets('a found company shows its name across the row', (t) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    t.view.physicalSize = const Size(390, 844);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.reset);
    final repo = _Repo();
    final cubit = CompanyDiscoveryCubit(searchCompanies: SearchCompanies(repo), resolveCompany: ResolveCompany(repo));
    await t.pumpWidget(
      ChangeNotifierProvider(
        create: (_) => CustomerTenantStorage(prefs),
        child: BlocProvider.value(
          value: cubit,
          child: MaterialApp(
            theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
            locale: const Locale('ar'),
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: const CompanySelectorScreen(),
          ),
        ),
      ),
    );
    cubit.onQueryChanged('dev');
    await t.pump();
    await t.pump();

    final name = find.text('Devora Developments');
    expect(name, findsOneWidget);
    expect(t.getSize(name).width, greaterThan(120));
    // At most two lines (the test font is wide), never a letter per line.
    expect(t.getSize(name).height, lessThan(60));
  });
}
