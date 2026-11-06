import 'package:flutter/material.dart';

import '../../core.dart';

/// Rows of a profile page in cards, and its logout button (staff, broker and
/// customer apps).

class ProfileItem {
  const ProfileItem({required this.id, required this.icon, required this.label, required this.onTap, this.subtitle, this.trailing});
  final String id;
  final IconData icon;
  final String label;
  final String? subtitle;
  final String? trailing;
  final VoidCallback onTap;
}

/// A titled section: its rows in one card.
class ProfileSection extends StatelessWidget {
  const ProfileSection({super.key, required this.icon, required this.title, required this.items, this.horizontal = AppSpacing.md});
  final IconData icon;
  final String title;
  final List<ProfileItem> items;
  final double horizontal;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();
    final colors = context.appColors;
    return HomeSection(
      horizontal: horizontal,
      icon: icon,
      title: title,
      child: Container(
        decoration: homeCard(context, radius: 24),
        clipBehavior: Clip.antiAlias,
        child: Material(
          color: Colors.transparent,
          child: Column(children: [
            for (var i = 0; i < items.length; i++) ...[
              if (i > 0) Divider(height: 1, indent: 66, endIndent: 14, color: colors.hairline),
              _Row(item: items[i]),
            ],
          ]),
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.item});
  final ProfileItem item;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return InkWell(
      key: Key('profile-${item.id}'),
      onTap: item.onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        child: Row(children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppPalette.gold50,
              border: Border.all(color: AppPalette.gold100),
              borderRadius: BorderRadius.circular(13),
            ),
            child: Icon(item.icon, size: 20, color: AppPalette.gold600),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(item.label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: colors.inkStrong)),
              if ((item.subtitle ?? '').isNotEmpty)
                Text(item.subtitle!, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
            ]),
          ),
          if (item.trailing != null) ...[
            Text(item.trailing!, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: colors.inkMuted)),
            const SizedBox(width: 6),
          ],
          Icon(AppIcons.chevronForward, size: 18, color: AppPalette.gold400.withValues(alpha: 0.8)),
        ]),
      ),
    );
  }
}

class ProfileLogout extends StatelessWidget {
  const ProfileLogout({super.key, required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.md, 22, AppSpacing.md, 0),
      child: Material(
        color: colors.error.withValues(alpha: 0.05),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(color: colors.error.withValues(alpha: 0.25)),
        ),
        child: InkWell(
          key: const Key('profile-logout'),
          customBorder: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          onTap: onTap,
          child: SizedBox(
            height: 52,
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(Icons.logout_rounded, size: 19, color: colors.error),
              const SizedBox(width: 8),
              Text(label, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: colors.error)),
            ]),
          ),
        ),
      ),
    );
  }
}
