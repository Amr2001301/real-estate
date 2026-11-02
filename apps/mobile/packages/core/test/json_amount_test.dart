import 'package:core/core.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('an amount is read from a number or from a decimal string', () {
    expect(readAmount(70709), 70709.0);
    expect(readAmount(70709.33), 70709.33);
    expect(readAmount('113222.22'), 113222.22);
    expect(readAmount(' 5000 '), 5000.0);
    expect(readAmount(null), isNull);
    expect(readAmount(''), isNull);
    expect(readAmount('abc'), isNull);
    expect(readAmount(true), isNull);
  });
}
