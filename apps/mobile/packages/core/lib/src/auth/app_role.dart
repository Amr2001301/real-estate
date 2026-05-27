import 'package:json_annotation/json_annotation.dart';

/// Roles mirrored from the backend `UserRole` enum
/// (apps/api/prisma/schema.prisma). Keep this in sync with the API.
enum AppRole {
  admin('ADMIN'),
  sales('SALES'),
  salesManager('SALES_MANAGER'),
  maintenanceSupervisor('MAINTENANCE_SUPERVISOR'),
  broker('BROKER'),
  client('CLIENT'),
  customer('CUSTOMER'),
  guest('GUEST'); // client-only pseudo-role for anonymous browsing

  const AppRole(this.wire);

  /// The exact string the backend uses.
  final String wire;

  static AppRole fromWire(String? value) {
    return AppRole.values.firstWhere(
      (r) => r.wire == value,
      orElse: () => AppRole.guest,
    );
  }

  // ---- Capability groups used by route guards -------------------------------

  /// Belongs in the Customer App (Guest / Client / Customer).
  bool get isCustomerSide =>
      this == AppRole.guest || this == AppRole.client || this == AppRole.customer;

  /// Belongs in the Staff App (Sales / Broker, plus managers/admins).
  bool get isStaffSide =>
      this == AppRole.sales ||
      this == AppRole.salesManager ||
      this == AppRole.broker ||
      this == AppRole.admin ||
      this == AppRole.maintenanceSupervisor;

  bool get isBroker => this == AppRole.broker;

  /// Post-purchase owner features (My Property, deposits, contracts, maintenance).
  bool get isCustomer => this == AppRole.customer;

  bool get isAuthenticated => this != AppRole.guest;
}

/// Serializes [AppRole] using the backend wire value (e.g. `CUSTOMER`).
class AppRoleConverter implements JsonConverter<AppRole, String> {
  const AppRoleConverter();

  @override
  AppRole fromJson(String json) => AppRole.fromWire(json);

  @override
  String toJson(AppRole object) => object.wire;
}
