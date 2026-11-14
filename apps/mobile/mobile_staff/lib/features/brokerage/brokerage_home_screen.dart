import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../common/role_label.dart';
import '../dashboard/home_kit/home_kit.dart';
import 'brokerage_data.dart';
import 'brokerage_kit.dart';
import 'deals_screen.dart' show BxDealCard;
import 'launches_screen.dart' show BxLaunchCard;
import 'targets_screen.dart' show BxTargetGoal;

/// BRK-6c — the home of a brokerage company's staff, in the homes' look: the
/// month's target on the ring (a rep's own; the team's for a manager and the
/// admin), the main actions, the commission shares, the open launches and
/// the latest deals. Each part shows what the API lets the caller see.
class BrokerageHomeScreen extends StatefulWidget {
  const BrokerageHomeScreen({super.key, required this.repository, this.onSwitchTab});
  final BrokerageRepository repository;
  final void Function(int)? onSwitchTab;

  @override
  State<BrokerageHomeScreen> createState() => _BrokerageHomeScreenState();
}

class _BrokerageHomeScreenState extends State<BrokerageHomeScreen> {
  BxTargets? _targets;
  BxShares? _shares;
  List<BxLaunch> _launches = const [];
  List<BxDeal> _deals = const [];
  BrandTokens? _brand;
  AppFailure? _failure;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<BrandTokens?> _branding() async {
    try {
      final slug = await context.read<TokenStorage>().readSelectedCompanySlug();
      if (slug == null || slug.isEmpty || !mounted) return null;
      return await BrandingRepository(context.read<Dio>()).fetchBranding(slug);
    } catch (_) {
      return null; // The page shows without the company's name and logo.
    }
  }

  Future<void> _load() async {
    final lang = Localizations.localeOf(context).languageCode;
    final repo = widget.repository;
    setState(() => _failure = null);
    final results = await Future.wait<Object?>([
      repo.targets(),
      repo.shares(),
      repo.launches(lang),
      repo.deals(),
      _branding(),
    ]);
    if (!mounted) return;
    setState(() {
      _loading = false;
      final t = results[0] as Result<BxTargets>;
      final s = results[1] as Result<BxShares>;
      final l = results[2] as Result<List<BxLaunch>>;
      final d = results[3] as Result<BxDealsPage>;
      _brand = results[4] as BrandTokens?;
      if (t case Ok(data: final v)) _targets = v;
      if (s case Ok(data: final v)) _shares = v;
      if (l case Ok(data: final v)) _launches = v.where((x) => x.status != 'CLOSED').take(3).toList();
      if (d case Ok(data: final v)) _deals = v.page.data.take(3).toList();
      // Only when nothing came back is the page an error.
      if (t is Err && s is Err && l is Err && d is Err) _failure = (t as Err).failure;
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final session = context.read<SessionCubit>().state;
    final role = session.role;
    final userId = session.sessionOrNull?.userId ?? '';
    final rep = role == AppRole.sales;
    final ready = !_loading && _failure == null;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: HomePage(
        pageKey: const Key('brokerage-home'),
        loading: _loading,
        failure: _failure,
        onRetry: _load,
        onRefresh: _load,
        hero: HomeHero(
          name: homeSessionName(context),
          roleLabel: roleLabel(l10n, role),
          companyName: _brand?.displayName,
          logoUrl: _brand?.logoUrl,
        ),
        overlap: ready ? _goal(context, rep, userId) : null,
        children: !ready
            ? const []
            : [
                HomeActions(actions: [
                  HomeAction(id: 'add-lead', icon: Icons.person_add_rounded, label: l10n.shActLead, onTap: () => context.push('/leads/new')),
                  HomeAction(id: 'listings', icon: Icons.home_work_rounded, label: l10n.bxListingsTitle, onTap: () => context.push('/bx/listings')),
                  HomeAction(id: 'deals', icon: Icons.handshake_rounded, label: l10n.bxDealsTitle, onTap: () => context.push('/bx/deals')),
                  HomeAction(id: 'launches', icon: Icons.rocket_launch_rounded, label: l10n.bxLaunchesTitle, onTap: () => context.push('/bx/launches')),
                ]),
                if (_shares != null)
                  HomeSection(
                    icon: Icons.payments_rounded,
                    title: rep ? l10n.bxSharesMine : l10n.bxSharesTeam,
                    action: l10n.shAll,
                    onAction: () => context.push('/bx/commissions'),
                    child: HomeTiles(tiles: [
                      HomeTile(label: l10n.bxTotalPayable, value: homeCompactText(_shares!.payable, l10n), sub: bxCurrency(context)),
                      HomeTile(label: l10n.bxTotalAwaiting, value: homeCompactText(_shares!.awaitingCollection, l10n), sub: bxCurrency(context)),
                      HomeTile(label: l10n.bxTotalPaid, value: homeCompactText(_shares!.paid, l10n), sub: bxCurrency(context)),
                    ]),
                  ),
                if (_launches.isNotEmpty)
                  HomeSection(
                    icon: Icons.rocket_launch_rounded,
                    title: l10n.bxHomeOpenLaunches,
                    action: l10n.shAll,
                    onAction: () => context.push('/bx/launches'),
                    child: Column(children: [
                      for (final x in _launches) ...[
                        BxLaunchCard(launch: x, onTap: () => context.push('/bx/launches/${x.id}', extra: x)),
                        const SizedBox(height: 10),
                      ],
                    ]),
                  ),
                if (_deals.isNotEmpty)
                  HomeSection(
                    icon: Icons.handshake_rounded,
                    title: l10n.bxDealsTitle,
                    action: l10n.shAll,
                    onAction: () => context.push('/bx/deals'),
                    child: Column(children: [
                      for (final d in _deals) ...[
                        BxDealCard(deal: d, onTap: () => context.push('/bx/deals/${d.id}', extra: d)),
                        const SizedBox(height: 10),
                      ],
                    ]),
                  ),
              ],
      ),
    );
  }

  /// A rep's own target; for a manager and the admin, the team's together.
  Widget _goal(BuildContext context, bool rep, String userId) {
    final l10n = context.l10n;
    final rows = _targets?.rows ?? const <BxTargetRow>[];
    final child = rep
        ? BxTargetGoal(row: rows.where((r) => r.userId == userId).firstOrNull)
        : BxTargetGoal(row: _team(rows), title: l10n.bxHomeTeamGoalTitle);
    return GestureDetector(onTap: () => context.push('/bx/targets'), child: child);
  }

  /// The team's month as one row: everyone's commission against the targets set.
  static BxTargetRow? _team(List<BxTargetRow> rows) {
    final set = rows.where((r) => r.hasTarget).toList();
    if (set.isEmpty) return null;
    final commission = set.fold<double>(0, (a, r) => a + r.commission);
    final target = set.fold<double>(0, (a, r) => a + r.commissionTarget!);
    final deals = set.fold<int>(0, (a, r) => a + r.deals);
    final dealsTarget = set.fold<int>(0, (a, r) => a + (r.dealsTarget ?? 0));
    return BxTargetRow(
      userId: '',
      userName: '',
      role: '',
      commission: commission,
      deals: deals,
      bonus: 'NONE',
      commissionTarget: target,
      dealsTarget: dealsTarget,
      commissionPct: target > 0 ? (commission / target * 100).round() : 100,
      dealsPct: dealsTarget > 0 ? (deals / dealsTarget * 100).round() : 100,
    );
  }
}
