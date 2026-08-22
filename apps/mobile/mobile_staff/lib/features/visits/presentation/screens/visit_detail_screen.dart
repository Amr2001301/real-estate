import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/visit_status_label.dart';
import '../../domain/entities/visit.dart';
import '../cubit/visit_detail_cubit.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyMid  = Color(0xFF14273F);

// ══════════════════════════════════════════════════════════════════════════════
// Root screen
// ══════════════════════════════════════════════════════════════════════════════
class VisitDetailScreen extends StatefulWidget {
  const VisitDetailScreen({super.key, this.fallback});
  final Visit? fallback;

  @override
  State<VisitDetailScreen> createState() => _VisitDetailScreenState();
}

class _VisitDetailScreenState extends State<VisitDetailScreen> {
  @override
  void initState() {
    super.initState();
    context.read<VisitDetailCubit>().load();
  }

  // ── Action helpers ─────────────────────────────────────────────────────────

  Future<void> _apply(VisitTransition t) async {
    final cubit = context.read<VisitDetailCubit>();
    if (t == VisitTransition.cancel || t == VisitTransition.noShow) {
      final reason = await _askReason();
      if (reason == null) return;
      await cubit.apply(t, reason: reason.isEmpty ? null : reason);
    } else {
      await cubit.apply(t);
    }
  }

  Future<String?> _askReason() async {
    final l10n = context.l10n;
    final ctrl = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.visitReasonTitle),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          decoration: InputDecoration(hintText: l10n.visitReasonHint),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(l10n.actionCancel)),
          TextButton(
              onPressed: () => Navigator.pop(ctx, ctrl.text),
              child: Text(l10n.actionContinue)),
        ],
      ),
    );
    ctrl.dispose();
    return result;
  }

  Future<void> _doReschedule() async {
    final l10n = context.l10n;
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 1)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked == null || !mounted) return;
    final time = await showTimePicker(
        context: context, initialTime: TimeOfDay.now());
    if (time == null || !mounted) return;
    final scheduledAt = DateTime(
        picked.year, picked.month, picked.day, time.hour, time.minute);
    await context.read<VisitDetailCubit>().reschedule(scheduledAt);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.visitRescheduleSuccess)));
    }
  }

  Future<void> _doReassign() async {
    final l10n = context.l10n;
    final ctrl = TextEditingController();
    final salesId = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.visitReassign),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          decoration: InputDecoration(hintText: l10n.visitReassignSalesHint),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(l10n.actionCancel)),
          TextButton(
            onPressed: () {
              if (ctrl.text.trim().isNotEmpty) {
                Navigator.pop(ctx, ctrl.text.trim());
              }
            },
            child: Text(l10n.actionContinue),
          ),
        ],
      ),
    );
    ctrl.dispose();
    if (salesId == null || !mounted) return;
    await context.read<VisitDetailCubit>().assign(salesId);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.visitReassignSuccess)));
    }
  }

  Future<void> _doFeedback() async {
    final l10n = context.l10n;
    int? selectedRating;
    final notesCtrl = TextEditingController();

    final submitted = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModal) {
          final colors = ctx.appColors;
          return Padding(
            padding: EdgeInsets.only(
                bottom: MediaQuery.viewInsetsOf(ctx).bottom),
            child: Container(
              decoration: BoxDecoration(
                color: colors.surface,
                borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(28)),
              ),
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 36),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: colors.hairline,
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    l10n.visitSalesFeedback,
                    style: Theme.of(ctx).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: colors.inkStrong,
                        ),
                  ),
                  const SizedBox(height: 24),
                  Center(
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: List.generate(5, (i) {
                        final filled =
                            selectedRating != null && i < selectedRating!;
                        return GestureDetector(
                          onTap: () =>
                              setModal(() => selectedRating = i + 1),
                          child: Padding(
                            padding:
                                const EdgeInsets.symmetric(horizontal: 6),
                            child: Icon(
                              filled
                                  ? Icons.star_rounded
                                  : Icons.star_border_rounded,
                              size: 44,
                              color: filled
                                  ? AppPalette.gold400
                                  : colors.hairline,
                            ),
                          ),
                        );
                      }),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Container(
                    decoration: BoxDecoration(
                      color: colors.surfaceSoft,
                      borderRadius: BorderRadius.circular(AppRadii.lg),
                      border: Border.all(color: colors.hairline),
                    ),
                    child: TextField(
                      controller: notesCtrl,
                      maxLines: 4,
                      decoration: InputDecoration(
                        hintText: l10n.visitFeedbackNotes,
                        hintStyle: TextStyle(
                            color: colors.inkMuted, fontSize: 14),
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.all(16),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  AppButton(
                    label: l10n.visitFeedbackSubmit,
                    variant: AppButtonVariant.gold,
                    size: AppButtonSize.large,
                    expand: true,
                    onPressed: () => Navigator.pop(ctx, true),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );

    final notes = notesCtrl.text.trim();
    notesCtrl.dispose();
    if (submitted != true || !mounted) return;
    await context.read<VisitDetailCubit>().submitFeedback(
          rating: selectedRating,
          notes: notes.isEmpty ? null : notes,
        );
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.visitFeedbackSuccess)));
    }
  }

  String _transitionLabel(AppLocalizations l10n, VisitTransition t) =>
      switch (t) {
        VisitTransition.confirm  => l10n.visitActionConfirm,
        VisitTransition.complete => l10n.visitActionComplete,
        VisitTransition.cancel   => l10n.visitActionCancel,
        VisitTransition.noShow   => l10n.visitActionNoShow,
      };

  static String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: BlocConsumer<VisitDetailCubit, VisitDetailState>(
          listenWhen: (a, b) =>
              a.actionFailure != b.actionFailure &&
              b.actionFailure != null,
          listener: (context, state) =>
              showFailureSnackBar(context, state.actionFailure!),
          builder: (context, state) {
            final l10n      = context.l10n;
            final lang      = Localizations.localeOf(context).languageCode;
            final colors    = context.appColors;
            final topInset  = MediaQuery.paddingOf(context).top;

            Widget scrollBody;
            if (state.status == DataStatus.initial ||
                state.status == DataStatus.loading) {
              scrollBody = _buildLoadingBody(topInset);
            } else if (state.status == DataStatus.failure) {
              scrollBody = _buildErrorBody(topInset, state);
            } else {
              scrollBody = _buildSuccessBody(
                  context, state, l10n, lang, colors, topInset);
            }

            return Stack(
              children: [
                scrollBody,
                // Back button — start edge: right in RTL, left in LTR
                PositionedDirectional(
                  top: topInset + 10,
                  start: 14,
                  child: _CircleBackButton(onTap: () => context.pop()),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildLoadingBody(double topInset) => CustomScrollView(
        physics: const NeverScrollableScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(
            child: _HeroShell(
              topInset: topInset,
              child: const Center(
                child: CircularProgressIndicator(color: AppPalette.gold400),
              ),
            ),
          ),
        ],
      );

  Widget _buildErrorBody(double topInset, VisitDetailState state) =>
      CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: _HeroShell(
              topInset: topInset,
              child: Center(
                child: ErrorState(
                  failure: state.failure,
                  onRetry: () => context.read<VisitDetailCubit>().load(),
                ),
              ),
            ),
          ),
        ],
      );

  Widget _buildSuccessBody(
    BuildContext context,
    VisitDetailState state,
    AppLocalizations l10n,
    String lang,
    AppColorsExt colors,
    double topInset,
  ) {
    final detail      = state.detail!;
    final v           = detail.visit;
    final allowed     = allowedVisitTransitions(v);
    final isAdmin     =
        context.read<SessionCubit>().state.role == AppRole.admin;
    final isActive    =
        !const {'COMPLETED', 'CANCELLED', 'NO_SHOW'}.contains(v.status);
    final isCompleted = v.status == 'COMPLETED';

    final hasRequestCtx = v.requestPreferredDate != null ||
        (v.requestPreferredTime?.isNotEmpty ?? false) ||
        (v.requestNotes?.isNotEmpty ?? false);

    return CustomScrollView(
      physics: const BouncingScrollPhysics(
          parent: AlwaysScrollableScrollPhysics()),
      slivers: [
        SliverToBoxAdapter(
          child: _HeroCard(
            visit: v,
            initials: _initials(v.clientName ?? ''),
            topInset: topInset,
            l10n: l10n,
            lang: lang,
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg, AppSpacing.xl, AppSpacing.lg, 80),
          sliver: SliverList.list(children: [
            if (hasRequestCtx) ...[
              _CustomerRequestCard(v: v, l10n: l10n, lang: lang),
              const SizedBox(height: AppSpacing.lg),
            ],
            if (v.status == 'PENDING_RESCHEDULE' &&
                v.customerFeedback?.isNotEmpty == true) ...[
              _InfoCard(
                icon: Icons.schedule_rounded,
                title: l10n.customerRescheduleReasonLabel,
                body: v.customerFeedback!,
              ),
              const SizedBox(height: AppSpacing.lg),
            ],
            if (allowed.isNotEmpty) ...[
              _SectionLabel(l10n.visitUpdateStatus),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: allowed
                    .map((t) => AppButton(
                          label: _transitionLabel(l10n, t),
                          size: AppButtonSize.medium,
                          variant: (t == VisitTransition.complete ||
                                  t == VisitTransition.confirm)
                              ? AppButtonVariant.gold
                              : AppButtonVariant.outline,
                          onPressed: state.working
                              ? null
                              : () => _apply(t),
                        ))
                    .toList(),
              ),
              const SizedBox(height: AppSpacing.lg),
            ],
            if (isActive || isAdmin) ...[
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  if (isActive)
                    _GlassChip(
                      icon: Icons.calendar_today_outlined,
                      label: l10n.visitReschedule,
                      onTap: state.working ? null : _doReschedule,
                    ),
                  if (isAdmin)
                    _GlassChip(
                      icon: Icons.swap_horiz_rounded,
                      label: l10n.visitReassign,
                      onTap: state.working ? null : _doReassign,
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
            ],
            if (isCompleted) ...[
              _FeedbackTile(
                l10n: l10n,
                onTap: state.working ? null : _doFeedback,
              ),
              const SizedBox(height: AppSpacing.lg),
            ],
            if (detail.salesNotes?.isNotEmpty == true) ...[
              _InfoCard(
                icon: Icons.sticky_note_2_outlined,
                title: l10n.visitNotes,
                body: detail.salesNotes!,
              ),
              const SizedBox(height: AppSpacing.lg),
            ],
            _SectionLabel(l10n.leadTimeline),
            const SizedBox(height: AppSpacing.md),
            if (detail.timeline.isEmpty)
              Text(
                l10n.leadTimelineEmpty,
                style: TextStyle(fontSize: 14, color: colors.inkMuted),
              )
            else
              _Timeline(
                  entries: detail.timeline, lang: lang, l10n: l10n),
          ]),
        ),
      ],
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Hero card — full-bleed navy gradient, no SliverAppBar needed
// ══════════════════════════════════════════════════════════════════════════════
class _HeroCard extends StatelessWidget {
  const _HeroCard({
    required this.visit,
    required this.initials,
    required this.topInset,
    required this.l10n,
    required this.lang,
  });

  final Visit visit;
  final String initials;
  final double topInset;
  final AppLocalizations l10n;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final v = visit;

    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1A3255), _navyMid, _navyDeep],
          stops: [0.0, 0.45, 1.0],
        ),
      ),
      child: Stack(
        children: [
          // Gold radial bloom — top-right accent
          Positioned(
            top: -50,
            right: -50,
            child: Container(
              width: 200,
              height: 200,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppPalette.gold400.withValues(alpha: 0.14),
                    AppPalette.gold400.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),

          // Bottom gold shimmer line
          const Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            height: 1,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Color(0x00B8941F),
                    AppPalette.gold400,
                    Color(0x00B8941F),
                  ],
                ),
              ),
            ),
          ),

          // Content
          Padding(
            // top padding: status bar height + toolbar-sized gap for back btn
            padding: EdgeInsets.fromLTRB(
              AppSpacing.lg,
              topInset + 56, // enough room for the back button overlay
              AppSpacing.lg,
              AppSpacing.xl,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // ── Avatar ────────────────────────────────────────────────────
                Container(
                  width: 76,
                  height: 76,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: const LinearGradient(
                      colors: [AppPalette.gold300, AppPalette.gold500],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: AppPalette.gold400.withValues(alpha: 0.55),
                        blurRadius: 28,
                        offset: const Offset(0, 10),
                      ),
                    ],
                  ),
                  child: Center(
                    child: Text(
                      initials,
                      style: const TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                        letterSpacing: 1.5,
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 16),

                // ── Status badge ─────────────────────────────────────────────
                _StatusPill(
                  label: visitStatusLabel(l10n, v.status),
                  tone: visitStatusTone(v.status),
                ),

                const SizedBox(height: 14),

                // ── Client name ───────────────────────────────────────────────
                Text(
                  v.clientName ?? '',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                    letterSpacing: -0.5,
                    shadows: [
                      Shadow(color: Colors.black38, blurRadius: 12),
                    ],
                  ),
                ),

                const SizedBox(height: 10),

                // ── Date ─────────────────────────────────────────────────────
                if (v.scheduledAt != null) ...[
                  Text(
                    DateFormatter.mediumDate(v.scheduledAt!,
                        languageCode: lang),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: Colors.white.withValues(alpha: 0.68),
                    ),
                  ),
                  const SizedBox(height: 5),
                ],

                // ── Project · Unit ────────────────────────────────────────────
                if (v.projectName != null)
                  Text(
                    [
                      v.projectName!,
                      if (v.unitCode != null) v.unitCode!,
                    ].join(' · '),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.82),
                    ),
                  ),

                // ── Location ─────────────────────────────────────────────────
                if (v.location?.isNotEmpty == true) ...[
                  const SizedBox(height: 5),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.location_on_rounded,
                        size: 12,
                        color: AppPalette.gold400.withValues(alpha: 0.75),
                      ),
                      const SizedBox(width: 3),
                      Flexible(
                        child: Text(
                          v.location!,
                          textAlign: TextAlign.center,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.white.withValues(alpha: 0.52),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],

                const SizedBox(height: AppSpacing.xl),

                // ── Thin gold divider ─────────────────────────────────────────
                Container(
                  height: 1,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        Colors.transparent,
                        AppPalette.gold400.withValues(alpha: 0.30),
                        Colors.transparent,
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: AppSpacing.lg),

                // ── Contact buttons (glass style for dark background) ─────────
                _DarkContactButtons(phone: v.clientPhone, l10n: l10n),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// Loading/error hero shell
class _HeroShell extends StatelessWidget {
  const _HeroShell({required this.topInset, required this.child});
  final double topInset;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 300 + topInset,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1A3255), _navyMid, _navyDeep],
        ),
      ),
      child: child,
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Circle back button — physical top-left (Positioned.left, not start)
// ══════════════════════════════════════════════════════════════════════════════
class _CircleBackButton extends StatelessWidget {
  const _CircleBackButton({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isRtl = Directionality.of(context) == TextDirection.rtl;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.18),
          shape: BoxShape.circle,
          border: Border.all(
            color: Colors.white.withValues(alpha: 0.30),
            width: 0.8,
          ),
        ),
        // Wrap in LTR to prevent automatic icon mirroring in RTL contexts
        child: Directionality(
          textDirection: TextDirection.ltr,
          child: Icon(
            isRtl
                ? Icons.arrow_forward_ios_rounded
                : Icons.arrow_back_ios_new_rounded,
            size: 16,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Status pill badge
// ══════════════════════════════════════════════════════════════════════════════
class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.label, required this.tone});
  final String label;
  final BadgeTone tone;

  Color _bg() => switch (tone) {
        BadgeTone.success => const Color(0xFF22C55E),
        BadgeTone.warning => const Color(0xFFF59E0B),
        BadgeTone.error   => const Color(0xFFEF4444),
        BadgeTone.gold    => AppPalette.gold500,
        BadgeTone.info    => const Color(0xFF3B82F6),
        _                 => Colors.white.withValues(alpha: 0.20),
      };

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
      decoration: BoxDecoration(
        color: _bg().withValues(alpha: 0.88),
        borderRadius: AppRadii.pillAll,
        border: Border.all(
            color: Colors.white.withValues(alpha: 0.22), width: 0.8),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 12,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.4,
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Section label
// ══════════════════════════════════════════════════════════════════════════════
class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Row(
      children: [
        Container(
          width: 4,
          height: 20,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [AppPalette.gold300, AppPalette.gold500],
            ),
            borderRadius: BorderRadius.circular(999),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Text(
          text,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w800,
                color: colors.inkStrong,
                letterSpacing: -0.2,
              ),
        ),
      ],
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Info card
// ══════════════════════════════════════════════════════════════════════════════
class _InfoCard extends StatelessWidget {
  const _InfoCard({
    required this.icon,
    required this.title,
    required this.body,
  });
  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.6)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: AppPalette.gold400.withValues(alpha: 0.10),
              shape: BoxShape.circle,
              border: Border.all(
                  color: AppPalette.gold400.withValues(alpha: 0.22)),
            ),
            child: Icon(icon, size: 17, color: AppPalette.gold500),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: colors.inkMuted,
                    letterSpacing: 0.3,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  body,
                  style: TextStyle(
                    fontSize: 14,
                    color: colors.inkStrong,
                    height: 1.5,
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

// ══════════════════════════════════════════════════════════════════════════════
// Customer request card
// ══════════════════════════════════════════════════════════════════════════════
class _CustomerRequestCard extends StatelessWidget {
  const _CustomerRequestCard({
    required this.v,
    required this.l10n,
    required this.lang,
  });
  final Visit v;
  final AppLocalizations l10n;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(
            color: AppPalette.gold400.withValues(alpha: 0.22)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.format_quote_rounded,
                  size: 15, color: AppPalette.gold500),
              const SizedBox(width: 6),
              Text(
                l10n.customerMessageLabel,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: colors.inkMuted,
                  letterSpacing: 0.3,
                ),
              ),
            ],
          ),
          if (v.requestPreferredDate != null) ...[
            const SizedBox(height: 8),
            Text(
              l10n.visitOn(DateFormatter.mediumDate(
                  v.requestPreferredDate!,
                  languageCode: lang)),
              style: TextStyle(
                fontSize: 14,
                color: colors.inkStrong,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
          if (v.requestPreferredTime?.isNotEmpty == true) ...[
            const SizedBox(height: 3),
            Text(
              '${l10n.preferredTimeLabel}: ${v.requestPreferredTime}',
              style: TextStyle(fontSize: 13, color: colors.inkMuted),
            ),
          ],
          if (v.requestNotes?.isNotEmpty == true) ...[
            const SizedBox(height: 8),
            Text(
              v.requestNotes!,
              style: TextStyle(
                  fontSize: 14, color: colors.inkStrong, height: 1.5),
            ),
          ],
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Glass action chip
// ══════════════════════════════════════════════════════════════════════════════
class _GlassChip extends StatelessWidget {
  const _GlassChip({
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(AppRadii.pill),
          border: Border.all(color: colors.hairline),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 8,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15, color: colors.inkMuted),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: colors.inkStrong,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Feedback tile
// ══════════════════════════════════════════════════════════════════════════════
class _FeedbackTile extends StatelessWidget {
  const _FeedbackTile({required this.l10n, required this.onTap});
  final AppLocalizations l10n;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg, vertical: 16),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [AppPalette.gold300, AppPalette.gold500],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(AppRadii.lg),
          boxShadow: [
            BoxShadow(
              color: AppPalette.gold400.withValues(alpha: 0.35),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.star_rounded, size: 18, color: Colors.white),
            const SizedBox(width: 8),
            Text(
              l10n.visitSalesFeedback,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Connected timeline
// ══════════════════════════════════════════════════════════════════════════════
class _Timeline extends StatelessWidget {
  const _Timeline({
    required this.entries,
    required this.lang,
    required this.l10n,
  });
  final List<VisitActivityEntry> entries;
  final String lang;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (int i = 0; i < entries.length; i++)
          _TimelineItem(
            entry: entries[i],
            isLast: i == entries.length - 1,
            lang: lang,
          ),
      ],
    );
  }
}

class _TimelineItem extends StatelessWidget {
  const _TimelineItem({
    required this.entry,
    required this.isLast,
    required this.lang,
  });
  final VisitActivityEntry entry;
  final bool isLast;
  final String lang;

  static IconData _icon(String type) => switch (type) {
        'VISIT_COMPLETED'    => Icons.check_circle_rounded,
        'VISIT_CANCELLED'    => Icons.cancel_rounded,
        'VISIT_NO_SHOW'      => Icons.person_off_rounded,
        'VISIT_RESCHEDULED'  => Icons.update_rounded,
        'CUSTOMER_CONFIRMED' => Icons.how_to_reg_rounded,
        'VISIT_SCHEDULED'    => Icons.event_rounded,
        'VISIT_CONFIRMED'    => Icons.verified_rounded,
        'FEEDBACK_SUBMITTED' => Icons.star_rounded,
        'REASSIGNED'         => Icons.swap_horiz_rounded,
        _                    => Icons.history_rounded,
      };

  static String _label(String type) => switch (type) {
        'VISIT_COMPLETED'    => 'تمت الزيارة',
        'VISIT_CANCELLED'    => 'تم الإلغاء',
        'VISIT_NO_SHOW'      => 'لم يحضر العميل',
        'VISIT_RESCHEDULED'  => 'تمت إعادة الجدولة',
        'CUSTOMER_CONFIRMED' => 'تأكيد العميل',
        'VISIT_SCHEDULED'    => 'تمت الجدولة',
        'VISIT_CONFIRMED'    => 'تم التأكيد',
        'FEEDBACK_SUBMITTED' => 'تم إرسال التقييم',
        'REASSIGNED'         => 'تم إعادة الإسناد',
        _                    => type,
      };

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Spine
          SizedBox(
            width: 44,
            child: Column(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: AppPalette.gold400.withValues(alpha: 0.10),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: AppPalette.gold400.withValues(alpha: 0.30),
                    ),
                  ),
                  child: Icon(
                    _icon(entry.type),
                    size: 16,
                    color: AppPalette.gold500,
                  ),
                ),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 1.5,
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      color: colors.hairline,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          // Content
          Expanded(
            child: Padding(
              padding:
                  EdgeInsets.only(bottom: isLast ? 0 : AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    entry.note?.isNotEmpty == true
                        ? entry.note!
                        : _label(entry.type),
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: colors.inkStrong,
                    ),
                  ),
                  if (entry.note?.isNotEmpty == true) ...[
                    const SizedBox(height: 2),
                    Text(
                      _label(entry.type),
                      style: TextStyle(
                        fontSize: 12,
                        color: colors.inkMuted,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                  if (entry.createdAt != null) ...[
                    const SizedBox(height: 3),
                    Text(
                      [
                        if (entry.actorName != null) entry.actorName!,
                        DateFormatter.shortDate(entry.createdAt!,
                            languageCode: lang),
                      ].join(' · '),
                      style: TextStyle(
                        fontSize: 11,
                        color: colors.inkMuted.withValues(alpha: 0.75),
                      ),
                    ),
                  ],
                  const SizedBox(height: 4),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Contact buttons styled for dark (navy) background
// ══════════════════════════════════════════════════════════════════════════════
class _DarkContactButtons extends StatelessWidget {
  const _DarkContactButtons({required this.phone, required this.l10n});
  final String? phone;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final number = phone?.trim() ?? '';
    if (number.isEmpty) return const SizedBox.shrink();

    return Row(
      children: [
        // Call — white-glass outline
        Expanded(
          child: GestureDetector(
            onTap: () => ContactActions.call(number),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 13),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(AppRadii.pill),
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.35),
                  width: 1,
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.call_rounded,
                      size: 16, color: Colors.white),
                  const SizedBox(width: 6),
                  Text(
                    l10n.contactCall,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        // WhatsApp — gold filled
        Expanded(
          child: GestureDetector(
            onTap: () => ContactActions.whatsApp(number: number),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 13),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppPalette.gold300, AppPalette.gold500],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(AppRadii.pill),
                boxShadow: [
                  BoxShadow(
                    color: AppPalette.gold400.withValues(alpha: 0.40),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.chat_rounded,
                      size: 16, color: Colors.white),
                  const SizedBox(width: 6),
                  Text(
                    l10n.contactWhatsapp,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
