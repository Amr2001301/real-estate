import 'package:core/core.dart';

import '../../domain/entities/discovered_company.dart';

enum CompanyDiscoveryStatus { initial, searching, idle, selecting, error }

class CompanyDiscoveryState extends Equatable {
  const CompanyDiscoveryState({
    this.status = CompanyDiscoveryStatus.initial,
    this.query = '',
    this.results = const [],
    this.failure,
  });

  final CompanyDiscoveryStatus status;
  final String query;
  final List<DiscoveredCompany> results;
  final AppFailure? failure;

  bool get isSearching => status == CompanyDiscoveryStatus.searching;
  bool get isSelecting => status == CompanyDiscoveryStatus.selecting;
  bool get hasError => status == CompanyDiscoveryStatus.error;

  CompanyDiscoveryState copyWith({
    CompanyDiscoveryStatus? status,
    String? query,
    List<DiscoveredCompany>? results,
    AppFailure? failure,
    bool clearFailure = false,
  }) {
    return CompanyDiscoveryState(
      status: status ?? this.status,
      query: query ?? this.query,
      results: results ?? this.results,
      failure: clearFailure ? null : (failure ?? this.failure),
    );
  }

  @override
  List<Object?> get props => [status, query, results, failure];
}
