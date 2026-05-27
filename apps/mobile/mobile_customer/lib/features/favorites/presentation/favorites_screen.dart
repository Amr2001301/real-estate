import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import 'favorites_cubit.dart';

class FavoritesScreen extends StatefulWidget {
  const FavoritesScreen({super.key});

  @override
  State<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends State<FavoritesScreen> {
  @override
  void initState() {
    super.initState();
    final cubit = context.read<FavoritesCubit>();
    if (cubit.state.status == DataStatus.initial) cubit.load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.navFavorites)),
      body: BlocBuilder<FavoritesCubit, FavoritesState>(
        builder: (context, state) {
          switch (state.status) {
            case DataStatus.initial:
            case DataStatus.loading:
              return const Center(child: CircularProgressIndicator());
            case DataStatus.failure:
              return ErrorState(
                failure: state.failure,
                onRetry: () => context.read<FavoritesCubit>().load(),
              );
            case DataStatus.empty:
              return EmptyState(
                icon: Icons.favorite_border_rounded,
                title: l10n.favoritesEmptyTitle,
                message: l10n.favoritesEmptyMessage,
              );
            case DataStatus.success:
              final lang = Localizations.localeOf(context).languageCode;
              return RefreshIndicator(
                onRefresh: () => context.read<FavoritesCubit>().load(),
                child: ListView.separated(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  itemCount: state.items.length,
                  separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
                  itemBuilder: (context, i) {
                    final fav = state.items[i];
                    return AppCard(
                      padding: const EdgeInsets.all(AppSpacing.sm),
                      onTap: () => context.push(fav.route),
                      child: Row(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(AppRadii.sm),
                            child: SizedBox(
                              width: 56,
                              height: 56,
                              child: AppNetworkImage(url: fav.coverImage),
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(fav.title.resolve(lang),
                                    style: Theme.of(context).textTheme.titleSmall,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis),
                                if (fav.subtitle != null)
                                  Text(fav.subtitle!,
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodySmall
                                          ?.copyWith(color: context.appColors.inkMuted)),
                              ],
                            ),
                          ),
                          IconButton(
                            icon: Icon(Icons.favorite_rounded,
                                color: context.appColors.error),
                            onPressed: () =>
                                context.read<FavoritesCubit>().removeById(fav.id),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              );
          }
        },
      ),
    );
  }
}
