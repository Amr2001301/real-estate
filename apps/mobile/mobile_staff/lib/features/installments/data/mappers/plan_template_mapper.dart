import '../../domain/entities/installment.dart';
import '../dtos/plan_template_dto.dart';

extension PlanTemplateDtoMapper on PlanTemplateDto {
  InstallmentPlanTemplate toEntity() => InstallmentPlanTemplate(
        id: id,
        name: name,
        durations: [
          for (final d in durations)
            PlanDuration(
              durationMonths: d.durationMonths,
              increasePercentage: d.increasePercentage,
            ),
        ],
      );
}
