/// Shared foundation for the Real Estate mobile apps (Customer & Staff).
///
/// Design system, theme, localization, state management (flutter_bloc),
/// centralized error handling, network, auth, and reusable widgets.
/// Apps depend only on this barrel.
library;

// Re-export the animation API so feature screens get micro-interactions
// (`.animate()…`) through the single `core` import.
export 'package:flutter_animate/flutter_animate.dart';

// Re-export Equatable so feature cubit states can use it via `core`.
export 'package:equatable/equatable.dart';

// Environment
export 'src/env/app_environment.dart';
export 'src/env/env_config.dart';

// Composition root
export 'src/app/app_bootstrap.dart';

// Design system
export 'src/design/platform/app_platform.dart';
export 'src/design/tokens/app_colors.dart';
export 'src/design/tokens/app_icons.dart';
export 'src/design/tokens/app_radii.dart';
export 'src/design/tokens/app_shadows.dart';
export 'src/design/tokens/app_spacing.dart';
export 'src/design/tokens/app_typography.dart';
export 'src/design/theme/app_theme.dart';
export 'src/design/theme/app_theme_ext.dart';

// Localization (re-exports generated AppLocalizations + LocaleCubit)
export 'src/l10n/l10n.dart';

// State management — shared cubits + base state
export 'src/theme/theme_mode_controller.dart'; // ThemeCubit
export 'src/state/data_state.dart';

// Centralized error handling
export 'src/error/failure_type.dart';
export 'src/error/app_failure.dart';
export 'src/error/dio_error_mapper.dart';
export 'src/error/result.dart';
export 'src/error/api_guard.dart';
export 'src/error/failure_localizations.dart';
export 'src/error/error_reporter.dart';
export 'src/error/error_presenter.dart';

// Domain base — use case contracts (used by feature domain layers)
export 'src/usecase/use_case.dart';

// Generic shared value types / utilities (no feature business logic)
export 'src/common/translatable.dart';
export 'src/common/paginated.dart';
export 'src/common/price_formatter.dart';
export 'src/common/date_formatter.dart';

// Contact actions (WhatsApp / call / maps)
export 'src/contact/contact_actions.dart';

// Network
export 'src/network/dio_client.dart';
export 'src/network/interceptors/auth_interceptor.dart'
    show
        AuthInterceptor,
        SessionRefresher,
        AccessTokenReader,
        SessionInvalidator;
export 'src/network/interceptors/request_id_interceptor.dart'
    show RequestIdInterceptor;
export 'src/network/session_refresher_registry.dart';

// Auth
export 'src/auth/app_role.dart';
export 'src/auth/session.dart';
export 'src/auth/session_state.dart';
export 'src/auth/session_cubit.dart';
export 'src/auth/token_storage.dart';

// Widgets
export 'src/widgets/adaptive_app_bar.dart';
export 'src/widgets/adaptive_dialog.dart';
export 'src/widgets/adaptive_icon_button.dart';
export 'src/widgets/app_bottom_nav.dart';
export 'src/widgets/app_button.dart';
export 'src/widgets/app_card.dart';
export 'src/widgets/app_network_image.dart';
export 'src/widgets/app_skeleton.dart';
export 'src/widgets/app_text_field.dart';
export 'src/widgets/app_tone.dart';
export 'src/widgets/empty_state.dart';
export 'src/widgets/error_state.dart';
export 'src/widgets/gradient_avatar.dart';
export 'src/widgets/icon_chip.dart';
export 'src/widgets/placeholder_screen.dart';
export 'src/widgets/premium_card.dart';
export 'src/widgets/reveal.dart';
export 'src/widgets/section_header.dart';
export 'src/widgets/state_view.dart';
export 'src/widgets/status_badge.dart';
export 'src/widgets/summary_tile.dart';

// Gallery (dev/visual verification)
export 'src/gallery/component_gallery_screen.dart';
