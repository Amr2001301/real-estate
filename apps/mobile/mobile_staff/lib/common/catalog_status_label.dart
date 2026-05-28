import 'package:core/core.dart';

String projectStatusLabel(AppLocalizations l10n, String status) => switch (status) {
      'PUBLISHED' => l10n.projectStatusPublished,
      'DRAFT' => l10n.projectStatusDraft,
      'ARCHIVED' => l10n.projectStatusArchived,
      _ => status,
    };

BadgeTone projectStatusTone(String status) => switch (status) {
      'PUBLISHED' => BadgeTone.success,
      'DRAFT' => BadgeTone.neutral,
      'ARCHIVED' => BadgeTone.warning,
      _ => BadgeTone.neutral,
    };

String unitStatusLabel(AppLocalizations l10n, String status) => switch (status) {
      'AVAILABLE' => l10n.unitStatusAvailable,
      'RESERVED' => l10n.unitStatusReserved,
      'SOLD' => l10n.unitStatusSold,
      _ => status,
    };

BadgeTone unitStatusTone(String status) => switch (status) {
      'AVAILABLE' => BadgeTone.success,
      'RESERVED' => BadgeTone.warning,
      'SOLD' => BadgeTone.error,
      _ => BadgeTone.neutral,
    };
