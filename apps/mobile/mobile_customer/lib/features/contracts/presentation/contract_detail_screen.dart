import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../documents/presentation/widgets/documents_list_view.dart';
import '../domain/entities/contract.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyLight = Color(0xFF243F62);

// ─────────────────────────────────────────────────────────────────────────────
// Contract Detail Screen
// ─────────────────────────────────────────────────────────────────────────────

class ContractDetailScreen extends StatelessWidget {
  const ContractDetailScreen({super.key, required this.contract});

  final Contract contract;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    final signed = contract.status == ContractStatus.signed;
    final projectName = contract.projectName.resolve(lang);

    return Scaffold(
      backgroundColor: colors.canvas,
      body: Column(
        children: [
          // ── Premium header ───────────────────────────────────────────────
          _DetailHeader(
            contractNumber: contract.contractNumber,
            projectName: projectName,
            signed: signed,
            l10n: l10n,
          ),

          // ── Body ─────────────────────────────────────────────────────────
          Expanded(
            child: ListView(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.md,
                AppSpacing.lg,
                AppSpacing.xl + MediaQuery.of(context).padding.bottom,
              ),
              children: [
                // ── Summary card
                _SummaryCard(
                  contract: contract,
                  lang: lang,
                  l10n: l10n,
                  colors: colors,
                  theme: theme,
                  signed: signed,
                ),
                const SizedBox(height: AppSpacing.lg),

                // ── Documents section header
                Row(
                  children: [
                    Container(
                      width: 3,
                      height: 18,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [AppPalette.gold400, AppPalette.gold300],
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                        ),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Text(
                      l10n.contractsDocumentsTitle,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: colors.inkStrong,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),

                // ── Documents list (provided by route via _documentsProviders)
                const DocumentsListView(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Detail header ─────────────────────────────────────────────────────────────

class _DetailHeader extends StatelessWidget {
  const _DetailHeader({
    required this.contractNumber,
    required this.projectName,
    required this.signed,
    required this.l10n,
  });

  final String? contractNumber;
  final String projectName;
  final bool signed;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return AppNavHeader(
      title: contractNumber != null ? ltr(contractNumber) : l10n.accountContracts,
      subtitle: projectName,
      compact: true,
      leadingAction: const NavHeaderBack(),
      actions: [
        NavHeaderPill(
          label: signed ? l10n.contractStatusSigned : l10n.contractStatusDraft,
          color: signed ? const Color(0xFF34D399) : null,
        ),
      ],
    );
  }
}

// ── Summary card ──────────────────────────────────────────────────────────────

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.contract,
    required this.lang,
    required this.l10n,
    required this.colors,
    required this.theme,
    required this.signed,
  });

  final Contract contract;
  final String lang;
  final AppLocalizations l10n;
  final AppColorsExt colors;
  final ThemeData theme;
  final bool signed;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.45)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 18,
            offset: const Offset(0, 4),
          ),
          if (signed)
            BoxShadow(
              color: AppPalette.gold400.withValues(alpha: 0.06),
              blurRadius: 24,
              spreadRadius: 2,
            ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Unit row
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [_navyLight, _navyDeep],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(13),
                    boxShadow: [
                      BoxShadow(
                        color: AppPalette.gold300.withValues(alpha: 0.2),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: const Icon(
                    AppIcons.property,
                    size: 20,
                    color: AppPalette.gold300,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        unitTypeLabel(contract.unitType, languageCode: Localizations.localeOf(context).languageCode),
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: colors.inkStrong,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        contract.unitCode,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: colors.inkMuted,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (contract.signedAt != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Divider(height: 1, color: colors.hairline),
              const SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  Icon(
                    AppIcons.calendar,
                    size: 14,
                    color: colors.inkMuted,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    '${l10n.myPropertySignedDate}: ',
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: colors.inkMuted),
                  ),
                  Expanded(
                    child: Text(
                      DateFormatter.mediumDate(
                        contract.signedAt!,
                        languageCode: lang,
                      ),
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: colors.inkStrong,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.xs),
              Row(
                children: [
                  Icon(AppIcons.calendar, size: 14, color: colors.inkMuted),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      contract.handedOverAt != null
                          ? '${l10n.myPropertyHandedOverDate}: '
                              '${DateFormatter.mediumDate(contract.handedOverAt!, languageCode: lang)}'
                          : l10n.myPropertyNotHandedOver,
                      style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted),
                    ),
                  ),
                ],
              ),
            ],
            // F10 — until the handover: the date the contract promised and,
            // when it slipped, the one expected now.
            if (contract.handedOverAt == null && contract.deliveryDate != null) ...[
              const SizedBox(height: AppSpacing.xs),
              Row(
                key: const ValueKey('contract-delivery-promised'),
                children: [
                  Icon(Icons.key_rounded, size: 14, color: colors.inkMuted),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      '${l10n.contractDeliveryPromised}: '
                      '${DateFormatter.mediumDate(contract.deliveryDate!, languageCode: lang)}',
                      style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted),
                    ),
                  ),
                ],
              ),
              if (contract.deliveryDelayDays > 0 && contract.expectedDeliveryDate != null) ...[
                const SizedBox(height: AppSpacing.xs),
                Row(
                  key: const ValueKey('contract-delivery-late'),
                  children: [
                    const Icon(Icons.schedule_rounded, size: 14, color: Color(0xFFB45309)),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        '${l10n.contractDeliveryExpected}: '
                        '${DateFormatter.mediumDate(contract.expectedDeliveryDate!, languageCode: lang)}'
                        ' · ${l10n.contractDeliveryLate(contract.deliveryDelayDays)}',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: const Color(0xFFB45309),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

// ── Shared ────────────────────────────────────────────────────────────────────

