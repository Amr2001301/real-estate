import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../contracts/create/contract_create_data.dart' show PickHit;
import '../../contracts/create/contract_form_kit.dart';
import '../../contracts/create/manual_contract_screen.dart' show PickSheet;
import '../../contracts/view/contracts_list_screen.dart' show contractMoney;
import '../../dashboard/home_kit/filter_kit.dart' show FilterOption, FilterRadioList;
import '../../dashboard/home_kit/home_kit.dart';
import '../../installments/domain/entities/installment.dart';
import '../../installments/domain/repositories/installments_repository.dart';
import '../presentation/cubit/create_reservation_cubit.dart';

/// A new booking (owner-approved design r3, 2026-11-04), as the website's
/// new-booking form: the client, the unit (the project, then one of its
/// free units, or fixed when it comes from a unit's page), the plan as
/// cards with their figures, the booking amount (from the plan, a fixed
/// amount, or a percentage) with how long it holds, and a summary. A
/// progress bar says how far the form is. The booking goes for review.
class NewReservationScreen extends StatefulWidget {
  const NewReservationScreen({super.key});

  @override
  State<NewReservationScreen> createState() => _NewReservationScreenState();
}

class _NewReservationScreenState extends State<NewReservationScreen> {
  final _notes = TextEditingController();
  final _bookingNotes = TextEditingController();
  final _amount = TextEditingController();
  final _percent = TextEditingController();
  List<InstallmentOffer> _offers = const [];
  String? _offersFor;

  /// The unit's plans have been asked for (answered, or failed).
  bool _offersLoaded = false;
  bool _offersFailed = false;

  @override
  void initState() {
    super.initState();
    context.read<CreateReservationCubit>().init();
  }

  @override
  void dispose() {
    _notes.dispose();
    _bookingNotes.dispose();
    _amount.dispose();
    _percent.dispose();
    super.dispose();
  }

  /// The unit's plans with their figures, once the unit is known.
  Future<void> _loadOffers(CreateReservationState s) async {
    final unitId = s.selectedUnitId;
    final projectId = s.selectedProjectId ?? _unit(s)?.projectId;
    if ((unitId ?? '').isEmpty || (projectId ?? '').isEmpty || _offersFor == unitId) return;
    _offersFor = unitId;
    InstallmentsRepository repo;
    try {
      repo = context.read<InstallmentsRepository>();
    } catch (_) {
      setState(() {
        _offersLoaded = true;
        _offersFailed = true;
      });
      return;
    }
    final r = await repo.unitOffers(projectId: projectId!, unitId: unitId!);
    if (!mounted || _offersFor != unitId) return;
    setState(() {
      _offersLoaded = true;
      _offersFailed = r is! Ok;
      if (r case Ok(:final data)) _offers = data;
    });
  }

  dynamic _unit(CreateReservationState s) => s.units.where((u) => u.id == s.selectedUnitId).firstOrNull;

  InstallmentOffer? _offerFor(InstallmentPlanTemplate? plan) {
    if (plan == null) return null;
    return _offers.where((o) => o.name == plan.name).firstOrNull;
  }

  Future<void> _pickLead(CreateReservationCubit cubit, CreateReservationState s) async {
    final l10n = context.l10n;
    final hit = await showModalBottomSheet<PickHit>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => PickSheet(
        title: l10n.rnPickClient,
        hint: l10n.rnSearchClient,
        keyPrefix: 'new-res-client',
        search: (q) async {
          final t = q.trim().toLowerCase();
          return [
            for (final l in s.leads)
              if (t.isEmpty || l.fullName.toLowerCase().contains(t) || (l.phone ?? '').contains(t)) PickHit(l.id, l.fullName, l.phone == null ? null : ltr(l.phone!)),
          ].take(30).toList();
        },
      ),
    );
    if (hit != null) cubit.selectLead(hit.id);
  }

  Future<void> _pickProject(CreateReservationCubit cubit, CreateReservationState s) async {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final hit = await showModalBottomSheet<PickHit>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => PickSheet(
        title: l10n.rnPickProject,
        hint: l10n.rnPickProject,
        keyPrefix: 'new-res-project',
        search: (q) async => [
          for (final p in s.projects)
            if (q.trim().isEmpty || p.name.resolve(lang).contains(q.trim())) PickHit(p.id, p.name.resolve(lang), p.city),
        ],
      ),
    );
    if (hit != null) {
      _offersFor = null;
      _offers = const [];
      _offersLoaded = false;
      await cubit.selectProject(hit.id);
    }
  }

  Future<void> _pickUnit(CreateReservationCubit cubit, CreateReservationState s) async {
    final l10n = context.l10n;
    final hit = await showModalBottomSheet<PickHit>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => PickSheet(
        title: l10n.rnPickUnit,
        hint: l10n.rnSearchUnit,
        keyPrefix: 'new-res-unit',
        search: (q) async => [
          for (final u in s.units)
            if (u.status == 'AVAILABLE' && (q.trim().isEmpty || u.code.toLowerCase().contains(q.trim().toLowerCase())))
              PickHit(u.id, u.code, null, double.tryParse(u.price ?? '')),
        ],
      ),
    );
    if (hit != null) {
      _offersFor = null;
      _offers = const [];
      _offersLoaded = false;
      cubit.selectUnit(hit.id);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BlocConsumer<CreateReservationCubit, CreateReservationState>(
          listenWhen: (a, b) => a.submitted != b.submitted || a.submitFailure != b.submitFailure,
          listener: (context, state) {
            if (state.submitted) {
              ScaffoldMessenger.of(context)
                ..hideCurrentSnackBar()
                ..showSnackBar(SnackBar(content: Text(l10n.reservationCreated)));
              context.pop(true);
            } else if (state.submitFailure != null) {
              showFailureSnackBar(context, state.submitFailure!);
            }
          },
          builder: (context, state) {
            final cubit = context.read<CreateReservationCubit>();
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) _loadOffers(state);
            });
            final lang = Localizations.localeOf(context).languageCode;
            final currency = PriceFormatter.symbol(lang);
            final lead = state.leads.where((l) => l.id == state.selectedLeadId).firstOrNull;
            final unit = _unit(state);
            final plan = state.plans.where((p) => p.id == state.selectedPlanId).firstOrNull;
            final offer = _offerFor(plan);
            final unitDone = state.hasUnit;
            final planDone = state.selectedPlanId != null || (unitDone && state.plansStatus == DataStatus.empty);
            final steps = [
              (l10n.rnStepClient, state.hasLead),
              (l10n.rnStepUnit, unitDone),
              (l10n.rnStepPlan, planDone),
              (l10n.rnStepBooking, state.hasLead && unitDone && planDone),
            ];
            return Column(children: [
              HomeListHero(title: l10n.reservationNew, subtitle: l10n.rnSub, back: true),
              Expanded(
                child: ListView(padding: const EdgeInsets.only(bottom: 24), children: [
                  _Progress(steps: steps),
                  HomeSection(
                    icon: Icons.person_rounded,
                    title: l10n.rnStepClient,
                    child: lead == null
                        ? FormValueBox(
                            key: const Key('new-res-client'),
                            text: l10n.rnPickClient,
                            placeholder: true,
                            icon: Icons.search_rounded,
                            invalid: state.showValidation && !state.hasLead,
                            onTap: () => _pickLead(cubit, state),
                          )
                        : _Picked(
                            key: const Key('new-res-client-picked'),
                            leading: Text(homeInitials(lead.fullName), style: homeDisplay(13, AppPalette.gold300)),
                            title: lead.fullName,
                            subtitle: lead.phone == null ? null : ltr(lead.phone!),
                            onChange: () => _pickLead(cubit, state),
                          ),
                  ),
                  HomeSection(
                    icon: Icons.apartment_rounded,
                    title: l10n.rnStepUnit,
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      if (state.fixedUnit)
                        _Picked(
                          key: const Key('new-res-unit-fixed'),
                          leading: const Icon(Icons.door_front_door_rounded, size: 18, color: AppPalette.gold300),
                          title: unit == null ? l10n.rnUnitFixed : ltr(unit.code as String),
                          subtitle: l10n.rnUnitFixed,
                        )
                      else ...[
                        if (state.selectedProjectId == null || state.units.isEmpty && !state.hasUnit)
                          FormValueBox(
                            key: const Key('new-res-project'),
                            text: state.projects.where((p) => p.id == state.selectedProjectId).map((p) => p.name.resolve(lang)).firstOrNull ?? l10n.rnPickProject,
                            placeholder: state.selectedProjectId == null,
                            icon: Icons.search_rounded,
                            onTap: state.projects.isEmpty ? null : () => _pickProject(cubit, state),
                          ),
                        if (state.selectedProjectId != null && !state.hasUnit) ...[
                          const SizedBox(height: 8),
                          state.unitsStatus == DataStatus.loading
                              ? const Center(child: Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator()))
                              : FormValueBox(
                                  key: const Key('new-res-unit'),
                                  text: l10n.rnPickUnit,
                                  placeholder: true,
                                  icon: Icons.search_rounded,
                                  invalid: state.showValidation && !state.hasUnit,
                                  onTap: () => _pickUnit(cubit, state),
                                ),
                        ],
                        if (state.hasUnit && unit != null)
                          _Picked(
                            key: const Key('new-res-unit-picked'),
                            leading: const Icon(Icons.door_front_door_rounded, size: 18, color: AppPalette.gold300),
                            title: ltr(unit.code as String),
                            subtitle: state.projects.where((p) => p.id == state.selectedProjectId).map((p) => p.name.resolve(lang)).firstOrNull,
                            onChange: () => _pickUnit(cubit, state),
                          ),
                      ],
                      if (unit?.price != null && double.tryParse('${unit.price}') != null)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(4, 8, 4, 0),
                          child: Row(children: [
                            Text(l10n.rnSumPrice, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                            const Spacer(),
                            Text('${contractMoney(double.parse('${unit.price}'))} $currency', style: homeDisplay(14, colors.inkStrong)),
                          ]),
                        ),
                    ]),
                  ),
                  HomeSection(
                    icon: Icons.payments_rounded,
                    title: l10n.rnStepPlan,
                    child: !state.hasUnit
                        ? Text(l10n.rnPickUnitFirst, style: TextStyle(fontSize: 12.5, color: colors.inkMuted))
                        : state.plansStatus == DataStatus.loading || !_offersLoaded
                            ? const Center(child: Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator()))
                            : Column(children: [
                                _PlanCard(
                                  key: const Key('new-res-plan-none'),
                                  title: l10n.rnNoPlan,
                                  subtitle: l10n.rnNoPlanSub,
                                  selected: state.selectedPlanId == null,
                                  onTap: () => cubit.selectPlan(null),
                                ),
                                // Only this unit's plans (a project can hold a plan per
                                // unit); every plan only if they could not be read.
                                for (final p in _offersFailed ? state.plans : state.plans.where((p) => _offerFor(p) != null))
                                  Builder(builder: (context) {
                                    final o = _offerFor(p);
                                    final from = o?.cheapest;
                                    final months = [for (final d in p.durations) d.durationMonths]..sort();
                                    return _PlanCard(
                                      key: Key('new-res-plan-${p.id}'),
                                      title: ltrRuns(p.name),
                                      subtitle: o == null
                                          ? (months.isEmpty ? l10n.rnCashSub : l10n.rnTermsSub(months.map((m) => ltr('$m')).join(' · ')))
                                          : [
                                              if (o.isCash) l10n.rnCashSub else l10n.rnPlanDown(ltr(o.downPaymentPercentLabel)),
                                              if (!o.isCash && o.longest != null) l10n.rnTermsSub(ltr('${o.longest!.durationMonths}')),
                                            ].join(' · '),
                                      price: o?.isCash == true
                                          ? contractMoney(o!.netPrice)
                                          : (from == null ? null : contractMoney(from.amount)),
                                      perMonth: o?.isCash == true ? currency : (from == null ? null : l10n.rnMonthlyShort),
                                      selected: state.selectedPlanId == p.id,
                                      onTap: () => cubit.selectPlan(p.id),
                                    );
                                  }),
                              ]),
                  ),
                  HomeSection(
                    icon: Icons.bookmark_rounded,
                    title: l10n.rnStepBooking,
                    child: FormCardBox(children: [
                      FormFieldBox(
                        label: l10n.reservationBookingAmountTitle,
                        child: FilterRadioList<String>(
                          stacked: true,
                          keyPrefix: 'new-res-mode',
                          selected: state.bookingAmountMode,
                          onSelect: (v) {
                            _amount.clear();
                            _percent.clear();
                            cubit.setBookingAmountMode(v);
                          },
                          options: [
                            FilterOption('PLAN', l10n.reservationBookingModePlan, sub: l10n.rnModePlanSub),
                            FilterOption('FIXED', l10n.reservationBookingModeFixed, sub: l10n.rnModeFixedSub),
                            FilterOption('PERCENTAGE', l10n.reservationBookingModePercent, sub: l10n.rnModePercentSub),
                          ],
                        ),
                      ),
                      if (state.bookingAmountMode == 'FIXED')
                        FormFieldBox(
                          label: l10n.reservationBookingFixedLabel,
                          child: TextField(
                            key: const Key('new-res-amount'),
                            controller: _amount,
                            keyboardType: TextInputType.number,
                            onChanged: cubit.setBookingAmount,
                            decoration: _deco(context, l10n.reservationBookingFixedHint),
                          ),
                        ),
                      if (state.bookingAmountMode == 'PERCENTAGE')
                        FormFieldBox(
                          label: l10n.reservationBookingPercentLabel,
                          child: TextField(
                            key: const Key('new-res-percent'),
                            controller: _percent,
                            keyboardType: TextInputType.number,
                            onChanged: cubit.setBookingAmountPercent,
                            decoration: _deco(context, l10n.reservationBookingPercentHint),
                          ),
                        ),
                      FormFieldBox(
                        label: l10n.rnHoldLabel,
                        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                          Wrap(spacing: 8, runSpacing: 8, children: [
                            for (final (h, label) in [(24, l10n.rnExp24), (72, l10n.rnExp72), (168, l10n.rnExp168), (336, l10n.rnExp336)])
                              _HoldChip(
                                key: Key('new-res-expiry-$h'),
                                label: label,
                                selected: state.expiresInHours == h,
                                onTap: () => cubit.setExpiresInHours(h),
                              ),
                          ]),
                          const SizedBox(height: 8),
                          Row(children: [
                            Icon(Icons.event_available_rounded, size: 16, color: colors.inkMuted),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                l10n.rnHoldUntil(DateFormatter.mediumDate(DateTime.now().add(Duration(hours: state.expiresInHours)), languageCode: lang)),
                                key: const Key('new-res-hold-until'),
                                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: colors.inkStrong),
                              ),
                            ),
                          ]),
                        ]),
                      ),
                      FormFieldBox(
                        label: l10n.reservationNotesLabel,
                        child: TextField(controller: _notes, minLines: 2, maxLines: 4, onChanged: cubit.setNotes, decoration: _deco(context, null)),
                      ),
                      FormFieldBox(
                        label: l10n.reservationBookingNotesLabel,
                        child: TextField(controller: _bookingNotes, minLines: 1, maxLines: 3, onChanged: cubit.setBookingNotes, decoration: _deco(context, l10n.reservationBookingNotesHint)),
                      ),
                    ]),
                  ),
                  if (offer != null && !offer.isCash)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(AppSpacing.md, 16, AppSpacing.md, 0),
                      child: _Summary(offer: offer, bookingFromPlan: state.bookingAmountMode == 'PLAN', currency: currency),
                    ),
                ]),
              ),
              FormBottomBar(
                confirmKey: const Key('new-res-submit'),
                label: l10n.reservationCreate,
                icon: Icons.bookmark_add_rounded,
                busy: state.submitting,
                onConfirm: cubit.submit,
              ),
            ]);
          },
        ),
      ),
    );
  }
}

InputDecoration _deco(BuildContext context, String? hint) => InputDecoration(
      isDense: true,
      hintText: hint,
      hintStyle: const TextStyle(color: Color(0xFFB9B0A3)),
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(13), borderSide: BorderSide(color: context.appColors.hairline)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(13), borderSide: BorderSide(color: context.appColors.hairline)),
    );

/// Four bars, each filled once its part of the form is done.
class _Progress extends StatelessWidget {
  const _Progress({required this.steps});
  final List<(String, bool)> steps;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
      child: Column(children: [
        Row(children: [
          for (final (i, (_, done)) in steps.indexed) ...[
            if (i > 0) const SizedBox(width: 6),
            Expanded(
              child: AnimatedContainer(
                key: Key('new-res-progress-$i'),
                duration: const Duration(milliseconds: 200),
                height: 5,
                decoration: BoxDecoration(color: done ? AppPalette.gold400 : const Color(0xFFEFE8DC), borderRadius: BorderRadius.circular(9)),
              ),
            ),
          ],
        ]),
        const SizedBox(height: 6),
        Row(children: [
          for (final (i, (label, done)) in steps.indexed) ...[
            if (i > 0) const SizedBox(width: 6),
            Expanded(
              child: Text(label,
                  style: TextStyle(fontSize: 12, fontWeight: done ? FontWeight.w800 : FontWeight.w500, color: done ? colors.inkStrong : colors.inkMuted)),
            ),
          ],
        ]),
      ]),
    );
  }
}

/// What was chosen, with a way to change it.
class _Picked extends StatelessWidget {
  const _Picked({super.key, required this.leading, required this.title, this.subtitle, this.onChange});
  final Widget leading;
  final String title;
  final String? subtitle;
  final VoidCallback? onChange;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppPalette.navy, width: 1.5)),
      child: Row(children: [
        Container(
          width: 38,
          height: 38,
          alignment: Alignment.center,
          decoration: BoxDecoration(gradient: homeNavyGradient, borderRadius: BorderRadius.circular(12)),
          child: leading,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: colors.inkStrong)),
            if (subtitle != null) Text(subtitle!, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
          ]),
        ),
        if (onChange != null)
          TextButton(onPressed: onChange, child: Text(context.l10n.rnChange, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppPalette.gold600))),
      ]),
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({super.key, required this.title, required this.subtitle, required this.selected, required this.onTap, this.price, this.perMonth});
  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;
  final String? price;
  final String? perMonth;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: selected ? const Color(0xFFFFFCF5) : Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: selected ? AppPalette.navy : const Color(0xFFECE4D6), width: selected ? 1.6 : 1.5),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 160),
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: selected ? Border.all(color: AppPalette.navy, width: 6) : Border.all(color: const Color(0xFFD9D0C2), width: 2),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(title, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: colors.inkStrong)),
                  Text(subtitle, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                ]),
              ),
              if (price != null)
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text(price!, style: homeDisplay(15, colors.inkStrong)),
                  if (perMonth != null) Text(perMonth!, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                ]),
            ]),
          ),
        ),
      ),
    );
  }
}

/// The navy summary: the down payment and booking, the monthly figure.
class _Summary extends StatelessWidget {
  const _Summary({required this.offer, required this.bookingFromPlan, required this.currency});
  final InstallmentOffer offer;
  final bool bookingFromPlan;
  final String currency;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    Widget row(String k, String v, {bool total = false}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 5),
          child: Row(children: [
            Expanded(child: Text(k, style: const TextStyle(fontSize: 12.5, color: Color(0xFFC9D2DE)))),
            Text(v, style: homeDisplay(total ? 17 : 14, total ? AppPalette.gold300 : Colors.white)),
          ]),
        );
    final from = offer.cheapest;
    return Container(
      key: const Key('new-res-summary'),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(gradient: homeNavyGradient, borderRadius: BorderRadius.circular(20)),
      child: Column(children: [
        row(l10n.rnSumBooking, '${contractMoney(offer.booking)} $currency'),
        row(l10n.rnSumDown, '${contractMoney(offer.downPayment)} $currency'),
        if (from != null) ...[
          const Divider(color: Color(0x1FFFFFFF)),
          row(l10n.rnSumMonthly, '${contractMoney(from.amount)} $currency', total: true),
        ],
      ]),
    );
  }
}

/// One choice of how long the booking holds: a chip that wraps with the
/// others when the width runs out.
class _HoldChip extends StatelessWidget {
  const _HoldChip({super.key, required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Material(
      color: selected ? AppPalette.navy : Colors.white,
      shape: StadiumBorder(side: BorderSide(color: selected ? AppPalette.navy : const Color(0xFFECE4D6), width: 1.5)),
      child: InkWell(
        customBorder: const StadiumBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: selected ? Colors.white : colors.inkStrong)),
        ),
      ),
    );
  }
}
