/// Wraps left-to-right text (a phone number, a contract or unit code) in
/// Unicode isolates so it keeps its own order inside Arabic text: without
/// them "+201009900084" shows as "201009900084+" and "#CON-2026-0005" as
/// "CON-2026-0005#". Empty text stays empty.
String ltr(String? text) {
  final t = text ?? '';
  return t.isEmpty ? t : '\u2066$t\u2069';
}
