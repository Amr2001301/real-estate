// A company's payment plan as the apps show it (pure Dart, for domain layers).

/// How often a plan's instalments fall due.
enum InstallmentPeriod { monthly, quarterly, semiAnnual, yearly }

InstallmentPeriod installmentPeriodFrom(String? raw) => switch ((raw ?? '').toUpperCase()) {
      'QUARTERLY' => InstallmentPeriod.quarterly,
      'SEMI_ANNUAL' => InstallmentPeriod.semiAnnual,
      'YEARLY' => InstallmentPeriod.yearly,
      _ => InstallmentPeriod.monthly,
    };

/// One duration of a plan: how long, how often, how many, how much each.
class InstallmentOfferOption {
  const InstallmentOfferOption({
    required this.durationMonths,
    required this.period,
    required this.count,
    required this.amount,
    required this.totalPayable,
    this.increasePercentage = 0,
  });
  final int durationMonths;
  final InstallmentPeriod period;
  final int count;
  final double amount;
  final double totalPayable;

  /// The markup this duration adds to the financed amount, in percent.
  final double increasePercentage;
}

/// A payment plan of a unit: the price after discount, what is paid before
/// the instalments (booking + down payment), a final payment, and its
/// durations. A cash plan has no durations.
class InstallmentOffer {
  const InstallmentOffer({
    required this.name,
    required this.netPrice,
    required this.booking,
    required this.downPayment,
    this.discount = 0,
    this.finalPayment = 0,
    this.isCash = false,
    this.options = const [],
  });
  final String name;
  final double netPrice;
  final double booking;
  final double downPayment;
  final double discount;
  final double finalPayment;
  final bool isCash;
  final List<InstallmentOfferOption> options;

  double get upfront => booking + downPayment;

  /// The down payment as a share of the net price, 10 or 12.5 ("10% مقدم";
  /// the booking is its own line).
  double get downPaymentPercent => netPrice <= 0 ? 0 : (downPayment / netPrice * 1000).round() / 10;

  /// "10%", kept left to right inside Arabic text.
  String get downPaymentPercentLabel => percentLabel(downPaymentPercent);

  /// The lowest instalment of all its durations (the "أو من" line).
  InstallmentOfferOption? get cheapest {
    InstallmentOfferOption? best;
    for (final o in options) {
      if (best == null || monthlyEquivalent(o) < monthlyEquivalent(best)) best = o;
    }
    return best;
  }

  InstallmentOfferOption? get longest {
    InstallmentOfferOption? best;
    for (final o in options) {
      if (best == null || o.durationMonths > best.durationMonths) best = o;
    }
    return best;
  }

  static double monthlyEquivalent(InstallmentOfferOption o) =>
      o.amount / switch (o.period) {
        InstallmentPeriod.monthly => 1,
        InstallmentPeriod.quarterly => 3,
        InstallmentPeriod.semiAnnual => 6,
        InstallmentPeriod.yearly => 12,
      };
}


double _num(Object? v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;

/// Reads a plan of `GET /public/units/:id/payment-plans`.
InstallmentOffer installmentOfferFromPublicJson(Map<String, dynamic> json) => InstallmentOffer(
      name: (json['name'] as String?) ?? '',
      netPrice: _num(json['netPrice']),
      booking: _num(json['reservationAmount']),
      downPayment: _num(json['downPaymentAmount']),
      discount: _num(json['discountAmount']),
      finalPayment: _num(json['finalPaymentAmount']),
      isCash: json['isCash'] == true,
      options: [
        for (final o in (json['options'] as List? ?? const []).whereType<Map<String, dynamic>>())
          InstallmentOfferOption(
            durationMonths: _num(o['durationMonths']).toInt(),
            period: installmentPeriodFrom(o['frequency'] as String?),
            count: _num(o['installmentsCount']).toInt(),
            amount: _num(o['installmentAmount']),
            totalPayable: _num(o['totalPayable']),
          ),
      ],
    );

/// A project's offers (`GET /public/projects/:id/payment-plans`).
class ProjectPlanSummary {
  const ProjectPlanSummary({this.minDownPaymentPercent, this.maxMonths, this.offers = const []});
  final double? minDownPaymentPercent;
  final int? maxMonths;
  final List<({double downPaymentPercent, int maxMonths, bool isCash})> offers;

  bool get isEmpty => offers.isEmpty;

  /// The same summary worked out from a project's plans (the staff app,
  /// which reads every active plan of the project).
  factory ProjectPlanSummary.fromOffers(List<InstallmentOffer> plans) {
    final seen = <String>{};
    final offers = <({double downPaymentPercent, int maxMonths, bool isCash})>[];
    for (final p in plans) {
      final pct = p.downPaymentPercent;
      final months = p.longest?.durationMonths ?? 0;
      if (seen.add('${p.isCash}|$pct|$months')) offers.add((downPaymentPercent: pct, maxMonths: months, isCash: p.isCash));
    }
    offers.sort((a, b) {
      final c = a.downPaymentPercent.compareTo(b.downPaymentPercent);
      return c != 0 ? c : b.maxMonths.compareTo(a.maxMonths);
    });
    final instalment = offers.where((o) => !o.isCash && o.maxMonths > 0).toList();
    return ProjectPlanSummary(
      minDownPaymentPercent: instalment.isEmpty ? null : instalment.map((o) => o.downPaymentPercent).reduce((a, b) => a < b ? a : b),
      maxMonths: instalment.isEmpty ? null : instalment.map((o) => o.maxMonths).reduce((a, b) => a > b ? a : b),
      offers: offers,
    );
  }

  factory ProjectPlanSummary.fromJson(Map<String, dynamic> json) => ProjectPlanSummary(
        minDownPaymentPercent: json['minDownPaymentPercent'] == null ? null : _num(json['minDownPaymentPercent']),
        maxMonths: json['maxMonths'] == null ? null : _num(json['maxMonths']).toInt(),
        offers: [
          for (final o in (json['offers'] as List? ?? const []).whereType<Map<String, dynamic>>())
            (downPaymentPercent: _num(o['downPaymentPercent']), maxMonths: _num(o['maxMonths']).toInt(), isCash: o['isCash'] == true),
        ],
      );
}

/// "10" or "12.5".
String percentText(double pct) => pct == pct.roundToDouble() ? pct.toInt().toString() : pct.toString();

/// "10%" kept left to right inside Arabic text (else it reads "%10").
String percentLabel(double pct) => '\u2066${percentText(pct)}%\u2069';

/// Reads a plan of the staff list (`GET /installment-plan-templates`) and
/// works out its instalments exactly as the API does (`computeDurationOption`
/// in duration-calc.ts): the remainder after booking, down payment and final
/// payment, raised by the duration's increase, split into whole cents with
/// the last instalment taking the rest.
InstallmentOffer installmentOfferFromTemplateJson(Map<String, dynamic> json) {
  final net = _num(json['netPrice']);
  final booking = _num(json['reservationAmount']);
  final down = _num(json['downPaymentAmount']);
  final last = _num(json['finalPaymentAmount']);
  final isCash = json['isCash'] == true;
  int cents(double v) => (v * 100).round();
  final rest = cents(net) - cents(booking) - cents(down) - cents(last);
  final remaining = rest < 0 ? 0 : rest;
  final durations = (json['durationOptions'] as List? ?? const []).whereType<Map<String, dynamic>>().toList()
    ..sort((a, b) => _num(a['order']).compareTo(_num(b['order'])));
  final options = <InstallmentOfferOption>[];
  if (!isCash && durations.isNotEmpty) {
    for (final d in durations) {
      final months = _num(d['durationMonths']).toInt();
      if (months <= 0) continue;
      final financed = (remaining * (1 + _num(d['increasePercentage']) / 100)).round();
      options.add(InstallmentOfferOption(
        durationMonths: months,
        period: InstallmentPeriod.monthly,
        count: months,
        amount: (financed ~/ months) / 100,
        totalPayable: (cents(booking) + cents(down) + financed + cents(last)) / 100,
        increasePercentage: _num(d['increasePercentage']),
      ));
    }
  } else if (!isCash) {
    final count = _num(json['installmentsCount']).toInt();
    if (count > 0) {
      final period = installmentPeriodFrom(json['frequency'] as String?);
      final every = switch (period) {
        InstallmentPeriod.monthly => 1,
        InstallmentPeriod.quarterly => 3,
        InstallmentPeriod.semiAnnual => 6,
        InstallmentPeriod.yearly => 12,
      };
      options.add(InstallmentOfferOption(
        durationMonths: count * every,
        period: period,
        count: count,
        amount: (remaining / count).round() / 100,
        totalPayable: net,
      ));
    }
  }
  return InstallmentOffer(
    name: (json['name'] as String?) ?? '',
    netPrice: net,
    booking: booking,
    downPayment: down,
    discount: _num(json['discountAmount']),
    finalPayment: last,
    isCash: isCash,
    options: options,
  );
}
