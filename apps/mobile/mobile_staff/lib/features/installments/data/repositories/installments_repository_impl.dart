import 'package:core/core.dart';

import '../../domain/entities/installment.dart';
import '../../domain/repositories/installments_repository.dart';
import '../datasources/installments_remote_data_source.dart';
import '../mappers/plan_template_mapper.dart';

class InstallmentsRepositoryImpl implements InstallmentsRepository {
  InstallmentsRepositoryImpl(this._remote);
  final InstallmentsRemoteDataSource _remote;

  @override
  Future<Result<List<InstallmentPlanTemplate>>> getPlanTemplates({String? projectId}) {
    return guardApiCall(() async {
      final rows = await _remote.listTemplates(projectId: projectId);
      return rows.map((r) => r.toEntity()).toList();
    });
  }

  @override
  Future<Result<InstallmentResult>> calculateInstallment(InstallmentInput input) {
    return guardApiCall(() => _remote.calculateInstallment(input));
  }

  @override
  Future<Result<List<InstallmentOffer>>> unitOffers({required String projectId, required String unitId}) =>
      // The API picks the plans (the unit's own, else its type's, else the project's) and
      // works a project plan out on this unit's price.
      guardApiCall(() async => [
            for (final j in await _remote.applicableTemplatesJson(unitId: unitId)) installmentOfferFromTemplateJson(j),
          ]);

  @override
  Future<Result<List<InstallmentOffer>>> projectOffers(String projectId) => guardApiCall(() async => [
        for (final j in await _remote.listTemplatesJson(projectId: projectId))
          if (j['status'] == 'ACTIVE') installmentOfferFromTemplateJson(j),
      ]);
}
