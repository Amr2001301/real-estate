import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';


/// The profile pages' building blocks (staff and broker), in the look of the
/// redesigned homes: the navy hero with the person, sections of rows in
/// cards, and the logout button.

/// The hero: the avatar, the name, the role (or company) and the bell.
class ProfileHero extends StatelessWidget {
  const ProfileHero({super.key, required this.name, required this.subtitle, this.loading = false});
  final String name;
  final String? subtitle;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return HomeListHero(
      title: name.isEmpty ? '—' : name,
      subtitle: subtitle,
      actions: [
        Container(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: AppPalette.gold400.withValues(alpha: 0.75), width: 2),
          ),
          child: GradientAvatar(name: name, size: 36),
        ),
        HomeHeroButton(
          icon: Icons.notifications_none_rounded,
          tooltip: context.l10n.accountNotifications,
          onTap: () => context.push('/notifications'),
        ),
      ],
    );
  }
}
