import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../notifications/presentation/widgets/customer_notification_button.dart';
import '../domain/entities/contract.dart';
import 'contracts_cubit.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyCard = Color(0xFF1A3352);
const _navyLight = Color(0xFF243F62);

// ─────────────────────────────────────────────────────────────────────────────
// Contracts Screen
// ─────────────────────────────────────────────────────────────────────────────

class ContractsScreen extends StatefulWidget {
  const ContractsScreen({super.key});

  @override
  State<ContractsScreen> createState() => _ContractsScreenState();
}

class _ContractsScreenState extends State<ContractsScreen> {
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
          Expanded(
            child: BlocBuilder<ContractsCubit, ContractsState>(
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const Center(child: CircularProgressIndicator());
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
                    final contracts = state.data!;
                    return RefreshIndicator(
                      onRefresh: () => context.read<ContractsCubit>().load(),
                      child: ListView.separated(
                        padding: EdgeInsets.fromLTRB(
                          AppSpacing.lg,
                          AppSpacing.lg,
                          AppSpacing.lg,
                          AppSpacing.xl + MediaQuery.of(context).padding.bottom,
                        ),
                        itemCount: contracts.length,
                        separatorBuilder: (_, _) =>
                            const SizedBox(height: AppSpacing.md),
                        itemBuilder: (context, i) =>
                            _ContractCard(contract: contracts[i]),
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

// ── Header ────────────────────────────────────────────────────────────────────

class _ContractsHeader extends StatelessWidget {
  const _ContractsHeader({required this.displayName, required this.l10n});
  final String? displayName;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final topInset = MediaQuery.paddingOf(context).top;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: Container(
        width: double.infinity,
        clipBehavior: Clip.antiAlias,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topRight,
            end: Alignment.bottomLeft,
            colors: [_navyLight, _navyCard, _navyDeep],
            stops: [0.0, 0.45, 1.0],
          ),
          borderRadius: BorderRadius.only(
            bottomLeft: Radius.circular(28),
            bottomRight: Radius.circular(28),
          ),
          boxShadow: [
            BoxShadow(
              color: Color(0x35000000),
              blurRadius: 22,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: Stack(
          children: [
            const Positioned.fill(child: IgnorePointer(child: _DotTexture())),
            PositionedDirectional(
              end: 0,
              top: 0,
              child: Container(
                width: 160,
                height: 130,
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment.topRight,
                    radius: 1.0,
                    colors: [
                      AppPalette.gold400.withValues(alpha: 0.09),
                      AppPalette.gold400.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),
            Positioned(
              bottom: 0,
              left: 48,
              right: 48,
              child: Container(
                height: 1,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      AppPalette.gold400.withValues(alpha: 0.0),
                      AppPalette.gold400.withValues(alpha: 0.5),
                      AppPalette.gold400.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.lg,
                topInset + AppSpacing.md,
                AppSpacing.lg,
                AppSpacing.xl,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  _HeaderBackButton(),
                  const SizedBox(width: AppSpacing.md),
                  // Container(
                  //   width: 44,
                  //   height: 44,
                  //   decoration: BoxDecoration(
                  //     color: Colors.white.withValues(alpha: 0.1),
                  //     borderRadius: BorderRadius.circular(13),
                  //     border: Border.all(
                  //       color: AppPalette.gold400.withValues(alpha: 0.35),
                  //     ),
                  //   ),
                  //   child: const Icon(
                  //     AppIcons.contract,
                  //     color: AppPalette.gold300,
                  //     size: 22,
                  //   ),
                  // ),
                  // const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          l10n.financeContractsDesc,
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: AppPalette.gold300,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.3,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          l10n.accountContracts,
                          style: theme.textTheme.titleLarge?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            height: 1.1,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  const CustomerNotificationButton(size: 42),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HeaderBackButton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.pop(),
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(11),
          border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
        ),
        child: const Icon(
          Icons.arrow_back_ios_new_rounded,
          color: Colors.white,
          size: 16,
        ),
      ),
    );
  }
}

// ── Contract Card ─────────────────────────────────────────────────────────────

class _ContractCard extends StatelessWidget {
  const _ContractCard({required this.contract});
  final Contract contract;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    final signed = contract.status == ContractStatus.signed;
    final projectName = contract.projectName.resolve(lang);

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.45)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.07),
            blurRadius: 20,
            offset: const Offset(0, 5),
          ),
          if (signed)
            BoxShadow(
              color: AppPalette.gold400.withValues(alpha: 0.05),
              blurRadius: 28,
              spreadRadius: 2,
            ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Navy gradient header strip
          _CardStrip(
            left: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Row(
                children: [
                  // Document icon tile
                  Container(
                    width: 50,
                    height: 50,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.25),
                      ),
                    ),
                    child: const Icon(
                      AppIcons.contract,
                      color: AppPalette.gold300,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          contract.contractNumber ?? projectName,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            fontSize: 17,
                            height: 1.1,
                            letterSpacing: -0.2,
                          ),
                        ),
                        if (contract.contractNumber != null) ...[
                          const SizedBox(height: 3),
                          Text(
                            projectName,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.7),
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  // Status pill
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: signed
                          ? const Color(0xFF1B7A50).withValues(alpha: 0.85)
                          : Colors.white.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                        color: signed
                            ? const Color(0xFF4ADE80).withValues(alpha: 0.55)
                            : Colors.white.withValues(alpha: 0.3),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          signed
                              ? Icons.verified_rounded
                              : Icons.pending_outlined,
                          size: 12,
                          color: signed
                              ? const Color(0xFF4ADE80)
                              : Colors.white.withValues(alpha: 0.8),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          signed
                              ? l10n.contractStatusSigned
                              : l10n.contractStatusDraft,
                          style: TextStyle(
                            color: signed
                                ? const Color(0xFF4ADE80)
                                : Colors.white.withValues(alpha: 0.9),
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // ── White body
          Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Unit info row
                Row(
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [_navyLight, _navyDeep],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(11),
                      ),
                      child: const Icon(
                        AppIcons.property,
                        size: 17,
                        color: AppPalette.gold300,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            contract.unitType,
                            style: theme.textTheme.bodyLarge?.copyWith(
                              color: colors.inkStrong,
                              fontWeight: FontWeight.w800,
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
                // Signed date chip
                if (contract.signedAt != null) ...[
                  const SizedBox(height: AppSpacing.md),
                  _InfoChip(
                    icon: AppIcons.calendar,
                    label:
                        '${l10n.myPropertySignedDate}:  '
                        '${DateFormatter.mediumDate(contract.signedAt!, languageCode: lang)}',
                  ),
                ] else if (contract.createdAt != null) ...[
                  const SizedBox(height: AppSpacing.md),
                  _InfoChip(
                    icon: AppIcons.calendar,
                    label: DateFormatter.mediumDate(
                      contract.createdAt!,
                      languageCode: lang,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Shared: card strip ────────────────────────────────────────────────────────

class _CardStrip extends StatelessWidget {
  const _CardStrip({required this.left});
  final Widget left;
  static const double height = 90;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: Stack(
        fit: StackFit.expand,
        children: [
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [_navyLight, _navyDeep],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
          ),
          const IgnorePointer(child: _DotTexture()),
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              height: 1,
              color: AppPalette.gold400.withValues(alpha: 0.3),
            ),
          ),
          left,
        ],
      ),
    );
  }
}

// ── Info chip ─────────────────────────────────────────────────────────────────

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    const accentColor = _navyDeep;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: accentColor.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: accentColor.withValues(alpha: 0.1)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: accentColor.withValues(alpha: 0.75)),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              label,
              style: TextStyle(
                color: accentColor.withValues(alpha: 0.85),
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
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
