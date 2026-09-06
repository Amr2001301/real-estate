import 'package:core/core_domain.dart';

/// A recent lead row on the broker dashboard.
class BrokerRecentLead extends Equatable {
  const BrokerRecentLead({
    required this.id,
    required this.fullName,
    required this.stage,
    required this.approvalStatus,
    this.projectName,
    this.phone,
    this.createdAt,
  });
  final String id;
  final String fullName;
  final String stage;
  final String approvalStatus;
  final String? projectName;
  final String? phone;
  final String? createdAt;

  @override
  List<Object?> get props => [id, fullName, stage, approvalStatus];
}

/// A recent reservation row on the broker dashboard.
class BrokerRecentReservation extends Equatable {
  const BrokerRecentReservation({
    required this.id,
    required this.status,
    this.reservationNumber,
    this.unitCode,
    this.createdAt,
  });
  final String id;
  final String status;
  final String? reservationNumber;
  final String? unitCode;
  final String? createdAt;

  @override
  List<Object?> get props => [id, status, reservationNumber, unitCode];
}

/// Aggregated broker dashboard (from /portal/performance). Commission figures
/// are only surfaced when the broker may view commissions (presentation gate).
class BrokerDashboard extends Equatable {
  const BrokerDashboard({
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
  final List<BrokerRecentLead> recentLeads;
  final List<BrokerRecentReservation> recentReservations;

  @override
  List<Object?> get props => [
        leadsTotal,
        leadsApproved,
        reservationsTotal,
        reservationsApproved,
        contractsSigned,
        salesGross,
        commissionsPending,
        commissionsGross,
        recentLeads,
        recentReservations,
      ];
}
