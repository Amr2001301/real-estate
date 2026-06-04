import 'package:core/core.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../notifications/presentation/unread_count_cubit.dart';
import 'notification_bell.dart';

/// Branch indices in the StatefulShellRoute (see app_router.dart).
class _Branch {
  static const home = 0;
  static const projects = 1;
  static const units = 2;
  static const compare = 3;
  static const more = 4;
  static const property = 5;
  static const finance = 6;
  static const maintenance = 7;
  static const account = 8;
}

/// Branches whose screens carry their OWN Scaffold + AppBar (catalog browsing
/// screens reused as full-screen pushes too). The shell omits its app bar for
/// these so there is never a double app bar.
const _selfChromeBranches = {_Branch.projects, _Branch.units, _Branch.compare};

/// Bottom-nav branch indices per auth state. Guests get the public browsing
/// set (home, projects, units, compare, more) and NEVER the account branches;
/// authenticated customers get the account tab set. Public + pure so it is
/// unit-testable.
List<int> shellBranchOrder({required bool isCustomer}) => isCustomer
    ? const [
        _Branch.home,
        _Branch.property,
        _Branch.finance,
        _Branch.maintenance,
        _Branch.account,
      ]
    : const [
        _Branch.home,
        _Branch.projects,
        _Branch.units,
        _Branch.compare,
        _Branch.more,
      ];

/// The persistent customer app shell. The bottom-nav tab set + app-bar actions
/// adapt to auth state; bottom-nav glyphs adapt to platform (Cupertino on iOS).
/// The shell app bar is suppressed on self-chrome catalog branches. Secondary
/// actions (login/language/theme) live in the المزيد tab (guest) or the account
/// tab (customer) — no app-bar overflow menu.
class CustomerShellScaffold extends StatelessWidget {
  const CustomerShellScaffold({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  void _goBranch(int branchIndex) {
    HapticFeedback.selectionClick();
    navigationShell.goBranch(
      branchIndex,
      initialLocation: branchIndex == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final session = context.watch<SessionCubit>().state;
    final isCustomer = session.isAuthenticated && session.role.isCustomerSide;
    final current = navigationShell.currentIndex;

    final titles = <int, String>{
      _Branch.home: l10n.navHome,
      _Branch.more: l10n.navMore,
      _Branch.property: l10n.accountMyProperty,
      _Branch.finance: l10n.navFinance,
      _Branch.maintenance: l10n.accountMaintenance,
      _Branch.account: l10n.navAccount,
    };

    final branchOrder = shellBranchOrder(isCustomer: isCustomer);

    // Native, always-bundled glyphs (no broken boxes): thin CupertinoIcons on
    // iOS, outlined Material on Android (per AppBottomNav's adaptive rendering).
    final navItems = isCustomer
        ? [
            AppBottomNavItem(
                icon: Icons.home_outlined,
                cupertinoIcon: CupertinoIcons.house,
                label: l10n.navHome),
            AppBottomNavItem(
                icon: Icons.home_work_outlined,
                cupertinoIcon: CupertinoIcons.building_2_fill,
                label: l10n.accountMyProperty),
            AppBottomNavItem(
                icon: Icons.account_balance_wallet_outlined,
                cupertinoIcon: CupertinoIcons.creditcard,
                label: l10n.navFinance),
            AppBottomNavItem(
                icon: Icons.build_outlined,
                cupertinoIcon: CupertinoIcons.wrench,
                label: l10n.accountMaintenance),
            AppBottomNavItem(
                icon: Icons.person_outline_rounded,
                cupertinoIcon: CupertinoIcons.person_crop_circle,
                label: l10n.navAccount),
          ]
        : [
            AppBottomNavItem(
                icon: Icons.home_outlined,
                cupertinoIcon: CupertinoIcons.house,
                label: l10n.navHome),
            AppBottomNavItem(
                icon: Icons.location_city_outlined,
                cupertinoIcon: CupertinoIcons.building_2_fill,
                label: l10n.navProjects),
            AppBottomNavItem(
                icon: Icons.grid_view_outlined,
                cupertinoIcon: CupertinoIcons.square_grid_2x2,
                label: l10n.navUnits),
            AppBottomNavItem(
                icon: Icons.view_column_rounded,
                cupertinoIcon: CupertinoIcons.square_split_2x1,
                label: l10n.navCompare),
            AppBottomNavItem(
                icon: Icons.more_horiz_rounded,
                cupertinoIcon: CupertinoIcons.ellipsis,
                label: l10n.navMore),
          ];

    final selected = branchOrder.indexOf(current);
    final displayIndex = selected < 0 ? 0 : selected;

    final session_ = session.sessionOrNull;
    final displayName = session_?.displayName ?? session_?.email;

    final showShellAppBar = !_selfChromeBranches.contains(current);

    return Scaffold(
      // iOS: let body content scroll behind the floating glass tab bar (real
      // glass). Tab scrollables add MediaQuery.padding.bottom so nothing hides.
      // Android keeps the in-slot Material bar (no overlap).
      extendBody: context.isApplePlatform,
      appBar: showShellAppBar
          ? AdaptiveAppBar(
              title: Text(titles[current] ?? l10n.navHome),
              // Guests have no app-bar actions (login/language/theme live in the
              // المزيد tab). Authenticated users get the bell + avatar only.
              actions: isCustomer
                  ? _customerActions(context, l10n, displayName)
                  : null,
            )
          : null,
      body: navigationShell,
      // Floating assistant — only on Home (avoids the maintenance tab's FAB).
      floatingActionButton: current == _Branch.home
          ? _AssistantFab(
              tooltip: l10n.homeAskAssistant,
              onTap: () => context.push('/chat'),
            )
          : null,
      bottomNavigationBar: AppBottomNav(
        currentIndex: displayIndex,
        onSelect: (i) => _goBranch(branchOrder[i]),
        items: navItems,
      ),
    );
  }

  /// Authenticated: notification bell + avatar (no overflow menu).
  List<Widget> _customerActions(
    BuildContext context,
    AppLocalizations l10n,
    String? displayName,
  ) {
    return [
      BlocBuilder<UnreadCountCubit, int>(
        builder: (context, count) => NotificationBell(
          count: count,
          tooltip: l10n.accountNotifications,
          onTap: () => context.push('/account/notifications'),
        ),
      ),
      Padding(
        padding: const EdgeInsetsDirectional.only(
          start: AppSpacing.xxs,
          end: AppSpacing.sm,
        ),
        child: GestureDetector(
          onTap: () => context.push('/account/profile'),
          child: displayName != null
              ? GradientAvatar(name: displayName, size: 34)
              : Icon(Icons.person_outline_rounded, color: context.appColors.inkMuted),
        ),
      ),
    ];
  }
}

/// Premium AI assistant FAB: a compact navy circle with a gold ring and a gold
/// sparkle glyph — refined and warm-luxe, not a plain gold square.
class _AssistantFab extends StatelessWidget {
  const _AssistantFab({required this.onTap, this.tooltip});

  final VoidCallback onTap;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final button = Container(
      width: 54,
      height: 54,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppPalette.navy700, AppPalette.navy],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        shape: BoxShape.circle,
        border: Border.all(
          color: AppPalette.gold400.withValues(alpha: 0.45),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: AppPalette.navy.withValues(alpha: 0.35),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        shape: const CircleBorder(),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: const Center(
            child: Icon(Icons.auto_awesome_rounded,
                color: AppPalette.gold300, size: 24),
          ),
        ),
      ),
    );
    return Semantics(
      button: true,
      label: tooltip,
      child: tooltip != null ? Tooltip(message: tooltip!, child: button) : button,
    );
  }
}
