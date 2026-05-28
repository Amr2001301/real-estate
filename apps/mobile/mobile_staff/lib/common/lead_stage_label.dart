import 'package:core/core.dart';

/// Localized label for a lead-stage wire value (NEW/INTERESTED/…). Shared by
/// the dashboard pipeline and the leads list/detail.
String leadStageLabel(AppLocalizations l10n, String stage) => switch (stage) {
      'NEW' => l10n.leadStageNew,
      'INTERESTED' => l10n.leadStageInterested,
      'VISIT' => l10n.leadStageVisit,
      'NEGOTIATION' => l10n.leadStageNegotiation,
      'WON' => l10n.leadStageWon,
      'LOST' => l10n.leadStageLost,
      _ => stage,
    };

/// Status-chip tone per stage.
BadgeTone leadStageTone(String stage) => switch (stage) {
      'NEW' => BadgeTone.neutral,
      'INTERESTED' => BadgeTone.info,
      'VISIT' => BadgeTone.gold,
      'NEGOTIATION' => BadgeTone.warning,
      'WON' => BadgeTone.success,
      'LOST' => BadgeTone.error,
      _ => BadgeTone.neutral,
    };

/// The pipeline stages in display order.
const kLeadStages = ['NEW', 'INTERESTED', 'VISIT', 'NEGOTIATION', 'WON', 'LOST'];
