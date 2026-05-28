import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../catalog/domain/repositories/staff_catalog_repository.dart';
import '../../catalog/domain/usecases/staff_catalog_use_cases.dart';
import '../../catalog/presentation/cubit/staff_projects_cubit.dart';
import '../../catalog/presentation/screens/staff_projects_screen.dart';
import '../../clients/domain/repositories/clients_repository.dart';
import '../../clients/domain/usecases/client_use_cases.dart';
import '../../clients/presentation/cubit/clients_cubit.dart';
import '../../clients/presentation/screens/clients_screen.dart';
import '../../bonus/domain/repositories/bonus_repository.dart';
import '../../bonus/domain/usecases/get_bonus_entries.dart';
import '../../bonus/presentation/cubit/bonus_summary_cubit.dart';
import '../../dashboard/domain/repositories/dashboard_repository.dart';
import '../../dashboard/domain/usecases/get_sales_dashboard.dart';
import '../../dashboard/presentation/cubit/dashboard_cubit.dart';
import '../../dashboard/presentation/screens/dashboard_screen.dart';
import '../../performance/domain/repositories/performance_repository.dart';
import '../../performance/domain/usecases/performance_use_cases.dart';
import '../../performance/presentation/cubit/target_summary_cubit.dart';
import '../../leads/domain/repositories/leads_repository.dart';
import '../../leads/domain/usecases/lead_use_cases.dart';
import '../../leads/presentation/cubit/leads_cubit.dart';
import '../../leads/presentation/screens/leads_screen.dart';
import '../../profile/domain/repositories/staff_profile_repository.dart';
import '../../profile/domain/usecases/get_staff_profile.dart';
import '../../profile/presentation/cubit/staff_profile_cubit.dart';
import '../../profile/presentation/screens/staff_profile_screen.dart';

/// The authenticated Sales workspace: a 5-tab bottom-nav shell. Each tab owns
/// its cubit (built from the repositories provided by StaffApp). Detail screens
/// are pushed as full pages from within each tab.
class StaffShell extends StatefulWidget {
  const StaffShell({super.key});

  @override
  State<StaffShell> createState() => _StaffShellState();
}

class _StaffShellState extends State<StaffShell> {
  int _index = 0;

  late final List<Widget> _tabs = [
    MultiBlocProvider(
      providers: [
        BlocProvider(
          create: (ctx) => DashboardCubit(GetSalesDashboard(ctx.read<DashboardRepository>())),
        ),
        BlocProvider(
          create: (ctx) => BonusSummaryCubit(GetBonusEntries(ctx.read<BonusRepository>())),
        ),
        BlocProvider(
          create: (ctx) =>
              TargetSummaryCubit(GetSalesPerformance(ctx.read<PerformanceRepository>())),
        ),
      ],
      child: const DashboardScreen(),
    ),
    BlocProvider(
      create: (ctx) => LeadsCubit(GetLeads(ctx.read<LeadsRepository>())),
      child: const LeadsScreen(),
    ),
    BlocProvider(
      create: (ctx) => ClientsCubit(GetMyClients(ctx.read<ClientsRepository>())),
      child: const ClientsScreen(),
    ),
    BlocProvider(
      create: (ctx) =>
          StaffProjectsCubit(GetStaffProjects(ctx.read<StaffCatalogRepository>())),
      child: const StaffProjectsScreen(),
    ),
    MultiBlocProvider(
      providers: [
        BlocProvider(
          create: (ctx) => StaffProfileCubit(GetStaffProfile(ctx.read<StaffProfileRepository>())),
        ),
        BlocProvider(
          create: (ctx) =>
              TargetSummaryCubit(GetSalesPerformance(ctx.read<PerformanceRepository>())),
        ),
        BlocProvider(
          create: (ctx) => BonusSummaryCubit(GetBonusEntries(ctx.read<BonusRepository>())),
        ),
      ],
      child: const StaffProfileScreen(),
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      body: IndexedStack(index: _index, children: _tabs),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.dashboard_outlined),
            selectedIcon: const Icon(Icons.dashboard_rounded),
            label: l10n.navDashboard,
          ),
          NavigationDestination(
            icon: const Icon(Icons.people_alt_outlined),
            selectedIcon: const Icon(Icons.people_alt_rounded),
            label: l10n.navLeads,
          ),
          NavigationDestination(
            icon: const Icon(Icons.contacts_outlined),
            selectedIcon: const Icon(Icons.contacts_rounded),
            label: l10n.navClients,
          ),
          NavigationDestination(
            icon: const Icon(Icons.apartment_outlined),
            selectedIcon: const Icon(Icons.apartment_rounded),
            label: l10n.navProjects,
          ),
          NavigationDestination(
            icon: const Icon(Icons.person_outline_rounded),
            selectedIcon: const Icon(Icons.person_rounded),
            label: l10n.navProfile,
          ),
        ],
      ),
    );
  }
}
