/// Wraps left-to-right text (a phone number, a contract or unit code) in
/// Unicode isolates so it keeps its own order inside Arabic text: without
/// them "+201009900084" shows as "201009900084+" and "#CON-2026-0005" as
/// "CON-2026-0005#". Empty text stays empty.
String ltr(String? text) {
  final t = text ?? '';
  return t.isEmpty ? t : '\u2066$t\u2069';
}

final _latinRun = RegExp(r'[#A-Za-z0-9][A-Za-z0-9#/_.\-]*[A-Za-z0-9]');

/// Keeps every Latin code inside mixed Arabic text in its own order — a plan
/// named «خطة 5 سنوات — DF-LB-Z01-302» otherwise reads
/// «DF-LB- — خطة 5 سنوات Z01-302». Runs with a Latin letter are isolated;
/// numbers alone are left as they are.
String ltrRuns(String? text) {
  final t = text ?? '';
  return t.replaceAllMapped(_latinRun, (m) {
    final run = m.group(0)!;
    return RegExp('[A-Za-z]').hasMatch(run) ? '\u2066$run\u2069' : run;
  });
}
