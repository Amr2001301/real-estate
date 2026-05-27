import 'package:flutter/widgets.dart';

/// Border-radius scale ported from the web (xl=14, 2xl=18, 3xl=24, 4xl=32).
/// Primary buttons use a pill shape; cards/inputs use [card]/[input].
abstract final class AppRadii {
  static const double xs = 8;
  static const double sm = 10;
  static const double md = 14; // web xl
  static const double lg = 18; // web 2xl — cards & inputs
  static const double xl = 24; // web 3xl
  static const double xxl = 32; // web 4xl
  static const double pill = 999;

  static const Radius rMd = Radius.circular(md);
  static const Radius rLg = Radius.circular(lg);

  static const BorderRadius card = BorderRadius.all(Radius.circular(lg));
  static const BorderRadius input = BorderRadius.all(Radius.circular(lg));
  static const BorderRadius icon = BorderRadius.all(Radius.circular(md));
  static const BorderRadius sheet = BorderRadius.vertical(top: Radius.circular(xl));
  static const BorderRadius pillAll = BorderRadius.all(Radius.circular(pill));
}
