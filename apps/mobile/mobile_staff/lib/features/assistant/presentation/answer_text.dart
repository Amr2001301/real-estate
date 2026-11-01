import 'package:core/core.dart';
import 'package:flutter/material.dart';

/// One block of an answer: a paragraph, a list or a table.
sealed class AnswerBlock {
  const AnswerBlock();
}

class AnswerParagraph extends AnswerBlock {
  const AnswerParagraph(this.text);
  final String text;
}

class AnswerList extends AnswerBlock {
  const AnswerList(this.items, {required this.ordered});
  final List<String> items;
  final bool ordered;
}

class AnswerTable extends AnswerBlock {
  const AnswerTable(this.head, this.rows);
  final List<String> head;
  final List<List<String>> rows;
}

final _bullet = RegExp(r'^([-*•]|\d+[.)])\s+');
final _divider = RegExp(r'^:?-{2,}:?$');

/// The small part of Markdown the assistant writes — paragraphs, bullet and
/// numbered lists, pipe tables, **bold** and `#` headings — read into blocks.
/// Same rules as the web chat.
List<AnswerBlock> parseAnswer(String text) {
  final blocks = <AnswerBlock>[];
  final lines = text.replaceAll('\r\n', '\n').split('\n');
  var i = 0;
  while (i < lines.length) {
    final line = lines[i].trim();
    if (line.isEmpty) {
      i++;
      continue;
    }
    if (line.startsWith('|')) {
      final rows = <List<String>>[];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        final cells = lines[i].trim().replaceAll(RegExp(r'^\||\|$'), '').split('|').map((c) => c.trim()).toList();
        if (!cells.every(_divider.hasMatch)) rows.add(cells);
        i++;
      }
      if (rows.isNotEmpty) blocks.add(AnswerTable(rows.first, rows.sublist(1)));
      continue;
    }
    if (_bullet.hasMatch(line)) {
      final ordered = RegExp(r'^\d').hasMatch(line);
      final items = <String>[];
      while (i < lines.length && _bullet.hasMatch(lines[i].trim())) {
        items.add(lines[i].trim().replaceFirst(_bullet, ''));
        i++;
      }
      blocks.add(AnswerList(items, ordered: ordered));
      continue;
    }
    final para = <String>[];
    while (i < lines.length) {
      final l = lines[i].trim();
      if (l.isEmpty || l.startsWith('|') || _bullet.hasMatch(l)) break;
      para.add(l.replaceFirst(RegExp(r'^#{1,6}\s+'), ''));
      i++;
    }
    blocks.add(AnswerParagraph(para.join('\n')));
  }
  return blocks;
}

/// `**bold**` runs as spans; the rest plain. Digits are kept Western.
List<TextSpan> answerSpans(String text, TextStyle base) {
  final spans = <TextSpan>[];
  final parts = latinAnswer(text).split('**');
  for (var k = 0; k < parts.length; k++) {
    if (parts[k].isEmpty) continue;
    // An odd part sits between two ** — unless the last ** never closed.
    final bold = k.isOdd && k < parts.length - 1;
    spans.add(
      TextSpan(
        text: (k.isOdd && !bold) ? '**${parts[k]}' : parts[k],
        style: bold ? base.copyWith(fontWeight: FontWeight.w700) : base,
      ),
    );
  }
  return spans;
}

/// Arabic-Indic digits and separators → Western, like the rest of the app.
String latinAnswer(String s) => s
    .replaceAllMapped(RegExp('[٠-٩]'), (m) => String.fromCharCode(m[0]!.codeUnitAt(0) - 0x0660 + 0x30))
    .replaceAll('٬', ',')
    .replaceAll('٫', '.');

/// The assistant's answer, drawn as widgets (never as HTML).
class AnswerText extends StatelessWidget {
  const AnswerText(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) {
    final c = context.appColors;
    final base = TextStyle(fontSize: 14, height: 1.6, color: c.ink);
    final blocks = parseAnswer(text);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var b = 0; b < blocks.length; b++) ...[
          if (b > 0) const SizedBox(height: AppSpacing.xs),
          switch (blocks[b]) {
            AnswerParagraph(:final text) => Text.rich(TextSpan(children: answerSpans(text, base))),
            AnswerList(:final items, :final ordered) => Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var k = 0; k < items.length; k++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 2),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox(
                          width: 22,
                          child: Text(
                            ordered ? '${k + 1}.' : '•',
                            style: base.copyWith(color: c.brandGold, fontWeight: FontWeight.w700),
                          ),
                        ),
                        Expanded(child: Text.rich(TextSpan(children: answerSpans(items[k], base)))),
                      ],
                    ),
                  ),
              ],
            ),
            AnswerTable(:final head, :final rows) => _AnswerTable(head: head, rows: rows, base: base),
          },
        ],
      ],
    );
  }
}

class _AnswerTable extends StatelessWidget {
  const _AnswerTable({required this.head, required this.rows, required this.base});
  final List<String> head;
  final List<List<String>> rows;
  final TextStyle base;

  @override
  Widget build(BuildContext context) {
    final c = context.appColors;
    final cols = [head.length, ...rows.map((r) => r.length)].reduce((a, b) => a > b ? a : b);
    String cell(List<String> r, int k) => k < r.length ? r[k] : '';
    Widget cellBox(String t, {bool header = false}) => Padding(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      child: Text.rich(
        TextSpan(
          children: answerSpans(
            t,
            header
                ? base.copyWith(fontSize: 12.5, fontWeight: FontWeight.w700, color: c.inkMuted)
                : base.copyWith(fontSize: 13),
          ),
        ),
      ),
    );
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadii.sm),
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border.all(color: c.hairline),
          borderRadius: BorderRadius.circular(AppRadii.sm),
        ),
        child: LayoutBuilder(
          builder: (context, box) => SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            // At least as wide as the bubble; wider tables scroll.
            child: ConstrainedBox(
              constraints: BoxConstraints(minWidth: box.maxWidth - 2),
              child: Table(
                defaultColumnWidth: const IntrinsicColumnWidth(flex: 1),
                border: TableBorder(horizontalInside: BorderSide(color: c.hairline)),
                children: [
                  TableRow(
                    decoration: BoxDecoration(color: c.surfaceSoft),
                    children: [for (var k = 0; k < cols; k++) cellBox(cell(head, k), header: true)],
                  ),
                  for (final r in rows) TableRow(children: [for (var k = 0; k < cols; k++) cellBox(cell(r, k))]),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
