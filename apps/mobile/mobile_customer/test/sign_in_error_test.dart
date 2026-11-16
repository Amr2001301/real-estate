import 'package:core/core.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/auth/data/repositories/auth_repository_impl.dart';

void main() {
  test('a refused sign-in says the email or password is wrong, not that the session expired', () {
    final f = asRefusedSignIn(AppFailure(type: FailureType.unauthorized, statusCode: 401));
    expect(f.userMessageKey, AppErrorMessageKey.invalidCredentials);
    expect(f.userMessageKey, isNot(AppErrorMessageKey.sessionExpired));
  });

  test('other failures keep their own message', () {
    final net = AppFailure(type: FailureType.network);
    expect(asRefusedSignIn(net), same(net));
  });
}
