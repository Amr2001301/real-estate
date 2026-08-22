import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/installment.dart';
import '../../domain/usecases/installment_use_cases.dart';

class InstallmentPlansState extends Equatable {
  const InstallmentPlansState({
    this.status = DataStatus.initial,
    this.templates = const [],
    this.query = '',
  });

  final DataStatus status;
  final List<InstallmentPlanTemplate> templates;
  final String query;

  List<InstallmentPlanTemplate> get filtered {
    if (query.isEmpty) return templates;
    final q = query.toLowerCase();
    return templates.where((t) => t.name.toLowerCase().contains(q)).toList();
  }

  InstallmentPlansState copyWith({
    DataStatus? status,
    List<InstallmentPlanTemplate>? templates,
    String? query,
  }) =>
      InstallmentPlansState(
        status: status ?? this.status,
        templates: templates ?? this.templates,
        query: query ?? this.query,
      );

  @override
  List<Object?> get props => [status, templates, query];
}

class InstallmentPlansCubit extends Cubit<InstallmentPlansState> {
  InstallmentPlansCubit(this._getTemplates) : super(const InstallmentPlansState());
  final GetPlanTemplates _getTemplates;

  Future<void> load() async {
    emit(state.copyWith(status: DataStatus.loading));
    final result = await _getTemplates(null);
    result.when(
      ok: (templates) => emit(state.copyWith(
        status: templates.isEmpty ? DataStatus.empty : DataStatus.success,
        templates: templates,
      )),
      err: (_) => emit(state.copyWith(status: DataStatus.failure)),
    );
  }

  void search(String q) => emit(state.copyWith(query: q));
}
