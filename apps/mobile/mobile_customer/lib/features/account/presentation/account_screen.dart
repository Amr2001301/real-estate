import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../auth/presentation/auth_cubit.dart';
import '../../content/presentation/content_widgets.dart';
import '../../notifications/presentation/unread_count_cubit.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Account Screen
// ─────────────────────────────────────────────────────────────────────────────

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  @override
  void initState() {
    super.initState();
    context.read<UnreadCountCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final session = context.watch<SessionCubit>().state.sessionOrNull;
    final unread = context.watch<UnreadCountCubit>().state;
    final name =
        session?.displayName ?? session?.email ?? l10n.accountRoleCustomer;

    // The hero stays put; only the list under it scrolls.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // The staff profile's hero: the person, the role, the bell.
        HomeListHero(
          key: const Key('account-hero'),
          title: name,
          subtitle: l10n.accountRoleCustomer,
          actions: [
            GestureDetector(
              onTap: () => context.push('/account/profile'),
              child: Container(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: AppPalette.gold400.withValues(alpha: 0.75),
                    width: 2,
                  ),
                ),
                child: GradientAvatar(name: name, size: 36),
              ),
            ),
            HomeHeroButton(
              icon: Icons.notifications_none_rounded,
              tooltip: l10n.accountNotifications,
              dot: unread > 0,
              onTap: () => context.push('/account/notifications'),
            ),
          ],
        ),
        Expanded(
          child: ListView(
            key: const Key('account-list'),
            padding: EdgeInsets.only(
              bottom: MediaQuery.paddingOf(context).bottom + 110,
            ),
            children: [
              HomeActions(
                actions: [
                  HomeAction(
                    id: 'profile',
                    icon: AppIcons.profile,
                    label: l10n.accountProfile,
                    onTap: () => context.push('/account/profile'),
                  ),
                  HomeAction(
                    id: 'favorites',
                    icon: AppIcons.favorite,
                    label: l10n.accountFavorites,
                    onTap: () => context.push('/account/favorites'),
                  ),
                  HomeAction(
                    id: 'requests',
                    icon: AppIcons.visit,
                    label: l10n.accountMyRequests,
                    onTap: () => context.push('/account/requests'),
                  ),
                  HomeAction(
                    id: 'notifications',
                    icon: AppIcons.notification,
                    label: l10n.accountNotifications,
                    onTap: () => context.push('/account/notifications'),
                  ),
                ],
              ),
              ProfileSection(
                icon: Icons.home_work_rounded,
                title: l10n.accountSectionServices,
                items: [
                  ProfileItem(
                    id: 'contracts',
                    icon: AppIcons.contract,
                    label: l10n.accountContracts,
                    subtitle: l10n.financeContractsDesc,
                    onTap: () => context.push('/account/contracts'),
                  ),
                  ProfileItem(
                    id: 'installments',
                    icon: AppIcons.installments,
                    label: l10n.installmentsTitle,
                    subtitle: l10n.financeInstallmentsDesc,
                    onTap: () => context.push('/account/installments'),
                  ),
                  ProfileItem(
                    id: 'deposits',
                    icon: AppIcons.deposit,
                    label: l10n.accountDeposits,
                    subtitle: l10n.financeDepositsDesc,
                    onTap: () => context.push('/account/deposits'),
                  ),
                ],
              ),
              // The company's published pages (CMS1).
              CompanyPagesCard(title: l10n.contentAboutCompany),
              ProfileSection(
                icon: Icons.settings_rounded,
                title: l10n.accountSectionSettings,
                items: [
                  ProfileItem(
                    id: 'language',
                    icon: Icons.translate_rounded,
                    label: l10n.galleryToggleLanguage,
                    trailing: l10n.languageName,
                    onTap: () => context.read<LocaleCubit>().toggle(),
                  ),
                  ProfileItem(
                    id: 'theme',
                    icon: Icons.brightness_6_outlined,
                    label: l10n.galleryToggleTheme,
                    onTap: () => context.read<ThemeCubit>().cycle(),
                  ),
                ],
              ),
              ProfileLogout(
                label: l10n.actionLogout,
                onTap: () => _confirmLogout(context),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _confirmLogout(BuildContext context) async {
    final l10n = context.l10n;
    final authCubit = context.read<AuthCubit>();
    final confirmed = await showAdaptiveConfirm(
      context,
      title: l10n.actionLogout,
      message: l10n.logoutConfirmMessage,
      confirmLabel: l10n.actionLogout,
      cancelLabel: l10n.actionCancel,
      destructive: true,
    );
    if (confirmed) authCubit.logout();
  }
}
