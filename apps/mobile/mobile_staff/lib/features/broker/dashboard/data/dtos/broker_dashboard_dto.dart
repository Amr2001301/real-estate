// Wire shape for GET /portal/performance (brokerDetail). Data layer only.
class BrokerDashboardDto {
  const BrokerDashboardDto({
    required this.leadsTotal,
    required this.leadsApproved,
    required this.reservationsTotal,
    required this.reservationsApproved,
    required this.contractsSigned,
    required this.salesGross,
    required this.commissionsPending,
    required this.commissionsGross,
    required this.recentLeads,
    required this.recentReservations,
  });

  final int leadsTotal;
  final int leadsApproved;
  final int reservationsTotal;
  final int reservationsApproved;
  final int contractsSigned;
  final double salesGross;
  final int commissionsPending;
  final double commissionsGross;
  final List<Map<String, dynamic>> recentLeads;
  final List<Map<String, dynamic>> recentReservations;

  static int _i(Object? v) => (v as num?)?.toInt() ?? 0;
  static double _d(Object? v) =>
      double.tryParse(v?.toString() ?? '') ?? (v as num?)?.toDouble() ?? 0.0;

  factory BrokerDashboardDto.fromJson(Map<String, dynamic> json) {
    final summary = json['summary'] as Map<String, dynamic>? ?? const {};
    final recent = json['recent'] as Map<String, dynamic>? ?? const {};
    return BrokerDashboardDto(
      leadsTotal: _i(summary['leadsSubmitted']),
      leadsApproved: _i(summary['leadsApproved']),
      reservationsTotal: _i(summary['reservationsCreated']),
      reservationsApproved: _i(summary['reservationsApproved']),
      contractsSigned: _i(summary['contractsSigned']),
      salesGross: _d(summary['salesGross']),
      commissionsPending: _i(summary['commissionsPending']),
      commissionsGross: _d(summary['commissionsGross']),
      recentLeads: ((recent['leads'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList(),
      recentReservations: ((recent['reservations'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList(),
    );
  }
}
