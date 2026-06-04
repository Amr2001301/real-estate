import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../favorites_cubit.dart';

/// Heart toggle for a project/unit. Guests are prompted to sign in; signed-in
/// users toggle the favorite via the app-wide [FavoritesCubit].
class FavoriteToggleButton extends StatelessWidget {
  const FavoriteToggleButton({
    super.key,
    required this.isProject,
    required this.id,
    this.dense = false,
  });

  final bool isProject;
  final String id;

  /// Compact 38×38 variant for on-image card overlays (vs the default app-bar
  /// size used by detail screens).
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final authed = context.watch<SessionCubit>().state.isAuthenticated;
    final favState = context.watch<FavoritesCubit>().state;
    final isFav = authed &&
        (isProject ? favState.forProject(id) : favState.forUnit(id)) != null;

    return IconButton(
      tooltip: context.l10n.accountFavorites,
      iconSize: dense ? 18 : 24,
      visualDensity: dense ? VisualDensity.compact : null,
      padding: dense ? EdgeInsets.zero : null,
      constraints:
          dense ? const BoxConstraints.tightFor(width: 36, height: 36) : null,
      icon: Icon(
        isFav ? Icons.favorite_rounded : Icons.favorite_border_rounded,
        color: isFav ? colors.error : null,
      ),
      onPressed: () => _onTap(context, wasFav: isFav, authed: authed),
    );
  }

  Future<void> _onTap(
    BuildContext context, {
    required bool wasFav,
    required bool authed,
  }) async {
    final l10n = context.l10n;
    final messenger = ScaffoldMessenger.of(context);
    if (!authed) {
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(
          content: Text(l10n.favoriteLoginPrompt),
          action: SnackBarAction(
            label: l10n.actionLogin,
            onPressed: () => context.push('/login'),
          ),
        ));
      return;
    }
    final cubit = context.read<FavoritesCubit>();
    final failure =
        isProject ? await cubit.toggleProject(id) : await cubit.toggleUnit(id);
    messenger.hideCurrentSnackBar();
    if (failure != null) {
      AppLog.failure(failure);
      messenger.showSnackBar(SnackBar(content: Text(failure.userMessage(l10n))));
      return;
    }
    messenger.showSnackBar(SnackBar(
      content: Text(wasFav ? l10n.favoriteRemoved : l10n.favoriteAdded),
    ));
  }
}
