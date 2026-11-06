import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:core/core.dart';

/// The card over the hero's edge takes taps where it is drawn — the part
/// over the hero included — and the layout leaves no gap under it.
void main() {
  testWidgets('a tap on the card where it overlaps the hero reaches the card', (t) async {
    var card = 0;
    var hero = 0;
    await t.pumpWidget(MaterialApp(
      home: Scaffold(
        body: ListView(children: [
          HomeOverlap(
            overlap: 40,
            top: GestureDetector(onTap: () => hero++, child: Container(key: const Key('hero'), height: 200, color: Colors.blue)),
            bottom: GestureDetector(onTap: () => card++, child: Container(key: const Key('card'), height: 100, color: Colors.white)),
          ),
          Container(key: const Key('after'), height: 50),
        ]),
      ),
    ));
    // The card starts 40px into the hero: 160..260.
    expect(t.getTopLeft(find.byKey(const Key('card'))).dy, 160);
    expect(t.getTopLeft(find.byKey(const Key('after'))).dy, 260); // no gap
    await t.tapAt(const Offset(200, 170)); // over the hero, on the card
    expect(card, 1);
    expect(hero, 0);
    await t.tapAt(const Offset(200, 100)); // the hero above the card
    expect(hero, 1);
  });
}
