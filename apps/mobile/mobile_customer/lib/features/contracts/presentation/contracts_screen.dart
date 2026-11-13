import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../notifications/presentation/widgets/customer_notification_button.dart';
import '../domain/entities/contract.dart';
import 'contracts_cubit.dart';

Color get _navyDeep => AppPalette.navyDeep;
Color get _navyLight => AppPalette.navyLight;

// ─────────────────────────────────────────────────────────────────────────────
// Contracts Screen
// ─────────────────────────────────────────────────────────────────────────────

class ContractsScreen extends StatefulWidget {
  const ContractsScreen({super.key});

  @override
  State<ContractsScreen> createState() => _ContractsScreenState();
}

class _ContractsScreenState extends State<ContractsScreen> {
  ContractStatus? _filter; // null = all

  @override
  void initState() {
    super.initState();
    context.read<ContractsCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final session = context.watch<SessionCubit>().state;
    final displayName =
        session.sessionOrNull?.displayName ?? session.sessionOrNull?.email;

    return Scaffold(
      backgroundColor: context.appColors.canvas,
      body: Column(
        children: [
          _ContractsHeader(displayName: displayName, l10n: l10n),

          // ── Filter chips ────────────────────────────────────────────────
          BlocBuilder<ContractsCubit, ContractsState>(
            builder: (context, state) {
              if (state.status != DataStatus.success) {
                return const SizedBox.shrink();
              }
              final all = state.data!;
              final signedCount =
                  all.where((c) => c.status == ContractStatus.signed).length;
              final draftCount = all.length - signedCount;
              return _FilterRow(
                selected: _filter?.name,
                items: [
                  _FilterItem(
                    key: null,
                    label: l10n.filterAny,
                    dotColor: null,
                    activeGradient: [_navyLight, _navyDeep],
                    count: all.length,
                  ),
                  _FilterItem(
                    key: ContractStatus.signed.name,
                    label: l10n.contractStatusSigned,
                    dotColor: const Color(0xFF4ADE80),
                    activeGradient: const [
                      Color(0xFF1B5E3F),
                      Color(0xFF0D3826),
                    ],
                    count: signedCount,
                  ),
                  _FilterItem(
                    key: ContractStatus.draft.name,
                    label: l10n.contractStatusDraft,
                    dotColor: Color(0xFFCBD5E1),
                    activeGradient: [_navyLight, _navyDeep],
                    count: draftCount,
                  ),
                ],
                onSelect: (k) => setState(() {
                  _filter = k == null
                      ? null
                      : ContractStatus.values.firstWhere((s) => s.name == k);
                }),
              );
            },
          ),

          // ── List ────────────────────────────────────────────────────────
          Expanded(
            child: BlocBuilder<ContractsCubit, ContractsState>(
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    // The list itself, as bones: the summary card and two contract cards.
                    return AppSkeletonizer(
                      enabled: true,
                      child: ListView.separated(
                        physics: const NeverScrollableScrollPhysics(),
                        padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.xl),
                        itemCount: _skeletonContracts.length + 1,
                        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
                        itemBuilder: (context, i) => i == 0
                            ? _ContractsSummary(contracts: _skeletonContracts, l10n: l10n)
                            : _ContractCard(contract: _skeletonContracts[i - 1], l10n: l10n),
                      ),
                    );
                  case DataStatus.failure:
                    return ErrorState(
                      failure: state.failure,
                      onRetry: () => context.read<ContractsCubit>().load(),
                    );
                  case DataStatus.empty:
                    return EmptyState(
                      icon: AppIcons.contract,
                      title: l10n.contractsEmptyTitle,
                      message: l10n.contractsEmptyMessage,
                    );
                  case DataStatus.success:
                    final all = state.data!;
                    final visible = _filter == null
                        ? all
                        : all.where((c) => c.status == _filter).toList();
                    return RefreshIndicator(
                      onRefresh: () => context.read<ContractsCubit>().load(),
                      child: ListView.separated(
                        padding: EdgeInsets.fromLTRB(
                          AppSpacing.lg,
                          AppSpacing.md,
                          AppSpacing.lg,
                          AppSpacing.xl + MediaQuery.of(context).padding.bottom,
                        ),
                        itemCount: visible.length + 1,
                        separatorBuilder: (_, _) =>
                            const SizedBox(height: AppSpacing.md),
                        itemBuilder: (context, i) {
                          if (i == 0) {
                            return _ContractsSummary(
                              contracts: all,
                              l10n: l10n,
                            );
                          }
                          return _ContractCard(
                            contract: visible[i - 1],
                            l10n: l10n,
                          );
                        },
                      ),
                    );
                }
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// Placeholder contracts the loading screen lays out (never shown as data).
final _skeletonContracts = [
  for (var i = 1; i <= 2; i++)
    Contract(
      id: 'skeleton-$i',
      contractNumber: 'CON-2026-000$i',
      unitCode: 'DF-NG-B01-10$i',
      unitType: 'APARTMENT',
      projectName: const Translatable(ar: 'اسم المشروع', en: 'Project name'),
      status: ContractStatus.signed,
      signedAt: DateTime(2026),
    ),
];

// ── Header ────────────────────────────────────────────────────────────────────

class _ContractsHeader extends StatelessWidget {
  const _ContractsHeader({required this.displayName, required this.l10n});
  final String? displayName;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return AppNavHeader(
      title: l10n.accountContracts,
      subtitle: l10n.financeContractsDesc,
      compact: true,
      leadingAction: const NavHeaderBack(),
      actions: const [CustomerNotificationButton()],
    );
  }
}

// ── Summary card ──────────────────────────────────────────────────────────────

class _ContractsSummary extends StatelessWidget {
  const _ContractsSummary({required this.contracts, required this.l10n});
  final List<Contract> contracts;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final signed = contracts
        .where((c) => c.status == ContractStatus.signed)
        .length;
    final draft = contracts.length - signed;

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [_navyLight, _navyDeep],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: _navyDeep.withValues(alpha: 0.25),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
          BoxShadow(
            color: AppPalette.gold400.withValues(alpha: 0.08),
            blurRadius: 24,
            spreadRadius: 2,
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          const Positioned.fill(child: IgnorePointer(child: _DotTexture())),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Row(
              children: [
                Expanded(
                  child: _SummaryCell(
                    value: '${contracts.length}',
                    label: l10n.accountContracts,
                    accent: AppPalette.gold300,
                    theme: theme,
                  ),
                ),
                Container(
                  width: 1,
                  height: 44,
                  color: Colors.white.withValues(alpha: 0.15),
                ),
                Expanded(
                  child: _SummaryCell(
                    value: '$signed',
                    label: l10n.contractStatusSigned,
                    accent: const Color(0xFF4ADE80),
                    theme: theme,
                  ),
                ),
                Container(
                  width: 1,
                  height: 44,
                  color: Colors.white.withValues(alpha: 0.15),
                ),
                Expanded(
                  child: _SummaryCell(
                    value: '$draft',
                    label: l10n.contractStatusDraft,
                    accent: Colors.white.withValues(alpha: 0.6),
                    theme: theme,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Contract card ─────────────────────────────────────────────────────────────

class _ContractCard extends StatelessWidget {
  const _ContractCard({required this.contract, required this.l10n});
  final Contract contract;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    final signed = contract.status == ContractStatus.signed;
    final projectName = contract.projectName.resolve(lang);

    final dark = Theme.of(context).brightness == Brightness.dark;
    final accent = signed
        ? (dark ? const Color(0xFF4ADE80) : const Color(0xFF15803D))
        : colors.inkMuted;
    final unitLine = [
      unitTypeLabel(contract.unitType, languageCode: lang),
      contract.unitCode,
    ].where((e) => e.isNotEmpty).join(' · ');
    final date = contract.signedAt ?? contract.createdAt;
    final dateLabel = contract.signedAt != null
        ? l10n.myPropertySignedDate
        : context.l10n.createdDateLabel;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.6)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: AppPalette.gold400.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  AppIcons.contract,
                  color: dark ? AppPalette.gold300 : AppPalette.goldInk,
                  size: 24,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      contract.contractNumber ?? projectName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: colors.inkStrong,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    if (contract.contractNumber != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        projectName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: colors.inkMuted,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              _StatusPill(
                label: signed
                    ? l10n.contractStatusSigned
                    : l10n.contractStatusDraft,
                icon: signed ? Icons.verified_rounded : Icons.pending_outlined,
                color: accent,
                bg: accent.withValues(alpha: 0.12),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Divider(height: 1, color: colors.hairline),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Icon(AppIcons.property, size: 16, color: colors.inkMuted),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  unitLine,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: colors.inkStrong,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          if (date != null) ...[
            const SizedBox(height: AppSpacing.sm),
            _InfoRow(
              icon: AppIcons.calendar,
              label: dateLabel,
              value: DateFormatter.mediumDate(date, languageCode: lang),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          _DocumentsButton(
            label: l10n.contractsDocumentsTitle,
            onTap: () => context.push(
              '/account/contracts/${contract.id}',
              extra: contract,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Summary cell ──────────────────────────────────────────────────────────────

class _SummaryCell extends StatelessWidget {
  const _SummaryCell({
    required this.value,
    required this.label,
    required this.accent,
    required this.theme,
  });
  final String value;
  final String label;
  final Color accent;
  final ThemeData theme;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          value,
          style: theme.textTheme.headlineSmall?.copyWith(
            color: accent,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.65),
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

// ── Status pill ───────────────────────────────────────────────────────────────

class _StatusPill extends StatelessWidget {
  const _StatusPill({
    required this.label,
    required this.icon,
    required this.color,
    required this.bg,
  });
  final String label;
  final IconData icon;
  final Color color;
  final Color bg;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Documents button ──────────────────────────────────────────────────────────

class _DocumentsButton extends StatelessWidget {
  const _DocumentsButton({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    final accent = AppPalette.gold300;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: accent.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: accent.withValues(alpha: 0.35),
            width: 1.5,
          ),
          boxShadow: [
            BoxShadow(
              color: accent.withValues(alpha: 0.10),
              blurRadius: 14,
              spreadRadius: 1,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: 12,
          ),
          child: Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [_navyLight, _navyDeep],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(13),
                  boxShadow: [
                    BoxShadow(
                      color: accent.withValues(alpha: 0.25),
                      blurRadius: 10,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: Icon(
                  Icons.folder_open_rounded,
                  color: accent,
                  size: 22,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: colors.inkStrong,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      context.l10n.tapToViewDocuments,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: colors.inkMuted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  Icons.arrow_forward_ios_rounded,
                  color: accent,
                  size: 14,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Info row ──────────────────────────────────────────────────────────────────

class _InfoRow extends StatelessWidget {
  const _InfoRow({
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
    return Row(
      children: [
        Icon(icon, size: 14, color: colors.inkMuted),
        const SizedBox(width: AppSpacing.xs),
        Text(
          '$label: ',
          style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted),
        ),
        Expanded(
          child: Text(
            value,
            style: theme.textTheme.bodySmall?.copyWith(
              color: colors.inkStrong,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    );
  }
}

// ── Filter row ────────────────────────────────────────────────────────────────

class _FilterItem {
  const _FilterItem({
    required this.key,
    required this.label,
    required this.dotColor,
    required this.activeGradient,
    required this.count,
  });
  final String? key;
  final String label;
  final Color? dotColor;
  final List<Color> activeGradient;
  final int count;
}

class _FilterRow extends StatelessWidget {
  const _FilterRow({
    required this.items,
    required this.selected,
    required this.onSelect,
  });
  final List<_FilterItem> items;
  final String? selected;
  final void Function(String?) onSelect;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 58,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: 8),
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
        itemBuilder: (context, i) {
          final item = items[i];
          return AppFilterChip(
            label: item.label,
            count: item.count,
            dotColor: item.dotColor,
            selected: item.key == selected,
            onTap: () => onSelect(item.key),
          );
        },
      ),
    );
  }
}

// ── Dot texture ───────────────────────────────────────────────────────────────

class _DotTexture extends StatelessWidget {
  const _DotTexture();
  @override
  Widget build(BuildContext context) =>
      const CustomPaint(painter: _DotPainter(), child: SizedBox.expand());
}

class _DotPainter extends CustomPainter {
  const _DotPainter();
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.04);
    const step = 20.0;
    for (var y = 6.0; y < size.height; y += step) {
      for (var x = 6.0; x < size.width; x += step) {
        canvas.drawCircle(Offset(x, y), 1.1, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DotPainter _) => false;
}
