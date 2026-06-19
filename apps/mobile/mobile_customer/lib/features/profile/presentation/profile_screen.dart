import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';

import '../domain/entities/user_profile.dart';
import '../domain/repositories/profile_repository.dart';
import 'profile_cubit.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyCard = Color(0xFF1A3352);
const _navyLight = Color(0xFF243F62);

// ─────────────────────────────────────────────────────────────────────────────
// Profile Screen
// ─────────────────────────────────────────────────────────────────────────────

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _editing = false;
  final _formKey = GlobalKey<FormState>();
  final _fullName = TextEditingController();
  final _phone = TextEditingController();
  String? _locale;

  @override
  void dispose() {
    _fullName.dispose();
    _phone.dispose();
    super.dispose();
  }

  void _startEditing(UserProfile p) {
    _fullName.text = p.fullName ?? '';
    _phone.text = p.phone ?? '';
    _locale = p.locale ?? 'ar';
    setState(() => _editing = true);
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final l10n = context.l10n;
    final failure = await context.read<ProfileCubit>().save(
          UpdateProfileParams(
            fullName: _fullName.text.trim(),
            phone: _phone.text.trim(),
            locale: _locale,
          ),
        );
    if (!mounted) return;
    if (failure == null) {
      setState(() => _editing = false);
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(l10n.profileSaved)));
    } else {
      showFailureSnackBar(context, failure);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      backgroundColor: context.appColors.canvas,
      extendBodyBehindAppBar: true,
      appBar: _PremiumAppBar(title: l10n.profileTitle),
      body: BlocBuilder<ProfileCubit, ProfileState>(
        builder: (context, state) {
          switch (state.status) {
            case DataStatus.initial:
            case DataStatus.loading:
              return const Center(child: CircularProgressIndicator());
            case DataStatus.failure:
              return ErrorState(
                failure: state.failure,
                onRetry: () => context.read<ProfileCubit>().load(),
              );
            case DataStatus.empty:
            case DataStatus.success:
              final p = state.profile;
              if (p == null) return const EmptyState();
              return _editing
                  ? _buildEdit(context, state, p)
                  : _buildView(context, p, l10n);
          }
        },
      ),
    );
  }

  // ── View mode ───────────────────────────────────────────────────────────────

  Widget _buildView(BuildContext context, UserProfile p, AppLocalizations l10n) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    final topInset = MediaQuery.paddingOf(context).top;
    // kToolbarHeight = standard AppBar height (56)
    final appBarBottom = topInset + kToolbarHeight;

    final fields = [
      _Field(l10n.fieldFullName, p.fullName ?? '—'),
      _Field(l10n.fieldEmail, p.email ?? '—'),
      _Field(l10n.fieldPhone, p.phone ?? '—'),
      _Field(l10n.fieldLanguage, p.locale == 'en' ? 'English' : 'العربية'),
    ];

    return ListView(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        appBarBottom + AppSpacing.xl,
        AppSpacing.lg,
        AppSpacing.xl,
      ),
      children: [
        // Profile identity hero
        _ProfileHero(profile: p, l10n: l10n),
        const SizedBox(height: AppSpacing.xl),

        // Fields card
        Container(
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: colors.hairline.withValues(alpha: 0.5)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.06),
                blurRadius: 16,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: [
              for (var i = 0; i < fields.length; i++) ...[
                if (i > 0)
                  Divider(
                    height: 1,
                    indent: AppSpacing.lg,
                    endIndent: AppSpacing.lg,
                    color: colors.hairline,
                  ),
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                    vertical: AppSpacing.md,
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              fields[i].label,
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: colors.inkMuted,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              fields[i].value,
                              style: theme.textTheme.bodyLarge?.copyWith(
                                color: colors.inkStrong,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.xl),

        // Edit button
        GestureDetector(
          onTap: () => _startEditing(p),
          child: Container(
            height: 52,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [_navyLight, _navyDeep],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: _navyDeep.withValues(alpha: 0.3),
                  blurRadius: 16,
                  offset: const Offset(0, 5),
                ),
              ],
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  Icons.edit_outlined,
                  color: AppPalette.gold300,
                  size: 18,
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  l10n.profileEdit,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // ── Edit mode ───────────────────────────────────────────────────────────────

  Widget _buildEdit(
    BuildContext context,
    ProfileState state,
    UserProfile p,
  ) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final topInset = MediaQuery.paddingOf(context).top;
    final appBarBottom = topInset + kToolbarHeight;

    return ListView(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        appBarBottom + AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.xl,
      ),
      children: [
        Form(
          key: _formKey,
          child: Container(
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: colors.hairline.withValues(alpha: 0.5)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.06),
                  blurRadius: 16,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              children: [
                TextFormField(
                  controller: _fullName,
                  decoration: InputDecoration(labelText: l10n.fieldFullName),
                  validator: (v) =>
                      (v == null || v.trim().isEmpty)
                          ? l10n.validationRequired
                          : null,
                ),
                const SizedBox(height: AppSpacing.md),
                TextFormField(
                  controller: _phone,
                  keyboardType: TextInputType.phone,
                  decoration: InputDecoration(labelText: l10n.fieldPhone),
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) {
                      return l10n.validationRequired;
                    }
                    return RegExp(r'^\+?[1-9]\d{7,14}$').hasMatch(v.trim())
                        ? null
                        : l10n.validationPhone;
                  },
                ),
                const SizedBox(height: AppSpacing.md),
                DropdownButtonFormField<String>(
                  initialValue: _locale,
                  decoration: InputDecoration(labelText: l10n.fieldLanguage),
                  items: const [
                    DropdownMenuItem(value: 'ar', child: Text('العربية')),
                    DropdownMenuItem(value: 'en', child: Text('English')),
                  ],
                  onChanged: (v) => setState(() => _locale = v),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.xl),
        AppButton(
          label: l10n.actionSave,
          expand: true,
          isLoading: state.saving,
          onPressed: _save,
        ),
        const SizedBox(height: AppSpacing.sm),
        AppButton(
          label: l10n.actionCancel,
          variant: AppButtonVariant.ghost,
          expand: true,
          onPressed: () => setState(() => _editing = false),
        ),
      ],
    );
  }
}

// ── Profile hero ─────────────────────────────────────────────────────────────

class _ProfileHero extends StatelessWidget {
  const _ProfileHero({required this.profile, required this.l10n});
  final UserProfile profile;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.5)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 18,
            offset: const Offset(0, 5),
          ),
          BoxShadow(
            color: AppPalette.gold400.withValues(alpha: 0.06),
            blurRadius: 24,
            spreadRadius: 2,
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          // Navy gradient top strip
          SizedBox(
            height: 72,
            child: Stack(
              fit: StackFit.expand,
              children: [
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topRight,
                      end: Alignment.bottomLeft,
                      colors: [_navyLight, _navyCard, _navyDeep],
                      stops: [0.0, 0.5, 1.0],
                    ),
                  ),
                ),
                const IgnorePointer(child: _HeaderDots()),
              ],
            ),
          ),
          // Avatar overlapping the strip
          Transform.translate(
            offset: const Offset(0, -36),
            child: Column(
              children: [
                Container(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: colors.surface,
                      width: 3,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: AppPalette.gold400.withValues(alpha: 0.3),
                        blurRadius: 16,
                        spreadRadius: 2,
                      ),
                    ],
                  ),
                  child: Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: AppPalette.gold400.withValues(alpha: 0.65),
                        width: 2,
                      ),
                    ),
                    child: GradientAvatar(
                      name: profile.fullName ?? profile.email,
                      size: 72,
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  profile.fullName ?? profile.email ?? '—',
                  style: const TextStyle(
                    color: _navyDeep,
                    fontWeight: FontWeight.w800,
                    fontSize: 18,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                StatusBadge(
                  label: l10n.accountRoleCustomer,
                  tone: BadgeTone.gold,
                ),
                const SizedBox(height: AppSpacing.md),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Field {
  const _Field(this.label, this.value);
  final String label;
  final String value;
}

// ── Premium app bar ───────────────────────────────────────────────────────────

class _PremiumAppBar extends StatelessWidget implements PreferredSizeWidget {
  const _PremiumAppBar({required this.title});
  final String title;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      backgroundColor: Colors.transparent,
      systemOverlayStyle: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
      ),
      foregroundColor: Colors.white,
      elevation: 0,
      iconTheme: const IconThemeData(color: Colors.white),
      title: Text(
        title,
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w800,
        ),
      ),
      flexibleSpace: Stack(
        fit: StackFit.expand,
        children: [
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topRight,
                end: Alignment.bottomLeft,
                colors: [_navyLight, _navyCard, _navyDeep],
                stops: [0.0, 0.45, 1.0],
              ),
            ),
          ),
          const IgnorePointer(child: _HeaderDots()),
          // Gold shimmer at bottom
          Positioned(
            bottom: 0,
            left: 48,
            right: 48,
            child: Container(
              height: 1,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppPalette.gold400.withValues(alpha: 0.0),
                    AppPalette.gold400.withValues(alpha: 0.5),
                    AppPalette.gold400.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Dot texture ───────────────────────────────────────────────────────────────

class _HeaderDots extends StatelessWidget {
  const _HeaderDots();
  @override
  Widget build(BuildContext context) =>
      const CustomPaint(painter: _DotPainter(), child: SizedBox.expand());
}

class _DotPainter extends CustomPainter {
  const _DotPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.04);
    const step = 20.0;
    for (var y = 6.0; y < size.height; y += step) {
      for (var x = 6.0; x < size.width; x += step) {
        canvas.drawCircle(Offset(x, y), 1.1, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DotPainter _) => false;
}
