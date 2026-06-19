import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../notifications/presentation/widgets/customer_notification_button.dart';
import '../domain/entities/property.dart';
import 'my_property_cubit.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyCard = Color(0xFF1A3352);
const _navyLight = Color(0xFF243F62);

// ─────────────────────────────────────────────────────────────────────────────
// My Property Screen
// ─────────────────────────────────────────────────────────────────────────────

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
    final session = context.watch<SessionCubit>().state;
    final displayName =
        session.sessionOrNull?.displayName ?? session.sessionOrNull?.email;

    return BlocBuilder<MyPropertyCubit, MyPropertyState>(
      builder: (context, state) {
        final l10n = context.l10n;

        final properties =
            state.status == DataStatus.success ? state.data! : const <Property>[];
        final ownedCount =
            properties.where((p) => p.status == PropertyStatus.owned).length;

        return Column(
          children: [
            _MyPropertyHeader(
              displayName: displayName,
              totalCount: properties.length,
              ownedCount: ownedCount,
              showCount: state.status == DataStatus.success,
            ),
            Expanded(
              child: switch (state.status) {
                DataStatus.initial || DataStatus.loading => const _PropertySkeleton(),
                DataStatus.failure => ErrorState(
                    failure: state.failure,
                    onRetry: () => context.read<MyPropertyCubit>().load(),
                  ),
                DataStatus.empty => EmptyState(
                    icon: Icons.home_work_outlined,
                    title: l10n.myPropertyEmptyTitle,
                    message: l10n.myPropertyEmptyMessage,
                  ),
                DataStatus.success => RefreshIndicator(
                    onRefresh: () => context.read<MyPropertyCubit>().load(),
                    child: ListView.builder(
                      padding: EdgeInsets.fromLTRB(
                        AppSpacing.lg,
                        AppSpacing.md,
                        AppSpacing.lg,
                        AppSpacing.lg + MediaQuery.of(context).padding.bottom,
                      ),
                      itemCount: properties.length,
                      itemBuilder: (context, i) => Padding(
                        padding: EdgeInsets.only(
                          bottom: i < properties.length - 1 ? AppSpacing.lg : 0,
                        ),
                        child: GestureDetector(
                          onTap: () => context.push(
                            '/account/property/detail',
                            extra: properties[i],
                          ),
                          child: _PropertyCard(property: properties[i], index: i),
                        ).animate(delay: Duration(milliseconds: 70 * i))
                            .fadeIn(duration: 360.ms)
                            .slideY(
                              begin: 0.06,
                              end: 0,
                              duration: 360.ms,
                              curve: Curves.easeOut,
                            ),
                      ),
                    ),
                  ),
              },
            ),
          ],
        );
      },
    );
  }
}

// ── Premium screen header ─────────────────────────────────────────────────────

class _MyPropertyHeader extends StatelessWidget {
  const _MyPropertyHeader({
    required this.displayName,
    required this.totalCount,
    required this.ownedCount,
    required this.showCount,
  });

  final String? displayName;
  final int totalCount;
  final int ownedCount;
  final bool showCount;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
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
              color: Color(0x33000000),
              blurRadius: 22,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: Stack(
          children: [
            // Dot grid texture
            const Positioned.fill(
              child: IgnorePointer(child: _HeaderDots()),
            ),
            // Radial highlight — soft glow at top-end corner
            PositionedDirectional(
              end: 0,
              top: 0,
              child: Container(
                width: 180,
                height: 140,
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment.topRight,
                    radius: 1.0,
                    colors: [
                      AppPalette.gold400.withValues(alpha: 0.07),
                      AppPalette.gold400.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),
            // Gold shimmer hairline at bottom edge
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
                      AppPalette.gold400.withValues(alpha: 0.55),
                      AppPalette.gold400.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),
            // Content
            Padding(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.lg,
                topInset + AppSpacing.lg,
                AppSpacing.lg,
                AppSpacing.xl,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // START (right in RTL): gold-ring avatar → profile
                  GestureDetector(
                    onTap: () => context.push('/account/profile'),
                    child: _GoldRingAvatar(name: displayName),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  // CENTER: eyebrow + title + portfolio pill
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'محفظتي العقارية',
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: AppPalette.gold300,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.4,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          l10n.accountMyProperty,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.titleLarge?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            height: 1.1,
                          ),
                        ),
                        if (showCount) ...[
                          const SizedBox(height: 8),
                          _PortfolioPill(
                            totalCount: totalCount,
                            ownedCount: ownedCount,
                            l10n: l10n,
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  // END (left in RTL): notification bell
                  const CustomerNotificationButton(size: 44),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GoldRingAvatar extends StatelessWidget {
  const _GoldRingAvatar({required this.name});
  final String? name;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: AppPalette.gold400.withValues(alpha: 0.75),
          width: 2,
        ),
        boxShadow: [
          BoxShadow(
            color: AppPalette.gold400.withValues(alpha: 0.26),
            blurRadius: 14,
            spreadRadius: 1,
          ),
        ],
      ),
      child: GradientAvatar(name: name, size: 48),
    );
  }
}

class _PortfolioPill extends StatelessWidget {
  const _PortfolioPill({
    required this.totalCount,
    required this.ownedCount,
    required this.l10n,
  });

  final int totalCount;
  final int ownedCount;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final pendingCount = totalCount - ownedCount;

    return Wrap(
      spacing: 6,
      runSpacing: 4,
      children: [
        // Gold count pill
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFFC8A24B), AppPalette.gold500],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(999),
            boxShadow: [
              BoxShadow(
                color: AppPalette.gold400.withValues(alpha: 0.28),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Text(
            '$totalCount وحدة',
            style: const TextStyle(
              color: _navyDeep,
              fontSize: 11,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        // Owned chip — only visible when there's a mix of statuses
        if (ownedCount > 0 && pendingCount > 0)
          _StatusMiniChip(
            color: Colors.greenAccent,
            label: l10n.myPropertyStatusOwned,
            count: ownedCount,
          ),
        if (pendingCount > 0 && ownedCount > 0)
          _StatusMiniChip(
            color: Colors.amber,
            label: l10n.myPropertyStatusReserved,
            count: pendingCount,
          ),
      ],
    );
  }
}

class _StatusMiniChip extends StatelessWidget {
  const _StatusMiniChip({
    required this.color,
    required this.label,
    required this.count,
  });

  final Color color;
  final String label;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 5,
            height: 5,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 4),
          Text(
            '$count $label',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.78),
              fontSize: 10.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

class _PropertySkeleton extends StatelessWidget {
  const _PropertySkeleton();

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return AppSkeletonizer(
      enabled: true,
      child: ListView.separated(
        padding: const EdgeInsets.all(AppSpacing.lg),
        itemCount: 2,
        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.lg),
        itemBuilder: (_, _) => Container(
          height: 270,
          decoration: BoxDecoration(
            color: colors.surfaceSoft,
            borderRadius: BorderRadius.circular(20),
          ),
        ),
      ),
    );
  }
}

// ── Property card ─────────────────────────────────────────────────────────────

class _PropertyCard extends StatelessWidget {
  const _PropertyCard({required this.property, required this.index});

  final Property property;
  final int index;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final owned = property.status == PropertyStatus.owned;

    final stats = <_Stat>[
      if (property.contractNumber != null)
        _Stat(l10n.myPropertyContractNumber, property.contractNumber!),
      if (property.signedAt != null)
        _Stat(
          l10n.myPropertySignedDate,
          DateFormatter.mediumDate(property.signedAt!, languageCode: lang),
        ),
    ];

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.45)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 22,
            offset: const Offset(0, 6),
          ),
          if (owned)
            BoxShadow(
              color: AppPalette.gold400.withValues(alpha: 0.07),
              blurRadius: 28,
              spreadRadius: 2,
              offset: const Offset(0, 4),
            ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _CardHeader(
            projectName: property.projectName.resolve(lang),
            unitType: property.unitType,
            unitCode: property.unitCode,
            owned: owned,
            index: index,
            l10n: l10n,
          ),
          if (stats.isNotEmpty) _StatsBlock(stats: stats, colors: colors),
          if (property.hasInstallmentPlan)
            _InstallmentBanner(property: property, lang: lang, l10n: l10n),
          _ActionRow(property: property, l10n: l10n),
        ],
      ),
    );
  }
}

// ── Card header ───────────────────────────────────────────────────────────────

class _CardHeader extends StatelessWidget {
  const _CardHeader({
    required this.projectName,
    required this.unitType,
    required this.unitCode,
    required this.owned,
    required this.index,
    required this.l10n,
  });

  final String projectName;
  final String unitType;
  final String unitCode;
  final bool owned;
  final int index;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final indexStr = (index + 1).toString().padLeft(2, '0');

    return SizedBox(
      height: 108,
      child: Stack(
        fit: StackFit.expand,
        children: [
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [_navyLight, _navyCard, _navyDeep],
                stops: [0.0, 0.48, 1.0],
              ),
            ),
          ),
          const IgnorePointer(child: _HeaderDots()),
          // Decorative ordinal number
          PositionedDirectional(
            end: AppSpacing.md,
            bottom: -10,
            child: Opacity(
              opacity: 0.055,
              child: Text(
                indexStr,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 76,
                  fontWeight: FontWeight.w900,
                  height: 1.0,
                ),
              ),
            ),
          ),
          // Decorative icon behind content
          PositionedDirectional(
            end: 52,
            top: 8,
            bottom: 8,
            child: Icon(
              AppIcons.property,
              size: 64,
              color: Colors.white.withValues(alpha: 0.045),
            ),
          ),
          // Gold hairline at bottom edge
          Positioned(
            bottom: 0,
            left: 32,
            right: 32,
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
          // Content
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.md,
              AppSpacing.lg,
              AppSpacing.md,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Gold-tinted icon tile
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: AppPalette.gold400.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: AppPalette.gold400.withValues(alpha: 0.35),
                    ),
                  ),
                  child: const Icon(
                    Icons.domain_rounded,
                    color: AppPalette.gold400,
                    size: 26,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        projectName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 16,
                          height: 1.2,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '$unitType · $unitCode',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.55),
                          fontSize: 12,
                          letterSpacing: 0.3,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                _StatusPill(owned: owned, l10n: l10n),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.owned, required this.l10n});
  final bool owned;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final dotColor = owned ? Colors.greenAccent : Colors.amber;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: (owned ? Colors.green : Colors.amber).withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: dotColor.withValues(alpha: 0.45)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
          ),
          const SizedBox(width: 5),
          Text(
            owned
                ? l10n.myPropertyStatusOwned
                : l10n.myPropertyStatusReserved,
            style: TextStyle(
              color: dotColor,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Stats block ───────────────────────────────────────────────────────────────

class _StatsBlock extends StatelessWidget {
  const _StatsBlock({required this.stats, required this.colors});
  final List<_Stat> stats;
  final AppColorsExt colors;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.xs,
      ),
      child: Column(
        children: [
          for (var i = 0; i < stats.length; i++) ...[
            if (i > 0) Divider(height: 1, color: colors.hairline),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
              child: Row(
                children: [
                  Text(
                    stats[i].label,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: colors.inkMuted,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    stats[i].value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: colors.inkStrong,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Stat {
  const _Stat(this.label, this.value);
  final String label;
  final String value;
}

// ── Installment banner ────────────────────────────────────────────────────────

class _InstallmentBanner extends StatelessWidget {
  const _InstallmentBanner({
    required this.property,
    required this.lang,
    required this.l10n,
  });

  final Property property;
  final String lang;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        0,
        AppSpacing.lg,
        AppSpacing.sm,
      ),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm + 1,
      ),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppPalette.gold400.withValues(alpha: 0.09),
            AppPalette.gold400.withValues(alpha: 0.04),
          ],
          begin: Alignment.centerRight,
          end: Alignment.centerLeft,
        ),
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(
          color: AppPalette.gold400.withValues(alpha: 0.28),
          width: 0.75,
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: AppPalette.gold400.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(
              Icons.calendar_month_rounded,
              size: 15,
              color: AppPalette.gold500,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              l10n.myPropertyInstallmentPlan,
              style: TextStyle(
                color: AppPalette.gold500.withValues(alpha: 0.8),
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Text(
            l10n.myPropertyInstallmentSummary(
              PriceFormatter.formatString(
                property.monthlyAmount,
                languageCode: lang,
              ),
              property.totalMonths!,
            ),
            style: const TextStyle(
              color: AppPalette.gold500,
              fontSize: 12,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Action row ────────────────────────────────────────────────────────────────

class _ActionRow extends StatelessWidget {
  const _ActionRow({required this.property, required this.l10n});
  final Property property;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: colors.hairline)),
      ),
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Row(
        children: [
          Expanded(
            child: _ActionButton(
              icon: AppIcons.contract,
              label: l10n.accountContracts,
              navy: false,
              onTap: () => context.push('/account/contracts'),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: _ActionButton(
              icon: AppIcons.maintenance,
              label: l10n.myPropertyRequestMaintenance,
              navy: true,
              onTap: () => context.push(
                '/account/maintenance/new',
                extra: {'unitId': property.unitId},
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.icon,
    required this.label,
    required this.navy,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool navy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Material(
      color: navy ? _navyDeep : Colors.transparent,
      borderRadius: BorderRadius.circular(AppRadii.lg),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Container(
          height: 44,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadii.lg),
            border: navy
                ? null
                : Border.all(color: colors.hairline.withValues(alpha: 0.8)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 17,
                color: navy ? AppPalette.gold400 : colors.inkStrong,
              ),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: navy ? Colors.white : colors.inkStrong,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Dot texture ───────────────────────────────────────────────────────────────

class _HeaderDots extends StatelessWidget {
  const _HeaderDots();
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
