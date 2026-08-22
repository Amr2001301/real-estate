import 'dart:async';

import 'package:core/core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/domain/repositories/staff_auth_repository.dart';
import '../features/auth/domain/usecases/forgot_staff_password.dart';
import '../features/auth/presentation/cubit/forgot_staff_password_cubit.dart';
import '../features/auth/presentation/screens/forgot_staff_password_screen.dart';
import '../features/auth/presentation/screens/staff_login_screen.dart';
import '../features/bonus/domain/repositories/bonus_repository.dart';
import '../features/bonus/domain/usecases/get_bonus_entries.dart';
import '../features/bonus/presentation/cubit/bonus_cubit.dart';
import '../features/bonus/presentation/screens/bonus_screen.dart';
import '../features/broker/catalog/domain/entities/broker_project.dart';
import '../features/broker/catalog/domain/repositories/broker_catalog_repository.dart';
import '../features/broker/catalog/domain/usecases/broker_catalog_use_cases.dart';
import '../features/broker/catalog/presentation/cubit/broker_units_cubit.dart';
import '../features/broker/catalog/presentation/screens/broker_project_detail_screen.dart';
import '../features/broker/catalog/presentation/screens/broker_unit_detail_screen.dart';
import '../features/broker/commissions/domain/repositories/broker_commissions_repository.dart';
import '../features/broker/commissions/domain/usecases/get_broker_commissions.dart';
import '../features/broker/commissions/presentation/cubit/broker_commissions_cubit.dart';
import '../features/broker/commissions/presentation/screens/broker_commissions_screen.dart';
import '../features/broker/leads/domain/entities/broker_lead.dart';
import '../features/broker/leads/domain/repositories/broker_leads_repository.dart';
import '../features/broker/leads/domain/usecases/broker_lead_use_cases.dart';
import '../features/broker/leads/presentation/cubit/broker_lead_detail_cubit.dart';
import '../features/broker/leads/presentation/cubit/create_broker_lead_cubit.dart';
import '../features/broker/leads/presentation/screens/broker_lead_detail_screen.dart';
import '../features/broker/leads/presentation/screens/create_broker_lead_screen.dart';
import '../features/broker/profile/domain/repositories/broker_profile_repository.dart';
import '../features/broker/profile/domain/usecases/get_broker_profile.dart';
import '../features/broker/profile/presentation/cubit/broker_profile_cubit.dart';
import '../features/broker/reservations/domain/entities/broker_reservation.dart';
import '../features/broker/reservations/domain/repositories/broker_reservations_repository.dart';
import '../features/broker/reservations/domain/usecases/broker_reservation_use_cases.dart';
import '../features/broker/reservations/presentation/cubit/broker_reservation_detail_cubit.dart';
import '../features/broker/reservations/presentation/cubit/create_broker_reservation_cubit.dart';
import '../features/broker/reservations/presentation/screens/broker_reservation_detail_screen.dart';
import '../features/broker/reservations/presentation/screens/create_broker_reservation_screen.dart';
import '../features/broker/shell/presentation/broker_shell.dart';
import '../features/payments_review/domain/repositories/payments_review_repository.dart';
import '../features/payments_review/domain/usecases/payments_review_use_cases.dart';
import '../features/payments_review/presentation/cubit/payments_review_cubit.dart';
import '../features/payments_review/presentation/cubit/proof_download_cubit.dart';
import '../features/payments_review/presentation/screens/payments_review_screen.dart';
import '../features/performance/domain/repositories/performance_repository.dart';
import '../features/performance/domain/usecases/performance_use_cases.dart';
import '../features/performance/presentation/cubit/targets_cubit.dart';
import '../features/performance/presentation/screens/targets_screen.dart';
import '../features/catalog/domain/entities/staff_project.dart';
import '../features/catalog/domain/repositories/staff_catalog_repository.dart';
import '../features/catalog/domain/usecases/staff_catalog_use_cases.dart';
import '../features/catalog/presentation/cubit/staff_project_detail_cubit.dart';
import '../features/catalog/presentation/cubit/staff_unit_detail_cubit.dart';
import '../features/catalog/presentation/screens/staff_project_detail_screen.dart';
import '../features/catalog/presentation/screens/staff_unit_detail_screen.dart';
import '../features/clients/domain/entities/staff_client.dart';
import '../features/clients/domain/repositories/clients_repository.dart';
import '../features/clients/domain/usecases/client_use_cases.dart';
import '../features/clients/presentation/cubit/client_detail_cubit.dart';
import '../features/clients/presentation/cubit/clients_cubit.dart';
import '../features/clients/presentation/screens/client_detail_screen.dart';
import '../features/clients/presentation/screens/clients_screen.dart';
import '../features/leads/domain/entities/lead.dart';
import '../features/leads/domain/repositories/leads_repository.dart';
import '../features/leads/domain/usecases/lead_use_cases.dart';
import '../features/leads/presentation/cubit/create_lead_cubit.dart';
import '../features/leads/presentation/cubit/lead_detail_cubit.dart';
import '../features/leads/presentation/cubit/leads_cubit.dart';
import '../features/leads/presentation/screens/create_lead_screen.dart';
import '../features/leads/presentation/screens/lead_detail_screen.dart';
import '../features/leads/presentation/screens/leads_screen.dart';
import '../features/notifications/domain/repositories/notifications_repository.dart';
import '../features/notifications/domain/usecases/notification_use_cases.dart';
import '../features/notifications/presentation/cubit/notifications_cubit.dart';
import '../features/notifications/presentation/screens/notifications_screen.dart';
import '../features/installments/domain/repositories/installments_repository.dart';
import '../features/installments/domain/usecases/installment_use_cases.dart';
import '../features/installments/presentation/cubit/calculator_cubit.dart';
import '../features/installments/presentation/screens/calculator_screen.dart';
import '../features/reservations/domain/entities/reservation.dart';
import '../features/reservations/domain/repositories/reservations_repository.dart';
import '../features/reservations/domain/usecases/reservation_use_cases.dart';
import '../features/reservations/presentation/cubit/create_reservation_cubit.dart';
import '../features/reservations/presentation/cubit/reservation_detail_cubit.dart';
import '../features/reservations/presentation/cubit/reservations_cubit.dart';
import '../features/reservations/presentation/screens/create_reservation_screen.dart';
import '../features/reservations/presentation/screens/reservation_detail_screen.dart';
import '../features/reservations/presentation/screens/reservations_screen.dart';
import '../features/contracts/domain/entities/staff_contract.dart';
import '../features/contracts/domain/repositories/contracts_repository.dart';
import '../features/contracts/domain/usecases/contract_use_cases.dart';
import '../features/contracts/presentation/cubit/contract_detail_cubit.dart';
import '../features/contracts/presentation/cubit/contracts_cubit.dart';
import '../features/contracts/presentation/screens/contract_detail_screen.dart';
import '../features/contracts/presentation/screens/contracts_screen.dart';
import '../features/deposits/domain/repositories/deposits_repository.dart';
import '../features/deposits/domain/usecases/deposit_use_cases.dart';
import '../features/deposits/presentation/cubit/deposits_cubit.dart';
import '../features/deposits/presentation/cubit/record_deposit_cubit.dart';
import '../features/deposits/presentation/screens/deposits_screen.dart';
import '../features/deposits/presentation/screens/record_deposit_screen.dart';
import '../features/documents/domain/repositories/documents_repository.dart';
import '../features/documents/domain/usecases/document_use_cases.dart';
import '../features/documents/presentation/cubit/documents_cubit.dart';
import '../features/documents/presentation/screens/documents_screen.dart';
import '../features/visits/domain/entities/visit.dart';
import '../features/visits/domain/repositories/visits_repository.dart';
import '../features/visits/domain/usecases/visit_use_cases.dart';
import '../features/visits/presentation/cubit/create_visit_cubit.dart';
import '../features/visits/presentation/cubit/visit_detail_cubit.dart';
import '../features/visits/presentation/cubit/visits_cubit.dart';
import '../features/visits/presentation/screens/create_visit_screen.dart';
import '../features/visits/presentation/screens/visit_detail_screen.dart';
import '../features/visits/presentation/screens/visits_screen.dart';
import '../features/maintenance/domain/entities/maintenance_request.dart';
import '../features/maintenance/domain/repositories/maintenance_repository.dart';
import '../features/maintenance/domain/usecases/maintenance_use_cases.dart';
import '../features/maintenance/presentation/cubit/maintenance_detail_cubit.dart';
import '../features/maintenance/presentation/cubit/maintenance_list_cubit.dart';
import '../features/maintenance/presentation/screens/maintenance_detail_screen.dart';
import '../features/maintenance/presentation/screens/maintenance_list_screen.dart';
import '../features/shell/presentation/staff_shell.dart';
import '../features/splash/splash_screen.dart';

/// Pure role-aware redirect. Returns the path to redirect to, or null to stay.
/// Extracted so it can be unit-tested without a router.
/// - Session not yet resolved → splash.
/// - Not an authenticated staff role (incl. customer-side) → login.
/// - Broker → confined to the `/broker/*` workspace (kept out of Sales screens).
/// - Sales/Manager/Admin → Sales shell (kept out of `/broker/*`).
String? staffRedirect(SessionState session, String loc) {
  if (!session.isResolved) return loc == '/splash' ? null : '/splash';

  final role = session.role;
  final isStaff = session.isAuthenticated && role.isStaffSide;
  if (!isStaff) return (loc == '/login' || loc == '/forgot-password') ? null : '/login';

  // `/notifications` is a shared inbox; the backend scopes results to the
  // signed-in user regardless of role.
  const sharedPaths = {'/notifications'};

  // Broker workspace: brokers may only navigate within `/broker/*` (+ shared).
  if (role.isBroker) {
    if (loc == '/login' || loc == '/splash') return '/broker/home';
    if (!loc.startsWith('/broker') && !sharedPaths.contains(loc)) {
      return '/broker/home';
    }
    return null;
  }

  // Maintenance supervisor workspace: confined to `/maintenance/*` (+ shared).
  // Mirrors the broker pattern so the supervisor never lands on the sales shell.
  if (role == AppRole.maintenanceSupervisor) {
    if (loc == '/login' || loc == '/splash') return '/maintenance';
    if (!loc.startsWith('/maintenance') && !sharedPaths.contains(loc)) {
      return '/maintenance';
    }
    return null;
  }

  // Sales / Manager / Admin: never enter the broker / maintenance workspaces.
  if (loc.startsWith('/broker')) return '/home';
  if (loc.startsWith('/maintenance')) return '/home';
  if (loc == '/login' || loc == '/splash') return '/home';
  return null;
}

/// Staff App routing. Everything requires an authenticated **staff** role.
/// BROKER lands on a placeholder (Phase 5); Sales/Manager/Admin get the shell;
/// customer-side roles are bounced to login.
GoRouter createStaffRouter(
  SessionCubit sessionCubit, {
  GlobalKey<NavigatorState>? navigatorKey,
}) {
  return GoRouter(
    navigatorKey: navigatorKey,
    initialLocation: '/splash',
    refreshListenable: _CubitRefresh(sessionCubit.stream),
    debugLogDiagnostics: kDebugMode,
    redirect: (context, state) => staffRedirect(sessionCubit.state, state.matchedLocation),
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const SplashScreen()),
      GoRoute(path: '/login', builder: (_, _) => const StaffLoginScreen()),
      GoRoute(
        path: '/forgot-password',
        builder: (context, _) => BlocProvider(
          create: (ctx) {
            final repo = ctx.read<StaffAuthRepository>();
            return ForgotStaffPasswordCubit(
              ForgotStaffPassword(repo),
              ResetStaffPassword(repo),
            );
          },
          child: const ForgotStaffPasswordScreen(),
        ),
      ),
      // ── Broker workspace (Phase 5) ───────────────────────────────────────
      GoRoute(
        path: '/broker/home',
        builder: (context, _) => BlocProvider(
          create: (ctx) =>
              BrokerProfileCubit(GetBrokerProfile(ctx.read<BrokerProfileRepository>()))..load(),
          child: const BrokerShell(),
        ),
      ),
      GoRoute(
        path: '/broker/projects/:id',
        builder: (context, state) {
          final project = state.extra! as BrokerProject;
          return BlocProvider(
            create: (ctx) => BrokerUnitsCubit(
              GetBrokerProjectUnits(ctx.read<BrokerCatalogRepository>()),
              projectId: project.id,
            ),
            child: BrokerProjectDetailScreen(project: project),
          );
        },
      ),
      GoRoute(
        path: '/broker/units/:id',
        builder: (context, state) {
          final args = (state.extra as Map<String, dynamic>?) ?? const {};
          return BrokerUnitDetailScreen(
            unit: args['unit'] as BrokerUnit,
            projectId: args['projectId'] as String?,
          );
        },
      ),
      GoRoute(
        path: '/broker/leads/new',
        builder: (context, state) {
          final args = (state.extra as Map<String, dynamic>?) ?? const {};
          return BlocProvider(
            create: (ctx) => CreateBrokerLeadCubit(
              CreateBrokerLead(ctx.read<BrokerLeadsRepository>()),
              projectInterestId: args['projectId'] as String?,
              unitInterestId: args['unitId'] as String?,
            ),
            child: const CreateBrokerLeadScreen(),
          );
        },
      ),
      GoRoute(
        path: '/broker/leads/:id',
        builder: (context, state) {
          final id = state.pathParameters['id']!;
          final lead = state.extra as BrokerLead?;
          return BlocProvider(
            create: (ctx) =>
                BrokerLeadDetailCubit(GetBrokerLeadDetail(ctx.read<BrokerLeadsRepository>()), leadId: id),
            child: BrokerLeadDetailScreen(fallback: lead),
          );
        },
      ),
      GoRoute(
        path: '/broker/reservations/new',
        builder: (context, state) {
          final args = (state.extra as Map<String, dynamic>?) ?? const {};
          return BlocProvider(
            create: (ctx) {
              final catalog = ctx.read<BrokerCatalogRepository>();
              return CreateBrokerReservationCubit(
                GetBrokerLeads(ctx.read<BrokerLeadsRepository>()),
                GetBrokerProjects(catalog),
                GetBrokerProjectUnits(catalog),
                CreateBrokerReservation(ctx.read<BrokerReservationsRepository>()),
                leadId: args['leadId'] as String?,
              );
            },
            child: const CreateBrokerReservationScreen(),
          );
        },
      ),
      GoRoute(
        path: '/broker/reservations/:id',
        builder: (context, state) {
          final id = state.pathParameters['id']!;
          final reservation = state.extra as BrokerReservation?;
          return BlocProvider(
            create: (ctx) => BrokerReservationDetailCubit(
              GetBrokerReservationDetail(ctx.read<BrokerReservationsRepository>()),
              reservationId: id,
            ),
            child: BrokerReservationDetailScreen(fallback: reservation),
          );
        },
      ),
      GoRoute(
        path: '/broker/commissions',
        builder: (context, _) => BlocProvider(
          create: (ctx) =>
              BrokerCommissionsCubit(GetBrokerCommissions(ctx.read<BrokerCommissionsRepository>())),
          child: const BrokerCommissionsScreen(),
        ),
      ),
      GoRoute(path: '/home', builder: (_, _) => const StaffShell()),

      // ── Maintenance supervisor workspace ─────────────────────────────────
      GoRoute(
        path: '/maintenance',
        builder: (context, _) => BlocProvider(
          create: (ctx) =>
              MaintenanceListCubit(GetAssignedMaintenance(ctx.read<MaintenanceRepository>())),
          child: const MaintenanceListScreen(),
        ),
      ),
      GoRoute(
        path: '/maintenance/:id',
        builder: (context, state) {
          final id = state.pathParameters['id']!;
          final request = state.extra as MaintenanceRequest?;
          return BlocProvider(
            create: (ctx) {
              final repo = ctx.read<MaintenanceRepository>();
              return MaintenanceDetailCubit(
                GetMaintenanceDetail(repo),
                UpdateMaintenanceStatus(repo),
                ConfirmMaintenanceResolution(repo),
                requestId: id,
              );
            },
            child: MaintenanceDetailScreen(fallback: request),
          );
        },
      ),

      // ── Leads list ──────────────────────────────────────────────────────
      GoRoute(
        path: '/leads',
        builder: (context, state) => BlocProvider(
          create: (ctx) {
            final repo = ctx.read<LeadsRepository>();
            return LeadsCubit(GetLeads(repo), repo);
          },
          child: const LeadsScreen(),
        ),
      ),

      // ── Lead create ─────────────────────────────────────────────────────
      GoRoute(
        path: '/leads/new',
        builder: (context, state) {
          final ctx = state.extra as LeadInterestContext?;
          return BlocProvider(
            create: (c) => CreateLeadCubit(
                CreateLead(c.read<LeadsRepository>()),
                c.read<LeadsRepository>()),
            child: CreateLeadScreen(interestContext: ctx),
          );
        },
      ),

      // ── Lead detail ──────────────────────────────────────────────────────
      GoRoute(
        path: '/leads/:id',
        builder: (context, state) {
          final id = state.pathParameters['id']!;
          final lead = state.extra as Lead?;
          return BlocProvider(
            create: (ctx) {
              final repo = ctx.read<LeadsRepository>();
              return LeadDetailCubit(
                GetLeadDetail(repo),
                UpdateLeadStage(repo),
                AddLeadNote(repo),
                leadId: id,
              );
            },
            child: LeadDetailScreen(leadId: id, fallbackName: lead?.fullName),
          );
        },
      ),

      // ── Clients list ─────────────────────────────────────────────────────
      GoRoute(
        path: '/clients',
        builder: (context, state) => BlocProvider(
          create: (ctx) =>
              ClientsCubit(GetMyClients(ctx.read<ClientsRepository>())),
          child: const ClientsScreen(),
        ),
      ),

      // ── Client detail ────────────────────────────────────────────────────
      GoRoute(
        path: '/clients/:id',
        builder: (context, state) {
          final id = state.pathParameters['id']!;
          final client = state.extra as StaffClient?;
          return BlocProvider(
            create: (ctx) =>
                ClientDetailCubit(GetClientDetail(ctx.read<ClientsRepository>()), clientId: id),
            child: ClientDetailScreen(fallback: client),
          );
        },
      ),

      // ── Project detail (+ units) ─────────────────────────────────────────
      GoRoute(
        path: '/projects/:id',
        builder: (context, state) {
          final id = state.pathParameters['id']!;
          final project = state.extra as StaffProject?;
          return BlocProvider(
            create: (ctx) => StaffProjectDetailCubit(
              GetStaffProjectDetail(ctx.read<StaffCatalogRepository>()),
              ctx.read<StaffCatalogRepository>(),
              projectId: id,
            ),
            child: StaffProjectDetailScreen(fallback: project),
          );
        },
      ),
      GoRoute(
        path: '/units/:id',
        builder: (context, state) {
          final id = state.pathParameters['id']!;
          return BlocProvider(
            create: (ctx) => StaffUnitDetailCubit(
              GetStaffUnitDetail(ctx.read<StaffCatalogRepository>()),
              unitId: id,
            ),
            child: const StaffUnitDetailScreen(),
          );
        },
      ),

      // ── Visits workflow ──────────────────────────────────────────────────
      GoRoute(
        path: '/visits',
        builder: (context, state) => BlocProvider(
          create: (ctx) => VisitsCubit(
            GetVisits(ctx.read<VisitsRepository>()),
            today: state.uri.queryParameters['today'] == '1',
          ),
          child: const VisitsScreen(),
        ),
      ),
      GoRoute(
        path: '/visits/new',
        builder: (context, state) {
          final args = (state.extra as Map<String, dynamic>?) ?? const {};
          return BlocProvider(
            create: (ctx) => CreateVisitCubit(
              GetStaffProjects(ctx.read<StaffCatalogRepository>()),
              CreateVisit(ctx.read<VisitsRepository>()),
              projectId: args['projectId'] as String?,
              unitId: args['unitId'] as String?,
              leadId: args['leadId'] as String?,
              clientId: args['clientId'] as String?,
            ),
            child: const CreateVisitScreen(),
          );
        },
      ),
      GoRoute(
        path: '/visits/:id',
        builder: (context, state) {
          final id = state.pathParameters['id']!;
          final visit = state.extra as Visit?;
          return BlocProvider(
            create: (ctx) {
              final repo = ctx.read<VisitsRepository>();
              return VisitDetailCubit(
                GetVisitDetail(repo),
                UpdateVisitStatus(repo),
                RescheduleVisit(repo),
                AssignVisit(repo),
                SubmitSalesFeedback(repo),
                visitId: id,
              );
            },
            child: VisitDetailScreen(fallback: visit),
          );
        },
      ),

      // ── Reservations workflow ────────────────────────────────────────────
      GoRoute(
        path: '/reservations',
        builder: (context, _) => BlocProvider(
          create: (ctx) => ReservationsCubit(GetReservations(ctx.read<ReservationsRepository>())),
          child: const ReservationsScreen(),
        ),
      ),
      GoRoute(
        path: '/reservations/new',
        builder: (context, state) {
          final args = (state.extra as Map<String, dynamic>?) ?? const {};
          return BlocProvider(
            create: (ctx) {
              final catalog = ctx.read<StaffCatalogRepository>();
              return CreateReservationCubit(
                GetStaffProjects(catalog),
                GetStaffProjectDetail(catalog),
                CreateReservation(ctx.read<ReservationsRepository>()),
                GetLeads(ctx.read<LeadsRepository>()),
                GetPlanTemplates(ctx.read<InstallmentsRepository>()),
                unitId: args['unitId'] as String?,
                projectId: args['projectId'] as String?,
                leadId: args['leadId'] as String?,
                clientId: args['clientId'] as String?,
              );
            },
            child: const CreateReservationScreen(),
          );
        },
      ),
      GoRoute(
        path: '/reservations/:id',
        builder: (context, state) {
          final id = state.pathParameters['id']!;
          final reservation = state.extra as Reservation?;
          return BlocProvider(
            create: (ctx) {
              final repo = ctx.read<ReservationsRepository>();
              return ReservationDetailCubit(
                GetReservationDetail(repo),
                AddReservationNote(repo),
                reservationId: id,
              );
            },
            child: ReservationDetailScreen(fallback: reservation),
          );
        },
      ),

      // ── Contracts ────────────────────────────────────────────────────────
      GoRoute(
        path: '/contracts',
        builder: (context, _) => BlocProvider(
          create: (ctx) =>
              ContractsCubit(ListContracts(ctx.read<StaffContractsRepository>())),
          child: const ContractsScreen(),
        ),
      ),
      GoRoute(
        path: '/contracts/:id',
        builder: (context, state) {
          final id = state.pathParameters['id']!;
          final contract = state.extra as StaffContract?;
          return BlocProvider(
            create: (ctx) => ContractDetailCubit(
              GetContractDetail(ctx.read<StaffContractsRepository>()),
              contractId: id,
            ),
            child: ContractDetailScreen(fallback: contract),
          );
        },
      ),

      // ── Deposits (list + record) ─────────────────────────────────────────
      GoRoute(
        path: '/deposits',
        builder: (context, state) {
          final contractId = state.uri.queryParameters['contractId'];
          return BlocProvider(
            create: (ctx) => DepositsCubit(ListDeposits(ctx.read<StaffDepositsRepository>())),
            child: DepositsScreen(contractId: contractId),
          );
        },
      ),
      GoRoute(
        path: '/deposits/record',
        builder: (context, state) {
          final args = (state.extra as Map<String, dynamic>?) ?? const {};
          return BlocProvider(
            create: (ctx) =>
                RecordDepositCubit(RecordDeposit(ctx.read<StaffDepositsRepository>())),
            child: RecordDepositScreen(
              contractId: args['contractId'] as String,
              installmentId: args['installmentId'] as String,
              suggestedAmount: (args['amount'] as num?)?.toDouble() ?? 0,
              installmentLabel: args['label'] as String?,
            ),
          );
        },
      ),

      // ── Documents viewer ─────────────────────────────────────────────────
      GoRoute(
        path: '/documents-view',
        builder: (context, state) {
          final q = state.uri.queryParameters;
          final ownerType = q['ownerType'] ?? 'CONTRACT';
          final ownerId = q['ownerId'] ?? '';
          final title = q['title'];
          return BlocProvider(
            create: (ctx) => DocumentsCubit(
              ListStaffDocuments(ctx.read<StaffDocumentsRepository>()),
              GetDocumentDownloadUrl(ctx.read<StaffDocumentsRepository>()),
            ),
            child: StaffDocumentsScreen(
              ownerType: ownerType,
              ownerId: ownerId,
              title: title,
            ),
          );
        },
      ),

      // ── Payments review (P11.6) — ADMIN + SALES_MANAGER view; ADMIN acts ──
      GoRoute(
        path: '/payments-review',
        builder: (context, _) => MultiBlocProvider(
          providers: [
            BlocProvider(
              create: (ctx) => PaymentsReviewCubit(
                GetPaymentReviewQueue(ctx.read<PaymentsReviewRepository>()),
                ApprovePayment(ctx.read<PaymentsReviewRepository>()),
                RejectPayment(ctx.read<PaymentsReviewRepository>()),
              ),
            ),
            // P11.6.1 — opens proof documents via short-lived signed URLs.
            BlocProvider(
              create: (ctx) => ProofDownloadCubit(
                GetProofDownloadLink(ctx.read<PaymentsReviewRepository>()),
              ),
            ),
          ],
          child: const PaymentsReviewScreen(),
        ),
      ),
      // ── Bonus / Targets ──────────────────────────────────────────────────
      GoRoute(
        path: '/bonus',
        builder: (context, _) => BlocProvider(
          create: (ctx) => BonusCubit(GetBonusEntries(ctx.read<BonusRepository>())),
          child: const BonusScreen(),
        ),
      ),
      GoRoute(
        path: '/targets',
        builder: (context, _) => BlocProvider(
          create: (ctx) {
            final repo = ctx.read<PerformanceRepository>();
            return TargetsCubit(GetSalesPerformance(repo), GetSalesTargets(repo));
          },
          child: const TargetsScreen(),
        ),
      ),

      // ── Installment calculator ───────────────────────────────────────────
      GoRoute(
        path: '/calculator',
        builder: (context, state) {
          final args = (state.extra as Map<String, dynamic>?) ?? const {};
          return BlocProvider(
            create: (ctx) => CalculatorCubit(
              GetPlanTemplates(ctx.read<InstallmentsRepository>()),
              CalculateInstallment(ctx.read<InstallmentsRepository>()),
              initialPrice: args['price'] as double?,
              projectId: args['projectId'] as String?,
            ),
            child: const CalculatorScreen(),
          );
        },
      ),

      if (kDebugMode)
        GoRoute(path: '/gallery', builder: (_, _) => const ComponentGalleryScreen()),

      // ── Notifications inbox (shared by Sales / Manager / Admin / Broker /
      // Maintenance Supervisor — backend scopes results to the signed-in user)
      GoRoute(
        path: '/notifications',
        builder: (context, _) => BlocProvider(
          create: (ctx) {
            final repo = ctx.read<NotificationsRepository>();
            return NotificationsCubit(
              GetNotifications(repo),
              MarkNotificationRead(repo),
              MarkAllNotificationsRead(repo),
            );
          },
          child: const NotificationsScreen(),
        ),
      ),
    ],
  );
}

/// Bridges a bloc/cubit [Stream] to a [Listenable] for GoRouter.
class _CubitRefresh extends ChangeNotifier {
  _CubitRefresh(Stream<dynamic> stream) {
    notifyListeners();
    _sub = stream.asBroadcastStream().listen((_) => notifyListeners());
  }

  late final StreamSubscription<dynamic> _sub;

  @override
  void dispose() {
    _sub.cancel();
    super.dispose();
  }
}
