import 'package:core/core_domain.dart';

import '../../../maintenance/domain/entities/maintenance_request.dart';

// ── Nested types ──────────────────────────────────────────────────────────────

class HomeSummaryProfile extends Equatable {
  const HomeSummaryProfile({
    required this.displayName,
    required this.customerType,
    required this.ownedUnitsCount,
    required this.avatarInitials,
  });

  final String displayName;
  // 'OWNER' | 'BUYER' | 'CUSTOMER'
  final String customerType;
  final int ownedUnitsCount;
  final String avatarInitials;

  bool get isOwner => customerType == 'OWNER';

  @override
  List<Object?> get props =>
      [displayName, customerType, ownedUnitsCount, avatarInitials];
}

class HomeSummaryNotifications extends Equatable {
  const HomeSummaryNotifications({required this.unreadCount});

  final int unreadCount;

  @override
  List<Object?> get props => [unreadCount];
}

class HomeSummaryCtaLabel extends Equatable {
  const HomeSummaryCtaLabel({required this.label, required this.route});

  final Translatable label;
  final String route;

  @override
  List<Object?> get props => [label, route];
}

class HomeSummaryPrimaryAction extends Equatable {
  const HomeSummaryPrimaryAction({
    required this.type,
    required this.severity,
    required this.title,
    required this.subtitle,
    required this.cta,
    this.amount,
    this.currency,
    this.dueDate,
  });

  final String type; // 'OVERDUE_INSTALLMENT' | 'DUE_SOON_INSTALLMENT' | ...
  final String severity; // 'danger' | 'warning' | 'info' | 'success' | 'neutral'
  final Translatable title;
  final Translatable subtitle;
  final HomeSummaryCtaLabel cta;
  final String? amount;
  final String? currency;
  final DateTime? dueDate;

  @override
  List<Object?> get props =>
      [type, severity, title, subtitle, cta, amount, currency, dueDate];
}

class HomeSummaryPrimaryProperty extends Equatable {
  const HomeSummaryPrimaryProperty({
    required this.contractId,
    required this.unitId,
    required this.unitCode,
    required this.unitType,
    required this.projectName,
    required this.city,
    required this.status,
    this.contractNumber,
    this.signedAt,
    this.monthlyAmount,
    this.totalMonths,
  });

  final String contractId;
  final String? contractNumber;
  final String unitId;
  final String unitCode;
  final String unitType;
  final Translatable projectName;
  final String city;
  // 'OWNED' | 'PENDING'
  final String status;
  final DateTime? signedAt;
  final String? monthlyAmount;
  final int? totalMonths;

  bool get isOwned => status == 'OWNED';
  bool get hasInstallmentPlan => (totalMonths ?? 0) > 0;

  @override
  List<Object?> get props => [contractId, unitId, status];
}

class HomeSummaryNextDue extends Equatable {
  const HomeSummaryNextDue({
    required this.id,
    required this.amount,
    required this.currency,
    required this.dueDate,
    required this.status,
  });

  final String id;
  final String amount;
  final String currency;
  final DateTime dueDate;
  // 'PENDING' | 'OVERDUE'
  final String status;

  bool get isOverdue => status == 'OVERDUE';

  @override
  List<Object?> get props => [id, amount, dueDate, status];
}

class HomeSummaryInstallments extends Equatable {
  const HomeSummaryInstallments({
    required this.paidCount,
    required this.totalCount,
    required this.remainingCount,
    required this.overdueCount,
    this.nextDue,
    this.lastPaidAt,
  });

  final HomeSummaryNextDue? nextDue;
  final int paidCount;
  final int totalCount;
  final int remainingCount;
  final int overdueCount;
  final DateTime? lastPaidAt;

  @override
  List<Object?> get props =>
      [nextDue, paidCount, totalCount, remainingCount, overdueCount, lastPaidAt];
}

class HomeSummaryMaintenanceItem extends Equatable {
  const HomeSummaryMaintenanceItem({
    required this.id,
    required this.status,
    required this.priority,
    required this.createdAt,
    this.categoryName,
    this.unitCode,
  });

  final String id;
  // Parsed from wire string for direct use with existing status helpers.
  final MaintenanceStatus status;
  final MaintenancePriority priority;
  final DateTime createdAt;
  final Translatable? categoryName;
  final String? unitCode;

  @override
  List<Object?> get props => [id, status, priority, createdAt];
}

class HomeSummaryMaintenance extends Equatable {
  const HomeSummaryMaintenance({
    required this.openCount,
    required this.recentRequests,
  });

  final int openCount;
  final List<HomeSummaryMaintenanceItem> recentRequests;

  @override
  List<Object?> get props => [openCount, recentRequests];
}

// ── Root entity ───────────────────────────────────────────────────────────────

class HomeSummary extends Equatable {
  const HomeSummary({
    required this.profile,
    required this.notifications,
    required this.primaryAction,
    required this.installments,
    required this.maintenance,
    this.primaryProperty,
  });

  final HomeSummaryProfile profile;
  final HomeSummaryNotifications notifications;
  final HomeSummaryPrimaryAction primaryAction;
  final HomeSummaryPrimaryProperty? primaryProperty;
  final HomeSummaryInstallments installments;
  final HomeSummaryMaintenance maintenance;

  @override
  List<Object?> get props =>
      [profile, notifications, primaryAction, primaryProperty, installments, maintenance];
}
