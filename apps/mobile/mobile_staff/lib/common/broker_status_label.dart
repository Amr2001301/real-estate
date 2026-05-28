import 'package:core/core.dart';

/// Broker lead approval status (BrokerLeadStatus).
String brokerLeadStatusLabel(AppLocalizations l10n, String status) => switch (status) {
      'PENDING' => l10n.brokerLeadStatusPending,
      'APPROVED' => l10n.brokerLeadStatusApproved,
      'REJECTED' => l10n.brokerLeadStatusRejected,
      'DUPLICATE' => l10n.brokerLeadStatusDuplicate,
      'EXPIRED' => l10n.brokerLeadStatusExpired,
      _ => status,
    };

BadgeTone brokerLeadStatusTone(String status) => switch (status) {
      'PENDING' => BadgeTone.warning,
      'APPROVED' => BadgeTone.success,
      'REJECTED' => BadgeTone.error,
      'DUPLICATE' => BadgeTone.neutral,
      'EXPIRED' => BadgeTone.neutral,
      _ => BadgeTone.neutral,
    };

const kBrokerLeadStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'DUPLICATE', 'EXPIRED'];

/// Broker commission status (BrokerCommissionStatus).
String brokerCommissionStatusLabel(AppLocalizations l10n, String status) => switch (status) {
      'PENDING' => l10n.bonusStatusPending,
      'APPROVED' => l10n.bonusStatusApproved,
      'REJECTED' => l10n.brokerLeadStatusRejected,
      'CANCELLED' => l10n.reservationStatusCancelled,
      _ => status,
    };

BadgeTone brokerCommissionStatusTone(String status) => switch (status) {
      'PENDING' => BadgeTone.warning,
      'APPROVED' => BadgeTone.success,
      'REJECTED' => BadgeTone.error,
      'CANCELLED' => BadgeTone.neutral,
      _ => BadgeTone.neutral,
    };

const kBrokerCommissionStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];
