// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get customerAppTitle => 'Real Estate';

  @override
  String get staffAppTitle => 'Real Estate Staff';

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
  String get homeHeroTitle => 'Find your next home';

  @override
  String get homeHeroSubtitle => 'Premium projects and units, curated for you.';

  @override
  String get homeSearchHint => 'Search projects, cities…';

  @override
  String get homeFeaturedProjects => 'Featured projects';

  @override
  String get homeExploreProjects => 'Explore projects';

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
  String get projectsSearchHint => 'Search projects';

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
  String get profileEdit => 'Edit profile';

  @override
  String get profileSaved => 'Profile updated';

  @override
  String get fieldLanguage => 'Language';

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
}
