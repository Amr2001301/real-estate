import 'package:core/core.dart';
import 'package:flutter/widgets.dart';

import '../../domain/entities/catalog_enums.dart';

/// Localized label + tone for a [UnitStatus].
extension UnitStatusL10n on UnitStatus {
  String label(AppLocalizations l) => switch (this) {
        UnitStatus.available => l.statusAvailable,
        UnitStatus.reserved => l.statusReserved,
        UnitStatus.sold => l.statusSold,
        UnitStatus.unknown => '',
      };

  BadgeTone get tone => switch (this) {
        UnitStatus.available => BadgeTone.success,
        UnitStatus.reserved => BadgeTone.warning,
        UnitStatus.sold => BadgeTone.error,
        UnitStatus.unknown => BadgeTone.neutral,
      };
}

/// A status pill for a unit (available / reserved / sold).
class UnitStatusChip extends StatelessWidget {
  const UnitStatusChip(this.status, {super.key, this.variant = BadgeVariant.soft});

  final UnitStatus status;
  final BadgeVariant variant;

  @override
  Widget build(BuildContext context) {
    if (status == UnitStatus.unknown) return const SizedBox.shrink();
    return StatusBadge(
      label: status.label(context.l10n),
      tone: status.tone,
      variant: variant,
    );
  }
}
