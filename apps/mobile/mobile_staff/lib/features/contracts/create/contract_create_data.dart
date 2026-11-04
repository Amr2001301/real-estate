import 'dart:typed_data';

import 'package:core/core.dart';
import 'package:dio/dio.dart';

/// An approved booking as the convert page shows it: who, which unit, the
/// booking amount and whether it is paid, and the plan the booking saved.
class ConvertSource extends Equatable {
  const ConvertSource({
    required this.id,
    required this.status,
    this.number,
    this.clientName,
    this.unitCode,
    this.projectName,
    this.salesName,
    this.bookingAmount = 0,
    this.bookingStatus,
    this.hasTemplate = false,
    this.months,
    this.down,
    this.monthly,
    this.total,
    this.contractId,
  });

  final String id;
  final String status;
  final String? number;
  final String? clientName;
  final String? unitCode;
  final String? projectName;
  final String? salesName;
  final double bookingAmount;

  /// UNPAID, PAID, WAIVED.
  final String? bookingStatus;
  final bool hasTemplate;
  final int? months;
  final double? down;
  final double? monthly;
  final double? total;

  /// Set once the booking became a contract.
  final String? contractId;

  /// The booking amount must be paid (or waived) first, as on the website.
  bool get bookingBlocks => bookingAmount > 0 && bookingStatus != 'PAID' && bookingStatus != 'WAIVED';

  /// A plan booking without its saved term cannot be converted.
  bool get snapshotMissing => hasTemplate && (months == null || down == null || monthly == null || total == null);

  /// A term means instalments, and they need a start date.
  bool get needsStart => (months ?? 0) > 0;

  bool get canConvert => status == 'APPROVED' && contractId == null && !bookingBlocks && !snapshotMissing;

  factory ConvertSource.fromJson(Map<String, dynamic> j) {
    final unit = j['unit'] as Map<String, dynamic>?;
    final project = ((unit?['building'] as Map?)?['phase'] as Map?)?['project'] as Map?;
    final client = (j['client'] as Map?) ?? (j['lead'] as Map?);
    return ConvertSource(
      id: '${j['id']}',
      status: j['status'] as String? ?? '',
      number: j['reservationNumber'] as String?,
      clientName: client?['fullName'] as String?,
      unitCode: unit?['code'] as String?,
      projectName: project == null ? null : Translatable.fromJson(project['name']).resolve('ar'),
      salesName: (j['sales'] as Map?)?['fullName'] as String?,
      bookingAmount: readAmount(j['bookingAmount']) ?? 0,
      bookingStatus: j['bookingPaymentStatus'] as String?,
      hasTemplate: j['installmentPlanTemplateId'] != null,
      months: (j['selectedDurationMonths'] as num?)?.toInt(),
      down: readAmount(j['snapshotDownPaymentAmount']),
      monthly: readAmount(j['snapshotMonthlyInstallment']),
      total: readAmount(j['snapshotTotalPayable']),
      contractId: (j['contract'] as Map?)?['id'] as String?,
    );
  }

  @override
  List<Object?> get props => [id, status, bookingStatus, contractId, months];
}

/// A file picked to be the contract's document.
class PickedDocument {
  const PickedDocument({required this.name, required this.bytes, required this.mimeType});
  final String name;
  final Uint8List bytes;
  final String mimeType;

  static String? mimeFor(String name) => switch (name.split('.').last.toLowerCase()) {
        'pdf' => 'application/pdf',
        'jpg' || 'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        _ => null,
      };
}

/// One search hit for a picker: what it sets, what it says.
class PickHit extends Equatable {
  const PickHit(this.id, this.title, [this.subtitle, this.amount]);
  final String id;
  final String title;
  final String? subtitle;

  /// A unit's price, to prefill the contract's value.
  final double? amount;

  @override
  List<Object?> get props => [id, title, subtitle, amount];
}

/// The result of a create: the contract, and whether its signing failed
/// (the contract stays; it is signed later).
typedef CreatedContract = ({String id, bool signFailed});

class ContractCreateRepository {
  ContractCreateRepository(this._dio, {Dio? uploadClient}) : _upload = uploadClient ?? Dio();
  final Dio _dio;

  /// Interceptor-free: the signed URL must not get our bearer token.
  final Dio _upload;

  Future<Result<ConvertSource>> reservation(String id) => guardApiCall(() async {
        final r = await _dio.get<Map<String, dynamic>>('/reservations/$id');
        return ConvertSource.fromJson(r.data ?? const {});
      });

  /// Presign, PUT, and give back what the contract stores — the public URL,
  /// or the private object's key — with the file's metadata.
  Future<Map<String, dynamic>> _uploadDocument(PickedDocument doc) async {
    final p = await _dio.post<Map<String, dynamic>>('/documents/presign', data: {
      'contentType': doc.mimeType,
      'sizeBytes': doc.bytes.length,
      'fileName': doc.name,
    });
    final uploadUrl = p.data?['uploadUrl'] as String?;
    if (uploadUrl == null) throw StateError('no upload url');
    await _upload.put<void>(
      uploadUrl,
      data: Stream<List<int>>.fromIterable([doc.bytes]),
      options: Options(headers: {Headers.contentTypeHeader: doc.mimeType, Headers.contentLengthHeader: doc.bytes.length}),
    );
    return {
      'pdfUrl': p.data?['publicUrl'] ?? p.data?['key'],
      'fileName': doc.name,
      'mimeType': doc.mimeType,
      'sizeBytes': doc.bytes.length,
    };
  }

  /// Signing is its own strict call, as on the website; a failure there
  /// leaves the contract made and unsigned.
  Future<bool> _sign(String contractId, DateTime? signedAt) async {
    if (signedAt == null) return false;
    try {
      await _dio.post<void>('/contracts/$contractId/sign', data: {'signedAt': signedAt.toUtc().toIso8601String()});
      return false;
    } catch (_) {
      return true;
    }
  }

  Future<Result<CreatedContract>> convert(String reservationId, {DateTime? startsAt, DateTime? signedAt, PickedDocument? doc}) =>
      guardApiCall(() async {
        final file = doc == null ? const <String, dynamic>{} : await _uploadDocument(doc);
        final r = await _dio.post<Map<String, dynamic>>('/reservations/$reservationId/convert', data: {
          if (startsAt != null) 'startsAt': _day(startsAt),
          ...file,
        });
        final id = '${(r.data?['contract'] as Map?)?['id'] ?? r.data?['contractId'] ?? r.data?['id']}';
        return (id: id, signFailed: await _sign(id, signedAt));
      });

  Future<Result<CreatedContract>> createManual({
    required String customerId,
    required String unitId,
    required double total,
    double? down,
    String? number,
    bool preSystem = false,
    DateTime? signedAt,
    PickedDocument? doc,
  }) =>
      guardApiCall(() async {
        final file = doc == null ? const <String, dynamic>{} : {'pdfUrl': (await _uploadDocument(doc))['pdfUrl']};
        final r = await _dio.post<Map<String, dynamic>>('/contracts', data: {
          'customerId': customerId,
          'unitId': unitId,
          'totalAmount': total,
          'downPayment': ?down,
          if ((number ?? '').trim().isNotEmpty) 'contractNumber': number!.trim(),
          if (preSystem) 'preSystem': true,
          ...file,
        });
        final id = '${r.data?['id']}';
        return (id: id, signFailed: await _sign(id, signedAt));
      });

  Future<List<PickHit>> searchClients(String q) async {
    final r = await _dio.get<Map<String, dynamic>>('/users', queryParameters: {
      'role': 'CLIENT,CUSTOMER',
      'pageSize': 20,
      if (q.trim().isNotEmpty) 'q': q.trim(),
    });
    return [
      for (final u in ((r.data?['data'] as List?) ?? const []).whereType<Map<String, dynamic>>())
        PickHit('${u['id']}', u['fullName'] as String? ?? '—', switch (u['phone']) { final String p => ltr(p), _ => null }),
    ];
  }

  Future<List<PickHit>> searchUnits(String q) async {
    final r = await _dio.get<Map<String, dynamic>>('/units', queryParameters: {
      'status': 'AVAILABLE',
      'pageSize': 20,
      if (q.trim().isNotEmpty) 'q': q.trim(),
    });
    return [
      for (final u in ((r.data?['data'] as List?) ?? const []).whereType<Map<String, dynamic>>())
        PickHit(
          '${u['id']}',
          u['code'] as String? ?? '—',
          switch ((((u['building'] as Map?)?['phase'] as Map?)?['project'] as Map?)?['name']) {
            null => null,
            final n => Translatable.fromJson(n).resolve('ar'),
          },
          readAmount(u['price']),
        ),
    ];
  }

  static String _day(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}
