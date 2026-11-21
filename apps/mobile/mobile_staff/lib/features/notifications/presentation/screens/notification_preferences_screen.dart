import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../domain/notification_preferences.dart';

/// Per-group e-mail / phone switches (design n2). Each change is saved at once
/// and put back if the save fails. In-app notifications are never switched off.
class NotificationPreferencesScreen extends StatefulWidget {
  const NotificationPreferencesScreen({super.key, required this.api});

  final NotificationPreferencesRepository api;

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
                        padding: EdgeInsets.fromLTRB(AppSpacing.md, 0, AppSpacing.md, MediaQuery.paddingOf(context).bottom + 24),
                        children: [
                          Padding(
                            padding: const EdgeInsets.fromLTRB(4, 14, 4, 0),
                            child: Text(l10n.npHint, style: TextStyle(fontSize: 12.5, height: 1.6, color: colors.inkMuted)),
                          ),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                            child: Row(children: [
                              const Spacer(),
                              for (final channel in prefChannels)
                                SizedBox(
                                  width: 64,
                                  child: Text(channel == 'email' ? l10n.npEmailShort : l10n.npPushShort,
                                      textAlign: TextAlign.center, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: colors.inkMuted)),
                                ),
                            ]),
                          ),
                          Container(
                            decoration: homeCard(context, radius: 22),
                            child: Column(children: [
                              for (final (i, group) in prefGroups.indexed) ...[
                                if (i > 0) Divider(height: 1, thickness: 1, indent: 16, endIndent: 16, color: colors.hairline),
                                Padding(
                                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
                                  child: Row(children: [
                                    Expanded(
                                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                        Text(groups[group]!.$1, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: colors.inkStrong)),
                                        const SizedBox(height: 2),
                                        Text(groups[group]!.$2, style: TextStyle(fontSize: 12, height: 1.4, color: colors.inkMuted)),
                                      ]),
                                    ),
                                    for (final channel in prefChannels)
                                      SizedBox(
                                        width: 64,
                                        child: Center(
                                          child: Switch(
                                            key: Key('pref-$channel-$group'),
                                            value: prefs[channel]![group]!,
                                            activeThumbColor: Colors.white,
                                            activeTrackColor: AppPalette.gold500,
                                            inactiveTrackColor: colors.surfaceSoft,
                                            onChanged: _saving ? null : (v) => _toggle(channel, group, v),
                                          ),
                                        ),
                                      ),
                                  ]),
                                ),
                              ],
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
