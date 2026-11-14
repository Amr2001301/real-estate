import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../bonus/domain/repositories/bonus_repository.dart';
import '../../brokerage/brokerage_data.dart';
import '../../brokerage/brokerage_home_screen.dart';
import '../../bonus/domain/usecases/get_bonus_entries.dart';
import '../../bonus/presentation/cubit/bonus_summary_cubit.dart';
import '../../dashboard/admin_home/admin_home_data.dart';
import '../../dashboard/admin_home/admin_home_screen.dart';
import '../../dashboard/manager_home/manager_home_screen.dart';
import '../../dashboard/sales_home/sales_home_cubit.dart';
import '../../dashboard/sales_home/sales_home_data.dart';
import '../../dashboard/sales_home/sales_home_screen.dart';
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

  /// The admin, the sales manager and the sales rep each have their own home
  /// (owner-approved designs, 2026-11-04). The broker and the maintenance
  /// supervisor have their own shells.
  late final AppRole _role = context.read<SessionCubit>().state.role;
  late final bool _adminHome = _role == AppRole.admin;

  /// BRK-6c — a brokerage company's staff get the brokerage home: the
  /// developer's homes read reservations, contracts and instalments, which a
  /// brokerage does not have.
  late final bool _brokerage = context.read<SessionCubit>().state.sessionOrNull?.companyType == 'BROKERAGE';

  late final List<Widget> _tabs = [
    // 0 — Dashboard
    if (_brokerage)
      Builder(builder: (ctx) => BrokerageHomeScreen(repository: BrokerageRepository(ctx.read<Dio>()), onSwitchTab: _switchTab))
    else if (_adminHome)
      BlocProvider(
        create: (ctx) => AdminHomeCubit(
          AdminHomeRepository(ctx.read<Dio>(), ctx.read<TokenStorage>(), ctx.read<LeadsRepository>()),
        ),
        child: AdminHomeScreen(onSwitchTab: _switchTab),
      )
    else
      BlocProvider(
        create: (ctx) => SalesHomeCubit(
          SalesHomeRepository(ctx.read<Dio>(), ctx.read<TokenStorage>()),
          ctx.read<LeadsRepository>(),
          userId: ctx.read<SessionCubit>().state.sessionOrNull?.userId ?? '',
          team: _role == AppRole.salesManager,
        ),
        child: _role == AppRole.salesManager
            ? ManagerHomeScreen(onSwitchTab: _switchTab)
            : SalesHomeScreen(onSwitchTab: _switchTab),
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
    final items = [
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
    ];
    // The approved design: a navy bar floating over the page.
    return Scaffold(
      extendBody: true,
      body: IndexedStack(index: _index, children: _tabs),
      bottomNavigationBar: StaffFloatingNav(
        items: items,
        currentIndex: _index,
        onSelect: (i) => setState(() => _index = i),
      ),
    );
  }
}

/// The staff bar: the shared floating navy bar, under the staff key.
class StaffFloatingNav extends StatelessWidget {
  const StaffFloatingNav({super.key, required this.items, required this.currentIndex, required this.onSelect});
  final List<AppBottomNavItem> items;
  final int currentIndex;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) => AppFloatingNav(items: items, currentIndex: currentIndex, onSelect: onSelect);
}
