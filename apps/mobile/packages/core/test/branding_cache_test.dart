import 'package:core/core.dart';
import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _FakeRepo implements BrandingRepository {
  _FakeRepo(this.bySlug);
  final Map<String, BrandTokens?> bySlug;
  int calls = 0;
  @override
  Future<BrandTokens?> fetchBranding(String slug) async {
    calls++;
    return bySlug[slug];
  }
}

const _a = BrandTokens(primaryColor: Color(0xFF064E3B), accentColor: Color(0xFFEC4899), displayName: 'A', currency: 'EGP');

void main() {
  late SharedPreferences prefs;
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    prefs = await SharedPreferences.getInstance();
  });

  test('toJson and fromJson round-trip the colours and texts', () {
    final back = BrandTokens.fromJson(_a.toJson());
    expect(back.primaryColor, _a.primaryColor);
    expect(back.accentColor, _a.accentColor);
    expect(back.displayName, 'A');
    expect(back.currency, 'EGP');
  });

  test('with nothing saved the app starts on the default palette, then takes the server branding and saves it', () async {
    final cubit = BrandingCubit(_FakeRepo({'a': _a}), prefs: prefs, initialSlug: 'a');
    expect(cubit.state, isNull);
    await cubit.load('a');
    expect(cubit.state?.primaryColor, _a.primaryColor);
    // A later start opens in the company's colours at once.
    final next = BrandingCubit(_FakeRepo({}), prefs: prefs, initialSlug: 'a');
    expect(next.state?.primaryColor, _a.primaryColor);
    expect(next.state?.displayName, 'A');
  });

  test('a failed request keeps what the device saved', () async {
    await BrandingCubit(_FakeRepo({'a': _a}), prefs: prefs, initialSlug: 'a').load('a');
    final cubit = BrandingCubit(_FakeRepo({'a': null}), prefs: prefs, initialSlug: 'a');
    await cubit.load('a');
    expect(cubit.state?.primaryColor, _a.primaryColor);
  });

  test("a change made in the dashboard replaces the saved copy", () async {
    await BrandingCubit(_FakeRepo({'a': _a}), prefs: prefs, initialSlug: 'a').load('a');
    const changed = BrandTokens(primaryColor: Color(0xFF111111), accentColor: Color(0xFFEEEEEE));
    final cubit = BrandingCubit(_FakeRepo({'a': changed}), prefs: prefs, initialSlug: 'a');
    expect(cubit.state?.primaryColor, _a.primaryColor); // opens on the saved one
    await cubit.load('a');
    expect(cubit.state?.primaryColor, const Color(0xFF111111)); // refreshed
    expect(BrandingCubit(_FakeRepo({}), prefs: prefs, initialSlug: 'a').state?.primaryColor, const Color(0xFF111111));
  });

  test("one company's saved tokens never show for another", () async {
    await BrandingCubit(_FakeRepo({'a': _a}), prefs: prefs, initialSlug: 'a').load('a');
    final cubit = BrandingCubit(_FakeRepo({'b': null}), prefs: prefs, initialSlug: 'a');
    expect(cubit.state?.displayName, 'A');
    await cubit.load('b'); // b is unknown to the device and the request fails
    expect(cubit.state, isNull);
  });

  test('without prefs it works as before', () async {
    final cubit = BrandingCubit(_FakeRepo({'a': _a}));
    await cubit.load('a');
    expect(cubit.state?.displayName, 'A');
    cubit.clear();
    expect(cubit.state, isNull);
  });
}
