import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../catalog/domain/repositories/staff_catalog_repository.dart';
import '../../catalog/domain/usecases/staff_catalog_use_cases.dart';
import '../../catalog/presentation/cubit/staff_projects_cubit.dart';
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

/// The authenticated Sales workspace: 3-tab bottom-nav shell.
/// Clients and Projects are accessible via the Profile screen.
class StaffShell extends StatefulWidget {
  const StaffShell({super.key});

  @override
  State<StaffShell> createState() => _StaffShellState();
}

class _StaffShellState extends State<StaffShell> {
  int _index = 0;

  void _switchTab(int index) => setState(() => _index = index);

  late final List<Widget> _tabs = [
    // 0 — Dashboard
    MultiBlocProvider(
      providers: [
        BlocProvider(
          create: (ctx) =>
              DashboardCubit(GetSalesDashboard(ctx.read<DashboardRepository>())),
        ),
        BlocProvider(
          create: (ctx) =>
              BonusSummaryCubit(GetBonusEntries(ctx.read<BonusRepository>())),
        ),
        BlocProvider(
          create: (ctx) => TargetSummaryCubit(
              GetSalesPerformance(ctx.read<PerformanceRepository>())),
        ),
        BlocProvider(
          create: (ctx) => StaffProjectsCubit(
              GetStaffProjects(ctx.read<StaffCatalogRepository>())),
        ),
      ],
      child: DashboardScreen(onSwitchTab: _switchTab),
    ),

    // 1 — Leads
    BlocProvider(
      create: (ctx) {
        final repo = ctx.read<LeadsRepository>();
        return LeadsCubit(GetLeads(repo), repo);
      },
      child: const LeadsScreen(),
    ),

    // 2 — Profile  (Clients, Projects, Reservations, Contracts… accessed here)
    MultiBlocProvider(
      providers: [
        BlocProvider(
          create: (ctx) =>
              StaffProfileCubit(GetStaffProfile(ctx.read<StaffProfileRepository>())),
        ),
        BlocProvider(
          create: (ctx) => TargetSummaryCubit(
              GetSalesPerformance(ctx.read<PerformanceRepository>())),
        ),
        BlocProvider(
          create: (ctx) =>
              BonusSummaryCubit(GetBonusEntries(ctx.read<BonusRepository>())),
        ),
      ],
      child: StaffProfileScreen(onSwitchTab: _switchTab),
    ),
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
            icon: Icons.people_alt_outlined,
            activeIcon: Icons.people_alt_rounded,
            label: l10n.navLeads,
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
