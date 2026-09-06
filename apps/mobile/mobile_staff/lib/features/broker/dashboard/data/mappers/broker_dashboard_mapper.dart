import '../../domain/entities/broker_dashboard.dart';
import '../dtos/broker_dashboard_dto.dart';

extension BrokerDashboardDtoMapper on BrokerDashboardDto {
  BrokerDashboard toEntity() => BrokerDashboard(
        leadsTotal: leadsTotal,
        leadsApproved: leadsApproved,
        reservationsTotal: reservationsTotal,
        reservationsApproved: reservationsApproved,
        contractsSigned: contractsSigned,
        salesGross: salesGross,
        commissionsPending: commissionsPending,
        commissionsGross: commissionsGross,
        recentLeads: [
          for (final l in recentLeads)
            BrokerRecentLead(
              id: l['id'] as String? ?? '',
              fullName: l['fullName'] as String? ?? '',
              stage: l['stage'] as String? ?? 'NEW',
              approvalStatus:
                  l['brokerApprovalStatus'] as String? ?? 'PENDING',
              projectName: _projectName(l['projectInterest']),
              phone: l['phone'] as String?,
              createdAt: l['createdAt'] as String?,
            ),
        ],
        recentReservations: [
          for (final r in recentReservations)
            BrokerRecentReservation(
              id: r['id'] as String? ?? '',
              status: r['status'] as String? ?? 'PENDING',
              reservationNumber: r['reservationNumber'] as String?,
              unitCode:
                  (r['unit'] as Map<String, dynamic>?)?['code'] as String?,
              createdAt: r['createdAt'] as String?,
            ),
        ],
      );

  static String? _projectName(Object? project) {
    final name = (project as Map<String, dynamic>?)?['name'];
    return name is Map
        ? ((name['ar'] as String?) ?? (name['en'] as String?))
        : name as String?;
  }
}
