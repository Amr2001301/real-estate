import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../domain/entities/maintenance_request.dart';

// Labels for the maintenance supervisor screens, from the ARB files.

String maintenanceStatusLabel(AppLocalizations l10n, MaintenanceStatus s) => switch (s) {
      MaintenanceStatus.open => l10n.maintenanceStatusOpen,
      MaintenanceStatus.assigned => l10n.supervisorStatAssigned,
      MaintenanceStatus.inProgress => l10n.maintenanceStatusInProgress,
      MaintenanceStatus.resolved => l10n.maintenanceStatusResolved,
      MaintenanceStatus.closed => l10n.maintenanceStatusClosed,
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

String maintenancePriorityLabel(AppLocalizations l10n, MaintenancePriority p) => switch (p) {
      MaintenancePriority.low => l10n.maintenancePriorityValue(l10n.maintenancePriorityLow),
      MaintenancePriority.medium => l10n.maintenancePriorityValue(l10n.maintenancePriorityMedium),
      MaintenancePriority.high => l10n.maintenancePriorityValue(l10n.maintenancePriorityHigh),
      MaintenancePriority.urgent => l10n.maintenancePriorityUrgent,
      MaintenancePriority.unknown => '—',
    };

BadgeTone maintenancePriorityTone(MaintenancePriority p) => switch (p) {
      MaintenancePriority.low => BadgeTone.neutral,
      MaintenancePriority.medium => BadgeTone.gold,
      MaintenancePriority.high => BadgeTone.warning,
      MaintenancePriority.urgent => BadgeTone.error,
      MaintenancePriority.unknown => BadgeTone.neutral,
    };

String maintenanceTransitionLabel(AppLocalizations l10n, MaintenanceTransition t) => switch (t) {
      MaintenanceTransition.start   => l10n.maintenanceActionStart,
      MaintenanceTransition.resolve => l10n.maintenanceProblemSolved,
      MaintenanceTransition.reopen  => l10n.maintenanceActionReopen,
    };

IconData maintenanceTransitionIcon(MaintenanceTransition t) => switch (t) {
      MaintenanceTransition.start   => Icons.play_arrow_rounded,
      MaintenanceTransition.resolve => Icons.check_rounded,
      MaintenanceTransition.reopen  => Icons.refresh_rounded,
    };

String maintenanceResolvedByLabel(AppLocalizations l10n, MaintenanceResolvedBy? by) => switch (by) {
      MaintenanceResolvedBy.both => l10n.maintenanceResolvedByBoth,
      MaintenanceResolvedBy.customer => l10n.maintenanceResolvedByCustomer,
      MaintenanceResolvedBy.supervisor => l10n.maintenanceResolvedBySupervisor,
      null => l10n.maintenanceResolvedByNone,
    };

BadgeTone maintenanceResolvedByTone(MaintenanceResolvedBy? by) => switch (by) {
      MaintenanceResolvedBy.both => BadgeTone.success,
      MaintenanceResolvedBy.customer => BadgeTone.gold,
      MaintenanceResolvedBy.supervisor => BadgeTone.gold,
      null => BadgeTone.neutral,
    };

String maintenanceWarrantyStatusLabel(AppLocalizations l10n, MaintenanceWarrantyStatus s) => switch (s) {
      MaintenanceWarrantyStatus.inWarranty => l10n.warrantyActive,
      MaintenanceWarrantyStatus.outOfWarranty => l10n.maintenanceOutOfWarranty,
      MaintenanceWarrantyStatus.unknown => l10n.maintenanceWarrantyUnknown,
    };
