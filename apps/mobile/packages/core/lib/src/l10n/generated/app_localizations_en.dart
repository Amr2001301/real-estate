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
  String get filterPriceUnit => 'EGP';

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
  String get validationRequired => 'This field is required';

  @override
  String get validationEmail => 'Enter a valid email';

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
  String get contractsEmptyTitle => 'No contracts';

  @override
  String get contractsEmptyMessage =>
      'Your contracts will appear here once available.';

  @override
  String get contractStatusSigned => 'Signed';

  @override
  String get contractStatusDraft => 'Draft';

  @override
  String get contractsDocumentsTitle => 'Documents';

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
  String get roleSales => 'Sales';

  @override
  String get roleSalesManager => 'Sales Manager';

  @override
  String get roleBroker => 'Broker';

  @override
  String get roleAdmin => 'Admin';

  @override
  String get roleMaintenance => 'Maintenance';

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
}
