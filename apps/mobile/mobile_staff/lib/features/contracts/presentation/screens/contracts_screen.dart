import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/staff_contract.dart';
import '../cubit/contracts_cubit.dart';

class ContractsScreen extends StatefulWidget {
  const ContractsScreen({super.key});

  @override
  State<ContractsScreen> createState() => _ContractsScreenState();
}

class _ContractsScreenState extends State<ContractsScreen> {
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<ContractsCubit>().load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<ContractsCubit>();
    final bottomPad = MediaQuery.paddingOf(context).bottom;

    return Scaffold(
      body: Column(
        children: [
          AppNavHeader(
            title: l10n.navContracts,
            compact: true,
            leadingAction: NavHeaderAction(
              icon: Icons.arrow_back_ios_new_rounded,
              onTap: () => context.pop(),
            ),
            bottom: _NavSearchBar(
              controller: _search,
              hint: l10n.contractsSearchHint,
              onChanged: cubit.setSearch,
              onClear: () { _search.clear(); cubit.setSearch(''); },
            ),
          ),
          _StatusFilter(),
          Expanded(
            child: BlocBuilder<ContractsCubit, ContractsListState>(
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const StaffListSkeleton();
                  case DataStatus.failure:
                    return ErrorState(failure: state.failure, onRetry: cubit.load);
                  case DataStatus.empty:
                    return EmptyState(
                      icon: Icons.description_outlined,
                      title: l10n.contractsEmptyTitle,
                      message: l10n.contractsEmptyMessage,
                    );
                  case DataStatus.success:
                    return RefreshIndicator(
                      onRefresh: cubit.load,
                      child: ListView.separated(
                        padding: EdgeInsets.fromLTRB(
                          AppSpacing.md,
                          AppSpacing.sm,
                          AppSpacing.md,
                          bottomPad + 100,
                        ),
                        itemCount: state.contracts.length,
                        separatorBuilder: (_, i) =>
                            const SizedBox(height: AppSpacing.sm),
                        itemBuilder: (context, i) =>
                            _ContractTile(contract: state.contracts[i]),
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

// ── Nav search bar — white pill, matches clients screen ───────────────────────

class _NavSearchBar extends StatefulWidget {
  const _NavSearchBar({
    required this.controller,
    required this.hint,
    required this.onChanged,
    required this.onClear,
  });
  final TextEditingController controller;
  final String hint;
  final ValueChanged<String> onChanged;
  final VoidCallback onClear;

  @override
  State<_NavSearchBar> createState() => _NavSearchBarState();
}

class _NavSearchBarState extends State<_NavSearchBar> {
  bool _hasText = false;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(
        () => setState(() => _hasText = widget.controller.text.isNotEmpty));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Container(
      height: 46,
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadii.pillAll,
        border: Border.all(color: colors.hairline),
        boxShadow: colors.shadowSoft,
      ),
      child: Row(
        children: [
          const SizedBox(width: AppSpacing.md),
          Icon(Icons.search_rounded, size: 20, color: colors.inkMuted),
          const SizedBox(width: AppSpacing.xs),
          Expanded(
            child: TextField(
              controller: widget.controller,
              onChanged: widget.onChanged,
              textInputAction: TextInputAction.search,
              style: theme.textTheme.bodyMedium,
              decoration: InputDecoration(
                isDense: true,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                contentPadding: EdgeInsets.zero,
                hintText: widget.hint,
                hintStyle: theme.textTheme.bodyMedium
                    ?.copyWith(color: colors.inkMuted),
              ),
            ),
          ),
          if (_hasText)
            IconButton(
              visualDensity: VisualDensity.compact,
              icon: Icon(Icons.close_rounded, size: 18, color: colors.inkMuted),
              onPressed: widget.onClear,
            ),
          const SizedBox(width: AppSpacing.xs),
        ],
      ),
    );
  }
}

// ── Status filter bar ─────────────────────────────────────────────────────────

const _kContractDotColors = <String, Color>{
  'SIGNED': Color(0xFF22C55E),  // green
  'DRAFT': Color(0xFF9CA3AF),   // muted
};

class _StatusFilter extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<ContractsCubit>();
    final colors = context.appColors;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(bottom: BorderSide(color: colors.hairline, width: 0.5)),
      ),
      child: BlocBuilder<ContractsCubit, ContractsListState>(
        buildWhen: (a, b) => a.statusFilter != b.statusFilter,
        builder: (context, state) => SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg,
            vertical: 6,
          ),
          child: Row(
            children: [
              _StatusChip(
                label: l10n.leadsFilterAll,
                active: state.statusFilter == null,
                onTap: () => cubit.setStatus(null),
              ),
              const SizedBox(width: AppSpacing.xs),
              _StatusChip(
                label: l10n.contractStatusSigned,
                active: state.statusFilter == 'SIGNED',
                dotColor: _kContractDotColors['SIGNED'],
                onTap: () => cubit.setStatus('SIGNED'),
              ),
              const SizedBox(width: AppSpacing.xs),
              _StatusChip(
                label: l10n.contractStatusDraft,
                active: state.statusFilter == 'DRAFT',
                dotColor: _kContractDotColors['DRAFT'],
                onTap: () => cubit.setStatus('DRAFT'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({
    required this.label,
    required this.active,
    required this.onTap,
    this.dotColor,
  });
  final String label;
  final bool active;
  final VoidCallback onTap;
  final Color? dotColor;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm + 4,
          vertical: 11,
        ),
        decoration: BoxDecoration(
          color: active ? colors.brandNavy : colors.surface,
          borderRadius: AppRadii.pillAll,
          border: Border.all(
            color: active ? colors.brandNavy : colors.hairline,
            width: active ? 0 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (!active && dotColor != null) ...[
              Container(
                width: 6,
                height: 6,
                decoration:
                    BoxDecoration(color: dotColor, shape: BoxShape.circle),
              ),
              const SizedBox(width: AppSpacing.xxs + 2),
            ],
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: active ? FontWeight.w700 : FontWeight.w600,
                color: active ? Colors.white : colors.inkStrong,
                height: 1.2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Contract tile ─────────────────────────────────────────────────────────────

class _ContractTile extends StatefulWidget {
  const _ContractTile({required this.contract});
  final StaffContract contract;

  @override
  State<_ContractTile> createState() => _ContractTileState();
}

class _ContractTileState extends State<_ContractTile> {
  bool _pressed = false;
  StaffContract get c => widget.contract;

  Color _statusColor(AppColorsExt colors) => c.status == StaffContractStatus.signed
      ? colors.success
      : colors.inkMuted;

  IconData get _statusIcon => c.status == StaffContractStatus.signed
      ? Icons.verified_rounded
      : Icons.edit_document;

  String _statusLabel(AppLocalizations l10n) =>
      c.status == StaffContractStatus.signed
          ? l10n.contractStatusSigned
          : l10n.contractStatusDraft;

  BadgeTone get _tone => c.status == StaffContractStatus.signed
      ? BadgeTone.success
      : BadgeTone.neutral;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final isRtl = context.read<LocaleCubit>().isRtl;
    final accent = _statusColor(colors);

    final primaryLabel = c.contractNumber ?? c.customerName ?? l10n.navContracts;
    final hasCustomer = c.customerName != null && c.contractNumber != null;
    final hasUnit = c.unitCode != null;
    final hasProject = c.projectName != null;
    final hasDate = c.signedAt != null || c.createdAt != null;
    final dateValue = c.signedAt ?? c.createdAt;

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: () => context.push('/contracts/${c.id}', extra: c),
      child: AnimatedScale(
        scale: _pressed ? 0.975 : 1.0,
        duration: const Duration(milliseconds: 110),
        curve: Curves.easeOutCubic,
        child: Container(
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: AppRadii.card,
            border: Border.all(
              color: accent.withValues(alpha: 0.16),
              width: 0.9,
            ),
            boxShadow: [
              BoxShadow(
                color: accent.withValues(alpha: 0.08),
                blurRadius: 20,
                offset: const Offset(0, 6),
              ),
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 6,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Status accent strip ────────────────────────────────────
              Container(
                height: 3,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: isRtl ? Alignment.centerRight : Alignment.centerLeft,
                    end: isRtl ? Alignment.centerLeft : Alignment.centerRight,
                    colors: [accent, accent.withValues(alpha: 0.0)],
                  ),
                ),
              ),
              // ── Card body ──────────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.fromLTRB(
                    AppSpacing.md, 13, AppSpacing.md, 13),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ── Main row: icon · content · badge · chevron ─────
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        // Status icon circle
                        Container(
                          width: 46,
                          height: 46,
                          decoration: BoxDecoration(
                            color: accent.withValues(alpha: 0.10),
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: accent.withValues(alpha: 0.28),
                              width: 1.2,
                            ),
                          ),
                          child:
                              Icon(_statusIcon, color: accent, size: 22),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        // Contract number + customer
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                primaryLabel,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 15.5,
                                  fontWeight: FontWeight.w700,
                                  color: colors.inkStrong,
                                  height: 1.2,
                                  letterSpacing: -0.2,
                                ),
                              ),
                              if (hasCustomer) ...[
                                const SizedBox(height: 3),
                                Row(
                                  children: [
                                    Icon(Icons.person_outline_rounded,
                                        size: 11, color: colors.inkMuted),
                                    const SizedBox(width: 3),
                                    Expanded(
                                      child: Text(
                                        c.customerName!,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: colors.inkMuted,
                                          height: 1.3,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ] else if (hasProject) ...[
                                const SizedBox(height: 3),
                                Row(
                                  children: [
                                    Icon(Icons.apartment_rounded,
                                        size: 11, color: colors.inkMuted),
                                    const SizedBox(width: 3),
                                    Expanded(
                                      child: Text(
                                        c.projectName!.resolve(lang),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: colors.inkMuted,
                                          height: 1.3,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        // Badge + chevron
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            StatusBadge(
                              label: _statusLabel(l10n),
                              tone: _tone,
                            ),
                            const SizedBox(height: 4),
                            Icon(
                              Icons.chevron_right_rounded,
                              size: 16,
                              color: colors.inkMuted.withValues(alpha: 0.5),
                            ),
                          ],
                        ),
                      ],
                    ),
                    // ── Info chips ─────────────────────────────────────
                    if (hasDate || hasUnit) ...[
                      const SizedBox(height: 10),
                      Container(height: 0.5, color: colors.hairline),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          if (hasDate)
                            _InfoChip(
                              icon: c.signedAt != null
                                  ? Icons.verified_outlined
                                  : Icons.calendar_today_rounded,
                              label: DateFormatter.shortDate(
                                dateValue!,
                                languageCode: lang,
                              ),
                              color: c.signedAt != null
                                  ? colors.success
                                  : colors.brandNavy,
                            ),
                          if (hasDate && hasUnit) const SizedBox(width: 6),
                          if (hasUnit)
                            _InfoChip(
                              icon: Icons.apartment_rounded,
                              label: c.unitCode!,
                              color: colors.brandGold,
                            ),
                          if (hasProject && hasCustomer) ...[
                            const SizedBox(width: 6),
                            Expanded(
                              child: _InfoChip(
                                icon: Icons.location_city_rounded,
                                label: c.projectName!.resolve(lang),
                                color: colors.inkMuted,
                                expand: true,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Info chip ─────────────────────────────────────────────────────────────────

class _InfoChip extends StatelessWidget {
  const _InfoChip({
    required this.icon,
    required this.label,
    required this.color,
    this.expand = false,
  });
  final IconData icon;
  final String label;
  final Color color;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.07),
        border: Border.all(color: color.withValues(alpha: 0.20)),
        borderRadius: AppRadii.pillAll,
      ),
      child: Row(
        mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color.withValues(alpha: 0.80)),
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: color,
                height: 1.2,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
