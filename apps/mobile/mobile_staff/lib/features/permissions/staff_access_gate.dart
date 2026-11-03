import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import 'staff_permissions.dart';

/// Opens a page only for the accounts its [StaffAccess] rule allows — the
/// same rule that hides its menu entry. A link or a typed address from an
/// account without access gets a plain "not available" page with a way home
/// instead of a screen whose every call answers 403. The API still checks.
class StaffAccessGate extends StatelessWidget {
  const StaffAccessGate({super.key, required this.allows, required this.child});

  final bool Function(AppRole? role, StaffPermissions permissions) allows;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final role = context.watch<SessionCubit>().state.role;
    // Watched: codes load after sign-in, so a page opened by its code shows
    // as soon as they arrive.
    final permissions = context.watch<StaffPermissionsCubit>().state;
    if (allows(role, permissions)) return child;
    return AppNotFoundPage(noAccess: true, onHome: () => context.go('/home'));
  }
}
