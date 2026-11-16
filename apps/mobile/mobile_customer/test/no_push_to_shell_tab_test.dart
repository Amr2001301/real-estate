import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// `/compare` (like /home, /projects, /units, /more and the account tabs — property, finance,
/// maintenance) is a shell tab. Pushing a
/// tab route over a root page such as the unit details puts the shell page in
/// the stack twice and asserts "duplicate page key" in debug builds. Screens
/// outside the shell must `go` to a tab instead.
void main() {
  test('no screen pushes a shell tab route', () {
    final tabs = RegExp(r'''\.push\(\s*['"]/(compare|home|projects|units|more|account/property|account/finance|account/maintenance)['"]''');
    final offenders = <String>[];
    for (final f in Directory('lib').listSync(recursive: true).whereType<File>()) {
      if (!f.path.endsWith('.dart')) continue;
      if (tabs.hasMatch(f.readAsStringSync())) offenders.add(f.path);
    }
    expect(offenders, isEmpty, reason: 'use context.go for a tab route');
  });
}
