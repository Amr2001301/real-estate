import 'package:core/core.dart';
import 'package:flutter/material.dart';

/// FU1 — the words and icons for logged activities and follow-ups, shared by
/// the lead timeline, the log-activity sheet and the follow-ups list.

const kNoteKinds = ['NOTE', 'CALL', 'MEETING', 'WHATSAPP', 'FOLLOW_UP'];
const kCallResults = ['ANSWERED', 'NO_ANSWER', 'BUSY', 'UNREACHABLE', 'WRONG_NUMBER'];
const kNextActionTypes = ['CALL', 'MEETING', 'WHATSAPP', 'FOLLOW_UP'];

String noteKindLabel(AppLocalizations l10n, String kind) => switch (kind) {
      'CALL' => l10n.noteKindCall,
      'MEETING' => l10n.noteKindMeeting,
      'WHATSAPP' => l10n.noteKindWhatsapp,
      'FOLLOW_UP' => l10n.noteKindFollowUp,
      _ => l10n.noteKindNote,
    };

String callResultLabel(AppLocalizations l10n, String result) => switch (result) {
      'ANSWERED' => l10n.callResultAnswered,
      'NO_ANSWER' => l10n.callResultNoAnswer,
      'BUSY' => l10n.callResultBusy,
      'UNREACHABLE' => l10n.callResultUnreachable,
      'WRONG_NUMBER' => l10n.callResultWrongNumber,
      _ => result,
    };

/// A good call is green; one that did not get through is amber; a wrong
/// number is red.
BadgeTone callResultTone(String result) => switch (result) {
      'ANSWERED' => BadgeTone.success,
      'WRONG_NUMBER' => BadgeTone.error,
      _ => BadgeTone.warning,
    };

IconData noteKindIcon(String kind) => switch (kind) {
      'CALL' => Icons.phone_rounded,
      'MEETING' => Icons.groups_rounded,
      'WHATSAPP' => Icons.chat_rounded,
      'FOLLOW_UP' => Icons.event_repeat_rounded,
      _ => Icons.sticky_note_2_rounded,
    };

Color noteKindColor(String kind) => switch (kind) {
      'CALL' => const Color(0xFF2E7D32),
      'MEETING' => const Color(0xFF6A1B9A),
      'WHATSAPP' => const Color(0xFF128C7E),
      'FOLLOW_UP' => const Color(0xFF1565C0),
      _ => const Color(0xFFC8A24B),
    };

/// The follow-up type that goes with what was just logged.
String nextTypeFor(String kind) => kNextActionTypes.contains(kind) ? kind : 'CALL';

/// When a follow-up is due, the way a rep says it: "النهارده 3:00 م",
/// "بكرة 10:00 ص", or the date and time.
String followUpWhen(DateTime at, AppLocalizations l10n, String lang, {DateTime? now}) {
  final local = at.toLocal();
  final today = DateUtils.dateOnly(now ?? DateTime.now());
  final day = DateUtils.dateOnly(local);
  final time = clockTime(local, lang);
  final diff = day.difference(today).inDays;
  if (diff == 0) return '${l10n.followUpsToday} $time';
  if (diff == 1) return '${lang == 'ar' ? 'بكرة' : 'Tomorrow'} $time';
  if (diff == -1) return '${lang == 'ar' ? 'امبارح' : 'Yesterday'} $time';
  return '${followUpDate(local, lang)} $time';
}

/// A short date in Western digits, like the dashboard: "29 أكتوبر 2026".
String followUpDate(DateTime d, String lang) => latinDigits(DateFormatter.shortDate(d, languageCode: lang));

/// Arabic-Indic digits → Western digits (and the Arabic thousands and
/// decimal separators → "," and "."), so dates and amounts read like the
/// times next to them.
String latinDigits(String s) => s
    .replaceAllMapped(
      RegExp('[\u0660-\u0669]'),
      (m) => String.fromCharCode(m[0]!.codeUnitAt(0) - 0x0660 + 0x30),
    )
    .replaceAll('\u066C', ',')
    .replaceAll('\u066B', '.');

/// A time of day on a 12-hour clock: "3:05 م" / "3:05 PM".
String clockTime(DateTime t, String lang) {
  final h = t.hour % 12 == 0 ? 12 : t.hour % 12;
  final m = t.minute.toString().padLeft(2, '0');
  final pm = t.hour >= 12;
  final suffix = lang == 'ar' ? (pm ? 'م' : 'ص') : (pm ? 'PM' : 'AM');
  return '$h:$m $suffix';
}
