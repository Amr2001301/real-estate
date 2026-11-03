import 'package:flutter/material.dart';

import '../design/theme/app_theme_ext.dart';
import '../design/tokens/app_spacing.dart';
import '../l10n/l10n.dart';
import 'app_button.dart';
import 'app_nav_header.dart';
import 'empty_state.dart';

/// What a wrong or outdated link opens (a notification for a page that moved,
/// a typo): the app's own header, a short Arabic/English message and a way
/// home — never the router's raw error. With [noAccess] it says the page is
/// not open to this account instead (a link to a page the menu hides).
class AppNotFoundPage extends StatelessWidget {
  const AppNotFoundPage({super.key, required this.onHome, this.noAccess = false});

  final VoidCallback onHome;
  final bool noAccess;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final title = noAccess ? l10n.pageNoAccessTitle : l10n.pageNotFoundTitle;
    return Scaffold(
      key: Key(noAccess ? 'page-no-access' : 'page-not-found'),
      backgroundColor: context.appColors.canvas,
      body: Column(
        children: [
          AppNavHeader(title: title, compact: true),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  EmptyState(
                    icon: noAccess ? Icons.lock_outline_rounded : Icons.link_off_rounded,
                    title: title,
                    message: noAccess ? l10n.pageNoAccessMessage : l10n.pageNotFoundMessage,
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  AppButton(label: l10n.pageNotFoundHome, icon: Icons.home_rounded, onPressed: onHome),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
