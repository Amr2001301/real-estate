import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../catalog/presentation/widgets/contact_buttons.dart';
import '../domain/entities/property.dart';
import 'my_property_cubit.dart';

/// Authenticated "My Property" screen: summarizes each unit a customer owns or
/// has reserved (derived from their contracts) with ownership status, key
/// dates, and quick links to deposits, contracts, maintenance, and contact.
class MyPropertyScreen extends StatefulWidget {
  const MyPropertyScreen({super.key});

  @override
  State<MyPropertyScreen> createState() => _MyPropertyScreenState();
}

class _MyPropertyScreenState extends State<MyPropertyScreen> {
  @override
  void initState() {
    super.initState();
    context.read<MyPropertyCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    // Body-only: the CustomerShellScaffold supplies the app bar + bottom nav.
    return BlocBuilder<MyPropertyCubit, MyPropertyState>(
      builder: (context, state) {
        switch (state.status) {
          case DataStatus.initial:
          case DataStatus.loading:
            return const Center(child: CircularProgressIndicator());
          case DataStatus.failure:
            return ErrorState(
              failure: state.failure,
              onRetry: () => context.read<MyPropertyCubit>().load(),
            );
          case DataStatus.empty:
            return EmptyState(
              icon: Icons.home_work_outlined,
              title: l10n.myPropertyEmptyTitle,
              message: l10n.myPropertyEmptyMessage,
            );
          case DataStatus.success:
            final properties = state.data!;
            return RefreshIndicator(
              onRefresh: () => context.read<MyPropertyCubit>().load(),
              child: ListView.separated(
                padding: EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.lg,
                    AppSpacing.lg, AppSpacing.lg + MediaQuery.of(context).padding.bottom),
                itemCount: properties.length,
                separatorBuilder: (_, _) =>
                    const SizedBox(height: AppSpacing.lg),
                itemBuilder: (context, i) =>
                    _PropertyCard(property: properties[i]),
              ),
            );
        }
      },
    );
  }
}

class _PropertyCard extends StatelessWidget {
  const _PropertyCard({required this.property});

  final Property property;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    final owned = property.status == PropertyStatus.owned;

    return AppCard(
      elevation: AppCardElevation.soft,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      property.projectName.resolve(lang),
                      style: theme.textTheme.titleMedium,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${property.unitType} · ${property.unitCode}',
                      style: theme.textTheme.bodyMedium
                          ?.copyWith(color: colors.inkMuted),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              StatusBadge(
                label: owned
                    ? l10n.myPropertyStatusOwned
                    : l10n.myPropertyStatusReserved,
                tone: owned ? BadgeTone.success : BadgeTone.warning,
                dot: true,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          const Divider(height: 1),
          const SizedBox(height: AppSpacing.md),

          // ── Key details ──────────────────────────────────────────────────
          if (property.contractNumber != null)
            _DetailRow(
              icon: Icons.description_outlined,
              label: l10n.myPropertyContractNumber,
              value: property.contractNumber!,
            ),
          if (property.reservationNumber != null)
            _DetailRow(
              icon: Icons.bookmark_outline_rounded,
              label: l10n.myPropertyReservationNumber,
              value: property.reservationNumber!,
            ),
          if (property.signedAt != null)
            _DetailRow(
              icon: Icons.event_available_outlined,
              label: l10n.myPropertySignedDate,
              value: DateFormatter.mediumDate(property.signedAt!,
                  languageCode: lang),
            ),
          if (property.hasInstallmentPlan)
            _DetailRow(
              icon: Icons.payments_outlined,
              label: l10n.myPropertyInstallmentPlan,
              value: l10n.myPropertyInstallmentSummary(
                PriceFormatter.formatString(property.monthlyAmount,
                    languageCode: lang),
                property.totalMonths!,
              ),
            ),

          const SizedBox(height: AppSpacing.md),

          // ── Linked actions ───────────────────────────────────────────────
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              _LinkChip(
                icon: Icons.account_balance_wallet_outlined,
                label: l10n.accountDeposits,
                onTap: () => context.push('/account/deposits'),
              ),
              _LinkChip(
                icon: Icons.folder_outlined,
                label: l10n.accountContracts,
                onTap: () => context.push('/account/contracts'),
              ),
              _LinkChip(
                icon: Icons.build_outlined,
                label: l10n.myPropertyRequestMaintenance,
                onTap: () => context.push(
                  '/account/maintenance/new',
                  extra: {'unitId': property.unitId},
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          ContactButtons(
            whatsappMessage: l10n.myPropertyContactMessage(
              property.projectName.resolve(lang),
              property.unitCode,
            ),
          ),
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: colors.inkMuted),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              label,
              style:
                  theme.textTheme.bodyMedium?.copyWith(color: colors.inkMuted),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Flexible(
            child: Text(
              value,
              style: theme.textTheme.bodyMedium
                  ?.copyWith(fontWeight: FontWeight.w600),
              textAlign: TextAlign.end,
            ),
          ),
        ],
      ),
    );
  }
}

class _LinkChip extends StatelessWidget {
  const _LinkChip({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return ActionChip(
      avatar: Icon(icon, size: 18, color: colors.brandGold),
      label: Text(label),
      onPressed: onTap,
    );
  }
}
