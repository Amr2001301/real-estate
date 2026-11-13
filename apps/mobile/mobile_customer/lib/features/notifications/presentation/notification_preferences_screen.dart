import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../../common/request_kit.dart';
import '../data/notification_preferences_api.dart';

/// Per-group e-mail / push switches. Each change is saved at once and put
/// back if the save fails. In-app notifications are never switched off.
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
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_t(context).saveError)));
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = _t(context);
    final prefs = _prefs;
    return Scaffold(
      body: Column(
        children: [
          AppNavHeader(title: t.title, compact: true, leadingAction: const NavHeaderBack()),
          Expanded(
            child: _failure != null
                ? ErrorState(failure: _failure, onRetry: _load)
                : prefs == null
                ? const KitSettingsSkeleton()
                : ListView(
                    padding: EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.md, AppSpacing.md, AppSpacing.xl + MediaQuery.paddingOf(context).bottom),
                    children: [
                      Text(t.hint, style: TextStyle(fontSize: 13.5, height: 1.5, color: context.appColors.inkMuted)),
                      for (final group in prefGroups)
                        RequestStep(
                          icon: _groupIcon(group),
                          title: t.groups[group]!,
                          child: Column(
                            children: [
                              for (final channel in prefChannels)
                                SwitchListTile(
                                  contentPadding: EdgeInsets.zero,
                                  dense: true,
                                  secondary: Icon(
                                    channel == 'email' ? Icons.mail_outline_rounded : Icons.phone_iphone_rounded,
                                    size: 20,
                                    color: AppPalette.gold500,
                                  ),
                                  title: Text(channel == 'email' ? t.email : t.push, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                                  value: prefs[channel]![group]!,
                                  onChanged: _saving ? null : (v) => _toggle(channel, group, v),
                                ),
                            ],
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

IconData _groupIcon(String group) => switch (group) {
      'sales' => Icons.event_available_rounded,
      'finance' => Icons.payments_rounded,
      'maintenance' => Icons.build_rounded,
      _ => Icons.person_rounded,
    };

class _Texts {
  const _Texts({
    required this.title,
    required this.hint,
    required this.email,
    required this.push,
    required this.saveError,
    required this.groups,
  });

  final String title;
  final String hint;
  final String email;
  final String push;
  final String saveError;
  final Map<String, String> groups;
}

_Texts _t(BuildContext context) => Localizations.localeOf(context).languageCode == 'ar'
    ? const _Texts(
        title: 'تفضيلات الإشعارات',
        hint: 'تصلك الإشعارات داخل التطبيق دائماً. اختر ما يصلك منها أيضاً بالبريد أو كإشعار على الهاتف.',
        email: 'البريد الإلكتروني',
        push: 'إشعار على الهاتف',
        saveError: 'تعذّر حفظ التغيير، حاول مرة أخرى.',
        groups: {
          'sales': 'الزيارات والحجوزات والعقود',
          'finance': 'الأقساط والدفعات',
          'maintenance': 'الصيانة',
          'account': 'الحساب',
        },
      )
    : const _Texts(
        title: 'Notification preferences',
        hint:
            'In-app notifications always arrive. Choose which ones also reach you by e-mail or as a phone notification.',
        email: 'E-mail',
        push: 'Phone notification',
        saveError: 'Could not save the change. Please try again.',
        groups: {
          'sales': 'Visits, reservations and contracts',
          'finance': 'Installments and payments',
          'maintenance': 'Maintenance',
          'account': 'Account',
        },
      );
