import 'package:core/core.dart';
import 'dart:ui' show Locale;

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/auth/presentation/auth_validators.dart';

/// QA run 1, F-028: Egyptians type 01099887766. The sign-in form refused the
/// leading 0, so only +20… worked.
void main() {
  final v = AuthValidators(lookupAppLocalizations(const Locale('ar')));

  test('accepts the local Egyptian format and +20', () {
    expect(v.phone('01099887766'), isNull);
    expect(v.phone(' 01099887766 '), isNull);
    expect(v.phone('+201099887766'), isNull);
    expect(v.phone('201099887766'), isNull);
  });

  test('still refuses junk', () {
    expect(v.phone(''), isNotNull);
    expect(v.phone('0123'), isNotNull);
    expect(v.phone('abc'), isNotNull);
    expect(v.phone('+0123456789'), isNotNull);
    expect(v.phone('0109988776612345'), isNotNull);
  });
}
