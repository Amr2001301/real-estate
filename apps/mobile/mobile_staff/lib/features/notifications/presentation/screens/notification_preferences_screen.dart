import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../data/notification_preferences_api.dart';

/// Per-group e-mail / phone switches (design n2). Each change is saved at once
/// and put back if the save fails. In-app notifications are never switched off.
class NotificationPreferencesScreen extends StatefulWidget {
  const NotificationPreferencesScreen({super.key, required this.api});

  final NotificationPreferencesApi api;

  @override
  State<NotificationPreferencesScreen> createState() => _NotificationPreferencesScreenState();
}

class _NotificationPreferencesScreenState extends State<NotificationPreferencesScreen> {
  NotificationPrefs? _prefs;
  AppFailure? _failure;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _failure = null);
    final result = await widget.api.load();
    if (!mounted) return;
    result.when(ok: (prefs) => setState(() => _prefs = prefs), err: (failure) => setState(() => _failure = failure));
  }

  Future<void> _toggle(String channel, String group, bool value) async {
    final previous = _prefs!;
    setState(() {
      _saving = true;
      _prefs = {
        ...previous,
        channel: {...previous[channel]!, group: value},
      };
    });
    final result = await widget.api.set(channel, group, value);
    if (!mounted) return;
    setState(() {
      _saving = false;
      final failure = result.failureOrNull;
      if (failure != null) {
        _prefs = previous;
        AppLog.failure(failure);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(context.l10n.npSaveError)));
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final prefs = _prefs;
    final groups = {
      'sales': (l10n.npGroupSales, l10n.npGroupSalesHint),
      'finance': (l10n.npGroupFinance, l10n.npGroupFinanceHint),
      'maintenance': (l10n.npGroupMaintenance, l10n.npGroupMaintenanceHint),
      'account': (l10n.npGroupAccount, l10n.npGroupAccountHint),
    };
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: Column(children: [
          HomeListHero(title: l10n.ntPrefs, back: true),
          Expanded(
            child: _failure != null
                ? ErrorState(failure: _failure, onRetry: _load)
                : prefs == null
                    ? const KitSettingsSkeleton()
                    : ListView(
                        padding: EdgeInsets.fromLTRB(AppSpacing.md, 12, AppSpacing.md, MediaQuery.paddingOf(context).bottom + 24),
                        children: [
                          Padding(
                            padding: const EdgeInsets.fromLTRB(4, 0, 4, 12),
                            child: Text(l10n.npHint, style: TextStyle(fontSize: 12, height: 1.6, color: colors.inkMuted)),
                          ),
                          for (final group in prefGroups)
                            Container(
                              margin: const EdgeInsets.only(bottom: 10),
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                              decoration: homeCard(context, radius: 22),
                              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                                Padding(
                                  padding: const EdgeInsets.only(top: 8, bottom: 2),
                                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                    Text(groups[group]!.$1, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: colors.inkStrong)),
                                    Text(groups[group]!.$2, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                                  ]),
                                ),
                                for (final (i, channel) in prefChannels.indexed)
                                  Container(
                                    decoration: BoxDecoration(border: Border(top: i == 0 ? BorderSide.none : BorderSide(color: colors.hairline))),
                                    child: Row(children: [
                                      Icon(channel == 'email' ? Icons.mail_rounded : Icons.notifications_active_rounded, size: 20, color: const Color(0xFF26405F)),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Padding(
                                          padding: const EdgeInsets.symmetric(vertical: 8),
                                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                            Text(channel == 'email' ? l10n.npEmail : l10n.npPush, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                                            Text(channel == 'email' ? l10n.npEmailHint : l10n.npPushHint, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                                          ]),
                                        ),
                                      ),
                                      Switch(
                                        key: Key('pref-$channel-$group'),
                                        value: prefs[channel]![group]!,
                                        activeThumbColor: AppPalette.gold300,
                                        activeTrackColor: AppPalette.navy,
                                        onChanged: _saving ? null : (v) => _toggle(channel, group, v),
                                      ),
                                    ]),
                                  ),
                              ]),
                            ),
                        ],
                      ),
          ),
        ]),
      ),
    );
  }
}
