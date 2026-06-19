import 'dart:async';

import 'package:core/core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../features/account/presentation/account_screen.dart';
import '../features/auth/presentation/login_screen.dart';
import '../features/auth/presentation/otp_screen.dart';
import '../features/auth/presentation/register_screen.dart';
import '../features/catalog/domain/repositories/catalog_repository.dart';
import '../features/catalog/domain/usecases/get_featured_projects.dart';
import '../features/catalog/domain/usecases/get_project_detail.dart';
import '../features/catalog/domain/usecases/get_projects.dart';
import '../features/catalog/domain/usecases/get_unit.dart';
import '../features/catalog/domain/usecases/get_units.dart';
import '../features/catalog/presentation/compare/compare_screen.dart';
import '../features/catalog/presentation/home/home_cubit.dart';
import '../features/catalog/presentation/home/home_screen.dart';
import '../features/catalog/presentation/project_details/project_details_cubit.dart';
import '../features/catalog/presentation/project_details/project_details_screen.dart';
import '../features/catalog/presentation/projects/projects_cubit.dart';
import '../features/catalog/presentation/projects/projects_screen.dart';
import '../features/catalog/presentation/projects/projects_state.dart';
import '../features/catalog/presentation/unit_details/unit_details_cubit.dart';
import '../features/catalog/presentation/unit_details/unit_details_screen.dart';
import '../features/catalog/presentation/units/units_cubit.dart';
import '../features/catalog/presentation/units/units_screen.dart';
import '../features/chat/domain/repositories/chat_repository.dart';
import '../features/chat/domain/usecases/send_chat_message.dart';
import '../features/chat/domain/usecases/start_chat_session.dart';
import '../features/chat/presentation/chat_bloc.dart';
import '../features/chat/presentation/chat_event.dart';
import '../features/chat/presentation/chat_screen.dart';
import '../features/contracts/domain/entities/contract.dart';
import '../features/contracts/domain/repositories/contracts_repository.dart';
import '../features/contracts/domain/usecases/get_my_contracts.dart';
import '../features/contracts/presentation/contract_detail_screen.dart';
import '../features/contracts/presentation/contracts_cubit.dart';
import '../features/contracts/presentation/contracts_screen.dart';
import '../features/deposits/domain/entities/deposit.dart';
import '../features/deposits/domain/repositories/deposits_repository.dart';
import '../features/deposits/domain/usecases/get_my_deposits.dart';
import '../features/deposits/presentation/deposit_detail_screen.dart';
import '../features/deposits/presentation/deposits_cubit.dart';
import '../features/deposits/presentation/deposits_screen.dart';
import '../features/finance/presentation/finance_hub_screen.dart';
import '../features/installments/domain/entities/installment.dart';
import '../features/installments/domain/repositories/installments_repository.dart';
import '../features/installments/domain/usecases/get_my_installments.dart';
import '../features/installments/domain/usecases/submit_payment_proof.dart';
import '../features/installments/presentation/cubit/installments_cubit.dart';
import '../features/installments/presentation/cubit/submit_proof_cubit.dart';
import '../features/installments/presentation/screens/installments_screen.dart';
import '../features/installments/presentation/screens/proof_view_screen.dart';
import '../features/installments/presentation/screens/submit_proof_screen.dart';
import '../features/documents/domain/entities/customer_document.dart';
import '../features/documents/domain/repositories/documents_repository.dart';
import '../features/documents/domain/usecases/get_customer_documents.dart';
import '../features/documents/domain/usecases/get_document_download_link.dart';
import '../features/documents/presentation/document_download_cubit.dart';
import '../features/documents/presentation/documents_list_cubit.dart';
import '../features/maintenance/domain/repositories/maintenance_repository.dart';
import '../features/maintenance/domain/entities/maintenance_request.dart';
import '../features/maintenance/domain/usecases/maintenance_use_cases.dart';
import '../features/maintenance/presentation/create_maintenance_cubit.dart';
import '../features/maintenance/presentation/create_maintenance_screen.dart';
import '../features/maintenance/presentation/image_picker_photo_picker.dart';
import '../features/maintenance/presentation/maintenance_detail_cubit.dart';
import '../features/maintenance/presentation/maintenance_request_detail_screen.dart';
import '../features/maintenance/presentation/maintenance_requests_cubit.dart';
import '../features/maintenance/presentation/maintenance_requests_screen.dart';
import '../features/my_property/domain/entities/property.dart';
import '../features/my_property/domain/repositories/my_property_repository.dart';
import '../features/my_property/domain/usecases/get_my_properties.dart';
import '../features/my_property/presentation/my_property_cubit.dart';
import '../features/my_property/presentation/my_property_screen.dart';
import '../features/my_property/presentation/property_detail_screen.dart';
import '../features/favorites/presentation/favorites_screen.dart';
import '../features/notifications/domain/repositories/notifications_repository.dart';
import '../features/notifications/domain/usecases/notification_use_cases.dart';
import '../features/notifications/presentation/notifications_cubit.dart';
import '../features/notifications/presentation/notifications_screen.dart';
import '../features/profile/domain/repositories/profile_repository.dart';
import '../features/profile/domain/usecases/get_my_profile.dart';
import '../features/profile/domain/usecases/update_my_profile.dart';
import '../features/profile/presentation/profile_cubit.dart';
import '../features/profile/presentation/profile_screen.dart';
import '../features/shell/presentation/customer_shell_scaffold.dart';
import '../features/shell/presentation/more_screen.dart';
import '../features/splash/splash_screen.dart';
import '../features/visits/domain/repositories/visits_repository.dart';
import '../features/visits/domain/usecases/confirm_visit_appointment.dart';
import '../features/visits/domain/usecases/create_visit_request.dart';
import '../features/visits/domain/usecases/get_my_visit_requests.dart';
import '../features/visits/domain/usecases/request_visit_reschedule.dart';
import '../features/visits/presentation/my_requests_screen.dart';
import '../features/visits/presentation/my_visits_cubit.dart';
import '../features/visits/presentation/visit_request_cubit.dart';
import '../features/visits/presentation/visit_request_screen.dart';

const _authRoutes = {'/login', '/register', '/login/otp'};

/// Customer App routing. Catalog + chat are public (Guest). The account area
/// requires an authenticated **customer-side** role. Screens get their
/// cubit/bloc from route-scoped providers built from use cases; the app-wide
/// AuthCubit/FavoritesCubit come from CustomerApp.
GoRouter createCustomerRouter(SessionCubit sessionCubit) {
  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: Listenable.merge([
      _CubitRefresh(sessionCubit.stream),
      SplashScreen.splashDone,
    ]),
    debugLogDiagnostics: kDebugMode,
    redirect: (context, state) {
      final session = sessionCubit.state;
      final loc = state.matchedLocation;
      // Hold on splash until both session resolves AND video splash completes.
      if (!session.isResolved || !SplashScreen.splashDone.value) {
        return loc == '/splash' ? null : '/splash';
      }

      final authed = session.isAuthenticated;
      final isCustomer = authed && session.role.isCustomerSide;

      if (loc == '/splash') return '/home';
      if (_authRoutes.contains(loc)) return authed ? '/account' : null;
      if (loc.startsWith('/account')) {
        if (!authed) return '/login';
        if (!isCustomer) {
          return '/home'; // staff roles can't enter customer account
        }
        return null;
      }
      if (loc == '/visit-request') return authed ? null : '/login';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const SplashScreen()),

      // ── Auth (app-wide AuthCubit) ──────────────────────────────────────
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, _) => const RegisterScreen()),
      GoRoute(path: '/login/otp', builder: (_, _) => const OtpScreen()),

      // ── Persistent shell ────────────────────────────────────────────────
      // One StatefulShellRoute hosts BOTH the public browsing branches and the
      // authenticated customer branches. The bottom nav (in CustomerShellScaffold)
      // shows a different SUBSET per auth state:
      //   guest  → branches 0,1,2  (home, projects, compare)
      //   customer → branches 0,3,4,5,6  (home, property, finance, maintenance, account)
      // Each branch keeps its own navigator/state. Detail + secondary routes
      // live OUTSIDE the shell (below) and push full-screen over it, preserving
      // their existing deep links unchanged. The redirect() guard still sends
      // unauthenticated access to /account/* to /login.
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            CustomerShellScaffold(navigationShell: navigationShell),
        branches: [
          // 0 · الرئيسية (public home)
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/home',
                // Home is public, but for a signed-in customer it becomes an
                // ownership-first dashboard. The ownership cubits below are
                // ADDED only for customers (guests never hit the /me endpoints)
                // — pure presentation wiring over the existing use cases /
                // repositories; no business logic changes.
                builder: (context, _) {
                  final session = sessionCubit.state;
                  final isCustomer =
                      session.isAuthenticated && session.role.isCustomerSide;
                  return MultiBlocProvider(
                    providers: [
                      BlocProvider(
                        create: (ctx) => HomeCubit(
                          GetFeaturedProjects(ctx.read<CatalogRepository>()),
                        )..load(),
                      ),
                      if (isCustomer) ...[
                        BlocProvider(
                          create: (ctx) => MyPropertyCubit(
                            GetMyProperties(ctx.read<MyPropertyRepository>()),
                          )..load(),
                        ),
                        BlocProvider(
                          create: (ctx) => InstallmentsCubit(
                            GetMyInstallments(
                              ctx.read<InstallmentsRepository>(),
                            ),
                          )..load(),
                        ),
                        BlocProvider(
                          create: (ctx) => MaintenanceRequestsCubit(
                            GetMyMaintenanceRequests(
                              ctx.read<MaintenanceRepository>(),
                            ),
                          )..load(),
                        ),
                      ],
                    ],
                    child: const HomeScreen(),
                  );
                },
              ),
            ],
          ),
          // 1 · المشاريع (public)
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/projects',
                builder: (context, state) => BlocProvider(
                  create: (ctx) => ProjectsCubit(
                    GetProjects(ctx.read<CatalogRepository>()),
                    initialFilter: ProjectsFilter(
                      city: state.uri.queryParameters['city'],
                      query: state.uri.queryParameters['q'],
                    ),
                  ),
                  child: const ProjectsScreen(),
                ),
              ),
            ],
          ),
          // 2 · الوحدات (public — global units list; projectId null)
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/units',
                builder: (context, _) => BlocProvider(
                  create: (ctx) =>
                      UnitsCubit(GetUnits(ctx.read<CatalogRepository>())),
                  child: const UnitsScreen(),
                ),
              ),
            ],
          ),
          // 3 · المقارنة (public)
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/compare',
                builder: (_, _) => const CompareScreen(),
              ),
            ],
          ),
          // 4 · المزيد (public hub: login, assistant, language, theme)
          StatefulShellBranch(
            routes: [
              GoRoute(path: '/more', builder: (_, _) => const MoreScreen()),
            ],
          ),
          // 5 · عقاراتي
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/account/property',
                builder: (context, _) => BlocProvider(
                  create: (ctx) => MyPropertyCubit(
                    GetMyProperties(ctx.read<MyPropertyRepository>()),
                  ),
                  child: const MyPropertyScreen(),
                ),
              ),
            ],
          ),
          // 6 · المالية (navigation-only hub — no API calls)
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/account/finance',
                builder: (_, _) => const FinanceHubScreen(),
              ),
            ],
          ),
          // 7 · الصيانة
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/account/maintenance',
                builder: (context, _) => BlocProvider(
                  create: (ctx) => MaintenanceRequestsCubit(
                    GetMyMaintenanceRequests(ctx.read<MaintenanceRepository>()),
                  ),
                  child: const MaintenanceRequestsScreen(),
                ),
              ),
            ],
          ),
          // 8 · حسابي
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/account',
                builder: (_, _) => const AccountScreen(),
              ),
            ],
          ),
        ],
      ),

      // ── Account area (secondary routes — pushed over the shell) ──────────
      GoRoute(
        path: '/account/profile',
        builder: (context, _) => BlocProvider(
          create: (ctx) {
            final repo = ctx.read<ProfileRepository>();
            return ProfileCubit(GetMyProfile(repo), UpdateMyProfile(repo))
              ..load();
          },
          child: const ProfileScreen(),
        ),
      ),
      GoRoute(
        path: '/account/favorites',
        builder: (_, _) => const FavoritesScreen(),
      ),
      GoRoute(
        path: '/account/requests',
        builder: (context, _) => BlocProvider(
          create: (ctx) {
            final repo = ctx.read<VisitsRepository>();
            return MyVisitsCubit(
              GetMyVisitRequests(repo),
              confirmVisitAppointment: ConfirmVisitAppointment(repo),
              requestVisitReschedule: RequestVisitReschedule(repo),
            );
          },
          child: const MyRequestsScreen(),
        ),
      ),
      GoRoute(
        path: '/account/notifications',
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

      // ── Contracts (list + signed-PDF detail) ─────────────────────────────
      GoRoute(
        path: '/account/contracts',
        builder: (context, _) => BlocProvider(
          create: (ctx) =>
              ContractsCubit(GetMyContracts(ctx.read<ContractsRepository>())),
          child: const ContractsScreen(),
        ),
      ),
      GoRoute(
        path: '/account/contracts/:id',
        builder: (context, state) {
          final contract = state.extra! as Contract;
          return _documentsProviders(
            ownerType: DocumentOwnerType.contract,
            ownerId: contract.id,
            child: ContractDetailScreen(contract: contract),
          );
        },
      ),

      // ── Deposits / payments (list + receipt detail) ──────────────────────
      GoRoute(
        path: '/account/deposits',
        builder: (context, _) => BlocProvider(
          create: (ctx) =>
              DepositsCubit(GetMyDeposits(ctx.read<DepositsRepository>())),
          child: const DepositsScreen(),
        ),
      ),
      GoRoute(
        path: '/account/deposits/:id',
        builder: (context, state) {
          final deposit = state.extra! as Deposit;
          return _documentsProviders(
            ownerType: DocumentOwnerType.deposit,
            ownerId: deposit.id,
            child: DepositDetailScreen(deposit: deposit),
          );
        },
      ),

      // ── Installments + payment-proof submission (P11.5) ─────────────────
      GoRoute(
        path: '/account/installments',
        builder: (context, _) => BlocProvider(
          create: (ctx) => InstallmentsCubit(
            GetMyInstallments(ctx.read<InstallmentsRepository>()),
          ),
          child: const InstallmentsScreen(),
        ),
      ),
      GoRoute(
        path: '/account/installments/:id/submit-proof',
        builder: (context, state) {
          final installment = state.extra! as Installment;
          return BlocProvider(
            create: (ctx) => SubmitProofCubit(
              submit: SubmitPaymentProof(ctx.read<InstallmentsRepository>()),
              resubmit: ResubmitPaymentProof(
                ctx.read<InstallmentsRepository>(),
              ),
              installment: installment,
            ),
            child: const SubmitProofScreen(),
          );
        },
      ),
      GoRoute(
        path: '/account/installments/:id/proof',
        builder: (context, state) {
          final installment = state.extra! as Installment;
          return _documentsProviders(
            ownerType: DocumentOwnerType.deposit,
            ownerId: installment.latestProof!.depositId,
            child: ProofViewScreen(installment: installment),
          );
        },
      ),

      // ── Property detail ───────────────────────────────────────────────────
      GoRoute(
        path: '/account/property/detail',
        builder: (context, state) {
          final property = state.extra! as Property;
          return BlocProvider(
            create: (ctx) => InstallmentsCubit(
              GetMyInstallments(ctx.read<InstallmentsRepository>()),
            ),
            child: PropertyDetailScreen(property: property),
          );
        },
      ),

      // ── Maintenance (create + detail — list is a shell tab) ──────────────
      GoRoute(
        path: '/account/maintenance/new',
        builder: (context, state) {
          final args = (state.extra as Map<String, dynamic>?) ?? const {};
          return BlocProvider(
            create: (ctx) {
              final repo = ctx.read<MaintenanceRepository>();
              return CreateMaintenanceCubit(
                GetMaintenanceCategories(repo),
                GetMyProperties(ctx.read<MyPropertyRepository>()),
                CreateMaintenanceRequest(repo),
                UploadMaintenancePhoto(repo),
                ImagePickerPhotoPicker(),
                initialUnitId: args['unitId'] as String?,
              );
            },
            child: const CreateMaintenanceScreen(),
          );
        },
      ),
      GoRoute(
        path: '/account/maintenance/:id',
        builder: (context, state) {
          final request = state.extra! as MaintenanceRequest;
          return _documentsProviders(
            ownerType: DocumentOwnerType.maintenanceRequest,
            ownerId: request.id,
            child: BlocProvider(
              create: (ctx) {
                final repo = ctx.read<MaintenanceRepository>();
                return MaintenanceDetailCubit(
                  initial: request,
                  confirmResolution: ConfirmMaintenanceResolution(repo),
                  submitComplaint: SubmitMaintenanceComplaint(repo),
                );
              },
              child: const MaintenanceRequestDetailScreen(),
            ),
          );
        },
      ),

      GoRoute(
        path: '/visit-request',
        builder: (context, state) {
          final args = (state.extra as Map<String, dynamic>?) ?? const {};
          return BlocProvider(
            create: (ctx) => VisitRequestCubit(
              CreateVisitRequest(ctx.read<VisitsRepository>()),
            ),
            child: VisitRequestScreen(
              projectId: args['projectId'] as String? ?? '',
              unitId: args['unitId'] as String?,
            ),
          );
        },
      ),

      // ── Public catalog (details — list/compare are shell branches above) ─
      GoRoute(
        path: '/projects/:id',
        builder: (context, state) => BlocProvider(
          create: (ctx) {
            final repo = ctx.read<CatalogRepository>();
            return ProjectDetailsCubit(
              GetProjectDetail(repo),
              GetUnits(repo),
              state.pathParameters['id']!,
            );
          },
          child: const ProjectDetailsScreen(),
        ),
      ),
      GoRoute(
        path: '/projects/:id/units',
        builder: (context, state) => BlocProvider(
          create: (ctx) => UnitsCubit(
            GetUnits(ctx.read<CatalogRepository>()),
            projectId: state.pathParameters['id']!,
          ),
          child: const UnitsScreen(),
        ),
      ),
      GoRoute(
        path: '/units/:id',
        builder: (context, state) => BlocProvider(
          create: (ctx) => UnitDetailsCubit(
            GetUnit(ctx.read<CatalogRepository>()),
            state.pathParameters['id']!,
          ),
          child: const UnitDetailsScreen(),
        ),
      ),
      GoRoute(
        path: '/chat',
        builder: (context, _) => BlocProvider(
          create: (ctx) {
            final repo = ctx.read<ChatRepository>();
            return ChatBloc(
              startSession: StartChatSession(repo),
              sendMessage: SendChatMessage(repo),
              localeCode: ctx.read<LocaleCubit>().state.languageCode,
            )..add(const ChatStarted());
          },
          child: const ChatScreen(),
        ),
      ),
      GoRoute(
        path: '/gallery',
        builder: (_, _) => const ComponentGalleryScreen(),
      ),
    ],
  );
}

/// Wraps a documents detail screen with the two cubits it needs: the list of
/// customer-visible documents for an owner, and the just-in-time signed
/// download handler. Both are built from the shared [DocumentsRepository].
Widget _documentsProviders({
  required DocumentOwnerType ownerType,
  required String ownerId,
  required Widget child,
}) {
  return MultiBlocProvider(
    providers: [
      BlocProvider(
        create: (ctx) => DocumentsListCubit(
          GetCustomerDocuments(ctx.read<DocumentsRepository>()),
          ownerType: ownerType,
          ownerId: ownerId,
        )..load(),
      ),
      BlocProvider(
        create: (ctx) => DocumentDownloadCubit(
          GetDocumentDownloadLink(ctx.read<DocumentsRepository>()),
        ),
      ),
    ],
    child: child,
  );
}

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
