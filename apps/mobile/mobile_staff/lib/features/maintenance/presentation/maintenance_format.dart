import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../domain/entities/maintenance_request.dart';

// Inline Arabic labels (Arabic-first app). Existing staff features use l10n;
// the maintenance supervisor strings are inline to avoid an ARB/codegen pass —
// extract to l10n in a follow-up if desired.

String maintenanceStatusLabel(MaintenanceStatus s) => switch (s) {
      MaintenanceStatus.open => 'مفتوح',
      MaintenanceStatus.assigned => 'مُسند',
      MaintenanceStatus.inProgress => 'قيد التنفيذ',
      MaintenanceStatus.resolved => 'تم الحل',
      MaintenanceStatus.closed => 'مغلق',
      MaintenanceStatus.unknown => '—',
    };

BadgeTone maintenanceStatusTone(MaintenanceStatus s) => switch (s) {
      MaintenanceStatus.open => BadgeTone.neutral,
      MaintenanceStatus.assigned => BadgeTone.info,
      MaintenanceStatus.inProgress => BadgeTone.info,
      MaintenanceStatus.resolved => BadgeTone.success,
      MaintenanceStatus.closed => BadgeTone.success,
      MaintenanceStatus.unknown => BadgeTone.neutral,
    };

String maintenancePriorityLabel(MaintenancePriority p) => switch (p) {
      MaintenancePriority.low => 'أولوية منخفضة',
      MaintenancePriority.medium => 'أولوية متوسطة',
      MaintenancePriority.high => 'أولوية عالية',
      MaintenancePriority.urgent => 'عاجلة',
      MaintenancePriority.unknown => '—',
    };

BadgeTone maintenancePriorityTone(MaintenancePriority p) => switch (p) {
      MaintenancePriority.low => BadgeTone.neutral,
      MaintenancePriority.medium => BadgeTone.gold,
      MaintenancePriority.high => BadgeTone.warning,
      MaintenancePriority.urgent => BadgeTone.error,
      MaintenancePriority.unknown => BadgeTone.neutral,
    };

String maintenanceTransitionLabel(MaintenanceTransition t) => switch (t) {
      MaintenanceTransition.start   => 'بدء التنفيذ',
      MaintenanceTransition.resolve => 'تم حل المشكلة',
      MaintenanceTransition.reopen  => 'إعادة الفتح',
    };

IconData maintenanceTransitionIcon(MaintenanceTransition t) => switch (t) {
      MaintenanceTransition.start   => Icons.play_arrow_rounded,
      MaintenanceTransition.resolve => Icons.check_rounded,
      MaintenanceTransition.reopen  => Icons.refresh_rounded,
    };

String maintenanceResolvedByLabel(MaintenanceResolvedBy? by) => switch (by) {
      MaintenanceResolvedBy.both => 'أكد الطرفان الحل',
      MaintenanceResolvedBy.customer => 'أكد العميل الحل',
      MaintenanceResolvedBy.supervisor => 'أكد مشرف الصيانة الحل',
      null => 'لم يتم التأكيد بعد',
    };

BadgeTone maintenanceResolvedByTone(MaintenanceResolvedBy? by) => switch (by) {
      MaintenanceResolvedBy.both => BadgeTone.success,
      MaintenanceResolvedBy.customer => BadgeTone.gold,
      MaintenanceResolvedBy.supervisor => BadgeTone.gold,
      null => BadgeTone.neutral,
    };
