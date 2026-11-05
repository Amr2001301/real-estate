// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get customerAppTitle => 'Devora';

  @override
  String get staffAppTitle => 'Devora Staff';

  @override
  String get languageName => 'English';

  @override
  String get actionContinue => 'Continue';

  @override
  String get actionRetry => 'Retry';

  @override
  String get actionCancel => 'Cancel';

  @override
  String get actionSave => 'Save';

  @override
  String get actionClose => 'Close';

  @override
  String get actionLogin => 'Log in';

  @override
  String get actionLogout => 'Log out';

  @override
  String get logoutConfirmMessage => 'Are you sure you want to log out?';

  @override
  String get actionRegister => 'Register';

  @override
  String get actionSearch => 'Search';

  @override
  String get actionViewMore => 'View more';

  @override
  String get stateLoading => 'Loading…';

  @override
  String get stateEmptyTitle => 'Nothing here yet';

  @override
  String get stateEmptyMessage => 'There is no content to show right now.';

  @override
  String get stateErrorTitle => 'Something went wrong';

  @override
  String get stateErrorMessage => 'We couldn\'t load this. Please try again.';

  @override
  String get stateNoConnection => 'No internet connection';

  @override
  String get errorNoConnection =>
      'No internet connection. Please check your network and try again.';

  @override
  String get errorTimeout => 'The connection timed out. Please try again.';

  @override
  String get errorSessionExpired =>
      'Your session has expired. Please sign in again.';

  @override
  String get errorPermissionDenied =>
      'You don\'t have permission to perform this action.';

  @override
  String get errorNotFound => 'We couldn\'t find what you were looking for.';

  @override
  String get errorValidation =>
      'Please review the information you entered and try again.';

  @override
  String get errorServer =>
      'Something went wrong on our side. Please try again shortly.';

  @override
  String get errorMaintenance =>
      'The service is temporarily under maintenance. Please try again soon.';

  @override
  String get errorUnknown => 'An unexpected error occurred. Please try again.';

  @override
  String get offlineMessage => 'No internet connection';

  @override
  String get settingsTitle => 'Settings';

  @override
  String get settingsTheme => 'Appearance';

  @override
  String get settingsThemeSystem => 'System';

  @override
  String get settingsThemeLight => 'Light';

  @override
  String get settingsThemeDark => 'Dark';

  @override
  String get settingsLanguage => 'Language';

  @override
  String get galleryTitle => 'Component Gallery';

  @override
  String get gallerySectionButtons => 'Buttons';

  @override
  String get gallerySectionInputs => 'Inputs';

  @override
  String get gallerySectionCards => 'Cards';

  @override
  String get gallerySectionBadges => 'Status badges';

  @override
  String get gallerySectionStates => 'States';

  @override
  String get gallerySectionSkeleton => 'Skeleton loading';

  @override
  String get galleryToggleTheme => 'Toggle theme';

  @override
  String get galleryToggleLanguage => 'Toggle language';

  @override
  String get gallerySampleCardTitle => 'Marina Heights';

  @override
  String get gallerySampleCardSubtitle => 'New Cairo · Apartment';

  @override
  String get gallerySampleCardPrice => '5,800,000 EGP';

  @override
  String get galleryInputLabel => 'Full name';

  @override
  String get galleryInputHint => 'Enter your full name';

  @override
  String get galleryInputError => 'This field is required';

  @override
  String get homeHeroEyebrow => 'Curated properties';

  @override
  String get homeHeroTitle => 'Find your next home';

  @override
  String get homeHeroSubtitle => 'Premium projects and units, curated for you.';

  @override
  String get homeSearchHint => 'Search projects, cities…';

  @override
  String get homeFeaturedUnits => 'Selected units';

  @override
  String get homeCtaTitle => 'Start your property journey with confidence';

  @override
  String get homeCtaSubtitle =>
      'Our advisors are here to guide you every step of the way.';

  @override
  String get homeCtaAction => 'Talk to an advisor';

  @override
  String get homeCtaSecondary => 'Browse units';

  @override
  String get homeCtaEyebrow => 'Get started';

  @override
  String get homeSearchAction => 'Search';

  @override
  String get homeFilterAction => 'Filters';

  @override
  String get homeFilterTypeLabel => 'Property type';

  @override
  String get homeFilterAllUnits => 'All units & filters';

  @override
  String get homeTypeResidential => 'Residential';

  @override
  String get homeTypeOffice => 'Office';

  @override
  String get homeTypeCommercial => 'Commercial';

  @override
  String get homeTypeMedical => 'Medical';

  @override
  String get homeTypeHotel => 'Hospitality';

  @override
  String get homeFilterHelper => 'Choose a property type for a quick search.';

  @override
  String get homeFilterViewResults => 'View results';

  @override
  String get homeFilterClearSelection => 'Clear selection';

  @override
  String get homeFeaturedProjects => 'Featured projects';

  @override
  String get homeExploreProjects => 'Explore projects';

  @override
  String get homeGuestGreeting => 'Welcome';

  @override
  String get homeGuestSubtitle => 'Discover the best projects and units';

  @override
  String homeGreeting(String name) {
    return 'Hi, $name';
  }

  @override
  String get homeOwnerRole => 'Unit owner';

  @override
  String get homeAfterSales => 'After-sales services';

  @override
  String get homeNextInstallment => 'Next installment';

  @override
  String homeInstallmentsRemaining(int count) {
    return '$count installments remaining';
  }

  @override
  String get homeNoDuePayments => 'No payments due';

  @override
  String get homeNoDuePaymentsHint => 'You\'re all caught up.';

  @override
  String get homeViewInstallments => 'View installments';

  @override
  String get homeRecentActivity => 'Recent updates';

  @override
  String get homePaymentDueSoon => 'Due soon';

  @override
  String get homePaymentUpcoming => 'Upcoming';

  @override
  String get homeMonthlyInstallment => 'Monthly';

  @override
  String get homeViewContractPdf => 'View contract PDF';

  @override
  String get homeOwnershipSummary => 'Ownership summary';

  @override
  String get homeOwnerEmptyTitle => 'Start your property journey';

  @override
  String get homeOwnerEmptyMessage =>
      'Browse projects and units, save what matters, or request a visit.';

  @override
  String get homeContactUs => 'Contact us';

  @override
  String get homeAskAssistant => 'Ask the assistant';

  @override
  String get viewAll => 'View all';

  @override
  String get viewDetails => 'View details';

  @override
  String get projectsTitle => 'Projects';

  @override
  String get projectsSubtitle => 'Browse projects and available units';

  @override
  String get projectsSearchHint => 'Search projects';

  @override
  String get unitsSearchHint => 'Search by code, type, project…';

  @override
  String get unitsTitle => 'Units';

  @override
  String get filtersTitle => 'Filters';

  @override
  String get filterCity => 'City';

  @override
  String get filterType => 'Type';

  @override
  String get filterStatus => 'Status';

  @override
  String get filterPriceRange => 'Price range';

  @override
  String get filterAreaRange => 'Area range';

  @override
  String get filterRooms => 'Bedrooms';

  @override
  String get filterAny => 'Any';

  @override
  String get filterFeaturedOnly => 'Featured only';

  @override
  String get minLabel => 'Min';

  @override
  String get maxLabel => 'Max';

  @override
  String get filterAreaUnit => 'm²';

  @override
  String get sortTitle => 'Sort by';

  @override
  String get sortNewest => 'Newest';

  @override
  String get sortOldest => 'Oldest';

  @override
  String get sortPriceAsc => 'Price: low to high';

  @override
  String get sortPriceDesc => 'Price: high to low';

  @override
  String get sortAreaAsc => 'Area: small to large';

  @override
  String get sortAreaDesc => 'Area: large to small';

  @override
  String get applyFilters => 'Apply';

  @override
  String get clearFilters => 'Clear';

  @override
  String resultsCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count results',
      one: '1 result',
      zero: 'No results',
    );
    return '$_temp0';
  }

  @override
  String get noProjectsTitle => 'No projects found';

  @override
  String get noProjectsMessage => 'Try adjusting your search or filters.';

  @override
  String get noUnitsTitle => 'No units found';

  @override
  String get noUnitsMessage => 'Try adjusting your filters.';

  @override
  String get aboutProject => 'About';

  @override
  String get projectAmenities => 'Amenities & services';

  @override
  String get projectLocation => 'Location';

  @override
  String get openInMaps => 'Open in Maps';

  @override
  String get projectAvailableUnits => 'Available units';

  @override
  String availableUnitsCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count available units',
      one: '1 available unit',
      zero: 'No available units',
    );
    return '$_temp0';
  }

  @override
  String get viewUnits => 'View units';

  @override
  String get projectOverview => 'Overview';

  @override
  String get projectAbout => 'About the project';

  @override
  String get projectUnits => 'Project units';

  @override
  String get labelAvailableUnits => 'Available units';

  @override
  String get labelCity => 'City';

  @override
  String get labelAmenities => 'Amenities';

  @override
  String get browseUnits => 'Browse units';

  @override
  String get talkToAdvisor => 'Talk to an advisor';

  @override
  String get projectInterestedTitle => 'Interested in this project?';

  @override
  String unitCode(String code) {
    return 'Unit $code';
  }

  @override
  String get unitOverview => 'Overview';

  @override
  String get labelArea => 'Area';

  @override
  String get labelBedrooms => 'Bedrooms';

  @override
  String get labelBathrooms => 'Bathrooms';

  @override
  String get labelFloor => 'Floor';

  @override
  String get labelType => 'Type';

  @override
  String get labelPrice => 'Price';

  @override
  String get labelProject => 'Project';

  @override
  String get unitAbout => 'About this unit';

  @override
  String get unitAboutGeneric =>
      'A carefully selected unit within a distinguished project — balancing comfort, location, and value.';

  @override
  String get unitWithinProject => 'Part of the project';

  @override
  String get viewProject => 'View project';

  @override
  String get viewProjectUnits => 'View units';

  @override
  String get unitPlanTitle => 'Unit plan';

  @override
  String get unitPlanOnRequest =>
      'The detailed floor plan is available on request — contact us to receive it.';

  @override
  String get unitPlanRequest => 'Request the plan';

  @override
  String get unitOtherInProject => 'Other units in this project';

  @override
  String get requestInfo => 'Request info';

  @override
  String get infoRequestTitle => 'Request Information';

  @override
  String get infoRequestMessage => 'Message';

  @override
  String get infoRequestMessageHint =>
      'What would you like to know about this project?';

  @override
  String get infoRequestMessageRequired => 'Please enter a message';

  @override
  String get infoRequestSubmit => 'Send Request';

  @override
  String get infoRequestSuccess =>
      'Your request has been sent. We\'ll be in touch soon.';

  @override
  String areaValue(String value) {
    return '$value m²';
  }

  @override
  String get statusAvailable => 'Available';

  @override
  String get statusReserved => 'Reserved';

  @override
  String get statusSold => 'Sold';

  @override
  String get requestVisit => 'Request a visit';

  @override
  String get requestVisitPrompt =>
      'Sign in to request a visit, or contact us directly.';

  @override
  String get contactTitle => 'Get in touch';

  @override
  String get contactCall => 'Call';

  @override
  String get contactWhatsapp => 'WhatsApp';

  @override
  String get compareTitle => 'Compare units';

  @override
  String get compareAdd => 'Add to compare';

  @override
  String get compareRemove => 'Remove';

  @override
  String get compareAdded => 'Added to compare';

  @override
  String compareFull(int max) {
    return 'You can compare up to $max units';
  }

  @override
  String get compareEmptyTitle => 'Nothing to compare yet';

  @override
  String get compareEmptyMessage =>
      'Add units from their details to compare them side by side.';

  @override
  String compareCount(int count) {
    return '$count selected';
  }

  @override
  String get compareSelectUnits => 'Choose units to compare';

  @override
  String compareSelectedCount(int count, int max) {
    return '$count/$max units';
  }

  @override
  String get compareNow => 'Compare now';

  @override
  String get compareNeedMore => 'Select another unit to compare';

  @override
  String get compareAddAnother => 'Add another unit to start comparing';

  @override
  String get compareAddUnit => 'Add a unit';

  @override
  String get compareStepSelect => 'Select';

  @override
  String get compareStepLimit => 'Up to 4';

  @override
  String get compareStepCompare => 'Compare';

  @override
  String get compareBrowseUnits => 'Browse units';

  @override
  String get compareSelectionHint => 'Select 2 to 4 units to compare';

  @override
  String get chatTitle => 'Assistant';

  @override
  String get chatInputHint => 'Type a message…';

  @override
  String get chatRestart => 'New chat';

  @override
  String get chatUnavailable => 'The assistant is unavailable right now.';

  @override
  String get authWelcomeBack => 'Welcome back';

  @override
  String get authCreateAccount => 'Create account';

  @override
  String get authLoginWithPhone => 'Use phone instead';

  @override
  String get authEyebrow => 'Devora Real Estate';

  @override
  String get authLoginSubtitle => 'Sign in to continue your property journey.';

  @override
  String get authRegisterSubtitle =>
      'Create your account to unlock every feature.';

  @override
  String get authPhoneSubtitle =>
      'Enter your phone and we\'ll send a verification code.';

  @override
  String get authLoginWithEmail => 'Use email instead';

  @override
  String get authNoAccountCta => 'Don\'t have an account? Register';

  @override
  String get authHaveAccountCta => 'Already have an account? Log in';

  @override
  String get authSendCode => 'Send code';

  @override
  String get authVerifyCode => 'Verify';

  @override
  String get authResendCode => 'Resend code';

  @override
  String authOtpSentTo(String phone) {
    return 'We sent a code to $phone';
  }

  @override
  String get authAcceptTerms => 'I accept the terms and conditions';

  @override
  String get authForgotPassword => 'Forgot password?';

  @override
  String get authForgotPasswordTitle => 'Reset password';

  @override
  String get authForgotPasswordSubtitle =>
      'Enter your email address and we\'ll send you a reset link.';

  @override
  String get authForgotPasswordSent =>
      'If that email is registered, a reset link has been sent.';

  @override
  String get authForgotPasswordSend => 'Send reset link';

  @override
  String get authResetPasswordTitle => 'New password';

  @override
  String get authResetPasswordSubtitle =>
      'Enter the token from your email and choose a new password.';

  @override
  String get authResetToken => 'Reset token';

  @override
  String get authNewPassword => 'New password';

  @override
  String get authResetSuccess => 'Password updated. Please log in.';

  @override
  String get authResetSubmit => 'Set new password';

  @override
  String get fieldEmail => 'Email';

  @override
  String get fieldPassword => 'Password';

  @override
  String get fieldFullName => 'Full name';

  @override
  String get fieldPhone => 'Phone number';

  @override
  String get fieldOtpCode => 'Verification code';

  @override
  String get fieldCompanyCode => 'Company Code';

  @override
  String get validationRequired => 'This field is required';

  @override
  String get validationEmail => 'Enter a valid email';

  @override
  String get validationCompanyCode => 'Enter the company code';

  @override
  String get validationPhone => 'Enter a valid phone number';

  @override
  String get validationPasswordShort =>
      'Password must be at least 8 characters';

  @override
  String get validationCodeShort => 'Enter the code you received';

  @override
  String get validationAcceptTerms => 'Please accept the terms to continue';

  @override
  String get accountGuestTitle => 'You\'re browsing as a guest';

  @override
  String get accountGuestMessage =>
      'Sign in to save favorites, request visits, and track your requests.';

  @override
  String get accountProfile => 'Profile';

  @override
  String get accountFavorites => 'Favorites';

  @override
  String get accountMyRequests => 'My requests';

  @override
  String get accountNotifications => 'Notifications';

  @override
  String get profileTitle => 'Profile';

  @override
  String get profileAccountSettings => 'Account & Performance';

  @override
  String get staffSectionTools => 'Advisor Tools';

  @override
  String get staffMyClientsDesc => 'Manage clients and active opportunities';

  @override
  String get staffMyLeadsDesc => 'Track sales stages and communication';

  @override
  String get staffMyTargetsDesc => 'Sales and unit targets';

  @override
  String get staffMyBonusDesc => 'Paid and pending amounts';

  @override
  String get staffMyVisitsDesc => 'Visits schedule and follow-ups';

  @override
  String get staffSectionOperations => 'Sales Management';

  @override
  String get staffMyReservationsDesc => 'Track unit bookings';

  @override
  String get staffMyContractsDesc => 'Manage contracts and documents';

  @override
  String get staffMyInventoryDesc => 'Browse available units and projects';

  @override
  String get staffMyCalculatorDesc => 'Installment plan calculations';

  @override
  String get staffMyInquiriesDesc => 'Customer requests and inquiries';

  @override
  String get staffShortcutPerformance => 'My Performance';

  @override
  String get staffShortcutVisits => 'My Visits';

  @override
  String get staffShortcutClients => 'My Clients';

  @override
  String get staffShortcutCommissions => 'My Commissions';

  @override
  String get profileEdit => 'Edit profile';

  @override
  String get profileSaved => 'Profile updated';

  @override
  String get phoneChangeTitle => 'Confirm your new number';

  @override
  String get phoneChangeConfirm => 'Confirm';

  @override
  String get phoneChanged => 'Phone number changed';

  @override
  String get profileDeleteAccount => 'Delete my account';

  @override
  String get profileDeleteAccountTitle => 'Delete your account?';

  @override
  String get profileDeleteAccountBody =>
      'Your name, phone, e-mail and photo are removed and you are signed out. Your contract and payment records stay with the company. This cannot be undone.';

  @override
  String get profileDeleteAccountConfirm => 'Delete';

  @override
  String get fieldLanguage => 'Language';

  @override
  String get settingsSecurity => 'Security & Password';

  @override
  String get settingsSupport => 'Support & Help';

  @override
  String get bonusViewAll => 'View Commissions';

  @override
  String get favoritesEmptyTitle => 'No favorites yet';

  @override
  String get favoritesEmptyMessage =>
      'Tap the heart on a project or unit to save it here.';

  @override
  String get favoriteAdded => 'Added to favorites';

  @override
  String get favoriteRemoved => 'Removed from favorites';

  @override
  String get favoriteLoginPrompt => 'Sign in to save favorites.';

  @override
  String get myRequestsTitle => 'My requests';

  @override
  String get visitRequestTitle => 'Request a visit';

  @override
  String get fieldPreferredDate => 'Preferred date';

  @override
  String get fieldNotes => 'Notes (optional)';

  @override
  String get selectDate => 'Select date';

  @override
  String get visitSubmit => 'Submit request';

  @override
  String get visitSubmitted => 'Visit request sent';

  @override
  String get myRequestsEmptyTitle => 'No requests yet';

  @override
  String get myRequestsEmptyMessage => 'Your visit requests will appear here.';

  @override
  String visitOn(String date) {
    return 'Preferred: $date';
  }

  @override
  String get visitStatusPending => 'Pending';

  @override
  String get visitStatusApproved => 'Approved';

  @override
  String get visitStatusScheduled => 'Scheduled';

  @override
  String get visitStatusCompleted => 'Completed';

  @override
  String get visitStatusCancelled => 'Cancelled';

  @override
  String get notificationsEmptyTitle => 'No notifications';

  @override
  String get notificationsEmptyMessage => 'You\'re all caught up.';

  @override
  String get markAllRead => 'Mark all read';

  @override
  String get notificationDefaultTitle => 'Notification';

  @override
  String get navHome => 'Home';

  @override
  String get navExplore => 'Explore';

  @override
  String get navFavorites => 'Favorites';

  @override
  String get navAccount => 'Account';

  @override
  String get navDashboard => 'Dashboard';

  @override
  String get navLeads => 'Leads';

  @override
  String get navMore => 'More';

  @override
  String get navFinance => 'Finance';

  @override
  String get financeHubSubtitle =>
      'Your installments, payments, and contracts in one place.';

  @override
  String get financeInstallmentsDesc =>
      'Schedule, due dates, and payment proofs';

  @override
  String get financeDepositsDesc => 'Booking and down-payment receipts';

  @override
  String get financeContractsDesc => 'Signed contracts and documents';

  @override
  String get dashboardWelcome => 'Welcome back';

  @override
  String get dashboardQuickActions => 'Quick actions';

  @override
  String get dashboardOverview => 'Overview';

  @override
  String get accountSectionServices => 'Customer services';

  @override
  String get accountRoleCustomer => 'Customer';

  @override
  String get navCompare => 'Compare';

  @override
  String get featuredBadge => 'Featured';

  @override
  String get compareAddUnits => 'Add units to compare';

  @override
  String get accountSectionSettings => 'Settings';

  @override
  String get moreSignInTitle => 'Sign in to your account';

  @override
  String get moreSignInSubtitle =>
      'Continue your journey and keep your favorites & comparisons.';

  @override
  String get moreSectionGeneral => 'General';

  @override
  String get authWelcomeTitle => 'Welcome';

  @override
  String get authWelcomeSubtitle => 'Sign in to continue';

  @override
  String get placeholderScreen => 'Coming soon';

  @override
  String get placeholderScreenBody => 'This screen is part of a later phase.';

  @override
  String get accountMyProperty => 'My property';

  @override
  String get accountContracts => 'Contracts';

  @override
  String get accountDeposits => 'Payments';

  @override
  String get accountMaintenance => 'Maintenance';

  @override
  String get myPropertyEmptyTitle => 'No property yet';

  @override
  String get myPropertyEmptyMessage =>
      'Once you reserve or own a unit, it will appear here.';

  @override
  String get myPropertyStatusOwned => 'Owned';

  @override
  String get myPropertyStatusReserved => 'Reserved';

  @override
  String get myPropertyContractNumber => 'Contract no.';

  @override
  String get myPropertyReservationNumber => 'Reservation no.';

  @override
  String get myPropertySignedDate => 'Signed on';

  @override
  String get myPropertyHandedOverDate => 'Handed over on';

  @override
  String get myPropertyNotHandedOver =>
      'Not handed over yet — maintenance requests open at handover';

  @override
  String get myPropertyInstallmentPlan => 'Installment plan';

  @override
  String myPropertyInstallmentSummary(String amount, int months) {
    return '$amount / month · $months months';
  }

  @override
  String get myPropertyRequestMaintenance => 'Request maintenance';

  @override
  String myPropertyContactMessage(String project, String unit) {
    return 'Hello, I have a question about my unit $unit in $project.';
  }

  @override
  String get contractsSearchHint => 'Search by name, phone or number';

  @override
  String get contractsEmptyTitle => 'No contracts';

  @override
  String get contractsEmptyMessage =>
      'Your contracts will appear here once available.';

  @override
  String get contractStatusSigned => 'Signed';

  @override
  String get contractStatusDraft => 'Draft';

  @override
  String get contractSignedDate => 'Date signed:';

  @override
  String get contractsDocumentsTitle => 'Documents';

  @override
  String get contractCustomer => 'Customer';

  @override
  String get contractUnit => 'Unit';

  @override
  String get contractTotalAmount => 'Total amount';

  @override
  String get contractDownPayment => 'Down payment';

  @override
  String get contractSalesRep => 'Sales rep';

  @override
  String get contractMonthlyPayment => 'Monthly payment';

  @override
  String get contractInstallmentLabel => 'Installment plan';

  @override
  String get documentsEmptyTitle => 'No documents';

  @override
  String get documentsEmptyMessage => 'There are no documents to show yet.';

  @override
  String get depositsEmptyTitle => 'No payments';

  @override
  String get depositsEmptyMessage =>
      'Your payments will appear here once recorded.';

  @override
  String get depositVerified => 'Verified';

  @override
  String get depositPending => 'Pending verification';

  @override
  String get depositDetailTitle => 'Payment details';

  @override
  String get depositPaidOn => 'Paid on';

  @override
  String get depositReceiptsTitle => 'Receipts';

  @override
  String get depositNoReceipts =>
      'No receipt has been attached to this payment yet.';

  @override
  String get depositTypeBooking => 'Booking amount';

  @override
  String get depositTypeDownPayment => 'Down payment';

  @override
  String get depositTypeInstallment => 'Installment';

  @override
  String get depositTypeFinal => 'Final payment';

  @override
  String get depositTypePayment => 'Payment';

  @override
  String get navDeposits => 'Deposits';

  @override
  String get recordDeposit => 'Record Payment';

  @override
  String get depositAmount => 'Amount';

  @override
  String get depositPaymentDate => 'Payment date';

  @override
  String get depositSelectInstallment => 'Select installment';

  @override
  String get depositContractRef => 'Contract';

  @override
  String get depositRecordSuccess => 'Payment recorded successfully';

  @override
  String get installmentsTitle => 'Installments';

  @override
  String get installmentsEmptyTitle => 'No installments yet';

  @override
  String get installmentsEmptyMessage =>
      'Your installment schedule will appear here once a plan is active.';

  @override
  String get installmentStatusPending => 'Pending';

  @override
  String get installmentStatusPaid => 'Paid';

  @override
  String get installmentStatusOverdue => 'Overdue';

  @override
  String get installmentStatusCancelled => 'Cancelled (rescheduled)';

  @override
  String installmentDueOn(String date) {
    return 'Due on $date';
  }

  @override
  String get installmentAmount => 'Amount';

  @override
  String get paymentProofTitle => 'Payment proof';

  @override
  String get paymentProofSubmit => 'Submit proof';

  @override
  String get paymentProofResubmit => 'Resubmit proof';

  @override
  String get paymentProofChooseFile => 'Choose file';

  @override
  String get paymentProofMethodLabel => 'Payment method';

  @override
  String get paymentProofMethodBankTransfer => 'Bank transfer';

  @override
  String get paymentProofMethodCashDeposit => 'Cash deposit';

  @override
  String get paymentProofMethodManualCard => 'Manual card';

  @override
  String get paymentProofMethodOther => 'Other';

  @override
  String get paymentProofNoteHint => 'Add a note (optional)';

  @override
  String get paymentProofStatusPendingReview => 'Pending review';

  @override
  String get paymentProofStatusApproved => 'Approved';

  @override
  String get paymentProofStatusRejected => 'Rejected';

  @override
  String paymentProofRejectionReason(String reason) {
    return 'Reason: $reason';
  }

  @override
  String get paymentProofSubmittedSuccess => 'Proof submitted successfully';

  @override
  String get paymentProofUploadFailed => 'Upload failed. Please try again.';

  @override
  String get paymentProofFileTooLarge => 'File is too large (max 25 MB)';

  @override
  String get paymentProofUnsupportedType =>
      'Unsupported file type. PDF, JPEG, PNG, or WebP only.';

  @override
  String get paymentProofNoFile => 'Please choose a file first.';

  @override
  String get maintenanceEmptyTitle => 'No maintenance requests';

  @override
  String get maintenanceEmptyMessage =>
      'File a request and we\'ll take care of it.';

  @override
  String get maintenanceNewRequest => 'New request';

  @override
  String get maintenanceDetailTitle => 'Request details';

  @override
  String get maintenanceUnit => 'Unit';

  @override
  String get maintenanceAttachmentsTitle => 'Photos & documents';

  @override
  String get maintenanceNoAttachments =>
      'No photos or documents have been attached yet.';

  @override
  String get maintenanceUnitLabel => 'Which unit?';

  @override
  String get maintenanceUnitRequired => 'Please select a unit.';

  @override
  String get maintenanceNoUnitsTitle => 'No units';

  @override
  String get maintenanceNoUnitsMessage =>
      'You don\'t have any units to file a request against yet.';

  @override
  String get maintenanceCategoryLabel => 'What needs attention?';

  @override
  String get maintenanceCategoryRequired =>
      'Please select at least one category.';

  @override
  String get maintenanceDescriptionLabel => 'Description';

  @override
  String get maintenanceDescriptionHint => 'Describe the issue in a few words';

  @override
  String get maintenanceDescriptionRequired =>
      'Please add a short description (at least 5 characters).';

  @override
  String get maintenanceSubmit => 'Submit request';

  @override
  String get maintenanceSubmitted => 'Your request has been submitted.';

  @override
  String get maintenanceNoCategoriesTitle => 'No categories';

  @override
  String get maintenanceNoCategoriesMessage =>
      'Maintenance categories aren\'t available right now. Please try again later.';

  @override
  String get maintenanceStatusOpen => 'Open';

  @override
  String get maintenanceStatusAssigned => 'Assigned';

  @override
  String get maintenanceStatusInProgress => 'In progress';

  @override
  String get maintenanceStatusResolved => 'Resolved';

  @override
  String get maintenanceStatusClosed => 'Closed';

  @override
  String get maintenancePriorityLow => 'Low';

  @override
  String get maintenancePriorityMedium => 'Medium';

  @override
  String get maintenancePriorityHigh => 'High';

  @override
  String get maintenancePriorityUrgent => 'Urgent';

  @override
  String maintenancePriorityValue(String value) {
    return '$value priority';
  }

  @override
  String get maintenancePhotosLabel => 'Photos (optional)';

  @override
  String maintenancePhotosHint(int count, int mb) {
    return 'Up to $count images, $mb MB each.';
  }

  @override
  String get maintenanceAddPhoto => 'Add photo';

  @override
  String get maintenanceFromCamera => 'Take a photo';

  @override
  String get maintenanceFromGallery => 'Choose from gallery';

  @override
  String get maintenancePhotoUploaded => 'Uploaded';

  @override
  String get maintenancePhotoPermissionDenied =>
      'Permission is needed to access your camera or photos. You can enable it in Settings.';

  @override
  String maintenancePhotoTooMany(int count) {
    return 'You can attach up to $count photos.';
  }

  @override
  String maintenancePhotoTooLarge(int mb) {
    return 'Each photo must be $mb MB or smaller.';
  }

  @override
  String get maintenancePhotoUnsupported =>
      'Only JPG, PNG, or WebP images are supported.';

  @override
  String get maintenancePhotoPickFailed =>
      'Couldn\'t add that photo. Please try again.';

  @override
  String maintenanceUploadPartial(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count photos failed to upload.',
      one: '1 photo failed to upload.',
    );
    return '$_temp0 Your request was still created.';
  }

  @override
  String maintenanceRetryFailed(int count) {
    return 'Retry ($count)';
  }

  @override
  String get maintenanceFinishAnyway => 'Done';

  @override
  String get navClients => 'Clients';

  @override
  String get navProjects => 'Projects';

  @override
  String get navProfile => 'Profile';

  @override
  String get navUnits => 'Units';

  @override
  String get staffLoginSubtitle => 'Sign in to your staff account';

  @override
  String get errorTenantMismatch =>
      'Your session does not match this company. Please sign in again.';

  @override
  String get roleSales => 'Sales Advisor';

  @override
  String get roleSalesManager => 'Sales Manager';

  @override
  String get roleBroker => 'Broker';

  @override
  String get roleAdmin => 'Administrator';

  @override
  String get roleMaintenance => 'Maintenance Supervisor';

  @override
  String get roleStaff => 'Staff';

  @override
  String get brokerComingSoonTitle => 'Broker workspace coming soon';

  @override
  String get brokerComingSoonMessage =>
      'Your broker tools are on the way. You\'ll be able to manage submissions and commissions here soon.';

  @override
  String get dashboardLeads => 'Leads';

  @override
  String get dashboardTodayVisits => 'Today\'s visits';

  @override
  String get dashboardScheduledVisits => 'Scheduled visits';

  @override
  String get dashboardReservations => 'Reservations';

  @override
  String get dashboardPipeline => 'Pipeline';

  @override
  String get leadStageNew => 'New';

  @override
  String get leadStageInterested => 'Interested';

  @override
  String get leadStageVisit => 'Visit';

  @override
  String get leadStageNegotiation => 'Negotiation';

  @override
  String get leadStageWon => 'Won';

  @override
  String get leadStageLost => 'Lost';

  @override
  String get leadsSearchHint => 'Search by name or phone';

  @override
  String get leadsFilterAll => 'All';

  @override
  String get leadsFilterSource => 'Source';

  @override
  String get leadsFilterDateFrom => 'From date';

  @override
  String get leadsFilterDateTo => 'To date';

  @override
  String get leadsFilterApply => 'Apply filters';

  @override
  String get leadsFilterClear => 'Clear all';

  @override
  String get leadsActiveFilters => 'Active filters';

  @override
  String get leadsFilterSheet => 'Filter leads';

  @override
  String get leadsMine => 'My leads';

  @override
  String get leadsEmptyTitle => 'No leads';

  @override
  String get leadsEmptyMessage => 'Leads assigned to you will appear here.';

  @override
  String get leadInterest => 'Interested in';

  @override
  String get leadAssignedTo => 'Assigned to';

  @override
  String get leadChangeStage => 'Change stage';

  @override
  String get leadAddNote => 'Add a note';

  @override
  String get leadNoteHint => 'Write a note…';

  @override
  String get leadTimeline => 'Timeline';

  @override
  String get leadTimelineEmpty => 'No activity yet.';

  @override
  String get leadActivityCall => 'Call logged';

  @override
  String get leadActivityEmail => 'Email logged';

  @override
  String get leadActivityStatusChange => 'Stage changed';

  @override
  String get leadActivityVisit => 'Visit';

  @override
  String get leadActivityNote => 'Note added';

  @override
  String get leadActivityReservation => 'Reservation';

  @override
  String get leadActivityCreated => 'Lead created';

  @override
  String get leadNew => 'New lead';

  @override
  String get leadCreate => 'Create lead';

  @override
  String get leadCreated => 'Lead created.';

  @override
  String get leadFullName => 'Full name';

  @override
  String get leadFullNameRequired => 'Please enter a name.';

  @override
  String get leadPhone => 'Phone';

  @override
  String get leadEmail => 'Email';

  @override
  String get leadNotes => 'Notes';

  @override
  String get clientsSubtitle =>
      'Track your clients and their current opportunities';

  @override
  String get leadsSubtitle =>
      'Track sales stages and communicate with your leads';

  @override
  String get clientsSearchHint => 'Search clients';

  @override
  String get clientsEmptyTitle => 'No clients';

  @override
  String get clientsEmptyMessage => 'Clients from your leads will appear here.';

  @override
  String clientsLeadCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count leads',
      one: '1 lead',
    );
    return '$_temp0';
  }

  @override
  String salesOpportunityCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count opportunities',
      one: '1 opportunity',
    );
    return '$_temp0';
  }

  @override
  String get callClient => 'Call client';

  @override
  String get clientLeads => 'Leads';

  @override
  String get projectsEmptyTitle => 'No projects';

  @override
  String get projectsEmptyMessage => 'Projects will appear here.';

  @override
  String get projectStatusPublished => 'Published';

  @override
  String get projectStatusDraft => 'Draft';

  @override
  String get projectStatusArchived => 'Archived';

  @override
  String get projectAvailableLabel => 'Available';

  @override
  String get projectTotalLabel => 'Total';

  @override
  String get projectSoldLabel => 'Sold';

  @override
  String get projectStartingFrom => 'From';

  @override
  String get priceOnRequest => 'Price on request';

  @override
  String get projectUnitTypes => 'Types';

  @override
  String get unitsEmptyMessage => 'No units in this project yet.';

  @override
  String get unitType => 'Type';

  @override
  String get unitBedrooms => 'Bedrooms';

  @override
  String get unitArea => 'Area';

  @override
  String get unitPrice => 'Price';

  @override
  String get unitStatusAvailable => 'Available';

  @override
  String get unitStatusReserved => 'Reserved';

  @override
  String get unitStatusSold => 'Sold';

  @override
  String get showMore => 'Show more';

  @override
  String get showLess => 'Show less';

  @override
  String get viewUnit => 'View unit';

  @override
  String get unitFloor => 'Floor';

  @override
  String get unitBathrooms => 'Bathrooms';

  @override
  String get unitDetails => 'Unit details';

  @override
  String get pricePerMeter => 'Price per m²';

  @override
  String get navVisits => 'Visits';

  @override
  String get navReservations => 'Reservations';

  @override
  String get navContracts => 'Contracts';

  @override
  String get visitsToday => 'Today';

  @override
  String get visitsEmptyTitle => 'No visits';

  @override
  String get visitsEmptyMessage => 'Scheduled visits will appear here.';

  @override
  String get visitNew => 'Schedule visit';

  @override
  String get visitCreate => 'Create visit';

  @override
  String get visitCreated => 'Visit scheduled.';

  @override
  String get visitProject => 'Project';

  @override
  String get visitProjectRequired => 'Please select a project.';

  @override
  String get visitSelectProject => 'Select a project';

  @override
  String get visitWhen => 'Date & time';

  @override
  String get visitPickDateTime => 'Pick date & time';

  @override
  String get visitScheduleRequired => 'Please pick a date & time.';

  @override
  String get visitLocation => 'Location';

  @override
  String get visitNotes => 'Notes';

  @override
  String get visitSectionClient => 'Client';

  @override
  String get visitSectionClientSubtitle =>
      'Choose the client type linked to this visit.';

  @override
  String get visitClientTypeLead => 'CRM Lead';

  @override
  String get visitClientTypeRegistered => 'Registered Client';

  @override
  String get visitClientTypeWalkin => 'Walk-in (No Account)';

  @override
  String get visitLeadRequired => 'Please select a lead.';

  @override
  String get visitClientRequired => 'Please select a registered client.';

  @override
  String get visitWalkInNameLabel => 'Client Name';

  @override
  String get visitWalkInNameHint => 'e.g. Ahmed Khaled';

  @override
  String get visitWalkInPhoneLabel => 'Phone Number';

  @override
  String get visitWalkInPhoneHint => 'e.g. 01012345678';

  @override
  String get visitWalkInNameRequired => 'Please enter the client name.';

  @override
  String get visitWalkInPhoneRequired => 'Please enter the phone number.';

  @override
  String get visitClientSearch => 'Search by name or phone...';

  @override
  String get visitClientSelect => '— Select a registered client —';

  @override
  String get visitLeadSearch => 'Search by client name...';

  @override
  String get visitLeadSelect => '— Select a lead —';

  @override
  String get visitSectionProject => 'Project & Unit';

  @override
  String get visitSectionProjectSubtitle =>
      'Select the project to visit. Optionally pick a specific unit.';

  @override
  String get visitSelectUnit => '— No specific unit —';

  @override
  String get visitNoUnit => 'No specific unit';

  @override
  String get visitNoUnits => 'No units available for this project.';

  @override
  String get visitSectionSchedule => 'Visit Schedule';

  @override
  String get visitSectionScheduleSubtitle =>
      'Set the visit date and add any notes.';

  @override
  String get visitUpdateStatus => 'Update status';

  @override
  String get visitActionConfirm => 'Confirm';

  @override
  String get visitActionComplete => 'Complete';

  @override
  String get visitActionCancel => 'Cancel';

  @override
  String get visitActionNoShow => 'No-show';

  @override
  String get visitReasonTitle => 'Add a reason';

  @override
  String get visitReasonHint => 'Optional reason';

  @override
  String get visitStatusConfirmed => 'Confirmed';

  @override
  String get visitStatusNoShow => 'No-show';

  @override
  String get visitStatusRescheduled => 'Rescheduled';

  @override
  String get visitStatusPendingReschedule => 'Reschedule requested';

  @override
  String get appointmentStatusAwaitingCustomer => 'Awaiting your confirmation';

  @override
  String get appointmentStatusConfirmedByCustomer => 'Confirmed by you';

  @override
  String get appointmentStatusPendingRescheduleCustomer =>
      'You requested a reschedule';

  @override
  String get appointmentStatusAwaitingCustomerStaff =>
      'Awaiting customer confirmation';

  @override
  String get appointmentStatusConfirmedByCustomerStaff => 'Customer confirmed';

  @override
  String get appointmentStatusPendingRescheduleStaff =>
      'Customer requested reschedule';

  @override
  String get appointmentActionConfirm => 'Confirm appointment';

  @override
  String get appointmentActionRequestReschedule => 'Request reschedule';

  @override
  String get appointmentRescheduleReasonLabel =>
      'Reason for reschedule (optional)';

  @override
  String get appointmentRescheduleReasonHint =>
      'E.g. I have another commitment at that time.';

  @override
  String get appointmentSendReschedule => 'Send request';

  @override
  String get appointmentConfirmSuccess =>
      'Visit confirmed. We\'ll see you on the agreed date.';

  @override
  String get appointmentRescheduleSuccess =>
      'Your reschedule request was sent.';

  @override
  String get appointmentProposedDateLabel => 'Proposed date';

  @override
  String get preferredTimeLabel => 'Preferred time';

  @override
  String get customerMessageLabel => 'Customer message';

  @override
  String get customerRescheduleReasonLabel => 'Reschedule reason';

  @override
  String get visitReschedule => 'Reschedule';

  @override
  String get visitRescheduleSuccess => 'Visit rescheduled.';

  @override
  String get visitReassign => 'Reassign';

  @override
  String get visitReassignSalesHint => 'Enter staff member ID';

  @override
  String get visitReassignSuccess => 'Visit reassigned.';

  @override
  String get visitSalesFeedback => 'Sales feedback';

  @override
  String get visitFeedbackNotes => 'Feedback notes';

  @override
  String get visitFeedbackRating => 'Rating (1–5)';

  @override
  String get visitFeedbackSubmit => 'Submit feedback';

  @override
  String get visitFeedbackSuccess => 'Feedback submitted.';

  @override
  String get reservationsEmptyTitle => 'No reservations';

  @override
  String get reservationsEmptyMessage => 'Reservations will appear here.';

  @override
  String get reservationNew => 'New reservation';

  @override
  String get reservationCreate => 'Reserve unit';

  @override
  String get reservationCreated => 'Reservation created.';

  @override
  String get reservationUnit => 'Unit';

  @override
  String get reservationUnitRequired => 'Please select a unit.';

  @override
  String get reservationSelectUnit => 'Select a unit';

  @override
  String get reservationPickProjectFirst =>
      'Select a project to see its units.';

  @override
  String get reservationSectionUnit => 'Property unit';

  @override
  String get reservationSectionUnitSubtitle =>
      'Select the unit to reserve. It must be in an available status.';

  @override
  String get reservationSectionClient => 'Client';

  @override
  String get reservationSectionClientSubtitle =>
      'Select a CRM lead to link to this reservation.';

  @override
  String get reservationLeadLabel => 'CRM lead';

  @override
  String get reservationLeadSelect => '— Select a lead —';

  @override
  String get reservationLeadRequired =>
      'A CRM lead is required to create a reservation';

  @override
  String get reservationLeadSearch => 'Search by client name...';

  @override
  String get reservationSectionDetails => 'Reservation details';

  @override
  String get reservationSectionDetailsSubtitle =>
      'Set the reservation validity period and optional notes.';

  @override
  String get reservationSectionPlanSubtitle =>
      'Choose an installment plan for the unit, or set the booking amount manually.';

  @override
  String get reservationExpiryLabel => 'Reservation validity (hours)';

  @override
  String get reservationExpiryHint =>
      'Time the reservation stays pending before auto-expiring';

  @override
  String get reservationExpiry24 => '24 hours — 1 day';

  @override
  String get reservationExpiry48 => '48 hours — 2 days';

  @override
  String get reservationExpiry72 => '72 hours — 3 days (default)';

  @override
  String get reservationExpiry120 => '120 hours — 5 days';

  @override
  String get reservationExpiry168 => '168 hours — 1 week';

  @override
  String get reservationExpiry336 => '336 hours — 2 weeks';

  @override
  String get reservationNotesLabel => 'Notes (optional)';

  @override
  String get reservationSectionPlan => 'Installment plan';

  @override
  String get reservationPlanOptional => '— No plan (optional) —';

  @override
  String get reservationPlanNoUnit =>
      'Select a unit first to see available plans';

  @override
  String get reservationBookingAmountTitle => 'Booking amount method';

  @override
  String get reservationBookingAmountDesc =>
      'Leave it calculated from the plan, or enter a fixed value or a percentage of the unit price.';

  @override
  String get reservationBookingModePlan => 'From installment plan';

  @override
  String get reservationBookingModeFixed => 'Fixed amount';

  @override
  String get reservationBookingModePercent => 'Percentage of unit price';

  @override
  String get reservationBookingFixedLabel => 'Booking amount';

  @override
  String get reservationBookingFixedHint => 'Enter fixed amount';

  @override
  String get reservationBookingPercentLabel => 'Percentage %';

  @override
  String get reservationBookingPercentHint => 'Enter percentage (0.01 – 100)';

  @override
  String get reservationBookingNotesLabel => 'Booking amount notes';

  @override
  String get reservationBookingNotesHint =>
      'Optional internal notes about the booking amount...';

  @override
  String get reservationBooking => 'Booking amount';

  @override
  String get reservationPlan => 'Plan';

  @override
  String get reservationExpiresOn => 'Expires';

  @override
  String get reservationExpiredOn => 'Expired';

  @override
  String get reservationStatusPending => 'Pending';

  @override
  String get reservationStatusApproved => 'Approved';

  @override
  String get reservationStatusRejected => 'Rejected';

  @override
  String get reservationStatusCancelled => 'Cancelled';

  @override
  String get reservationStatusExpired => 'Expired';

  @override
  String get reservationStatusConverted => 'Converted';

  @override
  String get planTemplatesTitle => 'Installment Plans';

  @override
  String get planTemplatesSubtitle => 'Track payment plans and installments';

  @override
  String get planTemplatesSearch => 'Search plans...';

  @override
  String get planTemplatesEmpty => 'No installment plans';

  @override
  String get planTemplatesEmptyDesc =>
      'No plan templates have been created yet';

  @override
  String get planTemplatesOpenCalculator => 'Open Calculator';

  @override
  String planTemplatesMonths(int n) {
    return '$n months';
  }

  @override
  String get calculatorTitle => 'Installment calculator';

  @override
  String get calculatorPlans => 'Plan presets';

  @override
  String get calculatorPrice => 'Unit price';

  @override
  String get calculatorDownPayment => 'Down payment';

  @override
  String get calculatorReservation => 'Reservation amount';

  @override
  String get calculatorMonths => 'Number of months';

  @override
  String get calculatorMonthsShort => 'mo';

  @override
  String get calculatorIncrease => 'Increase %';

  @override
  String get calculatorInvalid =>
      'Please check the values: months ≥ 1, and down payment + reservation must not exceed the price.';

  @override
  String get calculatorCompute => 'Calculate';

  @override
  String get calculatorResult => 'Result';

  @override
  String get calculatorFinanced => 'Financed amount';

  @override
  String get calculatorTotal => 'Total payable';

  @override
  String calculatorMonthlyN(int months) {
    return 'Monthly ($months months)';
  }

  @override
  String get summaryUnavailable => 'Unavailable';

  @override
  String get bonusTitle => 'Bonus & commission';

  @override
  String get bonusEmptyTitle => 'No bonus entries';

  @override
  String get bonusEmptyMessage =>
      'Your bonus and commission entries will appear here.';

  @override
  String get bonusPaid => 'Paid';

  @override
  String get bonusPending => 'Pending';

  @override
  String get bonusStatusPending => 'Pending';

  @override
  String get bonusStatusApproved => 'Approved';

  @override
  String get bonusStatusPaid => 'Paid';

  @override
  String get targetsTitle => 'Targets';

  @override
  String get targetsNone => 'No target set for this period.';

  @override
  String get targetsHistory => 'Target history';

  @override
  String get targetsActivity => 'This period';

  @override
  String get targetsSignedContracts => 'Signed contracts';

  @override
  String get targetAmount => 'Sales amount';

  @override
  String get targetUnits => 'Units sold';

  @override
  String targetsUnitsN(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count units',
      one: '1 unit',
    );
    return '$_temp0';
  }

  @override
  String get teamPerfTitle => 'Team Performance';

  @override
  String get teamTargetsManageTitle => 'Manage Team Targets';

  @override
  String get teamTargetEdit => 'Edit target';

  @override
  String teamTargetFor(String name) {
    return 'Target for $name';
  }

  @override
  String get teamTargetSaved => 'Target saved.';

  @override
  String get teamPerfRealizedValue => 'Realized value';

  @override
  String get teamPerfEmpty => 'No performance data for this period.';

  @override
  String get teamPerfTotalSales => 'Total Sales';

  @override
  String get teamPerfAvgAchievement => 'Avg Achievement';

  @override
  String get teamPerfDetails => 'Team Details';

  @override
  String get teamTargetAdd => 'Add Target';

  @override
  String get teamTargetCount => 'Targets';

  @override
  String get teamTargetTotalUnits => 'Total Units Target';

  @override
  String get teamTargetTotalAmount => 'Total Amount Target';

  @override
  String get teamTargetRegistered => 'Registered Targets';

  @override
  String get teamTargetNoTarget => 'No target';

  @override
  String get teamTargetAchievedValue => 'Achieved Value';

  @override
  String get teamTargetMember => 'Member';

  @override
  String get teamTargetAddNew => 'Add monthly target';

  @override
  String get profilePerformance => 'Performance';

  @override
  String get profileActiveLeads => 'Active leads';

  @override
  String get navCommissions => 'Commissions';

  @override
  String get brokerDashLeads => 'Total leads';

  @override
  String get brokerDashApprovedLeads => 'Approved leads';

  @override
  String get brokerDashApprovedReservations => 'Approved reservations';

  @override
  String get brokerRecentLeads => 'Recent leads';

  @override
  String get brokerRecentReservations => 'Recent reservations';

  @override
  String get brokerCommissionPct => 'Commission';

  @override
  String get brokerProjectsEmptyMessage =>
      'You don\'t have access to any projects yet.';

  @override
  String get brokerLeadsEmptyMessage => 'Leads you submit will appear here.';

  @override
  String get brokerLeadNew => 'Add lead';

  @override
  String get brokerLeadCreated => 'Lead submitted.';

  @override
  String get brokerLeadName => 'Full name';

  @override
  String get brokerLeadPhone => 'Phone';

  @override
  String get brokerLeadEmail => 'Email (optional)';

  @override
  String get brokerLeadNote => 'Note (optional)';

  @override
  String get brokerLeadSubmit => 'Submit lead';

  @override
  String get brokerSelectLead => 'Select a lead';

  @override
  String get brokerLeadStatusPending => 'Pending review';

  @override
  String get brokerLeadStatusApproved => 'Approved';

  @override
  String get brokerLeadStatusRejected => 'Rejected';

  @override
  String get brokerLeadStatusDuplicate => 'Duplicate';

  @override
  String get brokerLeadStatusExpired => 'Expired';

  @override
  String get brokerCommissionsEmptyTitle => 'No commissions';

  @override
  String get brokerCommissionsEmptyMessage =>
      'Your commissions will appear here.';

  @override
  String get paymentReviewTitle => 'Payment Review';

  @override
  String get paymentReviewSubtitle =>
      'Review payment proofs submitted by customers';

  @override
  String get paymentReviewEmptyTitle => 'No payment proofs pending review';

  @override
  String get paymentReviewEmptyMessage =>
      'Customer payment proofs awaiting review will appear here.';

  @override
  String get paymentReviewReadOnly =>
      'Approving or rejecting is available to admins only.';

  @override
  String get paymentMethodLabel => 'Payment method';

  @override
  String get paymentSubmittedDate => 'Submitted date';

  @override
  String get paymentDueDate => 'Due date';

  @override
  String get paymentCustomerNote => 'Customer note';

  @override
  String get paymentReference => 'Reference number';

  @override
  String get paymentProofAttached => 'Proof attached';

  @override
  String get paymentOpenProof => 'Open proof';

  @override
  String get paymentDownloadProof => 'Download proof';

  @override
  String get paymentProofUnavailable => 'Proof unavailable';

  @override
  String get paymentCouldNotOpenProof => 'Couldn\'t open the proof';

  @override
  String get paymentProofExpired => 'The proof link expired — tap again';

  @override
  String get paymentApprove => 'Approve payment';

  @override
  String get paymentReject => 'Reject payment';

  @override
  String get paymentRejectReason => 'Rejection reason';

  @override
  String get paymentReasonRequired => 'A rejection reason is required';

  @override
  String get paymentApproved => 'Payment approved';

  @override
  String get paymentRejected => 'Payment rejected';

  @override
  String get paymentStatusPending => 'Pending review';

  @override
  String get paymentStatusApproved => 'Verified';

  @override
  String get paymentStatusRejected => 'Rejected';

  @override
  String get paymentMethodCash => 'Cash';

  @override
  String get paymentMethodBankTransfer => 'Bank transfer';

  @override
  String get paymentMethodCheque => 'Cheque';

  @override
  String get paymentMethodOther => 'Other';

  @override
  String get homeInstallmentsRemainingLabel => 'Remaining';

  @override
  String get homeLastPaymentLabel => 'Last payment';

  @override
  String homePlanMonthsSuffix(int months) {
    return '/ mo · $months months';
  }

  @override
  String get supervisorMaintenanceTitle => 'Maintenance Requests';

  @override
  String get supervisorDashboardTitle => 'Maintenance Supervisor';

  @override
  String get supervisorDashboardSubtitle =>
      'Track assigned requests and confirm resolution status';

  @override
  String get supervisorRoleBadge => 'Maintenance Supervisor';

  @override
  String maintenanceWelcomeUser(String name) {
    return 'Hello, $name';
  }

  @override
  String get maintenanceWelcomeFallback => 'Welcome';

  @override
  String get maintenanceSupervisorRole => 'Maintenance Supervisor';

  @override
  String get maintenanceAssignedSubtitle =>
      'Your assigned requests and resolution approvals';

  @override
  String get supervisorStatTotal => 'Total';

  @override
  String get supervisorStatAssigned => 'Assigned';

  @override
  String get supervisorStatInProgress => 'In Progress';

  @override
  String get supervisorStatClosed => 'Closed';

  @override
  String get supervisorFilterAll => 'All';

  @override
  String get supervisorFilterActive => 'Active';

  @override
  String get supervisorFilterClosed => 'Closed';

  @override
  String get supervisorSummaryTotalLabel => 'Total Requests';

  @override
  String get supervisorNoDescription => 'No description';

  @override
  String get supervisorViewDetails => 'View Details';

  @override
  String get supervisorDetailTitle => 'Request Details';

  @override
  String get supervisorNoAssignedTitle => 'No assigned requests yet';

  @override
  String get supervisorNoAssignedMessage =>
      'Maintenance requests will appear here once assigned to you by management.';

  @override
  String get supervisorFilterEmptyTitle => 'No requests with this filter';

  @override
  String get supervisorFilterEmptyMessage =>
      'Try selecting a different filter.';

  @override
  String get supervisorDetailCustomerLabel => 'Customer';

  @override
  String get supervisorDetailPhoneLabel => 'Phone';

  @override
  String get supervisorDetailUnitLabel => 'Unit';

  @override
  String get supervisorDetailSlaTitle => 'Timeline & Tracking';

  @override
  String get supervisorDetailOverdueLabel => 'Overdue';

  @override
  String get supervisorDetailComplaintLabel => 'Complaint filed';

  @override
  String get supervisorDetailUnresolvedLabel => 'Unresolved';

  @override
  String get supervisorDetailDueDateLabel => 'Target date';

  @override
  String get supervisorDetailAssignedDateLabel => 'Assigned date';

  @override
  String get supervisorDetailComplaintDateLabel => 'Complaint date';

  @override
  String get supervisorDetailStatusTitle => 'Update Status';

  @override
  String get supervisorDetailConfirmTitle => 'Supervisor Confirmation';

  @override
  String get supervisorDetailConfirmInstruction =>
      'After completing the repair, confirm that the issue is resolved.';

  @override
  String get supervisorDetailConfirmLocked =>
      'Confirmation is available once the request is marked as resolved.';

  @override
  String get supervisorDetailConfirmAction => 'Confirm Resolution';

  @override
  String get supervisorDetailConfirmedAtPrefix => 'You confirmed resolution on';

  @override
  String get supervisorDetailFeedbackTitle => 'Customer Feedback';

  @override
  String get supervisorDetailCustomerConfirmedAtPrefix =>
      'Customer confirmed resolution on';

  @override
  String get supervisorDetailAttachmentsTitle => 'Attachments';

  @override
  String get supervisorDetailAttachmentFallback => 'Attachment';

  @override
  String get maintenanceOverdue => 'Overdue';

  @override
  String get maintenanceComplaint => 'Complaint';

  @override
  String get maintenanceUnresolved => 'Unresolved';

  @override
  String get maintenanceFallbackTitle => 'Maintenance request';

  @override
  String get maintenanceDetailSubtitle =>
      'Review the request and update execution status';

  @override
  String get maintenanceIssueDescription => 'Issue Description';

  @override
  String get maintenanceCustomerInfo => 'Customer & Unit Info';

  @override
  String get maintenanceWorkflow => 'Stage & Follow-up';

  @override
  String get maintenanceUpdateStatus => 'Update Status';

  @override
  String get maintenanceApproveSolution => 'Approve Solution';

  @override
  String get maintenanceConfirmationUnavailable =>
      'Confirmation is available after marking the request as resolved.';

  @override
  String get maintenanceAttachments => 'Attachments';

  @override
  String get maintenanceNoTargetDate => 'No target date';

  @override
  String get maintenanceCallCustomer => 'Call Customer';

  @override
  String get maintenanceDirectionsToUnit => 'Directions to Unit';

  @override
  String get maintenanceLocationUnavailable => 'Unit location unavailable';

  @override
  String get maintenanceImagePreview => 'Image Preview';

  @override
  String get maintenanceClosePreview => 'Close Preview';

  @override
  String get maintenanceActionUnavailable => 'No action available';

  @override
  String get maintenanceClosedState => 'Request Closed';

  @override
  String get maintenanceOpenAttachment => 'Open attachment';

  @override
  String get maintenanceNoPreviewAvailable =>
      'Preview is not available for this attachment';

  @override
  String get maintenanceProblemSolved => 'Problem Solved';

  @override
  String get maintenanceOpenDirections => 'Open Directions';

  @override
  String get maintenanceLocationPreview => 'Unit Location';

  @override
  String get maintenanceMapPreviewUnavailable => 'Map preview not available';

  @override
  String get maintenanceActionHintInProgress =>
      'After resolving the issue, update the status to confirm resolution.';

  @override
  String get maintenanceCompactDetailTitle => 'Maintenance Request Details';

  @override
  String get salesRoleChip => 'Sales Advisor';

  @override
  String dashboardWelcomeUser(String name) {
    return 'Welcome back, $name';
  }

  @override
  String get dashboardTodaySnapshot => 'Today\'s Snapshot';

  @override
  String get dashboardTodayFocus => 'Today\'s Priorities';

  @override
  String get dashboardMonthlyPerformance => 'Monthly Performance';

  @override
  String get dashboardFocusAllClear => 'No urgent priorities right now';

  @override
  String get dashboardSuggestedProperties => 'Suggested Properties';

  @override
  String get staffShareWithClient => 'Share with client';

  @override
  String get staffAddInterestedClient => 'Add interested client';

  @override
  String get staffSendToClient => 'Send to client';

  @override
  String get staffEditProject => 'Edit project';

  @override
  String get leadClientSection => 'Client';

  @override
  String get leadClientSectionSubtitle =>
      'Pick an existing client or create a new one';

  @override
  String get leadInterestSection => 'Interest & Source';

  @override
  String get leadInterestSectionSubtitle => 'How did the client hear about us?';

  @override
  String get leadNotesSectionSubtitle =>
      'Optional remarks or follow-up details';

  @override
  String get leadNotesHint => 'Write a note…';

  @override
  String get leadSource => 'Lead source';

  @override
  String get leadSourceHint => 'Select a source';

  @override
  String get leadSourceEmpty => 'No sources available';

  @override
  String get leadTabExisting => 'Existing';

  @override
  String get leadTabNew => 'New';

  @override
  String get leadSearchHint => 'Search by name or phone…';

  @override
  String get leadSearchEmpty => 'No clients found';

  @override
  String get leadClientSelected => 'Selected client';

  @override
  String get leadChangeClient => 'Change';

  @override
  String get leadContextProject => 'Project';

  @override
  String get leadContextUnit => 'Unit';

  @override
  String get leadInterestPreFilled => 'Interest pre-filled from';

  @override
  String get companySelectTitle => 'Select Developer';

  @override
  String get companySelectSubtitle =>
      'Search for the developer whose app you\'d like to use';

  @override
  String get companySearchHint => 'Search by company name or code';

  @override
  String get companySearchEmpty => 'No companies found';

  @override
  String get companySearchMinLength => 'Enter at least 2 characters to search';

  @override
  String get companySelectButton => 'Select';

  @override
  String get companyNotAvailable =>
      'This company is not available. Please try a different company.';

  @override
  String get companyChangeTitle => 'Change Developer';

  @override
  String get sectionFloorPlans => 'Floor Plans';

  @override
  String get sectionWarrantyItems => 'Components & Warranties';

  @override
  String get warrantyActive => 'Active';

  @override
  String get warrantyExpired => 'Expired';

  @override
  String get warrantyUntil => 'Until';

  @override
  String get labelSupplier => 'Supplier';

  @override
  String get labelContractor => 'Contractor';

  @override
  String get staffTfaTitle => 'Two-step sign-in';

  @override
  String get staffTfaCodeHint =>
      'Open your authenticator app and enter the 6-digit code.';

  @override
  String get staffTfaCodeLabel => 'Code from the app';

  @override
  String get staffTfaRecoveryLabel => 'Recovery code';

  @override
  String get staffTfaUseRecovery => 'Have a recovery code instead?';

  @override
  String get staffTfaUseApp => 'Use the code from the app';

  @override
  String get staffTfaVerify => 'Confirm';

  @override
  String get staffTfaBack => 'Back';

  @override
  String get staffTfaWrongCode =>
      'Wrong code — check the current code in the app';

  @override
  String get staffTfaLocked => 'Too many wrong codes — try again in 15 minutes';

  @override
  String get staffTfaExpired => 'This step timed out — sign in again';

  @override
  String get staffTfaInvalidFormat => 'Enter the 6-digit code';

  @override
  String get staffTfaSetupTitle => 'Turn on two-step sign-in';

  @override
  String get staffTfaSetupHint =>
      'Your company requires a code from an authenticator app with your password. Add this key to an authenticator app (Google Authenticator, Microsoft Authenticator), then enter the code it shows.';

  @override
  String get staffTfaOpenApp => 'Add to authenticator app';

  @override
  String get staffTfaNoApp =>
      'No authenticator app on this phone — copy the key and add it by hand';

  @override
  String get staffTfaKeyLabel => 'Key';

  @override
  String get staffTfaCopy => 'Copy';

  @override
  String get staffTfaCopied => 'Copied';

  @override
  String get staffTfaEnable => 'Turn on and continue';

  @override
  String get staffTfaCodesTitle => 'Recovery codes';

  @override
  String get staffTfaCodesHint =>
      'Keep these somewhere safe. Each works once if you do not have your phone, and they will not be shown again.';

  @override
  String get staffTfaCodesContinue => 'Saved them — continue';

  @override
  String get leadLostTitle => 'Why was this customer lost?';

  @override
  String get leadLostHint =>
      'Pick the reason — it feeds the lost reasons report.';

  @override
  String get leadLostNote => 'Details (optional)';

  @override
  String get leadLostConfirm => 'Mark as lost';

  @override
  String get leadLostEmpty =>
      'Your company has no lost reasons yet — ask an admin to add them from the dashboard.';

  @override
  String get leadLostReasonLabel => 'Lost reason';

  @override
  String get followUpsTitle => 'Follow-ups';

  @override
  String get followUpsHint =>
      'Customers due a call: overdue first, then today, then upcoming.';

  @override
  String get followUpsOverdue => 'Overdue';

  @override
  String get followUpsToday => 'Today';

  @override
  String get followUpsUpcoming => 'Upcoming';

  @override
  String get followUpsEmptyOverdue => 'No overdue follow-ups — great work.';

  @override
  String get followUpsEmptyToday => 'No follow-ups left today.';

  @override
  String get followUpsEmptyUpcoming => 'No upcoming follow-ups.';

  @override
  String get followUpsEmptyHint =>
      'Set the next follow-up whenever you log an activity on a customer.';

  @override
  String followUpsFocusLine(int overdue, int today) {
    return '$overdue overdue · $today today';
  }

  @override
  String get followUpsLastActivity => 'Last activity';

  @override
  String get followUpsNoActivity => 'No activity yet';

  @override
  String get leadNextAction => 'Next follow-up';

  @override
  String get leadNextActionNone =>
      'No follow-up set — pick a time when you log the next activity.';

  @override
  String get leadLogActivity => 'Log activity';

  @override
  String get leadLogActivityHint =>
      'A call, a meeting, a WhatsApp chat or a note — with the next follow-up.';

  @override
  String get noteKindNote => 'Note';

  @override
  String get noteKindCall => 'Call';

  @override
  String get noteKindMeeting => 'Meeting';

  @override
  String get noteKindWhatsapp => 'WhatsApp';

  @override
  String get noteKindFollowUp => 'Follow-up';

  @override
  String get callResultLabel => 'Call result';

  @override
  String get callResultAnswered => 'Answered';

  @override
  String get callResultNoAnswer => 'No answer';

  @override
  String get callResultBusy => 'Busy';

  @override
  String get callResultUnreachable => 'Unreachable';

  @override
  String get callResultWrongNumber => 'Wrong number';

  @override
  String get activityWhatHappened => 'What happened?';

  @override
  String get activityBodyHint => 'Write what happened and what you agreed…';

  @override
  String get activityNextKeep => 'Keep as is';

  @override
  String get activityNextNone => 'No follow-up';

  @override
  String get activityNextIn1h => 'In an hour';

  @override
  String get activityNextTomorrow => 'Tomorrow';

  @override
  String get activityNextIn3Days => 'In 3 days';

  @override
  String get activityNextWeek => 'In a week';

  @override
  String get activityNextPick => 'Other time…';

  @override
  String get activityNextType => 'Type';

  @override
  String get activityNextNote => 'Note for the follow-up (optional)';

  @override
  String get activityPastDate => 'Pick a time in the future';

  @override
  String get activitySave => 'Save activity';

  @override
  String get noteReply => 'Reply';

  @override
  String get noteReplyHint => 'Write a reply…';

  @override
  String get noteReplySend => 'Send';

  @override
  String get activitySectionWhatSubtitle =>
      'The kind of activity, and how a call went';

  @override
  String get activitySectionDetails => 'Details';

  @override
  String get activitySectionDetailsSubtitle =>
      'What happened and what you agreed';

  @override
  String get activitySectionNextSubtitle =>
      'When will you contact the customer again?';

  @override
  String get activityNextSet => 'Set a time';

  @override
  String get activityNextWhen => 'When';

  @override
  String get calendarTitle => 'Calendar';

  @override
  String get calendarEmptyDay => 'Nothing on this day';

  @override
  String get calendarEmptyHint =>
      'Visits, follow-ups, reservations running out and contract signings show here on their day.';

  @override
  String get calendarTypeVisit => 'Visit';

  @override
  String get calendarTypeFollowUp => 'Follow-up';

  @override
  String get calendarTypeReservationExpiry => 'Reservation expires';

  @override
  String get calendarTypeContract => 'Contract signed';

  @override
  String get calendarDone => 'Done';

  @override
  String get calendarPrevWeek => 'Previous week';

  @override
  String get calendarNextWeek => 'Next week';

  @override
  String get depositTypeFee => 'Fees & penalties';

  @override
  String get planTypeBouncePenalty => 'Bounced-cheque penalty';

  @override
  String get planTypeLateFee => 'Late fee';

  @override
  String get planTypeTransferFee => 'Transfer fee';

  @override
  String get chequesTitle => 'Cheques';

  @override
  String get chequeStatusPending => 'Not deposited';

  @override
  String get chequeStatusDeposited => 'At the bank';

  @override
  String get chequeStatusCleared => 'Cleared';

  @override
  String get chequeStatusBounced => 'Bounced';

  @override
  String get chequeStatusReplaced => 'Replaced';

  @override
  String get chequeStatusCancelled => 'Cancelled';

  @override
  String get chequesEmpty => 'No cheques here';

  @override
  String get chequesEmptyHint =>
      'Customers\' cheques show here, the soonest due first.';

  @override
  String get chequeDueForDeposit => 'Due for deposit';

  @override
  String get chequeNumberLabel => 'Cheque number';

  @override
  String get chequeBank => 'Bank';

  @override
  String get chequeDueDate => 'Due';

  @override
  String get chequeAmount => 'Amount';

  @override
  String get chequeCustomer => 'Customer';

  @override
  String get chequeContract => 'Contract';

  @override
  String get chequeReservation => 'Reservation';

  @override
  String get chequeRecordedBy => 'Recorded by';

  @override
  String get chequeClearedOn => 'Cleared on';

  @override
  String get chequeBouncedOn => 'Bounced on';

  @override
  String get chequeBounceReason => 'Bounce reason';

  @override
  String get chequeReplacedBy => 'Replaced by cheque';

  @override
  String get chequePayments => 'Payments it covers';

  @override
  String get chequeInstallmentDue => 'Installment due';

  @override
  String get chequeOnDashboard =>
      'Bouncing, cancelling and replacing are done on the web dashboard.';

  @override
  String get chequeActionDeposit => 'Deposited at the bank';

  @override
  String get chequeDepositTitle => 'Record cheque deposit';

  @override
  String get chequeDepositHint =>
      'The cheque will be recorded as deposited at the bank, waiting to clear.';

  @override
  String get chequeActionClear => 'Cleared';

  @override
  String get chequeClearTitle => 'Record cheque clearing';

  @override
  String get chequeClearHint =>
      'The payment the cheque covers will be recorded as paid on the clearing date.';

  @override
  String get chequeClearDate => 'Clearing date';

  @override
  String get chequeConfirm => 'Confirm';

  @override
  String get chequeDepositedDone => 'Cheque deposit recorded';

  @override
  String get chequeClearedDone => 'Cheque clearing recorded';

  @override
  String get assistantTitle => 'AI assistant';

  @override
  String get assistantNewChat => 'New chat';

  @override
  String get assistantWelcome => 'Ask about your company\'s data';

  @override
  String get assistantScopeHint =>
      'Overdue installments, available units, leads, reservations and visits. It answers only from the data you can see and changes nothing. Each question counts against the company\'s package.';

  @override
  String get assistantPlaceholder => 'Type your question…';

  @override
  String get assistantSend => 'Send';

  @override
  String get assistantThinking => 'Looking through the data…';

  @override
  String get assistantSuggestOverdue =>
      'Which customers have overdue installments?';

  @override
  String get assistantSuggestUnits =>
      'Which units with 3+ bedrooms are available?';

  @override
  String get assistantSuggestSummary =>
      'A quick summary of sales and reservations';

  @override
  String get assistantSuggestVisits =>
      'What visits do I have today and tomorrow?';

  @override
  String get assistantNotConfigured =>
      'The AI assistant is not available on the platform right now.';

  @override
  String get assistantNotActive =>
      'The assistant isn\'t enabled for your company or its package ended — contact your company admin.';

  @override
  String get assistantExhausted =>
      'This month\'s questions are used up — contact your company admin.';

  @override
  String get assistantErrorExhausted => 'This month\'s questions are used up.';

  @override
  String get assistantErrorNotActive =>
      'The assistant isn\'t enabled or its package ended.';

  @override
  String get assistantErrorUnavailable =>
      'Couldn\'t reach the assistant — the question was not counted; try again.';

  @override
  String get assistantErrorRate =>
      'Too many questions in a short time — wait a minute and try again.';

  @override
  String get signTitle => 'Customer signature';

  @override
  String get signNotSent => 'Not sent for signature yet';

  @override
  String get signNotSentHint =>
      'Send the booking form to the customer to sign on their phone: a code goes to their number and they sign by hand.';

  @override
  String get signStatePending => 'Waiting for the customer';

  @override
  String get signStateSigned => 'Signed by the customer';

  @override
  String get signStateExpired => 'The link expired';

  @override
  String get signStateCancelled => 'The request was cancelled';

  @override
  String signCodeTo(String phone) {
    return 'The code goes to $phone';
  }

  @override
  String signExpires(String when) {
    return 'The link works until $when';
  }

  @override
  String signSignedBy(String name, String when) {
    return 'Signed as $name — $when';
  }

  @override
  String signSentAt(String when) {
    return 'Sent $when';
  }

  @override
  String get signOutdated =>
      'The booking changed after the customer signed — the signature is on an older version. Send a new link.';

  @override
  String get signSend => 'Send for signature';

  @override
  String get signSendNew => 'Send a new link';

  @override
  String get signCancel => 'Cancel request';

  @override
  String get signNewLinkTitle => 'Send a new link?';

  @override
  String get signNewLinkBody => 'The link sent before will stop working.';

  @override
  String get signCancelTitle => 'Cancel the signature request?';

  @override
  String get signCancelBody => 'The customer\'s link will stop working.';

  @override
  String get signCancelConfirm => 'Cancel request';

  @override
  String get signLinkReady => 'The signing link is ready';

  @override
  String get signLinkHint =>
      'Send it to the customer now — the link is not shown again, and works for 72 hours.';

  @override
  String get signCopy => 'Copy';

  @override
  String get signCopied => 'Link copied';

  @override
  String get signShare => 'Share';

  @override
  String signShareMessage(String name, String url) {
    return 'Hello $name, here is the link to review and sign your booking form:\n$url';
  }

  @override
  String get campaignsTitle => 'Campaigns';

  @override
  String get campaignsEmpty => 'No campaigns';

  @override
  String get campaignsEmptyHint =>
      'Campaigns are set up and their spend recorded on the web dashboard.';

  @override
  String get campaignsSpend => 'Total spend';

  @override
  String get campaignsLeads => 'Leads';

  @override
  String get campaignsCpl => 'Cost per lead';

  @override
  String get campaignsWon => 'Sales';

  @override
  String get campaignsCpa => 'Cost per sale';

  @override
  String campaignLeadsCount(String n) {
    return '$n leads';
  }

  @override
  String campaignWonCount(String n) {
    return '$n sales';
  }

  @override
  String campaignLostCount(String n) {
    return '$n leads lost';
  }

  @override
  String campaignBudgetOf(String n) {
    return 'of a $n budget';
  }

  @override
  String get campaignQualified => 'Qualified';

  @override
  String get campaignChannel => 'Channel';

  @override
  String get campaignProject => 'Project';

  @override
  String get campaignSource => 'Source';

  @override
  String get campaignPeriod => 'Period';

  @override
  String get campaignBudget => 'Budget';

  @override
  String get campaignCode => 'Link code';

  @override
  String get campaignPlatforms => 'Where its leads came from';

  @override
  String get campaignSpendLog => 'Spend';

  @override
  String get campaignSpendEmpty => 'No spend recorded yet.';

  @override
  String get campaignOnDashboard =>
      'Edit the campaign and record spend on the web dashboard.';

  @override
  String get campaignStatusPlanned => 'Planned';

  @override
  String get campaignStatusActive => 'Active';

  @override
  String get campaignStatusPaused => 'Paused';

  @override
  String get campaignStatusEnded => 'Ended';

  @override
  String get campaignChannelFacebook => 'Meta (Facebook + Instagram)';

  @override
  String get campaignChannelInstagram => 'Instagram';

  @override
  String get campaignChannelTiktok => 'TikTok';

  @override
  String get campaignChannelGoogle => 'Google';

  @override
  String get campaignChannelSnapchat => 'Snapchat';

  @override
  String get campaignChannelWhatsapp => 'WhatsApp';

  @override
  String get campaignChannelSms => 'SMS';

  @override
  String get campaignChannelEmail => 'Email';

  @override
  String get campaignChannelBillboard => 'Billboards';

  @override
  String get campaignChannelEvent => 'Event';

  @override
  String get campaignChannelOther => 'Other';

  @override
  String get campaignPlatformFacebook => 'Facebook';

  @override
  String get campaignPlatformInstagram => 'Instagram';

  @override
  String get campaignPlatformMessenger => 'Messenger';

  @override
  String get campaignPlatformAudience => 'Audience Network';

  @override
  String get campaignPlatformOther => 'Other source';

  @override
  String get campaignPlatformUnknown => 'Not known';

  @override
  String get leadCampaign => 'Campaign';

  @override
  String get leadCampaignHint =>
      'The campaign that brought the lead (optional)';

  @override
  String get leadCampaignNone => 'No campaign';

  @override
  String get campaignsSubtitle => 'Spend, leads and sales from each campaign';

  @override
  String campaignFrom(String n) {
    return 'From $n';
  }

  @override
  String campaignUntil(String n) {
    return 'Until $n';
  }

  @override
  String get duplicatesTitle => 'Duplicate leads';

  @override
  String get duplicatesSubtitle =>
      'One customer, several open leads — merge them';

  @override
  String get duplicatesHow =>
      'Pick the lead to keep; the others merge into it with their notes, calls and visits. It takes what it lacks (campaign, source, project, owner, next follow-up) and the furthest stage reached.';

  @override
  String get duplicatesEmpty => 'No duplicate leads';

  @override
  String get duplicatesEmptyHint => 'Every customer has a single open lead.';

  @override
  String duplicatesOpenLeads(String n) {
    return '$n open leads';
  }

  @override
  String get duplicatesKeep => 'Keep';

  @override
  String get duplicatesMerge => 'Merge';

  @override
  String get duplicatesOwner => 'Owner';

  @override
  String get duplicatesUnassigned => 'Unassigned';

  @override
  String get duplicatesAdded => 'Added';

  @override
  String duplicatesActivities(String n) {
    return '$n activities';
  }

  @override
  String get duplicatesLocked =>
      'Has a reservation or a broker — keep this one instead';

  @override
  String duplicatesMergeN(String n) {
    return 'Merge $n into the kept lead';
  }

  @override
  String get duplicatesConfirmTitle => 'Merge the leads?';

  @override
  String get duplicatesConfirmBody =>
      'Their notes and history move to the kept lead, then they are removed.';

  @override
  String duplicatesMerged(String n) {
    return '$n merged';
  }

  @override
  String get securityDevices => 'Devices';

  @override
  String get securityDevicesHint =>
      'The devices signed in to your account. If one isn\'t yours, sign it out and change your password.';

  @override
  String get securityThisDevice => 'This device';

  @override
  String securityLastSeen(String when) {
    return 'Last used $when';
  }

  @override
  String get securityDeviceIphone => 'iPhone';

  @override
  String get securityDeviceAndroid => 'Android';

  @override
  String get securityDeviceBrowser => 'Browser';

  @override
  String get securityDeviceUnknown => 'Device';

  @override
  String securityBrowserOn(String browser, String os) {
    return '$browser on $os';
  }

  @override
  String get securitySignOut => 'Sign out';

  @override
  String get securitySignOutTitle => 'Sign this device out?';

  @override
  String securitySignOutBody(String device) {
    return '$device will have to sign in again.';
  }

  @override
  String get securitySignedOut => 'The device was signed out';

  @override
  String get securitySignOutOthers => 'Sign out all other devices';

  @override
  String get securitySignOutOthersTitle => 'Sign out all other devices?';

  @override
  String get securitySignOutOthersBody =>
      'Every device but this phone will have to sign in again.';

  @override
  String securitySignedOutOthers(String n) {
    return '$n devices signed out';
  }

  @override
  String get securityOn => 'On';

  @override
  String get securityOff => 'Off';

  @override
  String get securityTfaHint =>
      'A code from an authenticator app with your password at each sign-in.';

  @override
  String get securityTfaRequired =>
      'Your company requires two-step sign-in, so it can\'t be turned off.';

  @override
  String get securityTfaTurnOn => 'Turn on two-step sign-in';

  @override
  String get securityTfaTurnOff => 'Turn off';

  @override
  String get securityTfaSetupHint =>
      'Add this key to an authenticator app (Google or Microsoft Authenticator), then type the code it shows.';

  @override
  String get securityTfaOffBody =>
      'Enter your password and a code from the app to turn two-step sign-in off.';

  @override
  String get securityTfaOffDone => 'Two-step sign-in is off';

  @override
  String securityRecoveryLeft(String n) {
    return '$n recovery codes left';
  }

  @override
  String get securityNewCodes => 'New recovery codes';

  @override
  String get securityNewCodesBody =>
      'The old codes stop working. Enter a code from the app to get new ones.';

  @override
  String get securityPasswordHint =>
      'A strong password of at least 8 characters.';

  @override
  String get securityChangePassword => 'Change password';

  @override
  String get securityCurrentPassword => 'Current password';

  @override
  String get securityPasswordAgain => 'Type the new password again';

  @override
  String get securityPasswordMismatch => 'The passwords don\'t match';

  @override
  String get securityPasswordChanged => 'Password changed';

  @override
  String get leadDupTitle => 'This customer already has an open lead';

  @override
  String get leadDupDesc =>
      'A second lead splits their follow-up in two. Carry on with the open one, or add a new one if this is really a different request.';

  @override
  String get leadDupOwner => 'Owner';

  @override
  String get leadDupUnassigned => 'Unassigned';

  @override
  String get leadDupOpen => 'Open the lead';

  @override
  String get leadDupAnyway => 'Add a new lead anyway';

  @override
  String get reservationDecideTitle => 'Waiting for your approval';

  @override
  String get reservationDecideDesc =>
      'Approving lets the booking go on to a contract. Rejecting frees the unit.';

  @override
  String reservationBookedBy(String name) {
    return 'Booked by $name';
  }

  @override
  String get reservationApprove => 'Approve';

  @override
  String get reservationReject => 'Reject';

  @override
  String get reservationApproveConfirm => 'Approve this reservation?';

  @override
  String get reservationRejectTitle => 'Reject the reservation';

  @override
  String get reservationRejectReasonHint => 'Reason (the rep sees it)';

  @override
  String get reservationApprovedDone => 'Reservation approved';

  @override
  String get reservationRejectedDone => 'Reservation rejected';

  @override
  String get contractDeliveryPromised => 'Handover in the contract';

  @override
  String get contractDeliveryExpected => 'Expected handover now';

  @override
  String contractDeliveryLate(int days) {
    return '$days days late';
  }

  @override
  String get unitSpecsTitle => 'Unit specs';

  @override
  String unitAreaValue(String n) {
    return '$n m²';
  }

  @override
  String get unitSpecNetArea => 'Net area';

  @override
  String get unitSpecGarden => 'Garden';

  @override
  String get unitSpecRoof => 'Roof';

  @override
  String get unitSpecTerrace => 'Terrace';

  @override
  String get unitSpecLand => 'Land area';

  @override
  String get unitSpecFinishing => 'Finishing';

  @override
  String get unitSpecView => 'View';

  @override
  String get unitSpecOrientation => 'Orientation';

  @override
  String get unitSpecDelivery => 'Handover';

  @override
  String get unitDeliveryNow => 'Ready to move in';

  @override
  String get unitFinishingCoreShell => 'Core & shell';

  @override
  String get unitFinishingSemi => 'Semi-finished';

  @override
  String get unitFinishingFull => 'Fully finished';

  @override
  String get unitFinishingFurnished => 'Furnished';

  @override
  String get unitViewGarden => 'Garden';

  @override
  String get unitViewPool => 'Pool';

  @override
  String get unitViewLagoon => 'Lagoon';

  @override
  String get unitViewSea => 'Sea';

  @override
  String get unitViewNile => 'Nile';

  @override
  String get unitViewClub => 'Clubhouse';

  @override
  String get unitViewLandscape => 'Landscape';

  @override
  String get unitViewMainStreet => 'Main street';

  @override
  String get unitViewSideStreet => 'Side street';

  @override
  String get unitOrientationNorth => 'North';

  @override
  String get unitOrientationSouth => 'South';

  @override
  String get unitOrientationEast => 'East';

  @override
  String get unitOrientationWest => 'West';

  @override
  String get unitOrientationNorthEast => 'North-east';

  @override
  String get unitOrientationNorthWest => 'North-west';

  @override
  String get unitOrientationSouthEast => 'South-east';

  @override
  String get unitOrientationSouthWest => 'South-west';

  @override
  String get contentAboutCompany => 'About the company';

  @override
  String get contentPageEmpty => 'This page is empty for now.';

  @override
  String installmentPaidOn(String date) {
    return 'Paid on $date';
  }

  @override
  String get reservationEventCreated => 'Reservation created';

  @override
  String get reservationEventApproved => 'Reservation approved';

  @override
  String get reservationEventRejected => 'Reservation rejected';

  @override
  String get reservationEventCancelled => 'Reservation cancelled';

  @override
  String get reservationEventExpired => 'Reservation expired';

  @override
  String get reservationEventNoteAdded => 'Note added';

  @override
  String get reservationEventPaymentConfirmed => 'Booking payment confirmed';

  @override
  String get reservationEventPaymentUnconfirmed =>
      'Booking payment unconfirmed';

  @override
  String get reservationEventConverted => 'Converted to a contract';

  @override
  String get reservationEventOther => 'Reservation updated';

  @override
  String get visitEventRequestCreated => 'Visit requested';

  @override
  String get visitEventRequestReviewed => 'Visit request reviewed';

  @override
  String get visitEventRequestRejected => 'Visit request rejected';

  @override
  String get visitEventRequestCancelled => 'Visit request cancelled';

  @override
  String get visitEventScheduled => 'Visit scheduled';

  @override
  String get visitEventConfirmed => 'Visit confirmed';

  @override
  String get visitEventCompleted => 'Visit completed';

  @override
  String get visitEventCancelled => 'Visit cancelled';

  @override
  String get visitEventNoShow => 'Client did not show';

  @override
  String get visitEventRescheduled => 'Visit rescheduled';

  @override
  String get visitEventSalesAssigned => 'Assigned to a sales advisor';

  @override
  String get visitEventNoteAdded => 'Note added';

  @override
  String get visitEventCustomerConfirmed => 'Client confirmed';

  @override
  String get visitEventCustomerRescheduleRequested =>
      'Client asked to reschedule';

  @override
  String get visitEventReminderSent => 'Reminder sent';

  @override
  String get visitEventSalesReassigned => 'Visit reassigned';

  @override
  String get visitEventFeedbackSubmitted => 'Feedback added';

  @override
  String get visitEventOther => 'Visit updated';

  @override
  String get authPhoneTitle => 'Sign in with your phone';

  @override
  String get fieldFullNameNewAccount => 'Full name (new accounts only)';

  @override
  String get brokerLeadSectionContact => 'Client details';

  @override
  String get brokerLeadSectionContactSubtitle =>
      'Name and phone are required; email is optional.';

  @override
  String get brokerSectionNoteSubtitle =>
      'Anything that helps the sales team reach the client.';

  @override
  String get brokerReservationClientSubtitle =>
      'Pick one of the leads you added.';

  @override
  String get brokerReservationNewSubtitle =>
      'Request a unit booking for your client';

  @override
  String get brokerLeadNewSubtitle => 'Add the prospective client\'s details';

  @override
  String get followUpsYesterday => 'Yesterday';

  @override
  String get brokerAvailableProjects => 'Available projects';

  @override
  String get brokerAchievementSnapshot => 'Performance snapshot';

  @override
  String get brokerActivityBadge => 'Activity';

  @override
  String get brokerLeadsSent => 'Leads sent';

  @override
  String get brokerAcceptanceRate => 'Acceptance rate';

  @override
  String get brokerSignedContracts => 'Signed contracts';

  @override
  String brokerPendingLeads(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n leads waiting for approval',
      one: '1 lead waiting for approval',
    );
    return '$_temp0';
  }

  @override
  String brokerPendingReservations(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n reservations waiting for review',
      one: '1 reservation waiting for review',
    );
    return '$_temp0';
  }

  @override
  String get brokerChipWaiting => 'Waiting';

  @override
  String get brokerChipReview => 'Review';

  @override
  String get brokerChipGood => 'Good';

  @override
  String get brokerFocusAllClear => 'Nothing urgent — great work!';

  @override
  String get brokerNoProjects => 'No projects available';

  @override
  String get brokerCommissionsDue => 'Total commissions due';

  @override
  String get brokerCommissionsNone => 'No commissions yet';

  @override
  String get brokerSalesVolume => 'Sales volume';

  @override
  String get brokerSignedValue => 'Total value of signed contracts';

  @override
  String daysAgo(int n) {
    return '$n days ago';
  }

  @override
  String get maintenanceActionStart => 'Start work';

  @override
  String get maintenanceActionReopen => 'Reopen';

  @override
  String get maintenanceResolvedByBoth => 'Both sides confirmed the fix';

  @override
  String get maintenanceResolvedByCustomer => 'The customer confirmed the fix';

  @override
  String get maintenanceResolvedBySupervisor =>
      'The supervisor confirmed the fix';

  @override
  String get maintenanceResolvedByNone => 'Not confirmed yet';

  @override
  String get maintenanceOutOfWarranty => 'Out of warranty';

  @override
  String get maintenanceWarrantyUnknown => 'Warranty unknown';

  @override
  String get maintenanceDeadlinePassed => 'Past the deadline';

  @override
  String get maintenanceTimeLeft => 'Time left';

  @override
  String get timeUnitDay => 'days';

  @override
  String get timeUnitHour => 'hours';

  @override
  String get timeUnitMinute => 'min';

  @override
  String get timeUnitSecond => 'sec';

  @override
  String get maintenanceDeadlineOver => 'The deadline has passed';

  @override
  String maintenanceDeadlineUsed(String pct) {
    return '$pct% of the time used';
  }

  @override
  String unitTitle(String code) {
    return 'Unit $code';
  }

  @override
  String get whatsappOpenFailed => 'Couldn\'t open WhatsApp';

  @override
  String get maintenanceDirections => 'Directions';

  @override
  String get maintenanceWarrantyEnds => 'Warranty ends';

  @override
  String get maintenanceServicedItem => 'Item serviced';

  @override
  String get maintenanceRequestDate => 'Request date';

  @override
  String get maintenancePriorityLabel => 'Priority';

  @override
  String get teamPerfSubtitle => 'Track your reps\' performance';

  @override
  String get teamTargetsSubtitle => 'Set the team\'s monthly targets';

  @override
  String get teamManagement => 'Team management';

  @override
  String get fromLabel => 'From';

  @override
  String get clientTagOwner => 'Owner';

  @override
  String get clientTagClient => 'Client';

  @override
  String get kpiLeads => 'Leads';

  @override
  String get calculatorInputs => 'Inputs';

  @override
  String get brokerProjectsSubtitle => 'Projects open to you';

  @override
  String get brokerAddLeadForUnit => 'Add a lead for this unit';

  @override
  String get brokerAddLeadForProject => 'Add a lead for this project';

  @override
  String get detailsLabel => 'Details';

  @override
  String get aboutTheProject => 'About the project';

  @override
  String get projectFeatures => 'Project features';

  @override
  String get projectLocationTitle => 'Project location';

  @override
  String get totalLabel => 'Total';

  @override
  String get availableLabel => 'Available';

  @override
  String get unavailableLabel => 'Unavailable';

  @override
  String get brokerCommissionsSubtitle => 'Your commissions and what is due';

  @override
  String get brokerReservationDetails => 'Reservation request';

  @override
  String get brokerReserveForLead => 'Request a booking for this client';

  @override
  String get leadSingular => 'Lead';

  @override
  String get shareProjectBody => 'See the project and its available units:';

  @override
  String get shareUnitBody => 'See the unit\'s details:';

  @override
  String get paidDateLabel => 'Paid on';

  @override
  String get proofFilesTitle => 'Proof files';

  @override
  String get tapFileToOpen => 'Tap a file to open or download it';

  @override
  String get submitProofSubtitle => 'Attach your payment receipt for review';

  @override
  String get fileReadyToSend => 'The file is ready to send';

  @override
  String get proofFileTypes => 'PDF · JPG · PNG · WebP (up to 25 MB)';

  @override
  String get viewApprovedProof => 'View the approved proof';

  @override
  String get tapToViewAttachment => 'Tap to view or download the attachment';

  @override
  String get paymentProofResubmitTitle => 'Resubmit payment proof';

  @override
  String get paymentProofResubmitHint =>
      'Your last proof was rejected — attach a new document';

  @override
  String get paymentProofSubmitHint =>
      'Attach a photo or PDF as proof of payment';

  @override
  String get financeSubtitle => 'Your payments and contracts';

  @override
  String get accountMyPropertySubtitle => 'Your units and their status';

  @override
  String get accountMaintenanceSubtitle => 'Maintenance and repair requests';

  @override
  String get moreAssistantSubtitle => 'Chat with our assistant';

  @override
  String get moreBenefitFavorites => 'Save favourites';

  @override
  String get moreBenefitCompare => 'Compare units';

  @override
  String get moreBenefitTrack => 'Track your journey';

  @override
  String get tapToViewReceipts => 'Tap to view or download the receipts';

  @override
  String get createdDateLabel => 'Created on';

  @override
  String get tapToViewDocuments =>
      'Tap to view or download the attached documents';

  @override
  String get maintenanceFollowUpTitle => 'Resolution and rating';

  @override
  String get maintenanceTargetDate => 'Target fix date';

  @override
  String get maintenanceStartsAfterApproval =>
      'Starts once the request is approved';

  @override
  String get maintenanceSupervisorConfirmation => 'Supervisor confirmation';

  @override
  String get maintenanceOverdueComplaintHint =>
      'Your request is past its target date — you can file a complaint.';

  @override
  String get maintenanceFileComplaint => 'File a complaint';

  @override
  String get maintenanceYourRating => 'Your rating';

  @override
  String maintenanceYouConfirmedOn(String date) {
    return 'You confirmed the fix on $date';
  }

  @override
  String get maintenanceComplaintSent =>
      'Your complaint was filed; our team will follow it up.';

  @override
  String get maintenanceRatingRequired =>
      'Please choose a rating from 1 to 5 stars.';

  @override
  String get maintenanceRatingThanks =>
      'Thank you! The fix is confirmed and your rating sent.';

  @override
  String get maintenanceConfirmPrompt =>
      'Was the problem fixed? Confirm and rate the service';

  @override
  String get maintenanceRatingNoteHint =>
      'Add a note about the service (optional)';

  @override
  String get maintenanceConfirmAndRate => 'Confirm the fix and send the rating';

  @override
  String get serviceRequests => 'Service requests';

  @override
  String get maintenanceStatusOpenPlural => 'Open';

  @override
  String get maintenanceNewSubtitle =>
      'Tell us the problem and we\'ll handle it';

  @override
  String get maintenanceFromCameraHint => 'Take a photo now';

  @override
  String get maintenanceFromGalleryHint => 'Pick from your photos';

  @override
  String get noResults => 'No results';

  @override
  String get favoritesFilterEmpty => 'Nothing saved in this category';

  @override
  String get favoritesSubtitle => 'Saved units';

  @override
  String get favoritesTabUnits => 'Units';

  @override
  String get favoritesTabProjects => 'Projects';

  @override
  String get favoriteKindProject => 'Project';

  @override
  String get favoriteKindUnit => 'Unit';

  @override
  String get savedBadge => 'Saved';

  @override
  String get requestsFilterEmpty => 'No requests in this category';

  @override
  String get requestsNew => 'New';

  @override
  String get requestsConfirmed => 'Confirmed';

  @override
  String get requestsCompleted => 'Completed';

  @override
  String get requestsCancelled => 'Cancelled';

  @override
  String get preferredDateLabel => 'Preferred date';

  @override
  String get salesRepLabel => 'Sales consultant';

  @override
  String get noMessage => 'No message';

  @override
  String requestDateValue(String date) {
    return 'Requested on $date';
  }

  @override
  String installmentsPaidOf(int paid, int total) {
    return '$paid of $total installments paid';
  }

  @override
  String ofTotal(int total) {
    return 'of $total';
  }

  @override
  String get summaryTab => 'Summary';

  @override
  String get financialPanel => 'Financial overview';

  @override
  String monthsCount(int n) {
    return '$n months';
  }

  @override
  String get overdueTotal => 'Total overdue';

  @override
  String overdueInstallments(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n overdue installments',
      one: '1 overdue installment',
    );
    return '$_temp0';
  }

  @override
  String lastDueOn(String date) {
    return 'last due $date';
  }

  @override
  String get remainingLabel => 'Remaining';

  @override
  String get planDuration => 'Plan length';

  @override
  String get contractDetails => 'Contract details';

  @override
  String get myUnits => 'My units';

  @override
  String get myPortfolio => 'My property portfolio';

  @override
  String unitsCount(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n units',
      one: '1 unit',
    );
    return '$_temp0';
  }

  @override
  String overdueCountBadge(int n) {
    return '$n overdue';
  }

  @override
  String get onTrackBadge => 'On track';

  @override
  String get paymentProgress => 'Payment progress';

  @override
  String get notificationPrefsTitle => 'Notification settings';

  @override
  String get statementTitle => 'Statement of account';

  @override
  String get statementOpenHint => 'Everything you paid and what is left';

  @override
  String get statementBalance => 'Left on the contract';

  @override
  String statementAsOf(String date) {
    return 'As of $date';
  }

  @override
  String get statementPaid => 'Paid';

  @override
  String get statementDueToday => 'Due today';

  @override
  String get statementUpcoming => 'Not due yet';

  @override
  String get statementAwaiting => 'Awaiting confirmation';

  @override
  String get statementMovements => 'Movements';

  @override
  String get statementContractValue => 'Contract value';

  @override
  String statementPaymentOf(String what) {
    return 'Payment: $what';
  }

  @override
  String statementPaymentOfBy(String what, String how) {
    return 'Payment: $what — $how';
  }

  @override
  String statementReversalOf(String what) {
    return 'Payment reversed: $what';
  }

  @override
  String statementWaiverOf(String what) {
    return 'Waived: $what';
  }

  @override
  String statementDueOn(String date) {
    return 'due $date';
  }

  @override
  String get statementMarkedPaid => 'marked paid';

  @override
  String statementReason(String reason) {
    return 'Reason: $reason';
  }

  @override
  String statementBalanceAfter(String amount) {
    return 'Balance $amount';
  }

  @override
  String get statementAwaitingNote =>
      'Payments awaiting confirmation (a proof under review, a cheque not cleared) are not in the balance until they are confirmed.';

  @override
  String get ledgerTitle => 'Owed to us & by us';

  @override
  String get ledgerSubtitle => 'Receivables & payables';

  @override
  String get ledgerNet => 'Net position';

  @override
  String get ledgerNetForCompany => 'In the company\'s favour';

  @override
  String get ledgerNetOnCompany => 'Owed by the company';

  @override
  String get ledgerReceivables => 'Receivables';

  @override
  String get ledgerPayables => 'Payables';

  @override
  String get ledgerReceivablesTitle => 'Receivables — owed to the company';

  @override
  String get ledgerPayablesTitle => 'Payables — owed by the company';

  @override
  String get ledgerGroupInstallments => 'Contract installments';

  @override
  String get ledgerGroupBookings => 'Booking amounts';

  @override
  String get ledgerGroupFees => 'Fees & penalties';

  @override
  String get ledgerGroupClawbacks => 'Clawbacks from brokers & staff';

  @override
  String get ledgerGroupCommissions => 'Broker commissions';

  @override
  String get ledgerGroupBonuses => 'Sales team bonuses';

  @override
  String get ledgerGroupTopUps => 'Commission top-ups';

  @override
  String get ledgerGroupRefunds => 'Refunds owed to customers';

  @override
  String get ledgerGroupOnHold => 'On hold pending a decision';

  @override
  String get ledgerOnHoldNote => 'not in the total';

  @override
  String get statementDueTodayShort => 'Due today';

  @override
  String get ledgerStateUpcoming => 'Not due yet';

  @override
  String get ledgerStateOnItsWay => 'On its way';

  @override
  String get ledgerStatePendingApproval => 'Awaiting approval';

  @override
  String get ledgerTypeCommission => 'Commission';

  @override
  String get ledgerTypeBonus => 'Bonus';

  @override
  String get ledgerTypeCommissionClawback => 'Commission clawback';

  @override
  String get ledgerTypeBonusClawback => 'Bonus clawback';

  @override
  String get ledgerTypePriceChangeClawback => 'Commission reduction';

  @override
  String get ledgerPeriodAll => 'All open balances';

  @override
  String get ledgerPeriodThisMonth => 'This month';

  @override
  String get ledgerPeriodNextMonth => 'Next month';

  @override
  String get ledgerPeriodQuarter => 'This quarter';

  @override
  String get ledgerPeriodYear => 'This year';

  @override
  String ledgerItems(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n items',
      one: '1 item',
      zero: 'No items',
    );
    return '$_temp0';
  }

  @override
  String get ledgerEmpty => 'No items in this period.';

  @override
  String get detailPhotosFullscreen => 'View photos full screen';

  @override
  String get detailClose => 'Close';

  @override
  String get detailTotalPrice => 'Total price';

  @override
  String get detailPricesFrom => 'Prices from';

  @override
  String detailOrFrom(String amount, String period) {
    return 'or from $amount $period';
  }

  @override
  String get detailPeriodMonthly => 'a month';

  @override
  String get detailPeriodQuarterly => 'every 3 months';

  @override
  String get detailPeriodSemiAnnual => 'every 6 months';

  @override
  String get detailPeriodYearly => 'a year';

  @override
  String detailUpfrontPct(String pct) {
    return 'Down $pct';
  }

  @override
  String get detailTerm => 'Term';

  @override
  String detailYears(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n years',
      one: '1 year',
    );
    return '$_temp0';
  }

  @override
  String detailMonths(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n months',
      one: '1 month',
    );
    return '$_temp0';
  }

  @override
  String get detailHandover => 'Handover';

  @override
  String get detailCalcInstallment => 'Work out your instalment';

  @override
  String get detailTabOverview => 'Overview';

  @override
  String get detailTabFloorPlan => 'Floor plan';

  @override
  String get detailTabPayment => 'Payment plan';

  @override
  String get detailTabLocation => 'Location';

  @override
  String get detailTabSimilar => 'Similar';

  @override
  String get detailTabUnits => 'Units';

  @override
  String get detailTabAmenities => 'Amenities';

  @override
  String get detailRowBooking => 'Booking';

  @override
  String get detailRowDownPayment => 'Down payment';

  @override
  String detailRowInstallments(int count) {
    return 'Instalments ($count)';
  }

  @override
  String get detailRowFinal => 'Final payment';

  @override
  String get detailRowTotal => 'Total';

  @override
  String get detailRowDiscount => 'Discount';

  @override
  String get detailCashPayment => 'Cash payment';

  @override
  String get detailInstallmentMonthly => 'Monthly instalment';

  @override
  String get detailInstallmentQuarterly => 'Quarterly instalment';

  @override
  String get detailInstallmentSemiAnnual => 'Half-yearly instalment';

  @override
  String get detailInstallmentYearly => 'Yearly instalment';

  @override
  String get detailCalcPlan => 'Plan';

  @override
  String get detailCalcDuration => 'Duration';

  @override
  String get detailCalcUpfront => 'Down';

  @override
  String get detailCalcCount => 'Instalments';

  @override
  String get detailCalcTotal => 'Total paid';

  @override
  String get detailCalcNote =>
      'Figures come from the current payment plans; the final plan is set at signing.';

  @override
  String detailProjectOffer(String pct, String term) {
    return '$pct down, up to $term';
  }

  @override
  String get detailAvailableUnits => 'Available units';

  @override
  String get detailSimilarUnits => 'Similar units';

  @override
  String get detailPaymentPlans => 'Payment plans';

  @override
  String detailPlanTerm(String pct) {
    return '$pct down';
  }

  @override
  String detailUpTo(String term) {
    return 'up to $term';
  }

  @override
  String get pageNotFoundTitle => 'Page not found';

  @override
  String get pageNotFoundMessage =>
      'The link is wrong or this page is no longer available.';

  @override
  String get pageNotFoundHome => 'Back to home';

  @override
  String get pageNoAccessTitle => 'This page is not available to your account';

  @override
  String get pageNoAccessMessage =>
      'Ask your company\'s administrator for access to it.';

  @override
  String get companyUnavailableTitle => 'The app is not available right now';

  @override
  String get companyUnavailableMessage =>
      'The service is paused for now. Try again later or contact the company.';

  @override
  String get pageKindAboutSub => 'Get to know the company and its projects';

  @override
  String get pageKindPrivacySub => 'How we look after your data';

  @override
  String get pageKindTermsSub => 'The terms of using the service';

  @override
  String get pageKindPaymentSub => 'The payment plans and methods on offer';

  @override
  String get pageKindFaqSub => 'Answers to the most common questions';

  @override
  String get pageKindContactSub => 'Ways to reach the company';

  @override
  String get contentContactTitle => 'Contact us';

  @override
  String get contentContactSub => 'Our team is ready to answer your questions.';

  @override
  String get contentContactCall => 'Call';

  @override
  String get contentContactWhatsApp => 'WhatsApp';

  @override
  String get contractMoneyTitle => 'Payment summary';

  @override
  String contractPaidShare(String percent) {
    return '$percent of the contract paid';
  }

  @override
  String get contractRemaining => 'Remaining';

  @override
  String get contractNextInstallment => 'Next installment';

  @override
  String contractNextDue(String date) {
    return 'Due on $date';
  }

  @override
  String contractNextOverdue(String date) {
    return 'Overdue since $date';
  }

  @override
  String get contractNoUpcoming => 'Nothing is due from you right now.';

  @override
  String get contractViewInstallments => 'All installments';

  @override
  String get contractPlanTitle => 'Payment plan';

  @override
  String get contractPlanEach => 'Each installment';

  @override
  String get contractPlanDuration => 'Duration';

  @override
  String get contractPlanStart => 'First installment';

  @override
  String get contractPlanFrequency => 'Every';

  @override
  String get contractPlanCash => 'Paid in full, no installments';

  @override
  String get freqMonthly => 'month';

  @override
  String get freqQuarterly => '3 months';

  @override
  String get freqSemiAnnual => '6 months';

  @override
  String get freqAnnual => 'year';

  @override
  String get contractUnitTitle => 'The unit';

  @override
  String get statementCharge => 'Charge';

  @override
  String get statementPayment => 'Paid';

  @override
  String get depositStatusTitle => 'Payment status';

  @override
  String get depositDetailsTitle => 'Payment details';

  @override
  String get depositStateCollected => 'Confirmed';

  @override
  String get depositStatePendingReview => 'Under review';

  @override
  String get depositStateChequePending => 'Cheque not cleared yet';

  @override
  String get depositStateRejected => 'Rejected';

  @override
  String get depositStateReversed => 'Reversed by the company';

  @override
  String get depositStateBounced => 'Cheque returned';

  @override
  String get depositStepSent => 'You sent the proof';

  @override
  String get depositStepRecorded => 'Recorded by the company';

  @override
  String get depositStepReview => 'Company review';

  @override
  String get depositStepConfirmed => 'Payment confirmed';

  @override
  String get depositStepRejected => 'Proof rejected';

  @override
  String get depositStepWaiting => 'Waiting';

  @override
  String get depositMethod => 'Payment method';

  @override
  String get depositForInstallment => 'For the installment due on';

  @override
  String get depositBookingNumber => 'Booking number';

  @override
  String get depositRejectedReason => 'Why it was rejected';

  @override
  String get paymentMethodCard => 'Card';

  @override
  String get requestReplyNote =>
      'Our team will get back to you within one working day.';

  @override
  String get requestAbout => 'Your request is about';

  @override
  String get requestContactTitle => 'We will reach you on';

  @override
  String get requestContactEdit => 'Edit your details';

  @override
  String get visitPickDay => 'Pick a day';

  @override
  String get visitPickTime => 'Pick a time';

  @override
  String get visitNotesHint => 'e.g. I\'d like to see the units with a garden';

  @override
  String visitSummary(String day, String time) {
    return 'Your visit on $day at $time';
  }

  @override
  String get visitDoneTitle => 'Your visit request is in';

  @override
  String get visitDoneMessage =>
      'We\'ll confirm the time with you shortly; you\'ll find the request in «My requests».';

  @override
  String get infoTopicsTitle => 'What would you like to know?';

  @override
  String get infoTopicPrices => 'Prices and payment plans';

  @override
  String get infoTopicAreas => 'Available sizes';

  @override
  String get infoTopicDelivery => 'Handover date';

  @override
  String get infoTopicFinishing => 'Finishing and specs';

  @override
  String get infoTopicLocation => 'Location and services';

  @override
  String get infoMessageOptional => 'More details (optional)';

  @override
  String get infoTopicsRequired => 'Pick a topic or write your question.';

  @override
  String infoTopicsLine(String topics) {
    return 'Topics: $topics';
  }

  @override
  String get infoDoneTitle => 'Your question is sent';

  @override
  String get infoDoneMessage =>
      'A sales advisor will reply soon; you\'ll find the request in «My requests».';

  @override
  String get requestGoToRequests => 'My requests';

  @override
  String get requestBrowseProjects => 'Browse projects';

  @override
  String get maintenanceDoneTitle => 'Your maintenance request is in';

  @override
  String get maintenanceDoneMessage =>
      'The maintenance team will contact you to book a visit; follow the request from «Maintenance».';

  @override
  String get maintenanceDoneBack => 'Maintenance requests';

  @override
  String get maintenanceDoneHome => 'Back to home';

  @override
  String get shGreetMorning => 'Good morning,';

  @override
  String get shGreetEvening => 'Good evening,';

  @override
  String get shGoalTitle => 'This month\'s target';

  @override
  String shOfTarget(String target) {
    return 'of $target';
  }

  @override
  String get shOfGoal => 'of target';

  @override
  String get shGoalUnits => 'Units';

  @override
  String get shDaysLeftLabel => 'Left this month';

  @override
  String shDaysLeft(int n) {
    return '$n days';
  }

  @override
  String get shNoTarget => 'No target set for you this month yet.';

  @override
  String get shActLead => 'New lead';

  @override
  String get shActVisit => 'Schedule visit';

  @override
  String get shActReservation => 'New booking';

  @override
  String get shActCalculator => 'Calculator';

  @override
  String get shFigures => 'Your month in numbers';

  @override
  String get shOpenLeads => 'Open leads';

  @override
  String shStaleN(int n) {
    return '$n need follow-up';
  }

  @override
  String get shAllFollowed => 'All followed up';

  @override
  String get shUpcomingVisits => 'Upcoming visits';

  @override
  String shTodayN(int n) {
    return '$n today';
  }

  @override
  String get shActiveReservations => 'Active bookings';

  @override
  String shExpiringN(int n) {
    return '$n expiring soon';
  }

  @override
  String get shNoneExpiring => 'None expiring soon';

  @override
  String get shContractsMonth => 'Contracts this month';

  @override
  String shUnitsSoldN(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n units sold',
      one: '1 unit sold',
    );
    return '$_temp0';
  }

  @override
  String get shRealized => 'Sales value';

  @override
  String get shAvgDeal => 'Average deal';

  @override
  String get shAttention => 'Needs your attention';

  @override
  String shAttStale(int n) {
    return 'Leads with no follow-up for $n days';
  }

  @override
  String get shAttLapsing => 'Bookings ending this week';

  @override
  String get shAttUnconfirmed => 'Visits not confirmed yet';

  @override
  String get shFollowUps => 'Follow-ups';

  @override
  String get shAll => 'All';

  @override
  String get shOverdue => 'Overdue';

  @override
  String get shToday => 'Today';

  @override
  String get shUpcoming => 'Upcoming';

  @override
  String get shNoFollowUps => 'No follow-ups in this list.';

  @override
  String get shAgenda => 'This week';

  @override
  String get shAllAppointments => 'All appointments';

  @override
  String get shTagVisit => 'Visit';

  @override
  String get shTagExpiry => 'Booking ends';

  @override
  String get shConfirmed => 'Confirmed';

  @override
  String get shDayEmpty => 'Nothing on this day.';

  @override
  String shNextUp(String when) {
    return 'Next: $when';
  }

  @override
  String get shPipeline => 'Sales pipeline';

  @override
  String get shLeadsLink => 'Leads';

  @override
  String get shMillion => 'M';

  @override
  String get shThousand => 'K';

  @override
  String shWithRep(String name) {
    return 'With $name';
  }

  @override
  String get mhTeamGoal => 'The team\'s target this month';

  @override
  String get mhUnitsSold => 'Units sold';

  @override
  String mhUnitsN(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n units',
      one: '1 unit',
    );
    return '$_temp0';
  }

  @override
  String get mhActTargets => 'Team targets';

  @override
  String get mhActBonus => 'My earnings';

  @override
  String get mhFigures => 'Your team this month';

  @override
  String get mhActiveTeam => 'Active team';

  @override
  String get mhAllActive => 'Everyone is active';

  @override
  String mhInactiveN(int n) {
    return '$n inactive';
  }

  @override
  String get mhDecide => 'Needs your decision';

  @override
  String get mhPending => 'Bookings waiting for your approval';

  @override
  String get mhInactiveReps => 'Reps with no activity this month';

  @override
  String get mhLeaderboard => 'Team ranking';

  @override
  String get mhPerformance => 'Performance';

  @override
  String mhRankSub(int contracts, String pct) {
    String _temp0 = intl.Intl.pluralLogic(
      contracts,
      locale: localeName,
      other: '$contracts contracts',
      one: '1 contract',
    );
    return '$_temp0 · $pct of target';
  }

  @override
  String mhRankNoTarget(int contracts) {
    String _temp0 = intl.Intl.pluralLogic(
      contracts,
      locale: localeName,
      other: '$contracts contracts',
      one: '1 contract',
    );
    return '$_temp0 · no target';
  }

  @override
  String get mhTeamAgenda => 'The team\'s week';

  @override
  String get mhNoTeam => 'No reps in your team yet.';

  @override
  String get ahContractValue => 'Contracts value';

  @override
  String ahContractsN(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n contracts',
      one: '1 contract',
      zero: 'no contracts',
    );
    return '$_temp0';
  }

  @override
  String get ahCollectionRate => 'Collection rate';

  @override
  String get ahNothingDue => 'Nothing due';

  @override
  String get ahCollected => 'Collected';

  @override
  String get ahOverdue => 'Overdue';

  @override
  String get ahActPayment => 'Record payment';

  @override
  String get ahActReview => 'Review receipts';

  @override
  String get ahCompanyMonth => 'The company this month';

  @override
  String get ahCollectedMonth => 'Collected this month';

  @override
  String ahCollectedMonthUnit(String unit) {
    return 'Collected this month ($unit)';
  }

  @override
  String get ahSignedMonth => 'Contracts signed';

  @override
  String get ahNewLeads => 'New leads';

  @override
  String ahLastMonth(String v) {
    return 'Last month $v';
  }

  @override
  String get ahAvailableUnits => 'Available units';

  @override
  String ahOfN(int n) {
    return 'of $n';
  }

  @override
  String ahSoldReserved(int sold, int reserved) {
    return '$sold sold · $reserved reserved';
  }

  @override
  String get ahBrokerDue => 'Broker commissions';

  @override
  String get ahExpected30 => 'Expected collection';

  @override
  String get ahNeedsAction => 'Needs action';

  @override
  String get ahAttSign => 'Contracts awaiting signature';

  @override
  String get ahAttVisits => 'Visits awaiting confirmation';

  @override
  String get ahAttMaintenance => 'Open maintenance requests';

  @override
  String get ahAttInquiries => 'Unanswered inquiries';

  @override
  String get ahAttProofs => 'Receipts awaiting review';

  @override
  String get ahAttFollowUps => 'Overdue follow-ups';

  @override
  String get ahFunnel => 'Conversion funnel';

  @override
  String get ahFunnelLeads => 'Leads';

  @override
  String get ahFunnelVisits => 'Visits';

  @override
  String get ahFunnelReservations => 'Bookings';

  @override
  String get ahFunnelContracts => 'Contracts';

  @override
  String get ahTrend => 'Bookings in the last 6 months';

  @override
  String get ahTopSales => 'Top sales reps';

  @override
  String ahTopSalesSub(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n contracts this month',
      one: '1 contract this month',
      zero: 'no contracts this month',
    );
    return '$_temp0';
  }

  @override
  String get ahNoSales => 'No sales this month yet.';

  @override
  String get ahTopBrokers => 'Top brokers';

  @override
  String ahCommission(String v) {
    return 'commission $v';
  }

  @override
  String get ahNoBrokers => 'No broker sales yet.';

  @override
  String get ahActivity => 'Latest activity';

  @override
  String get ahNoActivity => 'No activity yet.';

  @override
  String get ahEvLead => 'New lead';

  @override
  String get ahEvReservation => 'New booking';

  @override
  String get ahEvContract => 'New contract';

  @override
  String get ahEvVisit => 'Visit request';

  @override
  String get ahEvMaintenance => 'Maintenance request';

  @override
  String get ahEvDeposit => 'New payment';

  @override
  String get ahEvInquiry => 'New inquiry';

  @override
  String get ahAgoNow => 'just now';

  @override
  String ahAgoMinutes(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n min ago',
      one: '1 min ago',
    );
    return '$_temp0';
  }

  @override
  String ahAgoHours(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n hours ago',
      one: '1 hour ago',
    );
    return '$_temp0';
  }

  @override
  String ahAgoDays(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n days ago',
      one: '1 day ago',
    );
    return '$_temp0';
  }

  @override
  String get ahBrokerDueSub => 'due to be paid';

  @override
  String get ahExpected30Sub => 'in the next 30 days';

  @override
  String get bhSalesVolume => 'Your sales';

  @override
  String get bhApprovalRate => 'Approval rate';

  @override
  String get bhMyCommissions => 'Your commissions';

  @override
  String get bhPaidOut => 'Paid out';

  @override
  String get bhActCommissions => 'Commissions';

  @override
  String get bhPerformance => 'Your performance';

  @override
  String get bhLeadsSent => 'Leads sent';

  @override
  String bhPendingN(int n) {
    return '$n under review';
  }

  @override
  String get bhNonePending => 'Nothing pending';

  @override
  String get bhSigned => 'Contracts signed';

  @override
  String bhOfReservations(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: 'of $n bookings',
      one: 'of 1 booking',
      zero: 'no bookings',
    );
    return '$_temp0';
  }

  @override
  String get bhPendingCommission => 'Pending commission';

  @override
  String bhPendingCommissionUnit(String unit) {
    return 'Pending commission ($unit)';
  }

  @override
  String bhCommissionsN(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n commissions',
      one: '1 commission',
      zero: 'no commissions',
    );
    return '$_temp0';
  }

  @override
  String get bhReservations => 'Bookings';

  @override
  String get bhUnitsForYou => 'Units for you';

  @override
  String bhInProjects(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: 'in $n projects',
      one: 'in 1 project',
      zero: 'no projects',
    );
    return '$_temp0';
  }

  @override
  String get bhPayoutRate => 'Payout rate';

  @override
  String bhPayoutsPaid(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n payouts paid',
      one: '1 payout paid',
      zero: 'no payouts yet',
    );
    return '$_temp0';
  }

  @override
  String get bhContractRate => 'Closing rate';

  @override
  String get bhOfBookings => 'of bookings';

  @override
  String get bhFollow => 'Needs your follow-up';

  @override
  String get bhAttLeads => 'Leads awaiting the company\'s approval';

  @override
  String get bhAttReservations => 'Bookings awaiting review';

  @override
  String get bhRecentLeads => 'Your latest leads';

  @override
  String get bhSentToday => 'Sent today';

  @override
  String get bhNoLeads => 'No leads sent yet.';

  @override
  String get bhFunnel => 'Your funnel';

  @override
  String get bhStSent => 'Sent';

  @override
  String get bhStApproved => 'Approved';

  @override
  String get bhStReservations => 'Bookings';

  @override
  String get bhStContracts => 'Contracts';

  @override
  String get bhStPayouts => 'Paid';

  @override
  String get bhProjects => 'Projects for you';

  @override
  String bhUnitsAvailable(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n units available',
      one: '1 unit available',
      zero: 'no units available',
    );
    return '$_temp0';
  }

  @override
  String get bhNoProjects => 'No projects for you yet.';

  @override
  String get bhCompanyLevel => 'Brokerage-wide';

  @override
  String get bhToday => 'Today';

  @override
  String get bhYesterday => 'Yesterday';

  @override
  String get bhNavClients => 'Leads';

  @override
  String get bhNavAccount => 'Account';

  @override
  String get bhEvLeadSubmitted => 'Lead sent';

  @override
  String get bhEvVisitRequested => 'Visit requested';

  @override
  String get bhEvLeadApproved => 'Lead approved';

  @override
  String get bhEvLeadRejected => 'Lead rejected';

  @override
  String get bhEvLeadDuplicate => 'Duplicate lead';

  @override
  String get bhEvReservationCreated => 'Booking created';

  @override
  String get bhEvContractCreated => 'Contract created';

  @override
  String get bhEvContractSigned => 'Contract signed';

  @override
  String get bhEvCommissionEarned => 'Commission earned';

  @override
  String get bhEvCommissionApproved => 'Commission approved';

  @override
  String get bhEvCommissionRejected => 'Commission rejected';

  @override
  String get bhEvCommissionCancelled => 'Commission cancelled';

  @override
  String get bhEvPayoutCreated => 'Payout created';

  @override
  String get bhEvPayoutApproved => 'Payout approved';

  @override
  String get bhEvPayoutProcessing => 'Payout in progress';

  @override
  String get bhEvPayoutPaid => 'Payout paid';

  @override
  String get bhEvPayoutCancelled => 'Payout cancelled';

  @override
  String lvCountN(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n leads',
      one: '1 lead',
      zero: 'no leads',
    );
    return '$_temp0';
  }

  @override
  String get lvTotal => 'Total';

  @override
  String lvOpenN(int n) {
    return '$n open';
  }

  @override
  String get lvConversion => 'Conversion';

  @override
  String lvWonN(int n) {
    return '$n won';
  }

  @override
  String get lvUnassigned => 'Unassigned';

  @override
  String get lvUnassignedHint => 'Waiting to be assigned';

  @override
  String get lvOverdue => 'Overdue follow-ups';

  @override
  String get lvOverdueNone => 'All on time';

  @override
  String get lvOverdueSome => 'Need a contact';

  @override
  String get lvAll => 'All';

  @override
  String lvInStage(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: 'in stage $n days',
      one: 'in stage 1 day',
      zero: 'in stage since today',
    );
    return '$_temp0';
  }

  @override
  String lvVisit(String when) {
    return 'Visit $when';
  }

  @override
  String lvLastContact(String when) {
    return 'Last contact $when';
  }

  @override
  String get lvNoContact => 'Not contacted yet';

  @override
  String lvFollowOverdue(String when) {
    return 'Overdue follow-up · $when';
  }

  @override
  String lvFollowToday(String when) {
    return 'Follow-up today · $when';
  }

  @override
  String lvFollowNext(String when) {
    return 'Follow-up $when';
  }

  @override
  String get lvToday => 'today';

  @override
  String get lvTomorrow => 'tomorrow';

  @override
  String get lvYesterday => 'yesterday';

  @override
  String get lvBroker => 'Broker';

  @override
  String get lvDirect => 'Direct';

  @override
  String get lvRep => 'Sales rep';

  @override
  String get lvAllReps => 'All reps';

  @override
  String lvRepChip(String name) {
    return 'Rep: $name';
  }

  @override
  String get lvMine => 'Mine only';

  @override
  String get lvFilters => 'Filters';

  @override
  String get lvNoPhone => 'This lead has no phone number.';

  @override
  String get ldCall => 'Call';

  @override
  String get ldWhatsApp => 'WhatsApp';

  @override
  String get ldEmail => 'Email';

  @override
  String get ldStateOverdue => 'Overdue';

  @override
  String get ldStateToday => 'Today';

  @override
  String get ldStateUpcoming => 'Upcoming';

  @override
  String get ldFollowLog => 'Follow-up log';

  @override
  String get ldNoNotes => 'No contact logged yet.';

  @override
  String get ldVisitsBookings => 'Visits and bookings';

  @override
  String get ldVisitRequest => 'Visit request';

  @override
  String get ldAppointment => 'Visit';

  @override
  String get ldReservation => 'Booking';

  @override
  String ldExpires(String date) {
    return 'Expires $date';
  }

  @override
  String get ldActivityLog => 'Activity';

  @override
  String get ldAssignment => 'Assignment';

  @override
  String get ldReassign => 'Change rep';

  @override
  String get ldAssign => 'Assign';

  @override
  String get ldAssignTo => 'Assign the lead to';

  @override
  String get ldClient => 'Client';

  @override
  String get ldOwner => 'Unit owner';

  @override
  String get ldBrowser => 'Browsing client';

  @override
  String get ldClientProfile => 'Client profile';

  @override
  String get ldOpportunity => 'Lead details';

  @override
  String get ldProject => 'Project';

  @override
  String get ldUnit => 'Unit';

  @override
  String get ldSource => 'Source';

  @override
  String get ldBrokerLbl => 'Broker';

  @override
  String get ldBrokerAgent => 'Broker agent';

  @override
  String get ldCampaign => 'Campaign';

  @override
  String get ldCreated => 'Added on';

  @override
  String get ldLeadId => 'Lead ID';

  @override
  String get ldAds => 'Ad attribution';

  @override
  String ldLostOn(String date) {
    return 'Lost on $date';
  }

  @override
  String get ldNoReason => 'No reason given';

  @override
  String get ldActCreated => 'Lead created';

  @override
  String get ldActAssigned => 'Lead assigned';

  @override
  String ldActStage(String from, String to) {
    return 'Moved from \"$from\" to \"$to\"';
  }

  @override
  String get ldActConverted => 'Reservation converted to a contract';

  @override
  String get ldActResCreated => 'Booking created';

  @override
  String get ldActResApproved => 'Booking approved';

  @override
  String get ldActResRejected => 'Booking rejected';

  @override
  String get ldActResCancelled => 'Booking cancelled';

  @override
  String get ldActResExpired => 'Booking expired';

  @override
  String get ldActResOther => 'Booking updated';

  @override
  String get ldActVisitScheduled => 'Visit scheduled';

  @override
  String get ldActVisitConfirmed => 'Visit confirmed';

  @override
  String get ldActVisitPending => 'Customer asked to reschedule';

  @override
  String get ldActVisitRescheduled => 'Visit rescheduled';

  @override
  String get ldActVisitCompleted => 'Visit done';

  @override
  String get ldActVisitCancelled => 'Visit cancelled';

  @override
  String get ldActVisitNoShow => 'Customer did not show up';

  @override
  String get ldActVisitOther => 'Visit updated';

  @override
  String get ldActNote => 'Note added';

  @override
  String get ldActBrokerSubmitted => 'Lead submitted by broker';

  @override
  String get ldActBrokerApproved => 'Broker lead approved';

  @override
  String get ldActBrokerRejected => 'Broker lead rejected';

  @override
  String get ldActBrokerDuplicate => 'Broker lead marked duplicate';

  @override
  String get ldActBrokerNote => 'Note from the broker';

  @override
  String get ldActBrokerReservation => 'Booking by the broker';

  @override
  String get ldActBrokerContract => 'Contract from the broker\'s lead';

  @override
  String get ldActBrokerCommission => 'Broker commission earned';

  @override
  String get ldActBrokerVisit => 'Broker requested a visit';

  @override
  String get ldActReturned => 'The customer came in again (ad / form)';

  @override
  String get ldActRelinked => 'Linked to another record';

  @override
  String get ldActCall => 'Customer called';

  @override
  String get ldActWhatsApp => 'WhatsApp chat opened';

  @override
  String ldActMerged(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n duplicate leads were merged into this one',
      one: 'A duplicate lead was merged into this one',
    );
    return '$_temp0';
  }

  @override
  String get ldActOther => 'Lead updated';

  @override
  String get ldNoActivity => 'No activity yet.';

  @override
  String get ldReqNew => 'New';

  @override
  String get ldReqReview => 'Under review';

  @override
  String get ldReqConverted => 'Became a visit';

  @override
  String get ldReqRejected => 'Rejected';

  @override
  String get ldReqCancelled => 'Cancelled';

  @override
  String get ldWonByBooking =>
      'A lead is won when its booking becomes a contract.';

  @override
  String blApprovedN(int n) {
    return '$n approved';
  }

  @override
  String get blWaitingCompany => 'Waiting for the company';

  @override
  String get blNoneRejected => 'None';

  @override
  String get blSeeReason => 'See why';

  @override
  String get blStage => 'Stage';

  @override
  String get blAnyUnit => 'Any unit';

  @override
  String blRep(String name) {
    return 'Rep: $name';
  }

  @override
  String blSent(String date) {
    return 'Sent $date';
  }

  @override
  String get blRejectionReason => 'Why it was rejected';

  @override
  String get blInterest => 'Interest';

  @override
  String get blTrack => 'Request status';

  @override
  String get blStepSent => 'Sent to the company';

  @override
  String get blStepReview => 'Under review';

  @override
  String get blStepApproved => 'Approved by the company';

  @override
  String get blStepRejected => 'Rejected by the company';

  @override
  String get blStepDuplicate => 'Already registered with the company';

  @override
  String get blStepExpired => 'The request expired';

  @override
  String get blVisits => 'Visits';

  @override
  String get blNoVisits => 'No visits yet.';

  @override
  String get blRepFollows => 'Following rep';

  @override
  String get blNoRep => 'Not assigned yet';

  @override
  String cpCountN(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n projects',
      one: '1 project',
      zero: 'No projects',
    );
    return '$_temp0';
  }

  @override
  String get cpSearchHint => 'Search projects';

  @override
  String get cpProjects => 'Projects';

  @override
  String cpPublishedN(int n) {
    return '$n published';
  }

  @override
  String get cpAvailableUnits => 'Available units';

  @override
  String cpOfUnitsN(int n) {
    return 'of $n units';
  }

  @override
  String cpInventoryIn(String unit) {
    return 'Inventory value ($unit)';
  }

  @override
  String get cpInventory => 'Inventory value';

  @override
  String cpSoldReserved(int sold, int reserved) {
    return '$sold sold · $reserved reserved';
  }

  @override
  String get cpFeatured => 'Featured';

  @override
  String get cpFrom => 'From';

  @override
  String cpContractValueN(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: 'Contract value · $n contracts',
      one: 'Contract value · 1 contract',
      zero: 'Contract value',
    );
    return '$_temp0';
  }

  @override
  String get cpNoUnits => 'No units yet';

  @override
  String get cpEmpty => 'No projects';

  @override
  String get cpEmptyMessage =>
      'No projects have been added for this company yet.';

  @override
  String get cpNoMatch => 'No projects match this choice';

  @override
  String get cpTypeResidential => 'Residential compound';

  @override
  String get cpTypeCoastal => 'Coastal';

  @override
  String get cpTypeAdministrative => 'Administrative';

  @override
  String get cpTypeCommercial => 'Commercial';

  @override
  String get cpTypeMedical => 'Medical';

  @override
  String get cpTypeMixedUse => 'Mixed use';

  @override
  String cuCountN(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n units',
      one: '1 unit',
      zero: 'No units',
    );
    return '$_temp0';
  }

  @override
  String get cuSearchHint => 'Search by unit code';

  @override
  String cuReservedN(int n) {
    return '$n reserved';
  }

  @override
  String get cuAllProjects => 'All projects';

  @override
  String get cuRooms => 'Rooms';

  @override
  String get cuPrice => 'Price';

  @override
  String cuRoomsN(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n rooms',
      one: '1 room',
      zero: 'No rooms',
    );
    return '$_temp0';
  }

  @override
  String cuFloorN(String n) {
    return 'Floor $n';
  }

  @override
  String get cuGroundFloor => 'Ground floor';

  @override
  String cuReservedUntil(String date) {
    return 'Reserved until $date';
  }

  @override
  String get cuEmpty => 'No units';

  @override
  String get cuEmptyMessage => 'No units have been added for this company yet.';

  @override
  String get cuNoMatch => 'No units match this choice';

  @override
  String get cuFilters => 'Filter units';

  @override
  String get cuProject => 'Project';

  @override
  String get cuPriceFrom => 'From';

  @override
  String get cuPriceTo => 'To';

  @override
  String get cuApply => 'Apply';

  @override
  String get cuClear => 'Clear all';

  @override
  String get cuAny => 'All';

  @override
  String get cuAllUnits => 'All units';

  @override
  String get cuProfileDesc => 'Every unit, with its status and price';

  @override
  String get ppOccupancy => 'Occupancy';

  @override
  String ppTakenOf(int taken, int total) {
    return '$taken of $total units reserved or sold';
  }

  @override
  String get ppUnits => 'Units';

  @override
  String ppAvailableN(int n) {
    return '$n available';
  }

  @override
  String ppSoldN(int n) {
    return '$n sold';
  }

  @override
  String get ppPhases => 'Phases';

  @override
  String ppDeliveryYear(String year) {
    return 'Delivery $year';
  }

  @override
  String get ppNoDelivery => 'No delivery date';

  @override
  String get ppBuildings => 'Buildings';

  @override
  String ppFloorsN(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n floors',
      one: '1 floor',
      zero: 'No floors',
    );
    return '$_temp0';
  }

  @override
  String ppBuildingsN(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n buildings',
      one: '1 building',
      zero: 'No buildings',
    );
    return '$_temp0';
  }

  @override
  String get ppType => 'Type';

  @override
  String get ppTotalArea => 'Total area';

  @override
  String get ppLicense => 'License number';

  @override
  String get ppPhasesBuildings => 'Phases and buildings';

  @override
  String ppDelivery(String date) {
    return 'Delivery $date';
  }

  @override
  String get ppFreeUnits => 'Available units';

  @override
  String get ppNoFree => 'No units are available now.';

  @override
  String get ppNoDescription => 'No description for this project yet.';

  @override
  String get ppNoPhases => 'No phases have been added to this project yet.';

  @override
  String ppPhotoOf(int i, int n) {
    return '$i / $n';
  }

  @override
  String get upSpecs => 'Specifications';

  @override
  String get upCode => 'Code';

  @override
  String get upReservation => 'Reservation';

  @override
  String get upActiveReservation => 'Active reservation';

  @override
  String get upClient => 'Client';

  @override
  String get upSales => 'Consultant';

  @override
  String get upExpires => 'Expires';

  @override
  String get upNoReservation =>
      'The unit is available with no reservation on it.';

  @override
  String get upNoActive => 'No active reservation on the unit.';

  @override
  String upPastN(int n) {
    return 'Past reservations · $n';
  }

  @override
  String get upAllReservations => 'All reservations';

  @override
  String get upProject => 'Project';

  @override
  String get upPhase => 'Phase';

  @override
  String get upBuilding => 'Building';

  @override
  String get upUpdated => 'Last updated';

  @override
  String get upHistory => 'Status history';

  @override
  String upHistoryLine(String from, String to) {
    return 'From $from → $to';
  }

  @override
  String upBy(String name) {
    return 'By $name';
  }

  @override
  String get upMaintenance => 'Maintenance and warranty';

  @override
  String upWarrantyUntil(String date) {
    return 'Warranty until $date';
  }

  @override
  String get upPerMeter => 'Price per m²';

  @override
  String upReservedUntil(String date) {
    return 'The unit is reserved until $date.';
  }

  @override
  String get upReservedNoDate => 'The unit is reserved.';

  @override
  String get upSoldNote => 'The unit is sold.';

  @override
  String get bcSearchHint => 'Search by project or city';

  @override
  String get bcReady => 'Ready to market';

  @override
  String get bcReadyOne => 'Ready to market';

  @override
  String get bcPaused => 'Paused';

  @override
  String get bcAllActive => 'All active';

  @override
  String bcPausedN(int n) {
    return '$n paused';
  }

  @override
  String get bcAvailableForYou => 'Units open to you';

  @override
  String get bcAvailableShort => 'Open to you';

  @override
  String bcInProjectsN(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: 'in $n projects',
      one: 'in 1 project',
      zero: 'in no project',
    );
    return '$_temp0';
  }

  @override
  String get bcCommission => 'Your commission';

  @override
  String get bcDefault => 'default';

  @override
  String get bcBrowseUnits => 'Browse units';

  @override
  String get bcAccessProject => 'Project access';

  @override
  String get bcAccessUnit => 'Unit access';

  @override
  String get bcYourAccess => 'Your access';

  @override
  String get bcNoEnd => 'No end date';

  @override
  String bcUntil(String date) {
    return 'Until $date';
  }

  @override
  String get bcReserve => 'Book';

  @override
  String get bcFreeForYou => 'Units open to you';

  @override
  String get bcNotBookable => 'Not bookable now';

  @override
  String get bcEmpty => 'No projects yet';

  @override
  String get bcEmptyMessage =>
      'Once you are given access to a project, it shows here.';

  @override
  String get bcUnitsEmptyMessage =>
      'Try other filters, or ask the company to widen your access.';

  @override
  String kcCountN(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n contracts',
      one: '1 contract',
      zero: 'No contracts',
    );
    return '$_temp0';
  }

  @override
  String get kcSearchHint => 'Search by client or contract number';

  @override
  String get kcContracts => 'Contracts';

  @override
  String get kcSigned => 'Signed';

  @override
  String get kcSignedOne => 'Signed';

  @override
  String get kcUnsigned => 'Awaiting signature';

  @override
  String get kcDelayed => 'Delivery late';

  @override
  String kcSignedPct(String pct) {
    return '$pct of them';
  }

  @override
  String get kcNeedsFollow => 'Need follow-up';

  @override
  String get kcAllSigned => 'All signed';

  @override
  String get kcFromReservations => 'Booked + manual';

  @override
  String kcFromReservation(String n) {
    return 'From booking $n';
  }

  @override
  String get kcManual => 'Manual contract';

  @override
  String get kcCancelled => 'Cancelled';

  @override
  String get kcValue => 'Contract value';

  @override
  String get kcPlan => 'Payment plan';

  @override
  String kcPlanLine(int months, String monthly) {
    return '$months months · $monthly';
  }

  @override
  String get kcNoPlan => 'No instalment plan';

  @override
  String kcDown(String amount) {
    return 'Down $amount';
  }

  @override
  String get kcSource => 'Source';

  @override
  String get kcSourceAll => 'All sources';

  @override
  String get kcFilters => 'Filter contracts';

  @override
  String get kcEmpty => 'No contracts';

  @override
  String get kcEmptyMessage =>
      'Contracts show here once bookings are converted.';

  @override
  String get kcNoMatch => 'No contracts match this choice';

  @override
  String kcSignedOn(String date) {
    return 'Signed · $date';
  }

  @override
  String kcCollected(String amount, String pct) {
    return 'Collected $amount · $pct';
  }

  @override
  String get kcRemaining => 'Remaining';

  @override
  String get kcOverdue => 'Overdue';

  @override
  String get kcNoOverdue => 'None';

  @override
  String kcOverdueN(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n instalments late',
      one: '1 instalment late',
    );
    return '$_temp0';
  }

  @override
  String kcPlusFees(String amount) {
    return '+ fees $amount';
  }

  @override
  String get kcTabOverview => 'Overview';

  @override
  String get kcTabInstallments => 'Instalments';

  @override
  String get kcTabStatement => 'Statement';

  @override
  String get kcTabPayments => 'Payments';

  @override
  String get kcData => 'Contract details';

  @override
  String get kcSignedAt => 'Signed on';

  @override
  String get kcNotSigned => 'Not signed yet';

  @override
  String get kcDelivery => 'Expected delivery';

  @override
  String kcDelayDays(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n days late',
      one: '1 day late',
    );
    return '$_temp0';
  }

  @override
  String get kcInstallment => 'Instalment';

  @override
  String get kcStarts => 'Starts';

  @override
  String kcPlanMonthlyN(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n instalments',
      one: '1 instalment',
    );
    return '$_temp0';
  }

  @override
  String get kcParties => 'Parties';

  @override
  String get kcClient => 'Client';

  @override
  String get kcSales => 'Consultant';

  @override
  String get kcBroker => 'Broker';

  @override
  String get kcNextInstallments => 'Next instalments';

  @override
  String kcAllInstallmentsN(int n) {
    return 'All instalments · $n';
  }

  @override
  String get kcDownPayment => 'Down payment';

  @override
  String kcInstallmentNOf(int i, int n) {
    return 'Instalment $i of $n';
  }

  @override
  String get kcPaid => 'Paid';

  @override
  String get kcDue => 'Due';

  @override
  String get kcLate => 'Late';

  @override
  String get kcUpcoming => 'Upcoming';

  @override
  String get kcAwaiting => 'Awaiting review';

  @override
  String get kcStatement => 'Statement';

  @override
  String get kcFullStatement => 'Full statement';

  @override
  String get kcStPaid => 'Paid';

  @override
  String get kcStBalance => 'Balance';

  @override
  String get kcStOverdue => 'Overdue';

  @override
  String get kcStUpcoming => 'Upcoming';

  @override
  String get kcStFees => 'Fees';

  @override
  String get kcLineContract => 'Contract value';

  @override
  String get kcLinePayment => 'Payment';

  @override
  String get kcLineBooking => 'Booking payment';

  @override
  String get kcLineFee => 'Fee';

  @override
  String get kcLineRefund => 'Refund';

  @override
  String get kcPayments => 'Payments';

  @override
  String get kcNoPayments => 'No payments recorded yet.';

  @override
  String get kcDocuments => 'Documents';

  @override
  String get kcContractPdf => 'Sale contract';

  @override
  String get kcAllDocuments => 'All contract documents';

  @override
  String get kcRecordPayment => 'Record a payment';

  @override
  String get kcNoInstallments => 'No instalments for this contract.';

  @override
  String get kcFromReservationShort => 'From a reservation';

  @override
  String get kcStatus => 'Status';

  @override
  String fsActiveN(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n filters on',
      one: '1 filter on',
      zero: 'No filters',
    );
    return '$_temp0';
  }

  @override
  String get fsClear => 'Clear';

  @override
  String get fsNone => 'None';

  @override
  String get fsAvailableHint => 'Available in each';

  @override
  String fsPriceUnder(String amount) {
    return 'Under $amount';
  }

  @override
  String fsPriceBetween(String from, String to) {
    return '$from – $to';
  }

  @override
  String fsPriceOver(String amount) {
    return 'Over $amount';
  }

  @override
  String fsMillion(String n) {
    return '${n}M';
  }

  @override
  String get fsNoLimit => 'No limit';

  @override
  String kcShowN(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: 'Show $n contracts',
      one: 'Show 1 contract',
      zero: 'No contracts',
    );
    return '$_temp0';
  }

  @override
  String cuShowN(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: 'Show $n units',
      one: 'Show 1 unit',
      zero: 'No units',
    );
    return '$_temp0';
  }

  @override
  String get cuBedrooms => 'Bedrooms';

  @override
  String get cvTitle => 'Convert to contract';

  @override
  String cvReservationN(String n) {
    return 'Booking $n';
  }

  @override
  String get cvClient => 'Client';

  @override
  String get cvUnit => 'Unit';

  @override
  String get cvProject => 'Project';

  @override
  String get cvSales => 'Consultant';

  @override
  String get cvBooking => 'Booking';

  @override
  String get cvApproved => 'Approved';

  @override
  String get cvUnpaidWarn =>
      'The booking amount is not recorded as paid yet. Record it first, then convert the booking.';

  @override
  String get cvSnapshotMissing =>
      'This booking has no saved instalment term, so it cannot be converted. Choose the term first.';

  @override
  String get cvPlan => 'Plan from the booking';

  @override
  String get cvDown => 'Down payment';

  @override
  String get cvTerm => 'Term';

  @override
  String cvMonthsN(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n months',
      one: '1 month',
      zero: 'One payment',
    );
    return '$_temp0';
  }

  @override
  String get cvMonthly => 'Monthly';

  @override
  String get cvTotal => 'Total';

  @override
  String get cvData => 'Contract details';

  @override
  String get cvStarts => 'Instalments start';

  @override
  String get cvSignedAt => 'Signing date (optional)';

  @override
  String get cvNotSigned => 'Not signed yet';

  @override
  String get cvDocument => 'Contract document (optional)';

  @override
  String get cvAttach => 'Attach a PDF';

  @override
  String get cvCancel => 'Cancel';

  @override
  String get cvConfirm => 'Confirm conversion';

  @override
  String get cvSignFailed =>
      'The contract was created but signing failed. Sign it from the website.';

  @override
  String get cvConvertSub => 'Creates a contract with the booking’s saved plan';

  @override
  String get cvUploadFailed => 'The document could not be uploaded. Try again.';

  @override
  String get cvRemoveFile => 'Remove file';

  @override
  String get mcTitle => 'Manual contract';

  @override
  String get mcSub => 'A new contract without a booking';

  @override
  String get mcParties => 'Client and unit';

  @override
  String get mcPickClient => 'Choose the client';

  @override
  String get mcSearchClient => 'Search by name or phone';

  @override
  String get mcPickUnit => 'Choose an available unit';

  @override
  String get mcSearchUnit => 'Search by unit code';

  @override
  String get mcUnitHint => 'Only available units are shown';

  @override
  String get mcAmounts => 'Amounts';

  @override
  String get mcTotal => 'Contract value';

  @override
  String get mcDown => 'Down payment (optional)';

  @override
  String get mcPreSystem => 'Signed before the system';

  @override
  String get mcPreSystemHint =>
      'Recorded with its real signing date, with no notifications, broker commission or sales bonus.';

  @override
  String get mcSignedAtRequired => 'Signing date';

  @override
  String get mcNumber => 'Contract number (optional)';

  @override
  String get mcNumberHint => 'Leave empty to number it automatically';

  @override
  String get mcCreate => 'Create contract';

  @override
  String get mcNoResults => 'No results';

  @override
  String get mcRequired => 'Required';

  @override
  String get mcSignedRequired =>
      'A signing date is required for a contract signed before the system';

  @override
  String get mcDownTooBig => 'The down payment is more than the contract value';

  @override
  String get mcPlanLater =>
      'After creating it, add the instalment plan from the website.';

  @override
  String get kbFromClients => 'From your clients';

  @override
  String get kbValueM => 'Value (million)';

  @override
  String get kbYourCommission => 'Your commission';

  @override
  String kbYourCommissionPct(String pct) {
    return 'Your commission $pct';
  }

  @override
  String get kbCommissionStatus => 'Status';

  @override
  String get kbNet => 'Net';

  @override
  String get kbClient => 'Client';

  @override
  String get kbUnitProject => 'Unit and project';

  @override
  String get kbType => 'Type';

  @override
  String get kbArea => 'Area';

  @override
  String kbAreaM(String n) {
    return '$n m²';
  }

  @override
  String get kbBuilding => 'Building';

  @override
  String get kbDelivery => 'Handover';

  @override
  String get kbPlan => 'Payment plan';

  @override
  String get kbPayments => 'Recorded payments';

  @override
  String get kbEmpty => 'No contracts yet';

  @override
  String get kbEmptyMessage =>
      'Contracts of the clients you brought appear here once their bookings are converted.';

  @override
  String rvCountN(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n bookings',
      one: '1 booking',
      zero: 'No bookings',
    );
    return '$_temp0';
  }

  @override
  String get rvSearchHint => 'Search by client, booking number or unit';

  @override
  String get rvActive => 'Active';

  @override
  String rvOutOf(String what) {
    return 'of $what';
  }

  @override
  String get rvNeedsDecision => 'Need your decision';

  @override
  String get rvUnderReview => 'Under review';

  @override
  String get rvAwaitingPayment => 'Awaiting booking amount';

  @override
  String get rvApprovedHint => 'Approved';

  @override
  String get rvPillPending => 'Under review';

  @override
  String get rvPillApproved => 'Approved';

  @override
  String get rvPillConverted => 'Converted';

  @override
  String get rvPillClosed => 'Rejected & cancelled';

  @override
  String get rvStPending => 'Under review';

  @override
  String get rvStApproved => 'Approved';

  @override
  String get rvStConverted => 'Converted';

  @override
  String get rvStRejected => 'Rejected';

  @override
  String get rvStCancelled => 'Cancelled';

  @override
  String get rvStExpired => 'Expired';

  @override
  String get rvBooking => 'Booking amount';

  @override
  String get rvPaid => 'Paid';

  @override
  String get rvUnpaid => 'Unpaid';

  @override
  String get rvWaived => 'Waived';

  @override
  String get rvByBroker => 'Via a broker';

  @override
  String rvExpiresInN(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: 'Ends in $n days',
      one: 'Ends tomorrow',
      zero: 'Ends today',
    );
    return '$_temp0';
  }

  @override
  String rvExpiredOn(String date) {
    return 'Lapsed $date';
  }

  @override
  String rvCreatedOn(String date) {
    return 'Created $date';
  }

  @override
  String get rvUnpaidWarn => 'Booking amount not paid yet';

  @override
  String rvExpiresOn(String date) {
    return 'Ends $date';
  }

  @override
  String get rvReady => 'Ready to convert';

  @override
  String get rvConvert => 'Convert';

  @override
  String rvConvertedOn(String date) {
    return 'Converted · $date';
  }

  @override
  String get rvOpenContract => 'Open the contract';

  @override
  String rvReasonLine(String reason) {
    return 'Reason: $reason';
  }

  @override
  String get rvJCreated => 'Created';

  @override
  String get rvJBooking => 'Booking';

  @override
  String get rvJApproved => 'Approval';

  @override
  String get rvJContract => 'Contract';

  @override
  String get rvJRejected => 'Rejected';

  @override
  String get rvJCancelled => 'Cancelled';

  @override
  String get rvJExpired => 'Lapsed';

  @override
  String get rvNextStep => 'Next step';

  @override
  String rvPaidOn(String date) {
    return 'Paid $date';
  }

  @override
  String get rvPlanName => 'Plan';

  @override
  String get rvUnitPrice => 'Unit price';

  @override
  String rvContractN(String n) {
    return 'Contract $n';
  }

  @override
  String get rvHistory => 'History';

  @override
  String get rvCancel => 'Cancel booking';

  @override
  String get rvCancelReason => 'Reason for cancelling';

  @override
  String get rvRecordPayment => 'Record booking amount';

  @override
  String get rvPayDate => 'Paid on';

  @override
  String get rvPayMethod => 'Method';

  @override
  String get rvConfirm => 'Confirm';

  @override
  String get rvKeep => 'Back';

  @override
  String get rvApprovedMsg => 'Booking approved';

  @override
  String get rvRejectedMsg => 'Booking rejected';

  @override
  String get rvCancelledMsg => 'Booking cancelled';

  @override
  String get rvPaidMsg => 'Booking amount recorded';

  @override
  String get rvNoteAdded => 'Note added';

  @override
  String get rvFilters => 'Filter bookings';

  @override
  String rvShowN(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: 'Show $n bookings',
      one: 'Show 1 booking',
      zero: 'No bookings',
    );
    return '$_temp0';
  }

  @override
  String get rvConsultant => 'Consultant';

  @override
  String get rvAllConsultants => 'All consultants';

  @override
  String get rvEmpty => 'No bookings yet';

  @override
  String get rvEmptyMessage => 'Bookings appear here once they are made.';

  @override
  String get rvNew => 'New booking';

  @override
  String get rnSub => 'Goes for review once saved';

  @override
  String get rnStepClient => 'Client';

  @override
  String get rnStepUnit => 'Unit';

  @override
  String get rnStepPlan => 'Plan';

  @override
  String get rnStepBooking => 'Booking';

  @override
  String get rnChange => 'Change';

  @override
  String get rnPickClient => 'Choose the client';

  @override
  String get rnSearchClient => 'Search by name or phone';

  @override
  String get rnPickProject => 'Choose the project';

  @override
  String get rnPickUnit => 'Choose the unit';

  @override
  String get rnSearchUnit => 'Search by unit code';

  @override
  String get rnNoUnitsFree => 'No units available';

  @override
  String get rnUnitFixed => 'Unit chosen';

  @override
  String get rnNoPlan => 'No plan';

  @override
  String get rnNoPlanSub => 'Priced without a payment plan';

  @override
  String get rnCashSub => 'One payment';

  @override
  String rnTermsSub(String months) {
    return '$months months';
  }

  @override
  String rnPlanDown(String pct) {
    return '$pct down';
  }

  @override
  String rnPerMonthFrom(String amount) {
    return 'From $amount a month';
  }

  @override
  String get rnPlansHint => 'Plans available for this unit';

  @override
  String get rnPickUnitFirst => 'Choose the unit first to see its plans';

  @override
  String get rnSummary => 'Booking summary';

  @override
  String get rnSumPrice => 'Unit price';

  @override
  String get rnSumBooking => 'Booking amount';

  @override
  String get rnSumDown => 'Down payment';

  @override
  String get rnSumMonthly => 'Monthly instalment';

  @override
  String get rnBookingFromPlan => 'From the plan';

  @override
  String get rnMonthlyShort => 'a month';

  @override
  String get rnExp24 => '1 day';

  @override
  String get rnExp72 => '3 days';

  @override
  String get rnExp168 => '1 week';

  @override
  String get rnExp336 => '2 weeks';

  @override
  String get rnModePlanSub => 'Worked out from the chosen plan';

  @override
  String get rnModeFixedSub => 'You enter the amount';

  @override
  String get rnModePercentSub => 'A share of the unit price';

  @override
  String rnHoldUntil(String date) {
    return 'Ends $date unless reviewed';
  }

  @override
  String get rnHoldLabel => 'Hold the booking for';

  @override
  String get rbFromClients => 'From your clients';

  @override
  String get rbConvertedHint => 'Became contracts';

  @override
  String get rbAll => 'All';

  @override
  String get rbCommission => 'Your commission';

  @override
  String get rbCommissionTotalHint => 'Your total commission';

  @override
  String rbCommissionPct(String pct) {
    return 'Your commission $pct';
  }

  @override
  String get rbEmpty => 'No bookings yet';

  @override
  String get rbEmptyMessage =>
      'Request a booking for your client from the projects tab or the client\'s page.';

  @override
  String get rbSearchHint => 'Search by client or booking number';

  @override
  String get rbOpenContract => 'Open the contract';

  @override
  String pmCountN(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n payments',
      one: '1 payment',
      zero: 'No payments',
    );
    return '$_temp0';
  }

  @override
  String get pmSearchHint => 'Search by client, contract or unit';

  @override
  String get pmCollected => 'Collected';

  @override
  String pmCollectedHint(int n) {
    return 'from $n payments';
  }

  @override
  String get pmNeedReview => 'Need your review';

  @override
  String get pmNeedReviewHint => 'Client proofs';

  @override
  String get pmChequesWaiting => 'Uncleared cheques';

  @override
  String get pmChequesHint => 'Tap to open';

  @override
  String get pmPillReview => 'Under review';

  @override
  String get pmPillCheque => 'Cheques';

  @override
  String get pmPillCollected => 'Collected';

  @override
  String get pmPillClosed => 'Rejected / bounced';

  @override
  String get pmEmpty => 'No payments';

  @override
  String get pmEmptyMessage =>
      'Payments appear here when recorded or when clients send proofs.';

  @override
  String get pmNoMatch => 'No payments match';

  @override
  String get pmMethodCash => 'Cash';

  @override
  String get pmMethodBank => 'Bank transfer';

  @override
  String get pmMethodCheque => 'Cheque';

  @override
  String pmChequeN(String no) {
    return 'Cheque $no';
  }

  @override
  String pmDueOn(String date) {
    return 'Due $date';
  }

  @override
  String pmPaidOn(String date) {
    return 'Paid $date';
  }

  @override
  String get pmProofAttached => 'Proof attached';

  @override
  String get pmViewProof => 'View proof';

  @override
  String get pmOpenCheque => 'Open the cheque';

  @override
  String pmReasonLine(String reason) {
    return 'Reason: $reason';
  }

  @override
  String get pmNotCounted =>
      'Not counted in the balance until the cheque clears.';

  @override
  String get pmStRecorded => 'Recorded';

  @override
  String get pmStReview => 'Review';

  @override
  String get pmStCleared => 'Clearing';

  @override
  String get pmStCollected => 'Collected';

  @override
  String get pmNow => 'Now';

  @override
  String get pmCheque => 'The cheque';

  @override
  String get pmChequeNo => 'Cheque number';

  @override
  String get pmChequeState => 'Cheque status';

  @override
  String get pmOpenChequePage => 'Open the cheque page';

  @override
  String get pmContractInstallment => 'Contract and instalment';

  @override
  String get pmContract => 'Contract';

  @override
  String get pmClient => 'Client';

  @override
  String get pmInstallmentDue => 'Instalment due';

  @override
  String get pmInstallmentAmount => 'Instalment amount';

  @override
  String get pmBooking => 'Booking';

  @override
  String pmReversedNote(String by) {
    return 'This payment was reversed$by';
  }

  @override
  String get pmDecisionTitleApprove => 'Approve this payment?';

  @override
  String get pmDecisionApproveBody =>
      'The amount will count towards the instalment.';

  @override
  String ntUnreadN(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n unread',
      one: '1 unread',
      zero: 'No unread',
    );
    return '$_temp0';
  }

  @override
  String get ntAllRead => 'All caught up';

  @override
  String get ntAll => 'All';

  @override
  String get ntUnread => 'Unread';

  @override
  String get ntFinance => 'Finance';

  @override
  String get ntSales => 'Sales';

  @override
  String get ntToday => 'Today';

  @override
  String get ntYesterday => 'Yesterday';

  @override
  String get ntNoMatch => 'No notifications match';

  @override
  String get ntSend => 'Send a notification';

  @override
  String get ntPrefs => 'Notification preferences';

  @override
  String get npHint =>
      'In-app notifications always arrive. Choose which also reach you by e-mail or on your phone.';

  @override
  String get npEmail => 'E-mail';

  @override
  String get npEmailHint => 'A summary with details';

  @override
  String get npPush => 'Phone notification';

  @override
  String get npPushHint => 'Reaches you at once';

  @override
  String get npSaveError => 'Could not save the change. Please try again.';

  @override
  String get npGroupSales => 'Sales';

  @override
  String get npGroupSalesHint => 'Leads · visits · bookings · contracts';

  @override
  String get npGroupFinance => 'Finance';

  @override
  String get npGroupFinanceHint => 'Instalments · payments · cheques · bonuses';

  @override
  String get npGroupMaintenance => 'Maintenance';

  @override
  String get npGroupMaintenanceHint => 'Maintenance and warranty requests';

  @override
  String get npGroupAccount => 'Account and team';

  @override
  String get npGroupAccountHint => 'Security · subscription · team';

  @override
  String get bcTitle => 'Send a notification';

  @override
  String get bcSubtitle => 'To one user or a whole group';

  @override
  String get bcAudience => 'Audience';

  @override
  String get bcAllCustomers => 'All customers';

  @override
  String get bcAllCustomersHint => 'Every active customer';

  @override
  String get bcAllBrokers => 'All brokers';

  @override
  String get bcAllSales => 'All the sales team';

  @override
  String get bcAllSupervisors => 'All maintenance supervisors';

  @override
  String get bcRole => 'A specific role';

  @override
  String get bcUser => 'A specific user';

  @override
  String get bcPickUser => 'Pick the user';

  @override
  String get bcSearchUser => 'Search by name';

  @override
  String get bcRoleCustomer => 'Customer';

  @override
  String get bcContent => 'Content';

  @override
  String get bcTitleAr => 'Title (Arabic)';

  @override
  String get bcTitleEn => 'Title (English)';

  @override
  String get bcBodyAr => 'Message (Arabic)';

  @override
  String get bcBodyEn => 'Message (English)';

  @override
  String get bcBothRequired =>
      'Both versions are required: each user gets it in their language.';

  @override
  String get bcChannel => 'Channel';

  @override
  String get bcInApp => 'In the app';

  @override
  String get bcInAppHint => 'Shows in the notification list';

  @override
  String get bcPush => 'Phone only';

  @override
  String get bcPushHint => 'An alert on the user\'s phone';

  @override
  String get bcBoth => 'In the app and on the phone';

  @override
  String get bcBothHint => 'Best for important alerts';

  @override
  String get bcLink => 'Link to a page (optional)';

  @override
  String get bcLinkNone => 'None';

  @override
  String get bcEntityContract => 'Contract';

  @override
  String get bcEntityReservation => 'Booking';

  @override
  String get bcEntityLead => 'Lead';

  @override
  String get bcRecord => 'Record';

  @override
  String get bcRecordHint => 'Search by number or name…';

  @override
  String get bcLinkNote => 'What the user opens when tapping the notification.';

  @override
  String get bcPreview => 'Preview';

  @override
  String get bcNow => 'Now';

  @override
  String get bcEstimate => 'Estimate recipients';

  @override
  String get bcSend => 'Send';

  @override
  String bcSendN(int n) {
    return 'Send to $n users';
  }

  @override
  String get bcSummary => 'Summary';

  @override
  String get bcRecipients => 'Recipients';

  @override
  String bcRecipientsN(int n) {
    return '$n users';
  }

  @override
  String get bcDevices => 'Registered devices';

  @override
  String bcDevicesN(int d, int u) {
    return '$d devices · $u without';
  }

  @override
  String get bcPushReady => 'Phone notifications are ready';

  @override
  String get bcPushOff =>
      'Phone notifications are not enabled on the server; phone sending is unavailable.';

  @override
  String get bcNoDevices => 'No recipient has a registered phone.';

  @override
  String bcConfirmMass(int n) {
    return 'I confirm sending this to $n users. This cannot be undone.';
  }

  @override
  String get bcNeedEstimate => 'Estimate the recipients first.';

  @override
  String get bcResult => 'Last send';

  @override
  String get bcResOk => 'The notification was sent';

  @override
  String get bcResPartial => 'Partly sent';

  @override
  String get bcResFail => 'Sending failed';

  @override
  String get bcResInApp => 'In-app notifications';

  @override
  String get bcResPush => 'Reached the phone';

  @override
  String get bcResNoDev => 'No device';

  @override
  String get bcResFailed => 'Failed';

  @override
  String get bcMissing => 'Fill the title and message in both languages.';

  @override
  String get bcNoRecipients => 'No recipients for this choice.';

  @override
  String get bcAllActiveUsers => 'All active users';

  @override
  String get bnSubtitle => 'My dues';

  @override
  String get bnTotal => 'Your total dues';

  @override
  String get bnPendingHint => 'Paid after the contract';

  @override
  String get bnPaidHint => 'Reached you';

  @override
  String bnBasisLine(String basis, String pct) {
    return 'Basis $basis × $pct';
  }

  @override
  String bnPeriodLine(String period) {
    return 'Period $period';
  }

  @override
  String get bnWhenSigned => 'Counted when the contract is signed';

  @override
  String get bnApprovedNote => 'Approved, awaiting payment';

  @override
  String bnPaidOn(String date) {
    return 'Paid $date';
  }

  @override
  String get tgSales => 'Sales value';

  @override
  String tgOf(String amount) {
    return 'of $amount';
  }

  @override
  String get tgUnitsSold => 'Units sold';

  @override
  String tgUnitsOf(int a, int b) {
    return '$a of $b';
  }

  @override
  String get tgRemaining => 'Left to reach the target';

  @override
  String get tgNoTarget => 'No target for this period yet.';

  @override
  String get tgPeriodActivity => 'Your activity this period';

  @override
  String get tmPeriodPick => 'Pick the period';

  @override
  String get tmEditTitle => 'Edit the target';

  @override
  String get tmSheetNote =>
      'Shows in the member\'s targets; progress is measured from their signed contracts.';

  @override
  String tmCreatedOn(String date) {
    return 'Created $date';
  }

  @override
  String tmUnitsLine(int n) {
    return '$n units';
  }

  @override
  String get tpFunnelLeads => 'Leads';

  @override
  String get tpVisits => 'Visits';

  @override
  String get tpBookings => 'Bookings';

  @override
  String get tpContracts => 'Contracts';

  @override
  String tmCountN(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n targets',
      one: '1 target',
      zero: 'No targets',
    );
    return '$_temp0';
  }

  @override
  String get tmPeriodField => 'Period';

  @override
  String cqCountN(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n cheques',
      one: '1 cheque',
      zero: 'No cheques',
    );
    return '$_temp0';
  }

  @override
  String get cqStReceived => 'Received';

  @override
  String get cqStDeposit => 'Deposit';

  @override
  String get cqStClear => 'Clearing';

  @override
  String cqDueIn(int n) {
    return 'In $n days';
  }

  @override
  String get cqDueToday => 'Due today';

  @override
  String cqOverdue(int n) {
    return '$n days late';
  }

  @override
  String get cqCovers => 'Payments it covers';

  @override
  String get bpTitle => 'Brokers\' performance';

  @override
  String get bpSubtitle => 'All time';

  @override
  String get bpBrokersSales => 'Brokers\' sales';

  @override
  String get bpCommissions => 'Commissions';

  @override
  String bpPendingOf(String amount) {
    return '$amount pending';
  }

  @override
  String get bpActive => 'Active brokers';

  @override
  String bpActiveOf(int n) {
    return 'of $n';
  }

  @override
  String get bpFunnel => 'Brokers\' funnel';

  @override
  String get bpFunnelMine => 'Your clients\' funnel';

  @override
  String get bpLeadsSent => 'Leads sent';

  @override
  String get bpLeadsApproved => 'Leads approved';

  @override
  String get bpBookings => 'Bookings';

  @override
  String get bpSigned => 'Signed contracts';

  @override
  String get bpPaidCom => 'Commission paid';

  @override
  String get bpTrend => 'Monthly trend';

  @override
  String get bpTrendMine => 'Your commission by month';

  @override
  String get bpTrendNote => 'Net commissions per month';

  @override
  String get bpTop => 'Top brokers';

  @override
  String get bpByProject => 'By project';

  @override
  String get bpSalesLbl => 'Sales';

  @override
  String get bpCommissionLbl => 'Commission';

  @override
  String get bpPaidLbl => 'Paid out';

  @override
  String bpConv(String pct) {
    return 'Conversion $pct';
  }

  @override
  String bpBrokerLine(int leads, int res, int con) {
    return '$leads leads · $res bookings · $con contracts';
  }

  @override
  String get bpActiveBadge => 'Active';

  @override
  String get bpMineTitle => 'My performance';

  @override
  String get bpMineSales => 'Your sales';

  @override
  String get bpMineCom => 'Your commission';

  @override
  String bpMineContractsHint(int n) {
    return 'of $n bookings';
  }

  @override
  String get bpCommissionsBlock => 'Commissions and payouts';

  @override
  String get bpNetCommissions => 'Net commissions';

  @override
  String get bpNetHint => 'All you earned';

  @override
  String get bpPendingLbl => 'Pending';

  @override
  String get bpPendingNote => 'Paid after the contract';

  @override
  String get bpPaidOutLbl => 'Paid to you';

  @override
  String get bpMyCommissions => 'My commissions and payouts';

  @override
  String get bpTeam => 'Your team';

  @override
  String bpProjectLine(String city, int n) {
    return '$city · $n contracts';
  }

  @override
  String bpContractsN(int n) {
    return '$n signed contracts';
  }

  @override
  String bpAgentLine(int leads, int con) {
    return '$leads leads · $con contracts';
  }

  @override
  String get bpEmpty => 'No data yet';

  @override
  String get bpEmptyMsg => 'Figures appear after the brokers\' first activity.';

  @override
  String get bkSubtitle => 'My commissions and payouts';

  @override
  String get bkNet => 'Your net commissions';

  @override
  String get bkNetHint => 'Pending and approved';

  @override
  String get bkPaidOutHint => 'Payouts paid';

  @override
  String get bkStRejected => 'Rejected';

  @override
  String get bkStCancelled => 'Cancelled';

  @override
  String get bkPayouts => 'Payout statements';

  @override
  String get bkPoDraft => 'Draft';

  @override
  String get bkPoApproved => 'Approved';

  @override
  String get bkPoProcessing => 'Processing';

  @override
  String get bkPoPaid => 'Paid';

  @override
  String get bkPoCancelled => 'Cancelled';

  @override
  String bkPaidOn(String date) {
    return 'Paid $date';
  }

  @override
  String bkEarnedOn(String date) {
    return 'Earned $date';
  }

  @override
  String get bkOnPayout => 'On a payout statement';

  @override
  String get bkWaitingPayout => 'Waiting for a payout statement';

  @override
  String get bkMethodBank => 'Bank transfer';

  @override
  String fuCountN(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n follow-ups',
      one: '1 follow-up',
      zero: 'No follow-ups',
    );
    return '$_temp0';
  }

  @override
  String get fuOverdueHint => 'Need a call now';

  @override
  String get fuNoneToday => 'None today';

  @override
  String get fuNoneUpcoming => 'None coming';

  @override
  String get fuLogResult => 'Log a result';

  @override
  String get fuBandToday => 'Today';

  @override
  String get calBandDay => 'This day';

  @override
  String get calBandVisits => 'Visits';

  @override
  String get calBandFollowUps => 'Follow-ups';

  @override
  String get calBandContracts => 'Signed contracts';

  @override
  String get asSubtitle => 'Answers from your company\'s data only';

  @override
  String get asTryAlso => 'Try also';

  @override
  String clOwnersN(int n) {
    return '$n unit owners';
  }

  @override
  String get clBrowsers => 'Browsing';

  @override
  String get clBrowsersHint => 'No unit yet';

  @override
  String get clSuspendedTitle => 'Suspended';

  @override
  String get clSuspendedHint => 'Suspended accounts';

  @override
  String get clAllActive => 'All active';

  @override
  String get clOwner => 'Owner';

  @override
  String get clBrowser => 'Browsing';

  @override
  String get clActive => 'Active';

  @override
  String get clSuspended => 'Suspended';

  @override
  String clJoined(String date) {
    return 'Joined $date';
  }

  @override
  String clLastLogin(String date) {
    return 'Last sign-in $date';
  }

  @override
  String get clNeverLogged => 'Never signed in';

  @override
  String get clSearchHint => 'Search by name, phone or e-mail';

  @override
  String get clEmpty => 'No clients yet.';

  @override
  String get clAccount => 'Account';

  @override
  String get clStatus => 'Status';

  @override
  String get clType => 'Type';

  @override
  String get clJoinedLbl => 'Registered';

  @override
  String get clLastLoginLbl => 'Last sign-in';

  @override
  String get clLocale => 'App language';

  @override
  String get clId => 'Client ID';

  @override
  String clSuspendedSince(String date) {
    return 'Suspended since $date';
  }

  @override
  String get clSuspend => 'Suspend account';

  @override
  String get clRestore => 'Restore account';

  @override
  String get clSuspendConfirm =>
      'The client will not be able to sign in until the account is restored. Continue?';

  @override
  String get clConfirm => 'Confirm';

  @override
  String get clDetails => 'More details';

  @override
  String get clNationalId => 'National ID';

  @override
  String get clAddress => 'Address';

  @override
  String get clBirthDate => 'Date of birth';

  @override
  String get clBirthPlace => 'Place of birth';

  @override
  String get clOccupation => 'Occupation';

  @override
  String get clEmployer => 'Employer';

  @override
  String get clIdIssueDate => 'ID issue date';

  @override
  String get clIdIssuePlace => 'ID issued at';

  @override
  String get clHomePhone => 'Home phone';

  @override
  String get clLeads => 'Leads';

  @override
  String get clNoLeads => 'No leads for this client.';

  @override
  String get clReservations => 'Bookings';

  @override
  String get clContracts => 'Contracts';

  @override
  String get clSigned => 'Signed';

  @override
  String get clUnsigned => 'Awaiting signature';

  @override
  String get clMaintenance => 'Maintenance';

  @override
  String get clDocuments => 'Documents';

  @override
  String clBy(String name) {
    return 'Uploaded by $name';
  }

  @override
  String get clNoFollowUp => 'No follow-up set';

  @override
  String get clDocImage => 'Image';

  @override
  String get clDocContract => 'Contract';

  @override
  String get clDocReceipt => 'Receipt';

  @override
  String get clDocInvoice => 'Invoice';

  @override
  String get clDocBrokerAgreement => 'Broker agreement';

  @override
  String get clDocCommission => 'Commission statement';

  @override
  String get clDocPayout => 'Payout receipt';

  @override
  String get clDocId => 'ID document';

  @override
  String get clDocLegal => 'Legal';

  @override
  String get clDocFinancial => 'Financial';

  @override
  String get clDocOther => 'Other';

  @override
  String get calculatorUnitSection => 'Unit and its plans';

  @override
  String get calculatorProject => 'Project';

  @override
  String get calculatorUnit => 'Unit';

  @override
  String get calculatorNoPlans =>
      'This unit has no active payment plans. You can calculate by hand below.';

  @override
  String calculatorPlanUpfront(String amount) {
    return 'Down payment and booking $amount';
  }

  @override
  String get calculatorPlanDurations => 'Payment durations';

  @override
  String calculatorPerMonth(String amount) {
    return '$amount / month';
  }

  @override
  String get calculatorCashPlan => 'Cash';

  @override
  String get calculatorManual => 'Manual calculation';

  @override
  String get profileSectionAdmin => 'Admin and review';

  @override
  String get profileSectionAccount => 'Account and security';

  @override
  String get profileSectionBrokerWork => 'My work';

  @override
  String ledgerNoItemsIn(String names) {
    return 'No items: $names';
  }

  @override
  String get ledgerFilterTitle => 'Filter balances';

  @override
  String get ledgerFilterPeriod => 'Period';

  @override
  String get ledgerFilterApply => 'Show results';

  @override
  String get prFigPending => 'Awaiting review';

  @override
  String get prFigTotal => 'Total amount';

  @override
  String prFigItems(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n receipts',
      one: '1 receipt',
      zero: 'no receipts',
    );
    return '$_temp0';
  }

  @override
  String get prOpenProof => 'Open receipt';

  @override
  String get campaignsFilterTitle => 'Filter campaigns';

  @override
  String get campaignsFilterApply => 'Show campaigns';

  @override
  String campaignsCountN(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n campaigns',
      one: '1 campaign',
      zero: 'no campaigns',
    );
    return '$_temp0';
  }

  @override
  String duplicatesCountN(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n customers with duplicates',
      one: '1 customer with duplicates',
      zero: 'no duplicates',
    );
    return '$_temp0';
  }

  @override
  String get visitsFilterTitle => 'Filter visits';

  @override
  String get visitsFilterApply => 'Show visits';

  @override
  String visitsCountN(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n visits',
      one: '1 visit',
      zero: 'no visits',
    );
    return '$_temp0';
  }

  @override
  String get maintenanceFilterTitle => 'Filter requests';

  @override
  String get maintenanceFilterApply => 'Show requests';

  @override
  String get plansNoUnitPlans => 'This unit has no payment plans.';

  @override
  String get plansPickHint =>
      'Pick the project, then the unit, to see its payment plans.';

  @override
  String get visitInfoTitle => 'Visit details';

  @override
  String get ahProjectHealth => 'Projects';

  @override
  String ahProjectContracts(int n, String value) {
    return '$n contracts · $value';
  }

  @override
  String get ahUnitsWord => 'units';

  @override
  String ahProjectSold(int n) {
    return '$n sold';
  }

  @override
  String ahProjectReserved(int n) {
    return '$n booked';
  }

  @override
  String ahProjectAvailable(int n) {
    return '$n available';
  }

  @override
  String get ahFinanceHealth => 'Financial health';

  @override
  String get ahPfPaid => 'Paid';

  @override
  String get ahPfAwaiting => 'Awaiting payment';

  @override
  String get ahPfOverdue => 'Overdue';

  @override
  String get ahPfNotYetDue => 'Not due yet';

  @override
  String get ahPfUnscheduled => 'Unscheduled';

  @override
  String get ahFees => 'Fees and penalties collected';

  @override
  String get ahCashFlow => 'Expected cash flow';

  @override
  String get ahCfTotal => 'Total over 90 days plus overdue';

  @override
  String get ahCfSlot30 => 'Next 30 days';

  @override
  String get ahCfSlot60 => '31 to 60 days';

  @override
  String get ahCfSlot90 => '61 to 90 days';

  @override
  String get ahCfOverdue => 'Overdue';

  @override
  String get ahLeadSources => 'Lead sources';

  @override
  String get ahSourcesOther => 'Other';

  @override
  String get inqTitle => 'Customer inquiries';

  @override
  String get inqProfileDesc => 'What customers and visitors asked';

  @override
  String inqCountN(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n inquiries',
      one: '1 inquiry',
      zero: 'No inquiries',
    );
    return '$_temp0';
  }

  @override
  String get inqStatusOpen => 'Open';

  @override
  String get inqStatusReplied => 'Replied';

  @override
  String get inqStatusClosed => 'Closed';

  @override
  String get inqOpenHint => 'Waiting for a reply';

  @override
  String get inqAllAnswered => 'All answered';

  @override
  String get inqRepliedHint => 'Answered';

  @override
  String get inqClosedHint => 'Done';

  @override
  String get inqFilterTitle => 'Filter inquiries';

  @override
  String get inqFilterApply => 'Show inquiries';

  @override
  String get inqEmpty => 'No inquiries in this state.';

  @override
  String get inqVisitor => 'Visitor';

  @override
  String get inqOwner => 'Unit owner';

  @override
  String get inqBrowser => 'Browsing client';

  @override
  String get inqNoName => 'Visitor without a name';

  @override
  String get inqMarkReplied => 'Mark replied';

  @override
  String get inqClose => 'Close';

  @override
  String get inqActionFailed => 'Could not update the inquiry.';

  @override
  String get rpTitle => 'Reports';

  @override
  String get rpProfileDesc => 'Sales, conversion, projects and brokers';

  @override
  String get rpFilterTitle => 'Report period';

  @override
  String get rpFilterPeriod => 'Period';

  @override
  String get rpFilterApply => 'Show report';

  @override
  String get rpPeriodThisMonth => 'This month';

  @override
  String get rpPeriodLastMonth => 'Last month';

  @override
  String get rpPeriodQuarter => 'This quarter';

  @override
  String get rpPeriodYear => 'This year';

  @override
  String get rpSales => 'Total sales';

  @override
  String rpAvgContract(String value) {
    return 'Average $value';
  }

  @override
  String get rpContracts => 'Contracts signed';

  @override
  String get rpContractsHint => 'In the period';

  @override
  String get rpConversion => 'Conversion';

  @override
  String get rpConversionHint => 'Lead to contract';

  @override
  String get rpCollected => 'Collected';

  @override
  String get rpCollectedSub => 'Towards the price';

  @override
  String get rpFees => 'Fees and penalties';

  @override
  String get rpTrend => 'Contracts per month this year';

  @override
  String get rpReservationStates => 'Booking states';

  @override
  String get rpResPending => 'Pending';

  @override
  String get rpResConfirmed => 'Confirmed';

  @override
  String get rpResApproved => 'Approved';

  @override
  String get rpResConverted => 'Converted';

  @override
  String get rpResCancelled => 'Cancelled';

  @override
  String get rpResExpired => 'Expired';

  @override
  String get rpProjects => 'Projects by sales';

  @override
  String get rpUnknownProject => 'Unknown project';

  @override
  String get rpNoSales => 'No sales in this period.';

  @override
  String get brkTitle => 'Brokers';

  @override
  String get brkProfileDesc =>
      'The firms, their leads, bookings and commissions';

  @override
  String brkCountN(int n) {
    String _temp0 = intl.Intl.pluralLogic(
      n,
      locale: localeName,
      other: '$n results',
      one: '1 result',
      zero: 'No results',
    );
    return '$_temp0';
  }

  @override
  String get brkTabFirms => 'Firms';

  @override
  String get brkTabLeads => 'Leads';

  @override
  String get brkTabReservations => 'Bookings';

  @override
  String get brkTabContracts => 'Contracts';

  @override
  String get brkTabCommissions => 'Commissions';

  @override
  String get brkTabPayouts => 'Payouts';

  @override
  String get brkFilterTitle => 'Filter the list';

  @override
  String get brkFilterApply => 'Show results';

  @override
  String get brkEmpty => 'Nothing here in this state.';

  @override
  String get brkCommissionWord => 'default commission';

  @override
  String get brkPayoutHold => 'Payouts on hold';

  @override
  String get brkStPending => 'Pending';

  @override
  String get brkStActive => 'Active';

  @override
  String get brkStSuspended => 'Suspended';

  @override
  String get brkStTerminated => 'Terminated';

  @override
  String get brkStApproved => 'Approved';

  @override
  String get brkStRejected => 'Rejected';

  @override
  String get brkStDuplicate => 'Duplicate';

  @override
  String get brkStExpired => 'Expired';

  @override
  String get brkStConfirmed => 'Confirmed';

  @override
  String get brkStConverted => 'Converted';

  @override
  String get brkStCancelled => 'Cancelled';

  @override
  String get brkStDraft => 'Draft';

  @override
  String get brkStProcessing => 'Processing';

  @override
  String get brkStPaid => 'Paid';

  @override
  String get brkStSigned => 'Signed';

  @override
  String get brkStUnsigned => 'Awaiting signature';

  @override
  String get brkActApprove => 'Approve';

  @override
  String get brkActReject => 'Reject';

  @override
  String get brkActCancel => 'Cancel';

  @override
  String get brkActDuplicate => 'Mark as duplicate';

  @override
  String get brkActProcess => 'Start paying';

  @override
  String get brkActMarkPaid => 'Mark as paid';

  @override
  String get brkActSuspend => 'Suspend the firm';

  @override
  String get brkActTerminate => 'Terminate';

  @override
  String get brkActActivate => 'Activate the firm';

  @override
  String get brkActHoldOn => 'Hold its payouts';

  @override
  String get brkActHoldOff => 'Resume its payouts';

  @override
  String get brkReasonHint => 'Write the reason';

  @override
  String get brkActionFailed => 'Could not do that.';

  @override
  String get brkPmBank => 'Bank transfer';

  @override
  String get brkPmCheque => 'Cheque';

  @override
  String get brkPmCash => 'Cash';

  @override
  String get brkPmOther => 'Other';

  @override
  String get brkFBroker => 'Firm';

  @override
  String get brkFAgent => 'Agent';

  @override
  String get brkFPhone => 'Phone';

  @override
  String get brkFEmail => 'Email';

  @override
  String get brkFCity => 'City';

  @override
  String get brkFProject => 'Project';

  @override
  String get brkFUnit => 'Unit';

  @override
  String get brkFCustomer => 'Customer';

  @override
  String get brkFAssigned => 'Sales rep';

  @override
  String get brkFSubmitted => 'Sent on';

  @override
  String get brkFReason => 'Reason';

  @override
  String get brkFBooking => 'Booking amount';

  @override
  String get brkFExpires => 'Booking ends';

  @override
  String get brkFTotal => 'Contract value';

  @override
  String get brkFDown => 'Down payment';

  @override
  String get brkFSigned => 'Signed on';

  @override
  String get brkFBasis => 'Commission basis';

  @override
  String get brkFCommission => 'Commission';

  @override
  String get brkFGross => 'Gross';

  @override
  String get brkFTax => 'Tax';

  @override
  String get brkFWithholding => 'Withholding';

  @override
  String get brkFNet => 'Net';

  @override
  String get brkFEarned => 'Earned on';

  @override
  String get brkFPeriod => 'Period';

  @override
  String get brkFMethod => 'Payment method';

  @override
  String get brkFReference => 'Reference';

  @override
  String get brkFContractPeriod => 'Contract period';

  @override
  String get brkFBank => 'Bank';

  @override
  String get brkFNotes => 'Notes';

  @override
  String get frTitle => 'Financial report';

  @override
  String get frProfileDesc => 'Collection, dues and liabilities';

  @override
  String get frContractValue => 'Contract value';

  @override
  String get frCollectedMonth => 'Collected this month';

  @override
  String frDueMonth(String value) {
    return 'Due $value';
  }

  @override
  String get frRateHint => 'Of what is due by today';

  @override
  String get frCollected => 'Collected';

  @override
  String get frRemaining => 'Remaining';

  @override
  String get frAging => 'Aging of arrears';

  @override
  String get frByType => 'Collected by type';

  @override
  String frAwaiting(String value) {
    return 'On its way $value';
  }

  @override
  String get frBooking => 'Bookings';

  @override
  String get frBookingCollected => 'Booking money collected';

  @override
  String get frBookingUncollected => 'Booking money not collected (estimate)';

  @override
  String get frBookingPending => 'Pending bookings';

  @override
  String get frBookingApproved => 'Approved bookings';

  @override
  String get frLiabilities => 'What the company owes';

  @override
  String get frLiabBonus => 'Unpaid sales bonuses';

  @override
  String get frLiabCommissions => 'Unpaid broker commissions';

  @override
  String get frLiabPayouts => 'Broker payouts in progress';

  @override
  String get frLiabRefunds => 'Refunds owed to customers';

  @override
  String get frLiabClawbacks => 'Clawbacks owed to the company';

  @override
  String get frLiabTotal => 'Total';

  @override
  String get frOverdueList => 'Late installments';

  @override
  String get frUpcomingWeek => 'Installments this week';

  @override
  String get frRecentPayments => 'Latest payments';

  @override
  String get frUnverified => 'Not reviewed';

  @override
  String frVsBefore(String value) {
    return '$value vs the period before';
  }

  @override
  String get frCompare => 'Comparison';

  @override
  String get frCompareOff => 'No comparison';

  @override
  String get frCompareOn => 'Against the period before';

  @override
  String get brkConfirmHint => 'Do you want to do this?';
}
