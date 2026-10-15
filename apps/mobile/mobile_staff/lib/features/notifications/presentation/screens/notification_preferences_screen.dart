import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../data/notification_preferences_api.dart';

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
    result.when(
      ok: (prefs) => setState(() => _prefs = prefs),
      err: (failure) => setState(() => _failure = failure),
    );
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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_t(context).saveError)),
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = _t(context);
    final prefs = _prefs;
    return Scaffold(
      appBar: AppBar(title: Text(t.title)),
      body: _failure != null
          ? ErrorState(failure: _failure, onRetry: _load)
          : prefs == null
              ? const Center(child: CircularProgressIndicator())
              : ListView(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  children: [
                    Text(t.hint, style: Theme.of(context).textTheme.bodyMedium),
                    const SizedBox(height: AppSpacing.md),
                    for (final group in prefGroups)
                      Card(
                        margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Padding(
                              padding: const EdgeInsetsDirectional.fromSTEB(
                                AppSpacing.md,
                                AppSpacing.md,
                                AppSpacing.md,
                                0,
                              ),
                              child: Text(
                                t.groups[group]!,
                                style: Theme.of(context).textTheme.titleSmall,
                              ),
                            ),
                            for (final channel in prefChannels)
                              SwitchListTile(
                                title: Text(channel == 'email' ? t.email : t.push),
                                value: prefs[channel]![group]!,
                                onChanged: _saving ? null : (v) => _toggle(channel, group, v),
                              ),
                          ],
                        ),
                      ),
                  ],
                ),
    );
  }
}

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
        hint: 'تصلك الإشعارات داخل التطبيق دائماً. اختر ما يصلك منها أيضاً بالبريد أو كإشعار على الموبايل.',
        email: 'البريد الإلكتروني',
        push: 'إشعار على الموبايل',
        saveError: 'تعذّر حفظ التغيير، حاول مرة أخرى.',
        groups: {
          'sales': 'المبيعات — العملاء والزيارات والحجوزات والعقود',
          'finance': 'المالية — الأقساط والدفعات والشيكات والمكافآت',
          'maintenance': 'الصيانة',
          'account': 'الحساب والاشتراك والفريق',
        },
      )
    : const _Texts(
        title: 'Notification preferences',
        hint: 'In-app notifications always arrive. Choose which ones also reach you by e-mail or as a phone notification.',
        email: 'E-mail',
        push: 'Phone notification',
        saveError: 'Could not save the change. Please try again.',
        groups: {
          'sales': 'Sales — leads, visits, reservations and contracts',
          'finance': 'Finance — installments, payments, cheques and bonuses',
          'maintenance': 'Maintenance',
          'account': 'Account, subscription and team',
        },
      );
