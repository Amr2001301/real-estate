import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../storage/customer_tenant_storage.dart';
import '../cubit/company_discovery_cubit.dart';
import '../cubit/company_discovery_state.dart';

/// K1 — Customer Company selection screen.
///
/// Allows the user to search for a Company (Developer) and select one.
/// On selection: exact-resolves the slug against the backend to confirm
/// eligibility, then persists slug+name via CustomerTenantStorage.
///
/// Only reachable when kEnableCustomerTenantSelection == true.
/// In K1 the selected slug does NOT flow into any legacy auth endpoint.
class CompanySelectorScreen extends StatefulWidget {
  const CompanySelectorScreen({
    super.key,
    this.isChanging = false,
    this.isUnavailable = false,
  });

  /// When true, presented as "change developer" (cosmetic difference in K1).
  final bool isChanging;

  /// When true (navigated from startup revalidation failure), show a
  /// "company not available" warning banner on first mount.
  final bool isUnavailable;

  @override
  State<CompanySelectorScreen> createState() => _CompanySelectorScreenState();
}

class _CompanySelectorScreenState extends State<CompanySelectorScreen> {
  final _controller = TextEditingController();

  @override
  void initState() {
    super.initState();
    if (widget.isUnavailable) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final l10n = context.l10n;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.companyNotAvailable)),
        );
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _onSelect(String slug) async {
    final cubit = context.read<CompanyDiscoveryCubit>();
    final storage = context.read<CustomerTenantStorage>();

    final resolved = await cubit.selectCompany(slug);
    if (!mounted) return;
    if (resolved == null) return; // error reflected in BlocBuilder

    await storage.saveSelectedCompany(slug: resolved.slug, name: resolved.name);
    if (!mounted) return;
    context.go('/home');
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final bottomPad = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      backgroundColor: colors.canvas,
      appBar: AdaptiveAppBar(
        title: Text(
          widget.isChanging ? l10n.companyChangeTitle : l10n.companySelectTitle,
        ),
      ),
      body: BlocConsumer<CompanyDiscoveryCubit, CompanyDiscoveryState>(
        listenWhen: (a, b) => a.failure != b.failure && b.failure != null,
        listener: (context, state) {
          if (state.failure != null) {
            showFailureSnackBar(context, state.failure!);
          }
        },
        builder: (context, state) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  AppSpacing.lg,
                  AppSpacing.lg,
                  AppSpacing.sm,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (!widget.isChanging) ...[
                      Text(
                        l10n.companySelectSubtitle,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: colors.inkMuted,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                    ],
                    AppTextField(
                      controller: _controller,
                      hint: l10n.companySearchHint,
                      onChanged: context.read<CompanyDiscoveryCubit>().onQueryChanged,
                      prefixIcon: AppIcons.search,
                      textInputAction: TextInputAction.search,
                    ),
                    if (state.hasError && state.failure == null)
                      Padding(
                        padding: const EdgeInsets.only(top: AppSpacing.sm),
                        child: Text(
                          l10n.companyNotAvailable,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: colors.error,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              if (state.isSearching)
                const Padding(
                  padding: EdgeInsets.only(top: AppSpacing.xl),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (state.query.trim().length < 2)
                Expanded(
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                      child: Text(
                        l10n.companySearchMinLength,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: colors.inkMuted,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
                )
              else if (state.results.isEmpty)
                Expanded(
                  child: EmptyState(title: l10n.companySearchEmpty, message: ''),
                )
              else
                Expanded(
                  child: ListView.separated(
                    padding: EdgeInsets.only(
                      top: AppSpacing.sm,
                      bottom: AppSpacing.lg + bottomPad,
                    ),
                    itemCount: state.results.length,
                    separatorBuilder: (_, _) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final company = state.results[index];
                      return ListTile(
                        title: Text(company.name),
                        subtitle: Text(
                          company.slug,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: colors.inkMuted,
                          ),
                        ),
                        trailing: state.isSelecting
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : AppButton(
                                label: l10n.companySelectButton,
                                variant: AppButtonVariant.outline,
                                size: AppButtonSize.small,
                                onPressed: () => _onSelect(company.slug),
                              ),
                        onTap: state.isSelecting ? null : () => _onSelect(company.slug),
                      );
                    },
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}
