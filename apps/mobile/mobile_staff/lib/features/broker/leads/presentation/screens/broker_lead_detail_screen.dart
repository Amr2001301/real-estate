import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../../common/broker_status_label.dart';
import '../../../../../common/lead_stage_label.dart';
import '../../../../../common/staff_contact_actions.dart';
import '../../domain/entities/broker_lead.dart';
import '../cubit/broker_lead_detail_cubit.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyLight = Color(0xFF243F62);

// ─────────────────────────────────────────────────────────────────────────────
// Broker Lead Detail Screen
// ─────────────────────────────────────────────────────────────────────────────

class BrokerLeadDetailScreen extends StatefulWidget {
  const BrokerLeadDetailScreen({super.key, this.fallback});
  final BrokerLead? fallback;

  @override
  State<BrokerLeadDetailScreen> createState() =>
      _BrokerLeadDetailScreenState();
}

class _BrokerLeadDetailScreenState extends State<BrokerLeadDetailScreen> {
  @override
  void initState() {
    super.initState();
    context.read<BrokerLeadDetailCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: BlocBuilder<BrokerLeadDetailCubit, BrokerLeadDetailState>(
          builder: (context, state) {
            switch (state.status) {
              case DataStatus.initial:
              case DataStatus.loading:
                return Column(
                  children: [
                    _LeadHeader(name: widget.fallback?.fullName),
                    Expanded(child: _DetailSkeleton()),
                  ],
                );
              case DataStatus.failure:
                return Column(
                  children: [
                    _LeadHeader(name: widget.fallback?.fullName),
                    Expanded(
                      child: ErrorState(
                        failure: state.failure,
                        onRetry: () =>
                            context.read<BrokerLeadDetailCubit>().load(),
                      ),
                    ),
                  ],
                );
              case DataStatus.empty:
              case DataStatus.success:
                return _Body(detail: state.data!);
            }
          },
        ),
      ),
    );
  }
}

// ── Body ──────────────────────────────────────────────────────────────────────

class _Body extends StatelessWidget {
  const _Body({required this.detail});
  final BrokerLeadDetail detail;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final theme = Theme.of(context);
    final lead = detail.lead;

    return Column(
      children: [
        _LeadHeader(
          name: lead.fullName,
          approvalStatus: lead.approvalStatus,
          l10n: l10n,
        ),
        Expanded(
          child: ListView(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.xl + MediaQuery.of(context).padding.bottom,
            ),
            children: [
              // ── Contact card ──────────────────────────────────────────────
              Container(
                padding: const EdgeInsets.all(AppSpacing.lg),
                decoration: BoxDecoration(
                  color: colors.surface,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: colors.hairline.withValues(alpha: 0.4),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 12,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 46,
                          height: 46,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [_navyLight, _navyDeep],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(13),
                          ),
                          child: Center(
                            child: Text(
                              lead.fullName.isNotEmpty
                                  ? lead.fullName[0].toUpperCase()
                                  : '?',
                              style: const TextStyle(
                                color: AppPalette.gold300,
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                lead.fullName,
                                style: theme.textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              const SizedBox(height: 4),
                              StatusBadge(
                                label: leadStageLabel(l10n, lead.stage),
                                tone: leadStageTone(lead.stage),
                              ),
                            ],
                          ),
                        ),
                        if (lead.projectName != null)
                          Flexible(
                            child: Text(
                              lead.projectName!,
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: colors.inkMuted,
                              ),
                              textAlign: TextAlign.end,
                              maxLines: 2,
                            ),
                          ),
                      ],
                    ),
                    if (lead.phone != null) ...[
                      const SizedBox(height: AppSpacing.md),
                      Divider(height: 1, color: colors.hairline),
                      const SizedBox(height: AppSpacing.md),
                      StaffContactButtons(phone: lead.phone),
                    ],
                  ],
                ),
              ),

              const SizedBox(height: AppSpacing.md),

              // ── New reservation CTA ───────────────────────────────────────
              GestureDetector(
                onTap: () => context.push(
                  '/broker/reservations/new',
                  extra: {'leadId': lead.id},
                ),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 18,
                    vertical: 16,
                  ),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF7C5200), Color(0xFF3D2800)],
                      begin: Alignment.topRight,
                      end: Alignment.bottomLeft,
                    ),
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF7C5200).withValues(alpha: 0.35),
                        blurRadius: 14,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(
                          Icons.bookmark_add_rounded,
                          color: AppPalette.gold300,
                          size: 22,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              l10n.reservationNew,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 14,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            Text(
                              context.l10n.brokerReserveForLead,
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.6),
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Icon(
                        Icons.arrow_back_ios_new_rounded,
                        color: Colors.white.withValues(alpha: 0.5),
                        size: 14,
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: AppSpacing.lg),

              // ── Timeline section ──────────────────────────────────────────
              _SectionLabel(label: l10n.leadTimeline),
              const SizedBox(height: AppSpacing.sm),

              if (detail.timeline.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
                  child: Text(
                    l10n.leadTimelineEmpty,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: colors.inkMuted,
                    ),
                  ),
                )
              else
                for (final e in detail.timeline) ...[
                  _TimelineEntry(entry: e, lang: lang),
                  const SizedBox(height: AppSpacing.sm),
                ],
            ],
          ),
        ),
      ],
    );
  }
}

// ── Lead header ───────────────────────────────────────────────────────────────

class _LeadHeader extends StatelessWidget {
  const _LeadHeader({this.name, this.approvalStatus, this.l10n});

  final String? name;
  final String? approvalStatus;
  final AppLocalizations? l10n;

  @override
  Widget build(BuildContext context) {
    return AppNavHeader(
      title: name ?? context.l10n.leadSingular,
      subtitle: name != null ? context.l10n.leadSingular : null,
      compact: true,
      leadingAction: const NavHeaderBack(),
      actions: [
        if (approvalStatus != null && l10n != null) NavHeaderPill(label: brokerLeadStatusLabel(l10n!, approvalStatus!)),
      ],
    );
  }
}

// ── Section label ─────────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Row(
      children: [
        Container(
          width: 3,
          height: 16,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppPalette.gold400, AppPalette.gold300],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          label,
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w800,
            color: colors.inkStrong,
          ),
        ),
      ],
    );
  }
}

// ── Timeline entry ────────────────────────────────────────────────────────────

class _TimelineEntry extends StatelessWidget {
  const _TimelineEntry({required this.entry, required this.lang});
  final BrokerLeadTimelineEntry entry;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.4)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: entry.isNote
                  ? AppPalette.gold300.withValues(alpha: 0.12)
                  : colors.inkMuted.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(
              entry.isNote
                  ? Icons.sticky_note_2_rounded
                  : Icons.history_rounded,
              size: 16,
              color: entry.isNote ? AppPalette.gold300 : colors.inkMuted,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.body,
                  style: theme.textTheme.bodyMedium,
                ),
                if (entry.createdAt != null) ...[
                  const SizedBox(height: 3),
                  Text(
                    [
                      if (entry.authorName != null) entry.authorName!,
                      DateFormatter.shortDate(
                        entry.createdAt!,
                        languageCode: lang,
                      ),
                    ].join(' · '),
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: colors.inkMuted,
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

// ── Shared ────────────────────────────────────────────────────────────────────

// ── Lead detail loading skeleton ──────────────────────────────────────────────

class _DetailSkeleton extends StatelessWidget {
  const _DetailSkeleton();

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final bottomPad = MediaQuery.of(context).padding.bottom;

    return AppSkeletonizer(
      enabled: true,
      child: ListView(
        padding: EdgeInsets.fromLTRB(
          AppSpacing.lg, AppSpacing.lg, AppSpacing.lg,
          AppSpacing.xl + bottomPad,
        ),
        children: [
          // ── Fake contact card ─────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(AppSpacing.lg),
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: colors.hairline.withValues(alpha: 0.4)),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Container(
                  width: 46, height: 46,
                  decoration: BoxDecoration(
                    color: _navyLight,
                    borderRadius: BorderRadius.circular(13),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('محمد أحمد العمري',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                  const SizedBox(height: 4),
                  StatusBadge(label: 'قيد المراجعة', tone: BadgeTone.warning),
                ])),
              ]),
              const SizedBox(height: AppSpacing.md),
              Divider(height: 1, color: colors.hairline),
              const SizedBox(height: AppSpacing.md),
              Row(children: [
                Container(width: 36, height: 36,
                    decoration: BoxDecoration(color: colors.surfaceSoft, borderRadius: BorderRadius.circular(10))),
                const SizedBox(width: 10),
                Container(width: 36, height: 36,
                    decoration: BoxDecoration(color: colors.surfaceSoft, borderRadius: BorderRadius.circular(10))),
              ]),
            ]),
          ),
          const SizedBox(height: AppSpacing.md),

          // ── Fake info rows card ───────────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(AppSpacing.lg),
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: colors.hairline.withValues(alpha: 0.4)),
            ),
            child: Column(children: [
              for (int i = 0; i < 4; i++) ...[
                if (i > 0) Divider(height: AppSpacing.lg, color: colors.hairline),
                Row(children: [
                  Icon(Icons.info_outline_rounded, size: 18, color: colors.inkMuted),
                  const SizedBox(width: AppSpacing.sm),
                  Text('التسمية', style: TextStyle(fontSize: 13, color: colors.inkMuted)),
                  const Spacer(),
                  Text('القيمة هنا', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: colors.inkStrong)),
                ]),
              ],
            ]),
          ),
          const SizedBox(height: AppSpacing.md),

          // ── Fake timeline card ────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(AppSpacing.lg),
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: colors.hairline.withValues(alpha: 0.4)),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('سجل النشاط', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: colors.inkStrong)),
              const SizedBox(height: AppSpacing.md),
              for (int i = 0; i < 3; i++) ...[
                if (i > 0) const SizedBox(height: AppSpacing.sm),
                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Container(width: 8, height: 8, margin: const EdgeInsets.only(top: 4),
                      decoration: BoxDecoration(color: colors.brandGold, shape: BoxShape.circle)),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('تم تسجيل العميل المحتمل', style: TextStyle(fontSize: 13, color: colors.inkStrong)),
                    Text('15/06/2026', style: TextStyle(fontSize: 11, color: colors.inkMuted)),
                  ])),
                ]),
              ],
            ]),
          ),
        ],
      ),
    );
  }
}
