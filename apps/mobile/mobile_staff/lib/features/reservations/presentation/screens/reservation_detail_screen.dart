import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/reservation_status_label.dart';
import '../../domain/entities/reservation.dart';
import '../cubit/reservation_detail_cubit.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyMid  = Color(0xFF14273F);

class ReservationDetailScreen extends StatefulWidget {
  const ReservationDetailScreen({super.key, this.fallback});
  final Reservation? fallback;

  @override
  State<ReservationDetailScreen> createState() => _ReservationDetailScreenState();
}

class _ReservationDetailScreenState extends State<ReservationDetailScreen> {
  final _note = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<ReservationDetailCubit>().load();
  }

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  void _submitNote() {
    if (_note.text.trim().isEmpty) return;
    context.read<ReservationDetailCubit>().addNote(_note.text);
    _note.clear();
    FocusScope.of(context).unfocus();
  }

  static String _initials(String? name) {
    if (name == null || name.trim().isEmpty) return '?';
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length == 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: BlocConsumer<ReservationDetailCubit, ReservationDetailState>(
          listenWhen: (a, b) =>
              a.actionFailure != b.actionFailure && b.actionFailure != null,
          listener: (context, state) =>
              showFailureSnackBar(context, state.actionFailure!),
          builder: (context, state) {
            final topInset = MediaQuery.paddingOf(context).top;
            Widget body;
            if (state.status == DataStatus.initial ||
                state.status == DataStatus.loading) {
              body = _LoadingBody(topInset: topInset);
            } else if (state.status == DataStatus.failure) {
              body = _ErrorBody(
                topInset: topInset,
                failure: state.failure,
                onRetry: () => context.read<ReservationDetailCubit>().load(),
              );
            } else {
              body = _SuccessBody(
                topInset: topInset,
                state: state,
                noteCtrl: _note,
                fallback: widget.fallback,
                onSubmitNote: _submitNote,
                initials: _initials(
                    state.detail?.reservation.clientName ??
                        widget.fallback?.clientName),
              );
            }
            return Stack(
              children: [
                body,
                PositionedDirectional(
                  top: topInset + 10,
                  start: 14,
                  child: _CircleBack(onTap: () => context.pop()),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

// ── Loading / error shells ────────────────────────────────────────────────────

class _LoadingBody extends StatelessWidget {
  const _LoadingBody({required this.topInset});
  final double topInset;

  @override
  Widget build(BuildContext context) => CustomScrollView(
        physics: const NeverScrollableScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(
            child: _HeroShell(
              topInset: topInset,
              child: const SizedBox.shrink(),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            sliver: SliverList.list(
              children: [
                AppSkeletonizer(
                  enabled: true,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _SkeletonCard(lines: 2),
                      const SizedBox(height: AppSpacing.xl),
                      _SkeletonSectionLabel(),
                      const SizedBox(height: AppSpacing.sm),
                      _SkeletonCard(lines: 1),
                      const SizedBox(height: AppSpacing.xl),
                      _SkeletonSectionLabel(),
                      const SizedBox(height: AppSpacing.md),
                      for (int i = 0; i < 3; i++) ...[
                        _SkeletonTimelineItem(isLast: i == 2),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      );
}

class _ErrorBody extends StatelessWidget {
  const _ErrorBody(
      {required this.topInset,
      required this.failure,
      required this.onRetry});
  final double topInset;
  final AppFailure? failure;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: _HeroShell(
              topInset: topInset,
              child:
                  Center(child: ErrorState(failure: failure, onRetry: onRetry)),
            ),
          ),
        ],
      );
}

// ── Success body ──────────────────────────────────────────────────────────────

class _SuccessBody extends StatelessWidget {
  const _SuccessBody({
    required this.topInset,
    required this.state,
    required this.noteCtrl,
    required this.fallback,
    required this.onSubmitNote,
    required this.initials,
  });

  final double topInset;
  final ReservationDetailState state;
  final TextEditingController noteCtrl;
  final Reservation? fallback;
  final VoidCallback onSubmitNote;
  final String initials;

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final lang   = Localizations.localeOf(context).languageCode;
    final colors = context.appColors;
    final detail = state.detail!;
    final r      = detail.reservation;

    return CustomScrollView(
      physics: const BouncingScrollPhysics(
          parent: AlwaysScrollableScrollPhysics()),
      slivers: [
        SliverToBoxAdapter(
          child: _HeroCard(
            reservation: r,
            initials: initials,
            topInset: topInset,
            l10n: l10n,
            lang: lang,
            planName: detail.planName,
          ),
        ),
        SliverPadding(
          padding: EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.xl,
            AppSpacing.lg,
            MediaQuery.paddingOf(context).bottom + 32,
          ),
          sliver: SliverList.list(children: [
            // ── Booking amount + plan ───────────────────────────────────────
            if (r.bookingAmount != null || detail.planName != null) ...[
              _InfoCard(
                icon: Icons.payments_rounded,
                title: l10n.reservationBooking,
                body: [
                  if (r.bookingAmount != null)
                    PriceFormatter.formatString(r.bookingAmount,
                        languageCode: lang),
                  if (detail.planName != null) detail.planName!,
                ].join('  ·  '),
              ),
              const SizedBox(height: AppSpacing.md),
            ],

            // ── Add note ────────────────────────────────────────────────────
            _SectionLabel(l10n.leadAddNote),
            const SizedBox(height: AppSpacing.sm),
            Container(
              decoration: BoxDecoration(
                color: colors.surface,
                borderRadius: BorderRadius.circular(AppRadii.lg),
                border: Border.all(color: colors.hairline),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 10,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: TextField(
                      controller: noteCtrl,
                      minLines: 1,
                      maxLines: 3,
                      style: TextStyle(
                          fontSize: 14, color: colors.inkStrong),
                      decoration: InputDecoration(
                        hintText: l10n.leadNoteHint,
                        hintStyle:
                            TextStyle(color: colors.inkMuted, fontSize: 14),
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.fromLTRB(16, 14, 8, 14),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(6),
                    child: GestureDetector(
                      onTap: state.working ? null : onSubmitNote,
                      child: Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [AppPalette.gold300, AppPalette.gold500],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(10),
                          boxShadow: [
                            BoxShadow(
                              color: AppPalette.gold400.withValues(alpha: 0.35),
                              blurRadius: 8,
                              offset: const Offset(0, 3),
                            ),
                          ],
                        ),
                        child: const Icon(Icons.send_rounded,
                            size: 16, color: Colors.white),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.xl),

            // ── Timeline ────────────────────────────────────────────────────
            _SectionLabel(l10n.leadTimeline),
            const SizedBox(height: AppSpacing.md),
            if (detail.timeline.isEmpty)
              Text(l10n.leadTimelineEmpty,
                  style: TextStyle(fontSize: 14, color: colors.inkMuted))
            else
              _Timeline(entries: detail.timeline, lang: lang, l10n: l10n),
          ]),
        ),
      ],
    );
  }
}

// ── Hero card ─────────────────────────────────────────────────────────────────

class _HeroCard extends StatelessWidget {
  const _HeroCard({
    required this.reservation,
    required this.initials,
    required this.topInset,
    required this.l10n,
    required this.lang,
    this.planName,
  });

  final Reservation reservation;
  final String initials;
  final double topInset;
  final AppLocalizations l10n;
  final String lang;
  final String? planName;

  @override
  Widget build(BuildContext context) {
    final r = reservation;
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
          // Gold radial bloom
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
          // Bottom shimmer
          const Positioned(
            bottom: 0, left: 0, right: 0, height: 1,
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
          Padding(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.lg,
              topInset + 56,
              AppSpacing.lg,
              AppSpacing.xl,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Avatar
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: const LinearGradient(
                      colors: [AppPalette.gold300, AppPalette.gold500],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: AppPalette.gold400.withValues(alpha: 0.50),
                        blurRadius: 24,
                        offset: const Offset(0, 10),
                      ),
                    ],
                  ),
                  child: Center(
                    child: Text(
                      initials,
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                        letterSpacing: 1.5,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 14),

                // Status pill
                _StatusPill(
                  label: reservationStatusLabel(l10n, r.status),
                  tone: reservationStatusTone(r.status),
                ),
                const SizedBox(height: 12),

                // Reservation number
                if (r.reservationNumber != null)
                  Text(
                    r.reservationNumber!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      letterSpacing: -0.3,
                    ),
                  ),
                const SizedBox(height: 6),

                // Client name
                if (r.clientName != null)
                  Text(
                    r.clientName!,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.80),
                    ),
                  ),

                // Unit · Project
                if (r.unitCode != null || r.projectName != null) ...[
                  const SizedBox(height: 5),
                  Text(
                    [
                      if (r.unitCode != null) r.unitCode!,
                      if (r.projectName != null) r.projectName!,
                    ].join(' · '),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: Colors.white.withValues(alpha: 0.60),
                    ),
                  ),
                ],

                // Expiry chip
                if (r.expiresAt != null) ...[
                  const SizedBox(height: 10),
                  _ExpiryPill(expiresAt: r.expiresAt!, l10n: l10n, lang: lang),
                ],

                const SizedBox(height: AppSpacing.xl),

                // Divider
                Container(
                  height: 1,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        Colors.transparent,
                        AppPalette.gold400.withValues(alpha: 0.28),
                        Colors.transparent,
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),

                // Contact buttons
                _DarkContactButtons(phone: r.clientPhone, l10n: l10n),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroShell extends StatelessWidget {
  const _HeroShell({required this.topInset, required this.child});
  final double topInset;
  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
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

// ── Timeline ──────────────────────────────────────────────────────────────────

class _Timeline extends StatelessWidget {
  const _Timeline(
      {required this.entries, required this.lang, required this.l10n});
  final List<ReservationTimelineEntry> entries;
  final String lang;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) => Column(
        children: [
          for (int i = 0; i < entries.length; i++)
            _TimelineItem(
              entry: entries[i],
              isLast: i == entries.length - 1,
              lang: lang,
              l10n: l10n,
            ),
        ],
      );
}

class _TimelineItem extends StatelessWidget {
  const _TimelineItem(
      {required this.entry,
      required this.isLast,
      required this.lang,
      required this.l10n});
  final ReservationTimelineEntry entry;
  final bool isLast;
  final String lang;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final isNote = entry.isNote;
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
                    color: isNote
                        ? AppPalette.gold400.withValues(alpha: 0.10)
                        : colors.surfaceSoft,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: isNote
                          ? AppPalette.gold400.withValues(alpha: 0.30)
                          : colors.hairline,
                    ),
                  ),
                  child: Icon(
                    isNote
                        ? Icons.sticky_note_2_rounded
                        : Icons.history_rounded,
                    size: 16,
                    color: isNote ? AppPalette.gold500 : colors.inkMuted,
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
              padding: EdgeInsets.only(bottom: isLast ? 0 : AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isNote
                        ? entry.body
                        : reservationStatusLabel(l10n, entry.body),
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: colors.inkStrong,
                    ),
                  ),
                  if (entry.createdAt != null) ...[
                    const SizedBox(height: 3),
                    Text(
                      [
                        if (entry.authorName != null) entry.authorName!,
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

// ── Shared sub-widgets ────────────────────────────────────────────────────────

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

class _InfoCard extends StatelessWidget {
  const _InfoCard(
      {required this.icon, required this.title, required this.body});
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
        border:
            Border.all(color: colors.hairline.withValues(alpha: 0.6)),
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
      padding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
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

class _ExpiryPill extends StatelessWidget {
  const _ExpiryPill(
      {required this.expiresAt, required this.l10n, required this.lang});
  final DateTime expiresAt;
  final AppLocalizations l10n;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final expired = expiresAt.isBefore(DateTime.now());
    final color =
        expired ? const Color(0xFFEF4444) : const Color(0xFFF59E0B);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.16),
        borderRadius: AppRadii.pillAll,
        border:
            Border.all(color: color.withValues(alpha: 0.35), width: 0.8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration:
                BoxDecoration(shape: BoxShape.circle, color: color),
          ),
          const SizedBox(width: 6),
          Text(
            '${expired ? l10n.reservationExpiredOn : l10n.reservationExpiresOn}: '
            '${DateFormatter.shortDate(expiresAt, languageCode: lang)}',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

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
        Expanded(
          child: GestureDetector(
            onTap: () => ContactActions.call(number),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 13),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(AppRadii.pill),
                border: Border.all(
                    color: Colors.white.withValues(alpha: 0.35), width: 1),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.call_rounded,
                      size: 16, color: Colors.white),
                  const SizedBox(width: 6),
                  Text(l10n.contactCall,
                      style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: Colors.white)),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
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
                  Text(l10n.contactWhatsapp,
                      style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: Colors.white)),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _CircleBack extends StatelessWidget {
  const _CircleBack({required this.onTap});
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
              color: Colors.white.withValues(alpha: 0.30), width: 0.8),
        ),
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

// ── Skeleton helpers (shared by loading state) ────────────────────────────────

class _SkeletonCard extends StatelessWidget {
  const _SkeletonCard({required this.lines});
  final int lines;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (int i = 0; i < lines; i++) ...[
            if (i > 0) const SizedBox(height: AppSpacing.sm),
            Container(
              height: i == 0 ? 16 : 13,
              width: i == 0 ? double.infinity : 160,
              decoration: BoxDecoration(
                color: colors.surfaceSoft,
                borderRadius: BorderRadius.circular(6),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _SkeletonSectionLabel extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Row(
      children: [
        Container(
          width: 4, height: 20,
          decoration: BoxDecoration(
            color: AppPalette.gold400.withValues(alpha: 0.30),
            borderRadius: BorderRadius.circular(999),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Container(
          height: 16,
          width: 110,
          decoration: BoxDecoration(
            color: colors.surfaceSoft,
            borderRadius: BorderRadius.circular(6),
          ),
        ),
      ],
    );
  }
}

class _SkeletonTimelineItem extends StatelessWidget {
  const _SkeletonTimelineItem({required this.isLast});
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 44,
            child: Column(
              children: [
                Container(
                  width: 36, height: 36,
                  decoration: BoxDecoration(
                    color: colors.surfaceSoft,
                    shape: BoxShape.circle,
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
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    height: 14, width: 140,
                    decoration: BoxDecoration(
                      color: colors.surfaceSoft,
                      borderRadius: BorderRadius.circular(6),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    height: 11, width: 90,
                    decoration: BoxDecoration(
                      color: colors.surfaceSoft,
                      borderRadius: BorderRadius.circular(6),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
