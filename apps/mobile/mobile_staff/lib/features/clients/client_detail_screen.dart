import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../common/lead_stage_label.dart';
import '../../common/reservation_status_label.dart';
import '../../common/visit_status_label.dart';
import '../dashboard/home_kit/home_kit.dart';
import '../leads/domain/entities/lead.dart';
import '../leads/presentation/follow_up_labels.dart';
import '../leads/presentation/screens/leads_screen.dart' show leadFollowState, LeadFollowState, leadStageColor, leadWhen;
import '../maintenance/domain/entities/maintenance_request.dart';
import '../maintenance/presentation/maintenance_format.dart';
import 'clients_data.dart';
import 'clients_screen.dart' show ClientPill;

/// A client's page (admins only, as on the website): the account and its
/// status, the extra details, each lead with its stage and next follow-up,
/// and the client's bookings, visits, contracts, maintenance and documents.
class ClientDetailScreen extends StatefulWidget {
  const ClientDetailScreen({super.key, this.fallback});
  final ClientRow? fallback;

  @override
  State<ClientDetailScreen> createState() => _ClientDetailScreenState();
}

class _ClientDetailScreenState extends State<ClientDetailScreen> {
  @override
  void initState() {
    super.initState();
    context.read<ClientDetailCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: BlocConsumer<ClientDetailCubit, ClientDetailState>(
          listenWhen: (a, b) => b.actionFailure != null && a.actionFailure != b.actionFailure,
          listener: (context, s) => showFailureSnackBar(context, s.actionFailure!),
          builder: (context, state) {
            final p = state.profile;
            final client = p?.client ?? widget.fallback;
            final hero = HomeListHero(
              back: true,
              title: client?.name ?? l10n.navClients,
              subtitle: client == null ? null : (client.owner ? l10n.ldOwner : l10n.ldBrowser),
            );
            if (p == null) {
              return Column(children: [
                hero,
                Expanded(
                  child: state.status == DataStatus.failure
                      ? ErrorState(failure: state.failure, onRetry: () => context.read<ClientDetailCubit>().load())
                      : const Center(child: CircularProgressIndicator()),
                ),
              ]);
            }
            return RefreshIndicator(
              onRefresh: () => context.read<ClientDetailCubit>().load(),
              child: ListView(
                key: const Key('client-detail'),
                padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 32),
                children: [
                  hero,
                  const SizedBox(height: AppSpacing.md),
                  Padding(padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md), child: _ContactCard(profile: p)),
                  HomeSection(
                    icon: Icons.manage_accounts_rounded,
                    title: l10n.clAccount,
                    child: _Account(profile: p, working: state.working),
                  ),
                  if (p.details.isNotEmpty || p.custom.isNotEmpty)
                    HomeSection(icon: Icons.badge_rounded, title: l10n.clDetails, child: _Details(profile: p)),
                  HomeSection(icon: Icons.people_alt_rounded, title: l10n.clLeads, child: _Leads(leads: p.leads)),
                  if (p.reservations.isNotEmpty)
                    HomeSection(
                      icon: Icons.bookmark_rounded,
                      title: l10n.clReservations,
                      child: _Items(rows: [
                        for (final r in p.reservations)
                          _Row(
                            key: Key('client-reservation-${r.id}'),
                            icon: Icons.bookmark_rounded,
                            title: '${l10n.ldReservation} ${ltr(r.number ?? '')}'.trim(),
                            sub: _where(context, r),
                            status: reservationStatusLabel(l10n, r.status ?? ''),
                            tone: context.appColors.success,
                            onTap: () => context.push('/reservations/${r.id}'),
                          ),
                      ]),
                    ),
                  if (p.visits.isNotEmpty)
                    HomeSection(
                      icon: Icons.event_rounded,
                      title: l10n.blVisits,
                      child: _Items(rows: [
                        for (final v in p.visits)
                          _Row(
                            icon: Icons.event_rounded,
                            title: '${l10n.ldAppointment} ${ltr(v.number ?? '')}'.trim(),
                            sub: [
                              if (v.project != null) v.project!.resolve(Localizations.localeOf(context).languageCode),
                              if (v.at != null) leadWhen(context, v.at!),
                            ].join(' · '),
                            status: visitStatusLabel(l10n, v.status ?? ''),
                            tone: context.appColors.info,
                            onTap: () => context.push('/visits/${v.id}'),
                          ),
                      ]),
                    ),
                  if (p.contracts.isNotEmpty)
                    HomeSection(
                      icon: Icons.description_rounded,
                      title: l10n.clContracts,
                      child: _Items(rows: [
                        for (final c in p.contracts)
                          _Row(
                            key: Key('client-contract-${c.id}'),
                            icon: Icons.description_rounded,
                            title: c.number == null ? l10n.clContracts : ltr(c.number!),
                            sub: [
                              _where(context, c),
                              if (c.amount != null)
                                PriceFormatter.format(c.amount!, languageCode: Localizations.localeOf(context).languageCode),
                            ].where((x) => x.isNotEmpty).join(' · '),
                            status: c.status == 'SIGNED' ? l10n.clSigned : l10n.clUnsigned,
                            tone: c.status == 'SIGNED' ? context.appColors.success : context.appColors.warning,
                            onTap: () => context.push('/contracts/${c.id}'),
                          ),
                      ]),
                    ),
                  if (p.maintenance.isNotEmpty)
                    HomeSection(
                      icon: Icons.build_rounded,
                      title: l10n.clMaintenance,
                      child: _Items(rows: [
                        for (final m in p.maintenance)
                          _Row(
                            icon: Icons.build_rounded,
                            title: [if ((m.extra ?? '').isNotEmpty) m.extra!, if ((m.unitCode ?? '').isNotEmpty) ltr(m.unitCode!)].join(' · '),
                            sub: [
                              if ((m.number ?? '').isNotEmpty) m.number!,
                              if (m.at != null) leadWhen(context, m.at!, withTime: false),
                            ].join(' · '),
                            status: maintenanceStatusLabel(l10n, MaintenanceStatus.fromWire(m.status)),
                            tone: AppPalette.gold600,
                          ),
                      ]),
                    ),
                  if (p.documents.isNotEmpty)
                    HomeSection(
                      icon: Icons.folder_rounded,
                      title: l10n.clDocuments,
                      child: _Items(rows: [
                        for (final d in p.documents)
                          _Row(
                            icon: Icons.insert_drive_file_rounded,
                            title: d.number ?? '—',
                            sub: [
                              if (d.at != null) leadWhen(context, d.at!, withTime: false),
                              if ((d.extra ?? '').isNotEmpty) l10n.clBy(d.extra!),
                            ].join(' · '),
                            status: _docCategory(l10n, d.status),
                            tone: context.appColors.info,
                            onTap: (d.url ?? '').isEmpty ? null : () => ContactActions.openExternal(d.url!),
                          ),
                      ]),
                    ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  String _where(BuildContext context, ClientItem i) => [
        if (i.project != null) i.project!.resolve(Localizations.localeOf(context).languageCode),
        if ((i.unitCode ?? '').isNotEmpty) ltr(i.unitCode!),
      ].join(' · ');
}

String _docCategory(AppLocalizations l10n, String? c) => switch (c) {
      'IMAGE' => l10n.clDocImage,
      'CONTRACT' => l10n.clDocContract,
      'RECEIPT' => l10n.clDocReceipt,
      'INVOICE' => l10n.clDocInvoice,
      'BROKER_AGREEMENT' => l10n.clDocBrokerAgreement,
      'COMMISSION_STATEMENT' => l10n.clDocCommission,
      'PAYOUT_RECEIPT' => l10n.clDocPayout,
      'ID_DOCUMENT' => l10n.clDocId,
      'LEGAL' => l10n.clDocLegal,
      'FINANCIAL' => l10n.clDocFinancial,
      _ => l10n.clDocOther,
    };

String _detailLabel(AppLocalizations l10n, String key) => switch (key) {
      'nationalId' => l10n.clNationalId,
      'address' => l10n.clAddress,
      'birthDate' => l10n.clBirthDate,
      'birthPlace' => l10n.clBirthPlace,
      'occupation' => l10n.clOccupation,
      'employer' => l10n.clEmployer,
      'nationalIdIssueDate' => l10n.clIdIssueDate,
      'nationalIdIssuePlace' => l10n.clIdIssuePlace,
      'homePhone' => l10n.clHomePhone,
      _ => key,
    };

class _ContactCard extends StatelessWidget {
  const _ContactCard({required this.profile});
  final ClientProfile profile;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final c = profile.client;
    return Container(
      key: const Key('client-card'),
      padding: const EdgeInsets.all(14),
      decoration: homeCard(context, radius: 24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Container(
            width: 54,
            height: 54,
            alignment: Alignment.center,
            decoration: BoxDecoration(gradient: homeNavyGradient, borderRadius: BorderRadius.circular(17)),
            child: Text(homeInitials(c.name), style: homeDisplay(17, AppPalette.gold300)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(c.name, style: homeDisplay(18, colors.inkStrong)),
              const SizedBox(height: 6),
              Wrap(spacing: 6, runSpacing: 6, children: [
                ClientPill(text: c.owner ? l10n.ldOwner : l10n.ldBrowser, color: c.owner ? colors.success : colors.info),
                ClientPill(text: c.active ? l10n.clActive : l10n.clSuspended, color: c.active ? colors.success : colors.error),
              ]),
            ]),
          ),
        ]),
        const SizedBox(height: 10),
        if ((c.phone ?? '').isNotEmpty) _Line(icon: Icons.phone_rounded, text: ltr(c.phone!)),
        if ((c.email ?? '').isNotEmpty) _Line(icon: Icons.alternate_email_rounded, text: c.email!),
        if ((c.phone ?? '').isNotEmpty) ...[
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: _Btn(icon: Icons.phone_rounded, label: l10n.ldCall, filled: true, onTap: () => ContactActions.call(c.phone!))),
            const SizedBox(width: 8),
            Expanded(child: _Btn(icon: Icons.chat_rounded, label: l10n.ldWhatsApp, onTap: () => ContactActions.whatsApp(number: c.phone!))),
            if ((c.email ?? '').isNotEmpty) ...[
              const SizedBox(width: 8),
              Expanded(child: _Btn(icon: Icons.mail_rounded, label: l10n.ldEmail, onTap: () => ContactActions.openExternal('mailto:${c.email}'))),
            ],
          ]),
        ],
      ]),
    );
  }
}

/// The account: status, type, registered, last sign-in, language and ID,
/// with suspending or restoring it (as the website's account panel).
class _Account extends StatelessWidget {
  const _Account({required this.profile, required this.working});
  final ClientProfile profile;
  final bool working;

  Future<void> _toggle(BuildContext context) async {
    final l10n = context.l10n;
    final cubit = context.read<ClientDetailCubit>();
    final active = profile.client.active;
    if (active) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(l10n.clSuspend),
          content: Text(l10n.clSuspendConfirm),
          actions: [
            TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: Text(l10n.actionCancel)),
            FilledButton(key: const Key('client-suspend-confirm'), onPressed: () => Navigator.of(ctx).pop(true), child: Text(l10n.clConfirm)),
          ],
        ),
      );
      if (ok != true) return;
    }
    await cubit.setActive(!active);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final c = profile.client;
    String date(DateTime d) => DateFormatter.mediumDate(d, languageCode: lang);
    final id = c.id.replaceAll('-', '');
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      _Rows(rows: [
        (l10n.clStatus, c.active ? l10n.clActive : (profile.updatedAt == null ? l10n.clSuspended : l10n.clSuspendedSince(date(profile.updatedAt!)))),
        (l10n.clType, c.owner ? l10n.ldOwner : l10n.ldBrowser),
        if (c.createdAt != null) (l10n.clJoinedLbl, date(c.createdAt!)),
        (l10n.clLastLoginLbl, c.lastLoginAt == null ? l10n.clNeverLogged : leadWhen(context, c.lastLoginAt!)),
        if ((profile.locale ?? '').isNotEmpty) (l10n.clLocale, profile.locale == 'en' ? 'English' : 'العربية'),
        (l10n.clId, ltr('#${id.substring(0, id.length < 8 ? id.length : 8).toUpperCase()}')),
      ]),
      const SizedBox(height: 10),
      OutlinedButton.icon(
        key: const Key('client-toggle-active'),
        style: OutlinedButton.styleFrom(
          foregroundColor: c.active ? colors.error : colors.success,
          side: BorderSide(color: (c.active ? colors.error : colors.success).withValues(alpha: 0.5)),
          minimumSize: const Size.fromHeight(44),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
        onPressed: working ? null : () => _toggle(context),
        icon: Icon(c.active ? Icons.block_rounded : Icons.check_circle_rounded, size: 18),
        label: Text(c.active ? l10n.clSuspend : l10n.clRestore),
      ),
    ]);
  }
}

class _Details extends StatelessWidget {
  const _Details({required this.profile});
  final ClientProfile profile;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    String value(String key, String v, {bool date = false}) {
      if (!date) return v;
      final d = DateTime.tryParse(v);
      return d == null ? v : DateFormatter.mediumDate(DateTime.utc(d.year, d.month, d.day), languageCode: lang);
    }

    final defs = {for (final d in profile.fieldDefs) d.key: d};
    return _Rows(rows: [
      for (final e in profile.details.entries)
        (_detailLabel(l10n, e.key), value(e.key, e.value, date: kClientDateDetails.contains(e.key))),
      for (final e in profile.custom.entries)
        if (defs[e.key] != null) (defs[e.key]!.label.resolve(lang), value(e.key, e.value, date: defs[e.key]!.type == 'DATE')),
    ]);
  }
}

/// The client's leads, each with its stage, rep, and next follow-up (or
/// last contact) — the website's per-lead follow-up line.
class _Leads extends StatelessWidget {
  const _Leads({required this.leads});
  final List<Lead> leads;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    if (leads.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(14),
        decoration: homeCard(context, radius: 20),
        child: Text(l10n.clNoLeads, style: TextStyle(fontSize: 13, color: colors.inkMuted)),
      );
    }
    final now = DateTime.now();
    return _Items(rows: [
      for (final l in leads)
        () {
          final f = l.nextActionAt;
          final open = l.stage != 'WON' && l.stage != 'LOST';
          final (String next, Color tone) = f != null && open
              ? switch (leadFollowState(f, now)) {
                  LeadFollowState.overdue => (l10n.lvFollowOverdue(leadWhen(context, f)), colors.error),
                  LeadFollowState.today => (l10n.lvFollowToday(DateFormatter.time(f, languageCode: lang)), colors.warning),
                  LeadFollowState.upcoming => (
                      '${l10n.lvFollowNext(leadWhen(context, f))} · ${noteKindLabel(l10n, l.nextActionType ?? 'FOLLOW_UP')}',
                      AppPalette.gold600
                    ),
                }
              : (
                  l.lastContactAt != null ? l10n.lvLastContact(leadWhen(context, l.lastContactAt!, withTime: false)) : l10n.clNoFollowUp,
                  colors.inkMuted
                );
          return _Row(
            key: Key('client-lead-${l.id}'),
            icon: Icons.person_search_rounded,
            title: l.projectName?.resolve(lang) ?? l.projectInterest ?? l10n.navLeads,
            sub: [l.assignedSalesName ?? l10n.lvUnassigned, next].join(' · '),
            subColor: tone,
            status: leadStageLabel(l10n, l.stage),
            tone: leadStageColor(l.stage, colors),
            onTap: () => context.push('/leads/${l.id}', extra: l),
          );
        }(),
    ]);
  }
}

class _Items extends StatelessWidget {
  const _Items({required this.rows});
  final List<Widget> rows;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      decoration: homeCard(context, radius: 22),
      child: Column(children: [
        for (var i = 0; i < rows.length; i++)
          DecoratedBox(
            decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: colors.hairline))),
            child: rows[i],
          ),
      ]),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({super.key, required this.icon, required this.title, required this.sub, required this.status, required this.tone, this.onTap, this.subColor});
  final IconData icon;
  final String title;
  final String sub;
  final String status;
  final Color tone;
  final Color? subColor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 11),
        child: Row(children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(color: tone.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, size: 18, color: tone),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: colors.inkStrong)),
              if (sub.isNotEmpty)
                Text(sub,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 11.5, color: subColor ?? colors.inkMuted, fontWeight: subColor == null ? FontWeight.w400 : FontWeight.w700)),
            ]),
          ),
          const SizedBox(width: 6),
          ClientPill(text: status, color: tone),
          if (onTap != null) ...[const SizedBox(width: 2), Icon(Icons.chevron_left_rounded, size: 18, color: colors.inkMuted)],
        ]),
      ),
    );
  }
}

class _Rows extends StatelessWidget {
  const _Rows({required this.rows});
  final List<(String, String)> rows;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      decoration: homeCard(context, radius: 20),
      child: Column(children: [
        for (var i = 0; i < rows.length; i++)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: colors.hairline))),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              SizedBox(width: 120, child: Text(rows[i].$1, style: TextStyle(fontSize: 12, color: colors.inkMuted))),
              Expanded(child: Text(rows[i].$2, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.inkStrong))),
            ]),
          ),
      ]),
    );
  }
}

class _Line extends StatelessWidget {
  const _Line({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Row(children: [
          Icon(icon, size: 15, color: AppPalette.gold500),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: TextStyle(fontSize: 13, color: context.appColors.inkStrong))),
        ]),
      );
}

class _Btn extends StatelessWidget {
  const _Btn({required this.icon, required this.label, required this.onTap, this.filled = false});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Material(
      color: filled ? AppPalette.navy : colors.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: filled ? AppPalette.navy : colors.hairline)),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: SizedBox(
          height: 44,
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: 17, color: filled ? AppPalette.gold300 : colors.inkStrong),
            const SizedBox(width: 6),
            Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: filled ? Colors.white : colors.inkStrong)),
          ]),
        ),
      ),
    );
  }
}
