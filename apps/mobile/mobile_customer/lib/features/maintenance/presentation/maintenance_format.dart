import 'package:core/core.dart';

import '../domain/entities/maintenance_request.dart';

/// Localized label for a request status.
String maintenanceStatusLabel(AppLocalizations l10n, MaintenanceStatus status) =>
    switch (status) {
      MaintenanceStatus.open => l10n.maintenanceStatusOpen,
      MaintenanceStatus.assigned => l10n.maintenanceStatusAssigned,
      MaintenanceStatus.inProgress => l10n.maintenanceStatusInProgress,
      MaintenanceStatus.resolved => l10n.maintenanceStatusResolved,
      MaintenanceStatus.closed => l10n.maintenanceStatusClosed,
      MaintenanceStatus.unknown => l10n.maintenanceStatusOpen,
    };

/// Status chip tone — neutral until work starts, info while active, success
/// once resolved/closed.
BadgeTone maintenanceStatusTone(MaintenanceStatus status) => switch (status) {
      MaintenanceStatus.open => BadgeTone.neutral,
      MaintenanceStatus.assigned => BadgeTone.info,
      MaintenanceStatus.inProgress => BadgeTone.info,
      MaintenanceStatus.resolved => BadgeTone.success,
      MaintenanceStatus.closed => BadgeTone.success,
      MaintenanceStatus.unknown => BadgeTone.neutral,
    };

/// Localized label for a request priority.
String maintenancePriorityLabel(AppLocalizations l10n, MaintenancePriority priority) =>
    switch (priority) {
      MaintenancePriority.low => l10n.maintenancePriorityLow,
      MaintenancePriority.medium => l10n.maintenancePriorityMedium,
      MaintenancePriority.high => l10n.maintenancePriorityHigh,
      MaintenancePriority.urgent => l10n.maintenancePriorityUrgent,
      MaintenancePriority.unknown => l10n.maintenancePriorityMedium,
    };

BadgeTone maintenancePriorityTone(MaintenancePriority priority) => switch (priority) {
      MaintenancePriority.low => BadgeTone.neutral,
      MaintenancePriority.medium => BadgeTone.gold,
      MaintenancePriority.high => BadgeTone.warning,
      MaintenancePriority.urgent => BadgeTone.error,
      MaintenancePriority.unknown => BadgeTone.neutral,
    };
