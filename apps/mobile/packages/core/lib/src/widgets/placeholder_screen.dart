import 'package:flutter/material.dart';

import '../design/tokens/app_spacing.dart';
import '../l10n/l10n.dart';
import 'empty_state.dart';

/// A labeled "coming soon" screen used to validate navigation before real
/// feature screens exist. Not for production use.
class PlaceholderScreen extends StatelessWidget {
  const PlaceholderScreen({
    super.key,
    required this.title,
    this.icon = Icons.widgets_outlined,
    this.actions,
  });

  final String title;
  final IconData icon;
  final List<Widget>? actions;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(title), actions: actions),
      body: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: EmptyState(
          icon: icon,
          title: l10n.placeholderScreen,
          message: l10n.placeholderScreenBody,
        ),
      ),
    );
  }
}
