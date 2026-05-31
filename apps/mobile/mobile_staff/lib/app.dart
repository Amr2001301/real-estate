import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'features/auth/data/datasources/staff_auth_remote_data_source.dart';
import 'features/auth/data/repositories/staff_auth_repository_impl.dart';
import 'features/auth/domain/repositories/staff_auth_repository.dart';
import 'features/auth/domain/usecases/login_staff.dart';
import 'features/auth/domain/usecases/logout_staff.dart';
import 'features/auth/presentation/cubit/staff_auth_cubit.dart';
import 'features/bonus/data/datasources/bonus_remote_data_source.dart';
import 'features/bonus/data/repositories/bonus_repository_impl.dart';
import 'features/bonus/domain/repositories/bonus_repository.dart';
import 'features/broker/catalog/data/datasources/broker_catalog_remote_data_source.dart';
import 'features/broker/catalog/data/repositories/broker_catalog_repository_impl.dart';
import 'features/broker/catalog/domain/repositories/broker_catalog_repository.dart';
import 'features/broker/commissions/data/datasources/broker_commissions_remote_data_source.dart';
import 'features/broker/commissions/data/repositories/broker_commissions_repository_impl.dart';
import 'features/broker/commissions/domain/repositories/broker_commissions_repository.dart';
import 'features/broker/dashboard/data/datasources/broker_dashboard_remote_data_source.dart';
import 'features/broker/dashboard/data/repositories/broker_dashboard_repository_impl.dart';
import 'features/broker/dashboard/domain/repositories/broker_dashboard_repository.dart';
import 'features/broker/leads/data/datasources/broker_leads_remote_data_source.dart';
import 'features/broker/leads/data/repositories/broker_leads_repository_impl.dart';
import 'features/broker/leads/domain/repositories/broker_leads_repository.dart';
import 'features/broker/profile/data/datasources/broker_profile_remote_data_source.dart';
import 'features/broker/profile/data/repositories/broker_profile_repository_impl.dart';
import 'features/broker/profile/domain/repositories/broker_profile_repository.dart';
import 'features/broker/reservations/data/datasources/broker_reservations_remote_data_source.dart';
import 'features/broker/reservations/data/repositories/broker_reservations_repository_impl.dart';
import 'features/broker/reservations/domain/repositories/broker_reservations_repository.dart';
import 'features/catalog/data/datasources/staff_catalog_remote_data_source.dart';
import 'features/catalog/data/repositories/staff_catalog_repository_impl.dart';
import 'features/catalog/domain/repositories/staff_catalog_repository.dart';
import 'features/clients/data/datasources/clients_remote_data_source.dart';
import 'features/clients/data/repositories/clients_repository_impl.dart';
import 'features/clients/domain/repositories/clients_repository.dart';
import 'features/dashboard/data/datasources/dashboard_remote_data_source.dart';
import 'features/dashboard/data/repositories/dashboard_repository_impl.dart';
import 'features/dashboard/domain/repositories/dashboard_repository.dart';
import 'features/installments/data/datasources/installments_remote_data_source.dart';
import 'features/installments/data/repositories/installments_repository_impl.dart';
import 'features/installments/domain/repositories/installments_repository.dart';
import 'features/leads/data/datasources/leads_remote_data_source.dart';
import 'features/leads/data/repositories/leads_repository_impl.dart';
import 'features/leads/domain/repositories/leads_repository.dart';
import 'features/notifications/data/datasources/notifications_remote_data_source.dart';
import 'features/notifications/data/repositories/notifications_repository_impl.dart';
import 'features/notifications/domain/repositories/notifications_repository.dart';
import 'features/notifications/domain/usecases/notification_use_cases.dart';
import 'features/notifications/presentation/cubit/unread_count_cubit.dart';
import 'features/payments_review/data/datasources/payments_review_remote_data_source.dart';
import 'features/payments_review/data/repositories/payments_review_repository_impl.dart';
import 'features/payments_review/domain/repositories/payments_review_repository.dart';
import 'features/performance/data/datasources/performance_remote_data_source.dart';
import 'features/performance/data/repositories/performance_repository_impl.dart';
import 'features/performance/domain/repositories/performance_repository.dart';
import 'features/profile/data/datasources/staff_profile_remote_data_source.dart';
import 'features/profile/data/repositories/staff_profile_repository_impl.dart';
import 'features/profile/domain/repositories/staff_profile_repository.dart';
import 'features/reservations/data/datasources/reservations_remote_data_source.dart';
import 'features/reservations/data/repositories/reservations_repository_impl.dart';
import 'features/reservations/domain/repositories/reservations_repository.dart';
import 'features/visits/data/datasources/visits_remote_data_source.dart';
import 'features/visits/data/repositories/visits_repository_impl.dart';
import 'features/visits/domain/repositories/visits_repository.dart';
import 'router/app_router.dart';

/// Root of the Staff App (Sales / Broker). Provides feature repositories (data→
/// domain contracts) + the app-wide StaffAuthCubit, wires the 401→refresh
/// handler, then builds the router. Shares design/theme/l10n with core.
class StaffApp extends StatelessWidget {
  const StaffApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiRepositoryProvider(
      providers: [
        RepositoryProvider<StaffAuthRepository>(
          create: (ctx) => StaffAuthRepositoryImpl(
            StaffAuthRemoteDataSourceImpl(ctx.read<Dio>()),
            ctx.read<TokenStorage>(),
          ),
        ),
        RepositoryProvider<StaffProfileRepository>(
          create: (ctx) => StaffProfileRepositoryImpl(
            StaffProfileRemoteDataSourceImpl(ctx.read<Dio>()),
          ),
        ),
        RepositoryProvider<DashboardRepository>(
          create: (ctx) => DashboardRepositoryImpl(
            DashboardRemoteDataSourceImpl(ctx.read<Dio>()),
          ),
        ),
        RepositoryProvider<LeadsRepository>(
          create: (ctx) => LeadsRepositoryImpl(LeadsRemoteDataSourceImpl(ctx.read<Dio>())),
        ),
        RepositoryProvider<NotificationsRepository>(
          create: (ctx) => NotificationsRepositoryImpl(
            NotificationsRemoteDataSourceImpl(ctx.read<Dio>()),
          ),
        ),
        RepositoryProvider<PaymentsReviewRepository>(
          create: (ctx) => PaymentsReviewRepositoryImpl(
            PaymentsReviewRemoteDataSourceImpl(ctx.read<Dio>()),
          ),
        ),
        RepositoryProvider<ClientsRepository>(
          create: (ctx) =>
              ClientsRepositoryImpl(ClientsRemoteDataSourceImpl(ctx.read<Dio>())),
        ),
        RepositoryProvider<StaffCatalogRepository>(
          create: (ctx) =>
              StaffCatalogRepositoryImpl(StaffCatalogRemoteDataSourceImpl(ctx.read<Dio>())),
        ),
        RepositoryProvider<VisitsRepository>(
          create: (ctx) => VisitsRepositoryImpl(VisitsRemoteDataSourceImpl(ctx.read<Dio>())),
        ),
        RepositoryProvider<ReservationsRepository>(
          create: (ctx) =>
              ReservationsRepositoryImpl(ReservationsRemoteDataSourceImpl(ctx.read<Dio>())),
        ),
        RepositoryProvider<InstallmentsRepository>(
          create: (ctx) =>
              InstallmentsRepositoryImpl(InstallmentsRemoteDataSourceImpl(ctx.read<Dio>())),
        ),
        RepositoryProvider<BonusRepository>(
          create: (ctx) => BonusRepositoryImpl(BonusRemoteDataSourceImpl(ctx.read<Dio>())),
        ),
        RepositoryProvider<PerformanceRepository>(
          create: (ctx) =>
              PerformanceRepositoryImpl(PerformanceRemoteDataSourceImpl(ctx.read<Dio>())),
        ),
        // ── Broker portal repositories (Phase 5) ──────────────────────────
        RepositoryProvider<BrokerProfileRepository>(
          create: (ctx) =>
              BrokerProfileRepositoryImpl(BrokerProfileRemoteDataSourceImpl(ctx.read<Dio>())),
        ),
        RepositoryProvider<BrokerDashboardRepository>(
          create: (ctx) =>
              BrokerDashboardRepositoryImpl(BrokerDashboardRemoteDataSourceImpl(ctx.read<Dio>())),
        ),
        RepositoryProvider<BrokerCatalogRepository>(
          create: (ctx) =>
              BrokerCatalogRepositoryImpl(BrokerCatalogRemoteDataSourceImpl(ctx.read<Dio>())),
        ),
        RepositoryProvider<BrokerLeadsRepository>(
          create: (ctx) =>
              BrokerLeadsRepositoryImpl(BrokerLeadsRemoteDataSourceImpl(ctx.read<Dio>())),
        ),
        RepositoryProvider<BrokerReservationsRepository>(
          create: (ctx) => BrokerReservationsRepositoryImpl(
              BrokerReservationsRemoteDataSourceImpl(ctx.read<Dio>())),
        ),
        RepositoryProvider<BrokerCommissionsRepository>(
          create: (ctx) => BrokerCommissionsRepositoryImpl(
              BrokerCommissionsRemoteDataSourceImpl(ctx.read<Dio>())),
        ),
      ],
      child: MultiBlocProvider(
        providers: [
          BlocProvider<StaffAuthCubit>(
            create: (ctx) {
              final repo = ctx.read<StaffAuthRepository>();
              return StaffAuthCubit(
                sessionCubit: ctx.read<SessionCubit>(),
                loginStaff: LoginStaff(repo),
                logoutStaff: LogoutStaff(repo),
              );
            },
          ),
          BlocProvider<UnreadCountCubit>(
            create: (ctx) => UnreadCountCubit(
              GetUnreadCount(ctx.read<NotificationsRepository>()),
            ),
          ),
        ],
        child: const _StaffRoot(),
      ),
    );
  }
}

class _StaffRoot extends StatefulWidget {
  const _StaffRoot();

  @override
  State<_StaffRoot> createState() => _StaffRootState();
}

class _StaffRootState extends State<_StaffRoot> {
  late final router = createStaffRouter(context.read<SessionCubit>());

  @override
  void initState() {
    super.initState();
    _wireRefresher();
  }

  /// Wires the 401→refresh handler now that the auth repository exists. On
  /// refresh failure: clear storage + sign out (router redirects to login).
  void _wireRefresher() {
    final authRepo = context.read<StaffAuthRepository>();
    final tokenStorage = context.read<TokenStorage>();
    final sessionCubit = context.read<SessionCubit>();
    context.read<SessionRefresherRegistry>().handler = () async {
      final result = await authRepo.refreshSession();
      if (result.isOk) return tokenStorage.readAccessToken();
      await tokenStorage.clear();
      sessionCubit.adoptSignedOut();
      return null;
    };
  }

  @override
  Widget build(BuildContext context) {
    final themeMode = context.watch<ThemeCubit>().state;
    final locale = context.watch<LocaleCubit>().state;
    final isArabic = locale.languageCode == 'ar';

    return BlocListener<SessionCubit, SessionState>(
      listenWhen: (a, b) => a.isAuthenticated != b.isAuthenticated,
      listener: (context, state) {
        if (state.isAuthenticated) {
          context.read<UnreadCountCubit>().load();
        } else {
          context.read<UnreadCountCubit>().clear();
        }
      },
      child: MaterialApp.router(
        onGenerateTitle: (ctx) => ctx.l10n.staffAppTitle,
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(isArabic: isArabic),
        darkTheme: AppTheme.dark(isArabic: isArabic),
        themeMode: themeMode,
        locale: locale,
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        routerConfig: router,
      ),
    );
  }
}
