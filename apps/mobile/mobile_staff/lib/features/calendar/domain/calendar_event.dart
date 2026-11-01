import 'package:core/core_domain.dart';

/// CAL1 — one entry in a rep's diary (GET /leads/calendar): a visit, a
/// follow-up due, a reservation running out, a contract signed, or a call /
/// meeting / chat already logged ("done").
class CalendarEvent extends Equatable {
  const CalendarEvent({
    required this.type,
    required this.id,
    required this.at,
    this.leadId,
    this.customer,
    this.project,
    this.unit,
    this.ref,
    this.status,
    this.kind,
    this.callResult,
    this.note,
    this.salesName,
  });

  /// visit · follow_up · reservation_expiry · contract_signed · done
  final String type;
  final String id;

  /// In the phone's time.
  final DateTime at;
  final String? leadId;
  final String? customer;
  final Translatable? project;
  final String? unit;
  final String? ref;
  final String? status;

  /// The follow-up's type, or the logged activity's kind.
  final String? kind;
  final String? callResult;
  final String? note;
  final String? salesName;

  factory CalendarEvent.fromJson(Map<String, dynamic> json) => CalendarEvent(
        type: json['type'] as String? ?? '',
        id: json['id'] as String? ?? '',
        at: (DateTime.tryParse(json['at'] as String? ?? '') ?? DateTime.fromMillisecondsSinceEpoch(0)).toLocal(),
        leadId: json['leadId'] as String?,
        customer: json['customer'] as String?,
        project: json['project'] == null ? null : Translatable.fromJson(json['project']),
        unit: json['unit'] as String?,
        ref: json['ref'] as String?,
        status: json['status'] as String?,
        kind: json['kind'] as String?,
        callResult: json['callResult'] as String?,
        note: json['note'] as String?,
        salesName: (json['sales'] as Map<String, dynamic>?)?['fullName'] as String?,
      );

  /// The screen this entry opens, or null.
  String? get route => switch (type) {
        'visit' => '/visits/$id',
        'follow_up' || 'done' => leadId != null ? '/leads/$leadId' : null,
        'reservation_expiry' => '/reservations/$id',
        'contract_signed' => '/contracts/$id',
        _ => null,
      };

  @override
  List<Object?> get props => [type, id, at, leadId, customer, project, unit, ref, status, kind, callResult, note, salesName];
}

/// The day's date as the API takes it: YYYY-MM-DD.
String calendarDay(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

abstract interface class CalendarRepository {
  /// The entries between two days (both included).
  Future<Result<List<CalendarEvent>>> events(DateTime from, DateTime to);
}
