import 'package:core/core.dart';

String bonusStatusLabel(AppLocalizations l10n, String status) => switch (status) {
      'PENDING' => l10n.bonusStatusPending,
      'APPROVED' => l10n.bonusStatusApproved,
      'PAID' => l10n.bonusStatusPaid,
      _ => status,
    };

BadgeTone bonusStatusTone(String status) => switch (status) {
      'PENDING' => BadgeTone.warning,
      'APPROVED' => BadgeTone.info,
      'PAID' => BadgeTone.success,
      _ => BadgeTone.neutral,
    };
