import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../auth/presentation/cubit/staff_auth_cubit.dart';
import '../../../../profile/presentation/profile_kit.dart';
import '../cubit/broker_profile_cubit.dart';

/// The broker's profile, in the staff profile's look: the person and the
/// company on the navy hero, the broker's pages, and the account.
class BrokerProfileScreen extends StatelessWidget {
  const BrokerProfileScreen({super.key});

  Future<void> _confirmLogout(BuildContext context) async {
    final l10n = context.l10n;
    final ok = await showAdaptiveConfirm(
      context,
      title: l10n.actionLogout,
      message: l10n.logoutConfirmMessage,
      confirmLabel: l10n.actionLogout,
      cancelLabel: l10n.actionCancel,
      destructive: true,
    );
    if (ok && context.mounted) context.read<StaffAuthCubit>().logout();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final bottom = MediaQuery.paddingOf(context).bottom;

    return Scaffold(
      backgroundColor: context.appColors.canvas,
      body: BlocBuilder<BrokerProfileCubit, BrokerProfileState>(
        builder: (context, state) {
          final session = context.read<SessionCubit>().state.sessionOrNull;
          final p = state.data;
          return ListView(
            key: const Key('broker-profile'),
            padding: EdgeInsets.only(bottom: bottom + 32),
            children: [
              ProfileHero(name: p?.fullName ?? session?.displayName ?? '', subtitle: p?.companyName),
              ProfileSection(
                icon: Icons.work_outline_rounded,
                title: l10n.profileSectionBrokerWork,
                items: [
                  ProfileItem(
                      id: 'contracts', icon: Icons.description_rounded, label: l10n.navContracts, onTap: () => context.push('/broker/contracts')),
                  ProfileItem(
                      id: 'performance', icon: Icons.insights_rounded, label: l10n.bpMineTitle, onTap: () => context.push('/broker/performance')),
                  if (p?.canViewCommissions == true)
                    ProfileItem(
                        id: 'commissions', icon: Icons.payments_rounded, label: l10n.navCommissions, onTap: () => context.push('/broker/commissions')),
                ],
              ),
              ProfileSection(
                icon: Icons.shield_outlined,
                title: l10n.profileSectionAccount,
                items: [
                  ProfileItem(
                      id: 'notifications', icon: AppIcons.notification, label: l10n.accountNotifications, onTap: () => context.push('/notifications')),
                  ProfileItem(id: 'security', icon: Icons.lock_outline_rounded, label: l10n.settingsSecurity, onTap: () => context.push('/security')),
                  ProfileItem(
                      id: 'language',
                      icon: Icons.translate_rounded,
                      label: l10n.settingsLanguage,
                      trailing: l10n.languageName,
                      onTap: () => context.read<LocaleCubit>().toggle()),
                  ProfileItem(
                      id: 'theme', icon: Icons.brightness_6_outlined, label: l10n.settingsTheme, onTap: () => context.read<ThemeCubit>().cycle()),
                ],
              ),
              ProfileLogout(label: l10n.actionLogout, onTap: () => _confirmLogout(context)),
            ],
          );
        },
      ),
    );
  }
}
