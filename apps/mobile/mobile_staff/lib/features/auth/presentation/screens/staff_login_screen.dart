import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/tenant_mismatch_notifier.dart';
import '../cubit/staff_auth_cubit.dart';

class StaffLoginScreen extends StatefulWidget {
  const StaffLoginScreen({super.key});

  @override
  State<StaffLoginScreen> createState() => _StaffLoginScreenState();
}

class _StaffLoginScreenState extends State<StaffLoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _slug = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();

  @override
  void initState() {
    super.initState();
    // Pre-fill the last-used company slug (UX convenience; not auth authority).
    context.read<TokenStorage>().readLastCompanySlug().then((slug) {
      if (mounted && slug != null && slug.isNotEmpty) {
        _slug.text = slug;
      }
    });
    // Show mismatch message if one is pending (set by TenantSlugInterceptor
    // via the mismatch handler in _StaffRootState).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final notifier = context.read<TenantMismatchNotifier>();
      if (notifier.hasPendingMessage) {
        final msg = notifier.consumeMessage()!;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(msg),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    });
  }

  @override
  void dispose() {
    _slug.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  void _submit() {
    if (_formKey.currentState?.validate() != true) return;
    FocusScope.of(context).unfocus();
    context.read<StaffAuthCubit>().login(
          _slug.text,
          _email.text,
          _password.text,
        );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final bottomPad = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      resizeToAvoidBottomInset: true,
      body: BlocListener<StaffAuthCubit, StaffAuthState>(
        listenWhen: (a, b) => a.failure != b.failure && b.failure != null,
        listener: (context, state) =>
            showFailureSnackBar(context, state.failure!),
        child: Form(
          key: _formKey,
          child: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: AuthHeader(
                  title: l10n.staffAppTitle,
                  subtitle: l10n.staffLoginSubtitle,
                ),
              ),
              SliverFillRemaining(
                hasScrollBody: false,
                child: Padding(
                  padding: EdgeInsets.fromLTRB(
                    AppSpacing.lg,
                    AppSpacing.xl,
                    AppSpacing.lg,
                    AppSpacing.lg + bottomPad,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      AuthCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            // Company Code — first field. Label matches web
                            // admin phrasing. Slug is normalized server-side.
                            AuthField(
                              controller: _slug,
                              label: l10n.fieldCompanyCode,
                              icon: Icons.business_outlined,
                              keyboardType: TextInputType.text,
                              textInputAction: TextInputAction.next,
                              autofillHints: const [AutofillHints.organizationName],
                              validator: (v) => (v == null || v.trim().isEmpty)
                                  ? l10n.validationCompanyCode
                                  : null,
                            ),
                            const SizedBox(height: AppSpacing.md),
                            AuthField(
                              controller: _email,
                              label: l10n.fieldEmail,
                              icon: Icons.email_outlined,
                              keyboardType: TextInputType.emailAddress,
                              textInputAction: TextInputAction.next,
                              autofillHints: const [AutofillHints.email],
                              validator: (v) => (v == null || !v.contains('@'))
                                  ? l10n.validationEmail
                                  : null,
                            ),
                            const SizedBox(height: AppSpacing.md),
                            AuthPasswordField(
                              controller: _password,
                              label: l10n.fieldPassword,
                              textInputAction: TextInputAction.done,
                              onFieldSubmitted: (_) => _submit(),
                              validator: (v) => (v == null || v.isEmpty)
                                  ? l10n.validationRequired
                                  : null,
                            ),
                            const SizedBox(height: AppSpacing.xl),
                            BlocBuilder<StaffAuthCubit, StaffAuthState>(
                              builder: (context, state) => AppButton(
                                label: l10n.actionLogin,
                                icon: Icons.login_rounded,
                                expand: true,
                                isLoading: state.isSubmitting,
                                onPressed: state.isSubmitting ? null : _submit,
                              ),
                            ),
                            const SizedBox(height: AppSpacing.md),
                            AuthFooterLink(
                              text: l10n.authForgotPassword,
                              onTap: () => context.push('/forgot-password'),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
