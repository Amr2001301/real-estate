import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';

/// Each company's app shows that company's name and mark — never another
/// company's logo baked into the app.

class _Branding extends BrandingCubit {
  _Branding({super.fallbackName}) : super(BrandingRepository(Dio()));
  void set(BrandTokens t) => emit(t);
}

Future<void> _pump(WidgetTester t, {BrandingCubit? cubit}) async {
  const body = Column(children: [BrandMark(size: 40), CompanyNameText()]);
  await t.pumpWidget(MaterialApp(
    home: Scaffold(
      body: cubit == null ? body : BlocProvider<BrandingCubit>.value(value: cubit, child: body),
    ),
  ));
  await t.pump();
}

void main() {
  test('initials: two Latin letters, or one Arabic letter without "ال"', () {
    expect(brandInitials('بيوت أكمي للتطوير'), 'ب');
    expect(brandInitials('النخيل للتطوير العقاري'), 'ن');
    expect(brandInitials('Real Estate Platform'), 'RE');
    expect(brandInitials('  Acme '), 'A');
    expect(brandInitials(''), '');
  });

  testWidgets('the company name and its initials show when it has no logo', (t) async {
    final cubit = _Branding();
    addTearDown(cubit.close);
    cubit.set(const BrandTokens(displayName: 'بيوت أكمي'));
    await _pump(t, cubit: cubit);
    expect(find.text('بيوت أكمي'), findsOneWidget);
    expect(find.text('ب'), findsOneWidget);
    expect(find.byType(Image), findsNothing);
  });

  testWidgets("a company's own app shows its name before branding loads", (t) async {
    final cubit = _Branding(fallbackName: 'بيوت أكمي');
    addTearDown(cubit.close);
    await _pump(t, cubit: cubit);
    expect(find.text('بيوت أكمي'), findsOneWidget);
  });

  testWidgets('without a company (staff login) only a neutral mark shows', (t) async {
    await _pump(t);
    expect(find.byIcon(Icons.apartment_rounded), findsOneWidget);
    expect(find.byType(Text), findsNothing);
  });
}
