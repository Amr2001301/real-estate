import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../catalog/domain/repositories/broker_catalog_repository.dart';
import '../../catalog/domain/usecases/broker_catalog_use_cases.dart';
import '../../catalog/presentation/cubit/broker_projects_cubit.dart';
import '../../catalog/presentation/screens/broker_projects_screen.dart';
import '../../dashboard/domain/repositories/broker_dashboard_repository.dart';
import '../../dashboard/domain/usecases/get_broker_dashboard.dart';
import '../../dashboard/presentation/cubit/broker_dashboard_cubit.dart';
import '../../dashboard/presentation/screens/broker_dashboard_screen.dart';
import '../../leads/domain/repositories/broker_leads_repository.dart';
import '../../leads/domain/usecases/broker_lead_use_cases.dart';
import '../../leads/presentation/cubit/broker_leads_cubit.dart';
import '../../leads/presentation/screens/broker_leads_screen.dart';
import '../../profile/presentation/cubit/broker_profile_cubit.dart';
import '../../profile/presentation/screens/broker_profile_screen.dart';
import '../../reservations/domain/repositories/broker_reservations_repository.dart';
import '../../reservations/domain/usecases/broker_reservation_use_cases.dart';
import '../../reservations/presentation/cubit/broker_reservations_cubit.dart';
import '../../reservations/presentation/screens/broker_reservations_screen.dart';

/// The authenticated Broker workspace: a 5-tab bottom-nav shell using the
/// shared premium [AppBottomNav] from core. The [BrokerProfileCubit] is hosted
/// here so both Dashboard and Profile can read the broker's `canViewCommissions`
/// flag. Commissions are reached from the Dashboard card / Profile entry.
class BrokerShell extends StatefulWidget {
  const BrokerShell({super.key});

  @override
  State<BrokerShell> createState() => _BrokerShellState();
}

class _BrokerShellState extends State<BrokerShell> {
  int _index = 0;

  late final List<Widget> _tabs = [
    BlocProvider(
      create: (ctx) => BrokerDashboardCubit(
          GetBrokerDashboard(ctx.read<BrokerDashboardRepository>())),
      child: const BrokerDashboardScreen(),
    ),
    BlocProvider(
      create: (ctx) => BrokerProjectsCubit(
          GetBrokerProjects(ctx.read<BrokerCatalogRepository>())),
      child: const BrokerProjectsScreen(),
    ),
    BlocProvider(
      create: (ctx) =>
          BrokerLeadsCubit(GetBrokerLeads(ctx.read<BrokerLeadsRepository>())),
      child: const BrokerLeadsScreen(),
    ),
    BlocProvider(
      create: (ctx) => BrokerReservationsCubit(
          GetBrokerReservations(ctx.read<BrokerReservationsRepository>())),
      child: const BrokerReservationsScreen(),
    ),
    const BrokerProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      body: IndexedStack(index: _index, children: _tabs),
      bottomNavigationBar: AppBottomNav(
        currentIndex: _index,
        onSelect: (i) => setState(() => _index = i),
        items: [
          AppBottomNavItem(
            icon: Icons.dashboard_outlined,
            activeIcon: Icons.dashboard_rounded,
            label: l10n.navDashboard,
          ),
          AppBottomNavItem(
            icon: Icons.apartment_outlined,
            activeIcon: Icons.apartment_rounded,
            label: l10n.navProjects,
          ),
          AppBottomNavItem(
            icon: Icons.people_alt_outlined,
            activeIcon: Icons.people_alt_rounded,
            label: l10n.navLeads,
          ),
          AppBottomNavItem(
            icon: Icons.bookmark_border_rounded,
            activeIcon: Icons.bookmark_rounded,
            label: l10n.navReservations,
          ),
          AppBottomNavItem(
            icon: Icons.person_outline_rounded,
            activeIcon: Icons.person_rounded,
            label: l10n.navProfile,
          ),
        ],
      ),
    );
  }
}
