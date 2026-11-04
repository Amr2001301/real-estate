import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../shell/presentation/staff_shell.dart';
import '../../home/broker_home_data.dart';
import '../../home/broker_home_screen.dart';

import '../../catalog/domain/repositories/broker_catalog_repository.dart';
import '../../catalog/portal/portal_catalog_data.dart';
import '../../catalog/portal/portal_catalog_screens.dart';
import '../../leads/domain/repositories/broker_leads_repository.dart';
import '../../leads/domain/usecases/broker_lead_use_cases.dart';
import '../../leads/presentation/cubit/broker_leads_cubit.dart';
import '../../leads/presentation/screens/broker_leads_screen.dart';
import '../../profile/presentation/screens/broker_profile_screen.dart';
import '../../reservations/domain/repositories/broker_reservations_repository.dart';
import '../../reservations/domain/usecases/broker_reservation_use_cases.dart';
import '../../reservations/presentation/cubit/broker_reservations_cubit.dart';
import '../../reservations/presentation/screens/broker_reservations_screen.dart';

/// The authenticated Broker workspace: a 5-tab bottom-nav shell.
///
class BrokerShell extends StatefulWidget {
  const BrokerShell({super.key});

  @override
  State<BrokerShell> createState() => _BrokerShellState();
}

class _BrokerShellState extends State<BrokerShell> {
  int _index = 0;

  void _switchTab(int index) => setState(() => _index = index);

  late final List<Widget> _tabs = [
    // The approved design (2026-11-04), with the website's broker figures.
    BlocProvider(
      create: (ctx) => BrokerHomeCubit(
        BrokerHomeRepository(ctx.read<Dio>(), ctx.read<BrokerCatalogRepository>()),
      ),
      child: BrokerHomeScreen(onSwitchTab: _switchTab),
    ),
    // The approved design (2026-11-04), with the portal's projects page.
    BlocProvider(
      create: (ctx) => PortalProjectsCubit(PortalCatalogRepository(ctx.read<Dio>())),
      child: const PortalProjectsScreen(),
    ),
    BlocProvider(
      create: (ctx) =>
          BrokerLeadsCubit(GetBrokerLeads(ctx.read<BrokerLeadsRepository>()), ctx.read<BrokerLeadsRepository>()),
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
        extendBody: true,
        body: IndexedStack(index: _index, children: _tabs),
        // The navy bar floating over the page, as the other staff homes.
        bottomNavigationBar: StaffFloatingNav(
          currentIndex: _index,
          onSelect: (i) => setState(() => _index = i),
          items: [
            AppBottomNavItem(icon: Icons.dashboard_outlined, activeIcon: Icons.dashboard_rounded, label: l10n.navHome),
            AppBottomNavItem(icon: Icons.apartment_outlined, activeIcon: Icons.apartment_rounded, label: l10n.navProjects),
            AppBottomNavItem(icon: Icons.people_alt_outlined, activeIcon: Icons.people_alt_rounded, label: l10n.bhNavClients),
            AppBottomNavItem(icon: Icons.bookmark_border_rounded, activeIcon: Icons.bookmark_rounded, label: l10n.navReservations),
            AppBottomNavItem(icon: Icons.person_outline_rounded, activeIcon: Icons.person_rounded, label: l10n.bhNavAccount),
          ],
        ),
    );
  }
}
