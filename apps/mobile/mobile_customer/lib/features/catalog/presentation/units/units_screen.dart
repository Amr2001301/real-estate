import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../widgets/catalog_skeletons.dart';
import '../widgets/unit_card.dart';
import 'units_cubit.dart';
import 'units_filters_sheet.dart';
import 'units_state.dart';

class UnitsScreen extends StatefulWidget {
  const UnitsScreen({super.key});

  @override
  State<UnitsScreen> createState() => _UnitsScreenState();
}

class _UnitsScreenState extends State<UnitsScreen> {
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (_scroll.position.pixels >= _scroll.position.maxScrollExtent - 400) {
        context.read<UnitsCubit>().loadMore();
      }
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _openFilters() async {
    final cubit = context.read<UnitsCubit>();
    final result = await showUnitsFilterSheet(context, current: cubit.state.filter);
    if (result != null) cubit.applyFilter(result);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.unitsTitle),
        actions: [
          BlocBuilder<UnitsCubit, UnitsState>(
            buildWhen: (a, b) => a.filter != b.filter,
            builder: (context, state) => IconButton(
              tooltip: l10n.filtersTitle,
              icon: Badge(
                isLabelVisible: state.filter.activeCount > 0,
                label: Text('${state.filter.activeCount}'),
                child: const Icon(Icons.tune_rounded),
              ),
              onPressed: _openFilters,
            ),
          ),
        ],
      ),
      body: BlocBuilder<UnitsCubit, UnitsState>(
        builder: (context, state) {
          switch (state.status) {
            case DataStatus.initial:
            case DataStatus.loading:
              return const UnitsGridSkeleton();
            case DataStatus.failure:
              return ErrorState(
                failure: state.failure,
                onRetry: () => context.read<UnitsCubit>().load(),
              );
            case DataStatus.empty:
              return EmptyState(
                icon: Icons.search_off_rounded,
                title: l10n.noUnitsTitle,
                message: l10n.noUnitsMessage,
              );
            case DataStatus.success:
              // Single-column list of full-width premium cards — intrinsic
              // height + flexible spec row means no horizontal/vertical overflow.
              return RefreshIndicator(
                onRefresh: () => context.read<UnitsCubit>().refresh(),
                child: ListView.separated(
                  controller: _scroll,
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  itemCount: state.items.length + (state.isLoadingMore ? 1 : 0),
                  separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.lg),
                  itemBuilder: (context, i) {
                    if (i >= state.items.length) {
                      return const Center(
                        child: Padding(
                          padding: EdgeInsets.all(AppSpacing.md),
                          child: CircularProgressIndicator(),
                        ),
                      );
                    }
                    final unit = state.items[i];
                    return UnitCard(
                      unit: unit,
                      onTap: () => context.push('/units/${unit.id}'),
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
