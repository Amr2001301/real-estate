import 'package:core/core.dart';

/// Localized display label for a staff [AppRole].
String roleLabel(AppLocalizations l10n, AppRole role) => switch (role) {
      AppRole.sales => l10n.roleSales,
      AppRole.salesManager => l10n.roleSalesManager,
      AppRole.broker => l10n.roleBroker,
      AppRole.admin => l10n.roleAdmin,
      AppRole.maintenanceSupervisor => l10n.roleMaintenance,
      AppRole.client || AppRole.customer || AppRole.guest => l10n.roleStaff,
    };
