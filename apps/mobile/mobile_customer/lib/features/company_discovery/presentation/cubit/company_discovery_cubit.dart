import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/discovered_company.dart';
import '../../domain/usecases/resolve_company.dart';
import '../../domain/usecases/search_companies.dart';
import 'company_discovery_state.dart';

class CompanyDiscoveryCubit extends Cubit<CompanyDiscoveryState> {
  CompanyDiscoveryCubit({
    required SearchCompanies searchCompanies,
    required ResolveCompany resolveCompany,
  })  : _search = searchCompanies,
        _resolve = resolveCompany,
        super(const CompanyDiscoveryState());

  final SearchCompanies _search;
  final ResolveCompany _resolve;

  static const _minQueryLength = 2;

  /// Called when the user types in the search field.
  void onQueryChanged(String query) {
    final trimmed = query.trim();
    emit(state.copyWith(
      query: query,
      results: trimmed.length < _minQueryLength ? [] : state.results,
      clearFailure: true,
    ));
    if (trimmed.length >= _minQueryLength) _doSearch(trimmed);
  }

  Future<void> _doSearch(String query) async {
    emit(state.copyWith(status: CompanyDiscoveryStatus.searching, clearFailure: true));
    final result = await _search(query);
    result.when(
      ok: (companies) => emit(state.copyWith(
        status: CompanyDiscoveryStatus.idle,
        results: companies,
      )),
      err: (failure) => emit(state.copyWith(
        status: CompanyDiscoveryStatus.error,
        failure: failure,
        results: [],
      )),
    );
  }

  /// Exact-resolves the selected Company before persisting.
  /// Returns the resolved Company on success, null on unavailable/error.
  /// On success the caller persists slug+name and navigates forward.
  Future<DiscoveredCompany?> selectCompany(String slug) async {
    emit(state.copyWith(status: CompanyDiscoveryStatus.selecting, clearFailure: true));
    final result = await _resolve(slug);
    return result.when(
      ok: (company) {
        if (company == null) {
          emit(state.copyWith(status: CompanyDiscoveryStatus.error));
          return null;
        }
        emit(state.copyWith(status: CompanyDiscoveryStatus.idle));
        return company;
      },
      err: (failure) {
        emit(state.copyWith(
          status: CompanyDiscoveryStatus.error,
          failure: failure,
        ));
        return null;
      },
    );
  }

  void clearError() => emit(state.copyWith(clearFailure: true, status: CompanyDiscoveryStatus.idle));
}
