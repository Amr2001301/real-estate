import 'package:core/core.dart';
import 'package:dio/dio.dart';

import '../../../maintenance/domain/entities/maintenance_request.dart';
import '../../domain/entities/home_summary.dart';

abstract interface class HomeSummaryRemoteDataSource {
  Future<HomeSummary> getHomeSummary();
}

class HomeSummaryRemoteDataSourceImpl implements HomeSummaryRemoteDataSource {
  HomeSummaryRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<HomeSummary> getHomeSummary() async {
    final res = await _dio.get<Map<String, dynamic>>('/me/home-summary');
    final j = res.data!;
    return _parse(j);
  }

  static HomeSummary _parse(Map<String, dynamic> j) {
    final profile = _parseProfile(j['profile'] as Map<String, dynamic>);
    final notifs = _parseNotifications(j['notifications'] as Map<String, dynamic>);
    final action = _parsePrimaryAction(j['primaryAction'] as Map<String, dynamic>);
    final prop = j['primaryProperty'] != null
        ? _parseProperty(j['primaryProperty'] as Map<String, dynamic>)
        : null;
    final installs = _parseInstallments(j['installments'] as Map<String, dynamic>);
    final maint = _parseMaintenance(j['maintenance'] as Map<String, dynamic>);

    return HomeSummary(
      profile: profile,
      notifications: notifs,
      primaryAction: action,
      primaryProperty: prop,
      installments: installs,
      maintenance: maint,
    );
  }

  static HomeSummaryProfile _parseProfile(Map<String, dynamic> j) {
    return HomeSummaryProfile(
      displayName: (j['displayName'] as String?) ?? '',
      customerType: (j['customerType'] as String?) ?? 'CUSTOMER',
      ownedUnitsCount: (j['ownedUnitsCount'] as int?) ?? 0,
      avatarInitials: (j['avatarInitials'] as String?) ?? '',
    );
  }

  static HomeSummaryNotifications _parseNotifications(Map<String, dynamic> j) {
    return HomeSummaryNotifications(
      unreadCount: (j['unreadCount'] as int?) ?? 0,
    );
  }

  static HomeSummaryPrimaryAction _parsePrimaryAction(Map<String, dynamic> j) {
    final ctaMap = j['cta'] as Map<String, dynamic>? ?? const {};
    return HomeSummaryPrimaryAction(
      type: (j['type'] as String?) ?? 'NO_ACTION_REQUIRED',
      severity: (j['severity'] as String?) ?? 'neutral',
      title: Translatable.fromJson(j['title']),
      subtitle: Translatable.fromJson(j['subtitle']),
      amount: j['amount'] as String?,
      currency: j['currency'] as String?,
      dueDate: j['dueDate'] != null
          ? DateTime.tryParse(j['dueDate'] as String)
          : null,
      cta: HomeSummaryCtaLabel(
        label: Translatable.fromJson(ctaMap['label']),
        route: (ctaMap['route'] as String?) ?? '',
      ),
    );
  }

  static HomeSummaryPrimaryProperty _parseProperty(Map<String, dynamic> j) {
    return HomeSummaryPrimaryProperty(
      contractId: (j['contractId'] as String?) ?? '',
      contractNumber: j['contractNumber'] as String?,
      unitId: (j['unitId'] as String?) ?? '',
      unitCode: (j['unitCode'] as String?) ?? '',
      unitType: (j['unitType'] as String?) ?? '',
      projectName: Translatable.fromJson(j['projectName']),
      city: (j['city'] as String?) ?? '',
      status: (j['status'] as String?) ?? 'PENDING',
      signedAt: j['signedAt'] != null
          ? DateTime.tryParse(j['signedAt'] as String)
          : null,
      monthlyAmount: j['monthlyAmount'] as String?,
      totalMonths: j['totalMonths'] as int?,
    );
  }

  static HomeSummaryInstallments _parseInstallments(Map<String, dynamic> j) {
    final nextDueMap = j['nextDue'] as Map<String, dynamic>?;
    return HomeSummaryInstallments(
      nextDue: nextDueMap != null ? _parseNextDue(nextDueMap) : null,
      paidCount: (j['paidCount'] as int?) ?? 0,
      totalCount: (j['totalCount'] as int?) ?? 0,
      remainingCount: (j['remainingCount'] as int?) ?? 0,
      overdueCount: (j['overdueCount'] as int?) ?? 0,
      lastPaidAt: j['lastPaidAt'] != null
          ? DateTime.tryParse(j['lastPaidAt'] as String)
          : null,
    );
  }

  static HomeSummaryNextDue _parseNextDue(Map<String, dynamic> j) {
    return HomeSummaryNextDue(
      id: (j['id'] as String?) ?? '',
      amount: (j['amount'] as String?) ?? '0',
      currency: (j['currency'] as String?) ?? 'EGP',
      dueDate: DateTime.tryParse((j['dueDate'] as String?) ?? '') ?? DateTime.now(),
      status: (j['status'] as String?) ?? 'PENDING',
    );
  }

  static HomeSummaryMaintenance _parseMaintenance(Map<String, dynamic> j) {
    final items = (j['recentRequests'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .map(_parseMaintenanceItem)
            .toList() ??
        const [];
    return HomeSummaryMaintenance(
      openCount: (j['openCount'] as int?) ?? 0,
      recentRequests: items,
    );
  }

  static HomeSummaryMaintenanceItem _parseMaintenanceItem(Map<String, dynamic> j) {
    final categoryRaw = j['categoryName'];
    return HomeSummaryMaintenanceItem(
      id: (j['id'] as String?) ?? '',
      status: MaintenanceStatus.fromWire(j['status'] as String?),
      priority: MaintenancePriority.fromWire(j['priority'] as String?),
      createdAt: DateTime.tryParse((j['createdAt'] as String?) ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      categoryName:
          categoryRaw != null ? Translatable.fromJson(categoryRaw) : null,
      unitCode: j['unitCode'] as String?,
    );
  }
}
