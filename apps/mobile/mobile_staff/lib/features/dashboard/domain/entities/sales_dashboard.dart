import 'package:core/core_domain.dart';

/// Aggregated KPIs for the sales dashboard, composed from the pipeline, visit,
/// and reservation endpoints. `pipeline` maps a lead-stage wire value
/// (NEW/INTERESTED/…) to its count.
class SalesDashboard extends Equatable {
  const SalesDashboard({
    required this.pipeline,
    required this.totalLeads,
    required this.wonLeads,
    required this.todayVisits,
    required this.scheduledVisits,
    required this.reservations,
  });

  final Map<String, int> pipeline;
  final int totalLeads;
  final int wonLeads;
  final int todayVisits;
  final int scheduledVisits;
  final int reservations;

  @override
  List<Object?> get props =>
      [pipeline, totalLeads, wonLeads, todayVisits, scheduledVisits, reservations];
}
