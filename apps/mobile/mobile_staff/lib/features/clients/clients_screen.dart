import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../leads/presentation/screens/leads_screen.dart' show leadWhen;
import 'clients_data.dart';

/// The company's clients (admins only, as on the website): how many browse,
/// own a unit or are suspended, a search and a type filter, and on each
/// card the type, status, phone, and when they joined and last signed in.
class ClientsScreen extends StatefulWidget {
  const ClientsScreen({super.key});

  @override
  State<ClientsScreen> createState() => _ClientsScreenState();
}

class _ClientsScreenState extends State<ClientsScreen> {
  final _search = TextEditingController();
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    context.read<ClientsCubit>().load();
    _scroll.addListener(() {
      if (_scroll.position.pixels >= _scroll.position.maxScrollExtent - 200) context.read<ClientsCubit>().loadMore();
    });
  }

  @override
  void dispose() {
    _search.dispose();
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<ClientsCubit>();
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: BlocBuilder<ClientsCubit, ClientsState>(
          builder: (context, state) {
            final c = state.counts;
            return RefreshIndicator(
              onRefresh: cubit.load,
              child: CustomScrollView(
                controller: _scroll,
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverToBoxAdapter(
                    child: HomeListHero(
                      back: true,
                      title: l10n.navClients,
                      subtitle: c == null ? null : l10n.lvCountN(c.total),
                      bottom: HomeSearchField(
                        controller: _search,
                        hint: l10n.clSearchHint,
                        onSubmitted: cubit.setSearch,
                        onClear: () {
                          _search.clear();
                          cubit.setSearch('');
                        },
                      ),
                    ),
                  ),
                  if (c != null)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 0),
                        child: HomeBand(figures: [
                          HomeFigure(id: 'total', value: '${c.total}', label: l10n.lvTotal, hint: l10n.clOwnersN(c.owners)),
                          HomeFigure(id: 'browsers', value: '${c.browsers}', label: l10n.clBrowsers, hint: l10n.clBrowsersHint),
                          HomeFigure(
                            id: 'suspended',
                            value: '${c.suspended}',
                            label: l10n.clSuspendedTitle,
                            hint: c.suspended > 0 ? l10n.clSuspendedHint : l10n.clAllActive,
                            warn: c.suspended > 0,
                          ),
                        ]),
                      ),
                    ),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 12, bottom: 4),
                      child: HomePills(pills: [
                        HomePill(id: 'all', label: l10n.lvAll, count: c?.total, selected: state.role == null, onTap: () => cubit.setRole(null)),
                        HomePill(
                          id: 'CUSTOMER',
                          label: l10n.clOwner,
                          count: c?.owners,
                          dot: context.appColors.success,
                          selected: state.role == 'CUSTOMER',
                          onTap: () => cubit.setRole('CUSTOMER'),
                        ),
                        HomePill(
                          id: 'CLIENT',
                          label: l10n.clBrowser,
                          count: c?.browsers,
                          dot: context.appColors.info,
                          selected: state.role == 'CLIENT',
                          onTap: () => cubit.setRole('CLIENT'),
                        ),
                      ]),
                    ),
                  ),
                  ...switch (state.status) {
                    DataStatus.initial || DataStatus.loading => const [
                        SliverToBoxAdapter(child: KitCardsSkeleton(count: 5)),
                      ],
                    DataStatus.failure => [SliverToBoxAdapter(child: ErrorState(failure: state.failure, onRetry: cubit.load))],
                    DataStatus.empty => [
                        SliverToBoxAdapter(
                          child: EmptyState(icon: Icons.people_outline_rounded, title: l10n.navClients, message: l10n.clEmpty),
                        ),
                      ],
                    DataStatus.success => [
                        SliverPadding(
                          padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.sm, AppSpacing.md, 0),
                          sliver: SliverList.separated(
                            itemCount: state.clients.length,
                            separatorBuilder: (_, _) => const SizedBox(height: 10),
                            itemBuilder: (context, i) => ClientCard(client: state.clients[i]),
                          ),
                        ),
                        if (state.loadingMore)
                          const SliverToBoxAdapter(
                            child: Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator())),
                          ),
                      ],
                  },
                  SliverPadding(padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 32)),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class ClientCard extends StatelessWidget {
  const ClientCard({super.key, required this.client});
  final ClientRow client;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final phone = client.phone ?? '';
    final contact = phone.isNotEmpty ? ltr(phone) : (client.email ?? '');
    return DvEntityCard(
      inkKey: Key('client-${client.id}'),
      onTap: () => context.push('/clients/${client.id}', extra: client),
      initials: homeInitials(client.name),
      title: client.name,
      subtitle: contact,
      status: !client.active ? l10n.clSuspended : (client.owner ? l10n.clOwner : l10n.clBrowser),
      statusColor: !client.active ? colors.error : (client.owner ? colors.success : colors.inkMuted),
      footIcon: Icons.login_rounded,
      footColor: colors.inkMuted,
      footText: client.lastLoginAt == null ? l10n.clNeverLogged : l10n.clLastLogin(leadWhen(context, client.lastLoginAt!, withTime: false)),
      actions: [
        if (phone.isNotEmpty) DvSquareAction(icon: Icons.phone_rounded, gold: true, tooltip: l10n.contactCall, onTap: () => ContactActions.call(phone)),
      ],
    );
  }
}

class ClientPill extends StatelessWidget {
  const ClientPill({super.key, required this.text, required this.color});
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.11), borderRadius: BorderRadius.circular(99)),
        child: Text(text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color)),
      );
}
