import '../../domain/entities/broker_lead.dart';
import '../dtos/broker_lead_dtos.dart';

extension BrokerLeadDtoMapper on BrokerLeadDto {
  BrokerLead toEntity() => BrokerLead(
        id: id,
        fullName: fullName,
        stage: stage,
        approvalStatus: approvalStatus,
        phone: phone,
        email: email,
        projectName: projectName,
        createdAt: DateTime.tryParse(createdAt ?? '')?.toLocal(),
        projectCity: (json['projectInterest'] as Map?)?['city'] as String?,
        unitCode: (json['unitInterest'] as Map?)?['code'] as String?,
        unitType: (json['unitInterest'] as Map?)?['type'] as String?,
        assignedSalesName: (json['assignedSales'] as Map?)?['fullName'] as String?,
        submittedAt: _at(json['brokerSubmittedAt']),
        approvedAt: _at(json['brokerApprovedAt']),
        rejectedAt: _at(json['brokerRejectedAt']),
        rejectionReason: (json['brokerRejectionReason'] as String?)?.trim(),
      );

  static DateTime? _at(Object? v) => DateTime.tryParse(v as String? ?? '')?.toLocal();
}

extension BrokerLeadDetailDtoMapper on BrokerLeadDetailDto {
  BrokerLeadDetail toEntity() {
    final entries = <BrokerLeadTimelineEntry>[
      for (final n in notes)
        BrokerLeadTimelineEntry(
          id: n.id,
          body: n.body,
          isNote: true,
          authorName: n.authorName,
          createdAt: DateTime.tryParse(n.createdAt ?? ''),
        ),
      for (final a in activities)
        BrokerLeadTimelineEntry(
          id: a.id,
          body: a.type,
          isNote: false,
          createdAt: DateTime.tryParse(a.createdAt ?? ''),
        ),
    ]..sort((a, b) {
        final at = a.createdAt, bt = b.createdAt;
        if (at == null && bt == null) return 0;
        if (at == null) return 1;
        if (bt == null) return -1;
        return bt.compareTo(at);
      });
    return BrokerLeadDetail(
      lead: lead.toEntity(),
      timeline: entries,
      unitCode: unitCode,
      visits: [
        for (final a in appointments)
          BrokerLeadVisit(
            id: a['id'] as String? ?? '',
            status: a['status'] as String? ?? '',
            number: a['visitNumber'] as String?,
            at: DateTime.tryParse(a['scheduledAt'] as String? ?? '')?.toLocal(),
          ),
      ],
    );
  }
}
