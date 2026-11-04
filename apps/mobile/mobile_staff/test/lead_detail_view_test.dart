import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/leads/data/dtos/lead_dtos.dart';
import 'package:mobile_staff/features/leads/data/mappers/lead_mapper.dart';
import 'package:mobile_staff/features/leads/domain/entities/lead.dart';
import 'package:mobile_staff/features/leads/presentation/screens/lead_detail_screen.dart';

/// The lead page reads what the website's lead page shows.

LeadTimelineEntry _act(String type, [Map<String, dynamic> payload = const {}]) =>
    LeadTimelineEntry(id: type, body: type, isNote: false, payload: payload);

void main() {
  final l10n = lookupAppLocalizations(const Locale('ar'));
  final colors = AppColorsExt.resolve(Brightness.light);
  String text(LeadTimelineEntry e) => leadActivityText(l10n, e, colors).$1;

  test('activities read as on the website', () {
    expect(text(_act('status_change', {'from': 'INTERESTED', 'to': 'VISIT'})), contains('«مهتم»'));
    expect(text(_act('visit', {'status': 'COMPLETED', 'visitNumber': 'VA-1'})), contains('تمت الزيارة'));
    expect(text(_act('reservation', {'status': 'CONVERTED', 'contractNumber': 'C-9'})), contains('تم تحويل الحجز إلى عقد'));
    expect(text(_act('contact_opened', {'kind': 'WHATSAPP', 'by': 'هالة'})), 'فتح محادثة واتساب — هالة');
    expect(text(_act('merged', {'count': 2})), contains('2'));
    expect(text(_act('something_new')), 'تحديث على الفرصة');
  });

  test('the detail keeps the activity payload, lost date, client and ad data', () {
    final d = LeadDetailDto.fromJson({
      'id': 'l1',
      'fullName': 'أمل',
      'stage': 'LOST',
      'lostAt': '2026-11-01T10:00:00Z',
      'client': {'id': 'c1', 'role': 'CUSTOMER'},
      'assignedSales': {'id': 's1', 'fullName': 'محمود'},
      'brokerAgent': {'fullName': 'سامي'},
      'unitInterest': {'code': 'A-1', 'type': 'APARTMENT'},
      'utmSource': 'facebook',
      'utmMedium': '',
      'activities': [
        {'id': 'a1', 'type': 'status_change', 'createdAt': '2026-11-01T10:00:00Z', 'payload': {'from': 'NEW', 'to': 'LOST'}},
      ],
      'notes': [],
    }).toEntity();
    expect(d.lostAt, isNotNull);
    expect(d.clientRole, 'CUSTOMER');
    expect(d.assignedSalesId, 's1');
    expect(d.brokerAgentName, 'سامي');
    expect(d.unitType, 'APARTMENT');
    expect(d.utm, {'utmSource': 'facebook'});
    expect(d.activities.single.payload['to'], 'LOST');
  });
}
