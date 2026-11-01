import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../domain/campaign.dart';

class CampaignsState extends Equatable {
  const CampaignsState({this.status = DataStatus.initial, this.filter, this.page = const CampaignsPage(), this.failure});

  final DataStatus status;

  /// The status shown; null = every campaign.
  final String? filter;
  final CampaignsPage page;
  final AppFailure? failure;

  CampaignsState copyWith({DataStatus? status, String? filter, bool clearFilter = false, CampaignsPage? page, AppFailure? failure}) =>
      CampaignsState(
        status: status ?? this.status,
        filter: clearFilter ? null : (filter ?? this.filter),
        page: page ?? this.page,
        failure: failure ?? this.failure,
      );

  @override
  List<Object?> get props => [status, filter, page, failure];
}

/// «الحملات»: what each campaign cost and brought, a status at a time.
class CampaignsCubit extends Cubit<CampaignsState> {
  CampaignsCubit(this._repo) : super(const CampaignsState());
  final CampaignsRepository _repo;

  Future<void> load() async {
    final filter = state.filter;
    if (state.page.items.isEmpty) emit(state.copyWith(status: DataStatus.loading));
    final result = await _repo.list(status: filter);
    if (filter != state.filter) return; // another tab was picked meanwhile
    result.when(
      ok: (page) => emit(state.copyWith(status: page.items.isEmpty ? DataStatus.empty : DataStatus.success, page: page)),
      err: (f) => emit(state.copyWith(status: DataStatus.failure, failure: f)),
    );
  }

  Future<void> setFilter(String? status) async {
    if (status == state.filter) return;
    emit(
      (status == null ? state.copyWith(clearFilter: true) : state.copyWith(filter: status))
          .copyWith(status: DataStatus.loading, page: const CampaignsPage()),
    );
    await load();
  }
}

class CampaignDetailState extends Equatable {
  const CampaignDetailState({this.status = DataStatus.initial, this.campaign, this.failure});
  final DataStatus status;
  final Campaign? campaign;
  final AppFailure? failure;

  @override
  List<Object?> get props => [status, campaign, failure];
}

class CampaignDetailCubit extends Cubit<CampaignDetailState> {
  CampaignDetailCubit(this._repo, {required this.id}) : super(const CampaignDetailState());
  final CampaignsRepository _repo;
  final String id;

  Future<void> load() async {
    emit(CampaignDetailState(status: DataStatus.loading, campaign: state.campaign));
    final result = await _repo.get(id);
    result.when(
      ok: (c) => emit(CampaignDetailState(status: DataStatus.success, campaign: c)),
      err: (f) => emit(CampaignDetailState(status: DataStatus.failure, failure: f, campaign: state.campaign)),
    );
  }
}
