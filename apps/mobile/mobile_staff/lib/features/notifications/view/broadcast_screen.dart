import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../contracts/create/contract_create_data.dart' show PickHit;
import '../../contracts/create/manual_contract_screen.dart' show PickSheet;
import 'broadcast_data.dart';

/// Send a notification by hand, for the admin (design n3, owner-approved
/// 2026-11-05): the audience, the text in both languages, the channel, the
/// page it opens, a preview, then an estimate and a confirmed send.
class BroadcastScreen extends StatefulWidget {
  const BroadcastScreen({super.key, required this.repository});
  final BroadcastRepository repository;

  @override
  State<BroadcastScreen> createState() => _BroadcastScreenState();
}

class _BroadcastScreenState extends State<BroadcastScreen> {
  final _titleAr = TextEditingController();
  final _titleEn = TextEditingController();
  final _bodyAr = TextEditingController();
  final _bodyEn = TextEditingController();

  @override
  void dispose() {
    for (final c in [_titleAr, _titleEn, _bodyAr, _bodyEn]) {
      c.dispose();
    }
    super.dispose();
  }

  void _content(BroadcastCubit cubit) {
    final s = cubit.state.content;
    cubit.setContent(BroadcastContent(titleAr: _titleAr.text, titleEn: _titleEn.text, bodyAr: _bodyAr.text, bodyEn: _bodyEn.text, entityType: s.entityType, entityId: s.entityId, entityLabel: s.entityLabel));
  }

  Future<void> _pickUser(BroadcastCubit cubit) async {
    final l10n = context.l10n;
    final hit = await showModalBottomSheet<PickHit>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => PickSheet(title: l10n.bcPickUser, hint: l10n.bcSearchUser, keyPrefix: 'bc-user', search: widget.repository.searchUsers),
    );
    if (hit == null) return;
    final a = cubit.state.audience;
    cubit.setAudience(BroadcastAudience(target: BroadcastTarget.user, channel: a.channel, role: a.role, userId: hit.id, userName: hit.title));
  }

  Future<void> _pickRecord(BroadcastCubit cubit, String type) async {
    final l10n = context.l10n;
    final hit = await showModalBottomSheet<PickHit>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => PickSheet(title: l10n.bcRecord, hint: l10n.bcRecordHint, keyPrefix: 'bc-record', search: (q) => widget.repository.searchRecords(type, q)),
    );
    if (hit == null) return;
    final c = cubit.state.content;
    cubit.setContent(BroadcastContent(titleAr: c.titleAr, titleEn: c.titleEn, bodyAr: c.bodyAr, bodyEn: c.bodyEn, entityType: type, entityId: hit.id, entityLabel: hit.title));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    return BlocProvider(
      create: (_) => BroadcastCubit(widget.repository),
      child: BlocConsumer<BroadcastCubit, BroadcastState>(
        listenWhen: (a, b) => a.result != b.result && b.result != null,
        listener: (context, s) {
          for (final c in [_titleAr, _titleEn, _bodyAr, _bodyEn]) {
            c.clear();
          }
        },
        builder: (context, s) {
          final cubit = context.read<BroadcastCubit>();
          final a = s.audience;
          final roles = {
            'CUSTOMER': l10n.bcRoleCustomer,
            'BROKER': l10n.roleBroker,
            'SALES': l10n.roleSales,
            'SALES_MANAGER': l10n.roleSalesManager,
            'MAINTENANCE_SUPERVISOR': l10n.roleMaintenance,
            'ADMIN': l10n.roleAdmin,
          };
          final targets = <(BroadcastTarget, String, String?)>[
            (BroadcastTarget.allCustomers, l10n.bcAllCustomers, l10n.bcAllCustomersHint),
            (BroadcastTarget.allBrokers, l10n.bcAllBrokers, null),
            (BroadcastTarget.allSales, l10n.bcAllSales, null),
            (BroadcastTarget.allSupervisors, l10n.bcAllSupervisors, null),
            (BroadcastTarget.allActive, l10n.bcAllActiveUsers, null),
            (BroadcastTarget.role, l10n.bcRole, a.target == BroadcastTarget.role ? roles[a.role] : null),
            (BroadcastTarget.user, l10n.bcUser, a.target == BroadcastTarget.user ? (a.userName ?? l10n.bcSearchUser) : l10n.bcSearchUser),
          ];
          final needEstimate = isMassTarget(a.target) || a.needsDevices;
          final p = s.preview;
          final entities = {'contract': l10n.bcEntityContract, 'reservation': l10n.bcEntityReservation, 'lead': l10n.bcEntityLead};
          final e = s.content.entityType;
          return AnnotatedRegion<SystemUiOverlayStyle>(
            value: SystemUiOverlayStyle.light,
            child: Scaffold(
              body: Column(children: [
                Expanded(
                  child: ListView(padding: EdgeInsets.only(bottom: 24 + MediaQuery.viewInsetsOf(context).bottom), children: [
                    HomeListHero(title: l10n.bcTitle, subtitle: l10n.bcSubtitle, back: true),
                    if (s.result != null) _ResultCard(result: s.result!),
                    HomeSection(
                      icon: Icons.groups_rounded,
                      title: l10n.bcAudience,
                      child: Column(children: [
                        for (final (t, label, sub) in targets)
                          _Opt(
                            key: Key('bc-target-${t.name}'),
                            label: label,
                            sub: sub,
                            on: a.target == t,
                            onTap: () {
                              if (t == BroadcastTarget.user) {
                                _pickUser(cubit);
                              } else {
                                cubit.setAudience(BroadcastAudience(target: t, channel: a.channel, role: a.role));
                              }
                            },
                          ),
                        if (a.target == BroadcastTarget.role)
                          Wrap(spacing: 6, runSpacing: 6, children: [
                            for (final r in roles.entries)
                              ChoiceChip(
                                key: Key('bc-role-${r.key}'),
                                label: Text(r.value),
                                selected: a.role == r.key,
                                onSelected: (_) => cubit.setAudience(BroadcastAudience(target: BroadcastTarget.role, channel: a.channel, role: r.key)),
                              ),
                          ]),
                      ]),
                    ),
                    HomeSection(
                      icon: Icons.edit_rounded,
                      title: l10n.bcContent,
                      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                        _Field(key: const Key('bc-title-ar'), label: l10n.bcTitleAr, controller: _titleAr, maxLength: 200, onChanged: (_) => _content(cubit)),
                        _Field(key: const Key('bc-title-en'), label: l10n.bcTitleEn, controller: _titleEn, maxLength: 200, ltrText: true, onChanged: (_) => _content(cubit)),
                        _Field(key: const Key('bc-body-ar'), label: l10n.bcBodyAr, controller: _bodyAr, maxLength: 500, lines: 3, onChanged: (_) => _content(cubit)),
                        _Field(key: const Key('bc-body-en'), label: l10n.bcBodyEn, controller: _bodyEn, maxLength: 500, lines: 3, ltrText: true, onChanged: (_) => _content(cubit)),
                        Padding(padding: const EdgeInsets.only(top: 2), child: Text(l10n.bcBothRequired, style: TextStyle(fontSize: 12, color: colors.inkMuted))),
                      ]),
                    ),
                    HomeSection(
                      icon: Icons.send_rounded,
                      title: l10n.bcChannel,
                      child: Column(children: [
                        _Opt(key: const Key('bc-channel-inApp'), label: l10n.bcInApp, sub: l10n.bcInAppHint, on: a.channel == BroadcastChannel.inApp, onTap: () => cubit.setAudience(BroadcastAudience(target: a.target, channel: BroadcastChannel.inApp, role: a.role, userId: a.userId, userName: a.userName))),
                        _Opt(key: const Key('bc-channel-push'), label: l10n.bcPush, sub: l10n.bcPushHint, on: a.channel == BroadcastChannel.push, onTap: () => cubit.setAudience(BroadcastAudience(target: a.target, channel: BroadcastChannel.push, role: a.role, userId: a.userId, userName: a.userName))),
                        _Opt(key: const Key('bc-channel-both'), label: l10n.bcBoth, sub: l10n.bcBothHint, on: a.channel == BroadcastChannel.both, onTap: () => cubit.setAudience(BroadcastAudience(target: a.target, channel: BroadcastChannel.both, role: a.role, userId: a.userId, userName: a.userName))),
                      ]),
                    ),
                    HomeSection(
                      icon: Icons.link_rounded,
                      title: l10n.bcLink,
                      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                        Wrap(spacing: 6, runSpacing: 6, children: [
                          ChoiceChip(
                            key: const Key('bc-entity-none'),
                            label: Text(l10n.bcLinkNone),
                            selected: e == null,
                            onSelected: (_) => cubit.setContent(BroadcastContent(titleAr: s.content.titleAr, titleEn: s.content.titleEn, bodyAr: s.content.bodyAr, bodyEn: s.content.bodyEn)),
                          ),
                          for (final en in entities.entries)
                            ChoiceChip(
                              key: Key('bc-entity-${en.key}'),
                              label: Text(en.value),
                              selected: e == en.key,
                              onSelected: (_) => _pickRecord(cubit, en.key),
                            ),
                        ]),
                        if (e != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 6),
                            child: Text(s.content.entityLabel == null ? l10n.bcRecordHint : '${entities[e]} · ${ltr(s.content.entityLabel!)}',
                                style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                          ),
                        Padding(padding: const EdgeInsets.only(top: 6), child: Text(l10n.bcLinkNote, style: TextStyle(fontSize: 12, color: colors.inkMuted))),
                      ]),
                    ),
                    HomeSection(
                      icon: Icons.visibility_rounded,
                      title: l10n.bcPreview,
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(color: colors.surface, borderRadius: BorderRadius.circular(20), border: Border.all(color: colors.hairline)),
                        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Container(width: 42, height: 42, decoration: BoxDecoration(color: AppPalette.gold500.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(14)), child: const Icon(Icons.campaign_rounded, color: AppPalette.gold600)),
                          const SizedBox(width: 11),
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(_titleAr.text.isEmpty ? l10n.bcTitleAr : _titleAr.text, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: _titleAr.text.isEmpty ? colors.inkMuted : colors.inkStrong)),
                              Text(_bodyAr.text.isEmpty ? l10n.bcBodyAr : _bodyAr.text, style: TextStyle(fontSize: 12, height: 1.55, color: colors.inkMuted)),
                              Text(l10n.bcNow, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                            ]),
                          ),
                        ]),
                      ),
                    ),
                    if (p != null)
                      HomeSection(
                        icon: Icons.fact_check_rounded,
                        title: l10n.bcSummary,
                        child: Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(gradient: homeNavyGradient, borderRadius: BorderRadius.circular(20)),
                          child: Column(children: [
                            _SumRow(l10n.bcAudience, switch (a.target) {
                              BroadcastTarget.role => roles[a.role] ?? a.role,
                              BroadcastTarget.user => a.userName ?? '',
                              _ => targets.firstWhere((t) => t.$1 == a.target).$2,
                            }),
                            _SumRow(l10n.bcRecipients, l10n.bcRecipientsN(p.recipients)),
                            _SumRow(l10n.bcChannel, switch (a.channel) { BroadcastChannel.inApp => l10n.bcInApp, BroadcastChannel.push => l10n.bcPush, BroadcastChannel.both => l10n.bcBoth }),
                            if (a.needsDevices && p.pushEnabled) _SumRow(l10n.bcDevices, l10n.bcDevicesN(p.devices ?? 0, p.withoutDevice ?? 0)),
                            if (a.needsDevices)
                              Padding(
                                padding: const EdgeInsets.only(top: 8),
                                child: Text(
                                  !p.pushEnabled ? l10n.bcPushOff : ((p.devices ?? 0) == 0 ? l10n.bcNoDevices : l10n.bcPushReady),
                                  style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: !p.pushEnabled || (p.devices ?? 0) == 0 ? const Color(0xFFFFB4A9) : AppPalette.gold300),
                                ),
                              ),
                            if (p.recipients == 0)
                              Padding(padding: const EdgeInsets.only(top: 8), child: Text(l10n.bcNoRecipients, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFFFFB4A9)))),
                          ]),
                        ),
                      ),
                    if (p != null && isMassTarget(a.target) && p.recipients > 0)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(AppSpacing.md, 12, AppSpacing.md, 0),
                        child: InkWell(
                          key: const Key('bc-confirm'),
                          borderRadius: BorderRadius.circular(14),
                          onTap: () => cubit.setConfirmed(!s.confirmed),
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(color: const Color(0xFFFCEBCF), borderRadius: BorderRadius.circular(14)),
                            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Icon(s.confirmed ? Icons.check_box_rounded : Icons.check_box_outline_blank_rounded, color: AppPalette.navy),
                              const SizedBox(width: 10),
                              Expanded(child: Text(l10n.bcConfirmMass(p.recipients), style: const TextStyle(fontSize: 12, height: 1.6, color: Color(0xFF6B4510)))),
                            ]),
                          ),
                        ),
                      ),
                    if (s.failure != null) Padding(padding: const EdgeInsets.fromLTRB(AppSpacing.md, 12, AppSpacing.md, 0), child: Text(s.failure!.userMessage(l10n), style: TextStyle(color: colors.error, fontSize: 12.5))),
                  ]),
                ),
                Container(
                  padding: EdgeInsets.fromLTRB(16, 10, 16, 10 + MediaQuery.paddingOf(context).bottom),
                  decoration: BoxDecoration(color: colors.canvas, border: Border(top: BorderSide(color: colors.hairline))),
                  child: Row(children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        key: const Key('bc-estimate'),
                        onPressed: s.previewing || !a.complete ? null : cubit.estimate,
                        icon: s.previewing ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.calculate_rounded, size: 18),
                        label: Text(l10n.bcEstimate, maxLines: 1, overflow: TextOverflow.ellipsis),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size.fromHeight(48),
                          foregroundColor: colors.inkStrong,
                          side: const BorderSide(color: AppPalette.navy, width: 1.2),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                          textStyle: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: FilledButton.icon(
                        key: const Key('bc-send'),
                        onPressed: s.canSend ? cubit.send : null,
                        icon: s.sending ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: AppPalette.navy)) : const Icon(Icons.send_rounded, size: 18),
                        label: Text(p != null && p.recipients > 0 && needEstimate ? l10n.bcSendN(p.recipients) : l10n.bcSend, maxLines: 1, overflow: TextOverflow.ellipsis),
                        style: FilledButton.styleFrom(
                          minimumSize: const Size.fromHeight(48),
                          backgroundColor: AppPalette.gold400,
                          foregroundColor: AppPalette.navy,
                          textStyle: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                        ),
                      ),
                    ),
                  ]),
                ),
              ]),
            ),
          );
        },
      ),
    );
  }
}

class _Opt extends StatelessWidget {
  const _Opt({super.key, required this.label, required this.on, required this.onTap, this.sub});
  final String label;
  final String? sub;
  final bool on;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
          decoration: BoxDecoration(
            color: on ? const Color(0xFFFFFCF5) : colors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: on ? AppPalette.navy : colors.hairline, width: 1.5),
          ),
          child: Row(children: [
            Icon(on ? Icons.radio_button_checked_rounded : Icons.radio_button_unchecked_rounded, size: 20, color: on ? AppPalette.navy : colors.inkMuted),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: colors.inkStrong)),
                if (sub != null) Text(sub!, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({super.key, required this.label, required this.controller, required this.onChanged, this.maxLength, this.lines = 1, this.ltrText = false});
  final String label;
  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final int? maxLength;
  final int lines;
  final bool ltrText;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: TextField(
        controller: controller,
        onChanged: onChanged,
        maxLength: maxLength,
        minLines: lines,
        maxLines: lines + 1,
        textDirection: ltrText ? TextDirection.ltr : null,
        decoration: InputDecoration(
          labelText: label,
          counterText: '',
          filled: true,
          fillColor: colors.surface,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: colors.hairline, width: 1.5)),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: colors.hairline, width: 1.5)),
        ),
      ),
    );
  }
}

class _SumRow extends StatelessWidget {
  const _SumRow(this.k, this.v);
  final String k;
  final String v;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(children: [
          Text(k, style: const TextStyle(fontSize: 12.5, color: Color(0xFFC9D2DE))),
          const Spacer(),
          Flexible(child: Text(v, textAlign: TextAlign.end, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.white))),
        ]),
      );
}

class _ResultCard extends StatelessWidget {
  const _ResultCard({required this.result});
  final BroadcastResult result;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final o = result.outcome;
    final color = o == 0 ? const Color(0xFF2F6B4A) : (o == 1 ? const Color(0xFF8A5A12) : const Color(0xFFB3261E));
    final bg = o == 0 ? const Color(0xFFE6F2EA) : (o == 1 ? const Color(0xFFFCEBCF) : const Color(0xFFFBE7E4));
    Widget line(String k, int v) => Text('$k: ${ltr('$v')}', style: TextStyle(fontSize: 12, height: 1.8, color: color));
    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 0),
      child: Container(
        key: const Key('bc-result'),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(18)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(l10n.bcResult, style: TextStyle(fontSize: 12, color: color)),
          Text(o == 0 ? l10n.bcResOk : (o == 1 ? l10n.bcResPartial : l10n.bcResFail), style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: color)),
          const SizedBox(height: 4),
          line(l10n.bcRecipients, result.recipients),
          if (result.usesInApp) line(l10n.bcResInApp, result.created),
          if (result.usesInApp && result.failed > 0) line(l10n.bcResFailed, result.failed),
          if (result.usesPush) line(l10n.bcResPush, result.pushSent),
          if (result.usesPush && result.noDevice > 0) line(l10n.bcResNoDev, result.noDevice),
          if (result.usesPush && result.pushFailed > 0) line(l10n.bcResFailed, result.pushFailed),
        ]),
      ),
    );
  }
}
