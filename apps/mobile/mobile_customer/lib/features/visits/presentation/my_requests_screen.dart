import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../domain/entities/visit_request.dart';
import 'my_visits_cubit.dart';

extension on VisitStatus {
  String label(AppLocalizations l) => switch (this) {
        VisitStatus.pending => l.visitStatusPending,
        VisitStatus.approved => l.visitStatusApproved,
        VisitStatus.scheduled => l.visitStatusScheduled,
        VisitStatus.completed => l.visitStatusCompleted,
        VisitStatus.cancelled => l.visitStatusCancelled,
        VisitStatus.unknown => '',
      };

  BadgeTone get tone => switch (this) {
        VisitStatus.pending => BadgeTone.warning,
        VisitStatus.approved => BadgeTone.info,
        VisitStatus.scheduled => BadgeTone.gold,
        VisitStatus.completed => BadgeTone.success,
        VisitStatus.cancelled => BadgeTone.error,
        VisitStatus.unknown => BadgeTone.neutral,
      };
}

class MyRequestsScreen extends StatefulWidget {
  const MyRequestsScreen({super.key});

  @override
  State<MyRequestsScreen> createState() => _MyRequestsScreenState();
}

class _MyRequestsScreenState extends State<MyRequestsScreen> {
  @override
  void initState() {
    super.initState();
    context.read<MyVisitsCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.myRequestsTitle)),
      body: BlocBuilder<MyVisitsCubit, MyVisitsState>(
        builder: (context, state) {
          switch (state.status) {
            case DataStatus.initial:
            case DataStatus.loading:
              return const Center(child: CircularProgressIndicator());
            case DataStatus.failure:
              return ErrorState(
                failure: state.failure,
                onRetry: () => context.read<MyVisitsCubit>().load(),
              );
            case DataStatus.empty:
              return EmptyState(
                icon: Icons.event_note_outlined,
                title: l10n.myRequestsEmptyTitle,
                message: l10n.myRequestsEmptyMessage,
              );
            case DataStatus.success:
              final items = state.data!;
              return RefreshIndicator(
                onRefresh: () => context.read<MyVisitsCubit>().load(),
                child: ListView.separated(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
                  itemBuilder: (context, i) {
                    final r = items[i];
                    return AppCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  r.projectName?.resolve(lang) ?? l10n.visitRequestTitle,
                                  style: Theme.of(context).textTheme.titleMedium,
                                ),
                              ),
                              StatusBadge(label: r.status.label(l10n), tone: r.status.tone),
                            ],
                          ),
                          if (r.preferredDate != null) ...[
                            const SizedBox(height: AppSpacing.xs),
                            Text(
                              l10n.visitOn(DateFormatter.mediumDate(
                                  r.preferredDate!, languageCode: lang)),
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(color: context.appColors.inkMuted),
                            ),
                          ],
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
