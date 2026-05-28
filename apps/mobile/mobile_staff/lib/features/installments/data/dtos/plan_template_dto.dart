// Wire shape for /installment-plan-templates. Data layer only.
class PlanDurationDto {
  const PlanDurationDto({required this.durationMonths, required this.increasePercentage});
  final int durationMonths;
  final double increasePercentage;

  factory PlanDurationDto.fromJson(Map<String, dynamic> json) => PlanDurationDto(
        durationMonths: (json['durationMonths'] as num?)?.toInt() ?? 0,
        increasePercentage:
            double.tryParse(json['increasePercentage']?.toString() ?? '') ?? 0,
      );
}

class PlanTemplateDto {
  const PlanTemplateDto({required this.id, required this.name, this.durations = const []});
  final String id;
  final String name;
  final List<PlanDurationDto> durations;

  factory PlanTemplateDto.fromJson(Map<String, dynamic> json) => PlanTemplateDto(
        id: json['id'] as String,
        name: json['name'] as String? ?? '',
        durations: ((json['durationOptions'] as List?) ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(PlanDurationDto.fromJson)
            .toList(),
      );
}
