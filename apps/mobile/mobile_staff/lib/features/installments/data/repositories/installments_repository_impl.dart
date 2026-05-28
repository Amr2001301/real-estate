import 'package:core/core.dart';

import '../../domain/entities/installment.dart';
import '../../domain/repositories/installments_repository.dart';
import '../datasources/installments_remote_data_source.dart';
import '../mappers/plan_template_mapper.dart';

class InstallmentsRepositoryImpl implements InstallmentsRepository {
  InstallmentsRepositoryImpl(this._remote);
  final InstallmentsRemoteDataSource _remote;

  @override
  Future<Result<List<InstallmentPlanTemplate>>> getPlanTemplates() {
    return guardApiCall(() async {
      final rows = await _remote.listTemplates();
      return rows.map((r) => r.toEntity()).toList();
    });
  }
}
