import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_ar.dart';
import 'app_localizations_en.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'generated/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('ar'),
    Locale('en'),
  ];

  /// Customer app display name
  ///
  /// In en, this message translates to:
  /// **'Real Estate'**
  String get customerAppTitle;

  /// Staff app display name
  ///
  /// In en, this message translates to:
  /// **'Real Estate Staff'**
  String get staffAppTitle;

  /// Native name of this language
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get languageName;

  /// No description provided for @actionContinue.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get actionContinue;

  /// No description provided for @actionRetry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get actionRetry;

  /// No description provided for @actionCancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get actionCancel;

  /// No description provided for @actionSave.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get actionSave;

  /// No description provided for @actionClose.
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get actionClose;

  /// No description provided for @actionLogin.
  ///
  /// In en, this message translates to:
  /// **'Log in'**
  String get actionLogin;

  /// No description provided for @actionLogout.
  ///
  /// In en, this message translates to:
  /// **'Log out'**
  String get actionLogout;

  /// No description provided for @actionRegister.
  ///
  /// In en, this message translates to:
  /// **'Register'**
  String get actionRegister;

  /// No description provided for @actionSearch.
  ///
  /// In en, this message translates to:
  /// **'Search'**
  String get actionSearch;

  /// No description provided for @actionViewMore.
  ///
  /// In en, this message translates to:
  /// **'View more'**
  String get actionViewMore;

  /// No description provided for @stateLoading.
  ///
  /// In en, this message translates to:
  /// **'Loading…'**
  String get stateLoading;

  /// No description provided for @stateEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'Nothing here yet'**
  String get stateEmptyTitle;

  /// No description provided for @stateEmptyMessage.
  ///
  /// In en, this message translates to:
  /// **'There is no content to show right now.'**
  String get stateEmptyMessage;

  /// No description provided for @stateErrorTitle.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong'**
  String get stateErrorTitle;

  /// No description provided for @stateErrorMessage.
  ///
  /// In en, this message translates to:
  /// **'We couldn\'t load this. Please try again.'**
  String get stateErrorMessage;

  /// No description provided for @stateNoConnection.
  ///
  /// In en, this message translates to:
  /// **'No internet connection'**
  String get stateNoConnection;

  /// No description provided for @errorNoConnection.
  ///
  /// In en, this message translates to:
  /// **'No internet connection. Please check your network and try again.'**
  String get errorNoConnection;

  /// No description provided for @errorTimeout.
  ///
  /// In en, this message translates to:
  /// **'The connection timed out. Please try again.'**
  String get errorTimeout;

  /// No description provided for @errorSessionExpired.
  ///
  /// In en, this message translates to:
  /// **'Your session has expired. Please sign in again.'**
  String get errorSessionExpired;

  /// No description provided for @errorPermissionDenied.
  ///
  /// In en, this message translates to:
  /// **'You don\'t have permission to perform this action.'**
  String get errorPermissionDenied;

  /// No description provided for @errorNotFound.
  ///
  /// In en, this message translates to:
  /// **'We couldn\'t find what you were looking for.'**
  String get errorNotFound;

  /// No description provided for @errorValidation.
  ///
  /// In en, this message translates to:
  /// **'Please review the information you entered and try again.'**
  String get errorValidation;

  /// No description provided for @errorServer.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong on our side. Please try again shortly.'**
  String get errorServer;

  /// No description provided for @errorMaintenance.
  ///
  /// In en, this message translates to:
  /// **'The service is temporarily under maintenance. Please try again soon.'**
  String get errorMaintenance;

  /// No description provided for @errorUnknown.
  ///
  /// In en, this message translates to:
  /// **'An unexpected error occurred. Please try again.'**
  String get errorUnknown;

  /// No description provided for @settingsTitle.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settingsTitle;

  /// No description provided for @settingsTheme.
  ///
  /// In en, this message translates to:
  /// **'Appearance'**
  String get settingsTheme;

  /// No description provided for @settingsThemeSystem.
  ///
  /// In en, this message translates to:
  /// **'System'**
  String get settingsThemeSystem;

  /// No description provided for @settingsThemeLight.
  ///
  /// In en, this message translates to:
  /// **'Light'**
  String get settingsThemeLight;

  /// No description provided for @settingsThemeDark.
  ///
  /// In en, this message translates to:
  /// **'Dark'**
  String get settingsThemeDark;

  /// No description provided for @settingsLanguage.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get settingsLanguage;

  /// No description provided for @galleryTitle.
  ///
  /// In en, this message translates to:
  /// **'Component Gallery'**
  String get galleryTitle;

  /// No description provided for @gallerySectionButtons.
  ///
  /// In en, this message translates to:
  /// **'Buttons'**
  String get gallerySectionButtons;

  /// No description provided for @gallerySectionInputs.
  ///
  /// In en, this message translates to:
  /// **'Inputs'**
  String get gallerySectionInputs;

  /// No description provided for @gallerySectionCards.
  ///
  /// In en, this message translates to:
  /// **'Cards'**
  String get gallerySectionCards;

  /// No description provided for @gallerySectionBadges.
  ///
  /// In en, this message translates to:
  /// **'Status badges'**
  String get gallerySectionBadges;

  /// No description provided for @gallerySectionStates.
  ///
  /// In en, this message translates to:
  /// **'States'**
  String get gallerySectionStates;

  /// No description provided for @gallerySectionSkeleton.
  ///
  /// In en, this message translates to:
  /// **'Skeleton loading'**
  String get gallerySectionSkeleton;

  /// No description provided for @galleryToggleTheme.
  ///
  /// In en, this message translates to:
  /// **'Toggle theme'**
  String get galleryToggleTheme;

  /// No description provided for @galleryToggleLanguage.
  ///
  /// In en, this message translates to:
  /// **'Toggle language'**
  String get galleryToggleLanguage;

  /// No description provided for @gallerySampleCardTitle.
  ///
  /// In en, this message translates to:
  /// **'Marina Heights'**
  String get gallerySampleCardTitle;

  /// No description provided for @gallerySampleCardSubtitle.
  ///
  /// In en, this message translates to:
  /// **'New Cairo · Apartment'**
  String get gallerySampleCardSubtitle;

  /// No description provided for @gallerySampleCardPrice.
  ///
  /// In en, this message translates to:
  /// **'5,800,000 EGP'**
  String get gallerySampleCardPrice;

  /// No description provided for @galleryInputLabel.
  ///
  /// In en, this message translates to:
  /// **'Full name'**
  String get galleryInputLabel;

  /// No description provided for @galleryInputHint.
  ///
  /// In en, this message translates to:
  /// **'Enter your full name'**
  String get galleryInputHint;

  /// No description provided for @galleryInputError.
  ///
  /// In en, this message translates to:
  /// **'This field is required'**
  String get galleryInputError;

  /// No description provided for @homeHeroTitle.
  ///
  /// In en, this message translates to:
  /// **'Find your next home'**
  String get homeHeroTitle;

  /// No description provided for @homeHeroSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Premium projects and units, curated for you.'**
  String get homeHeroSubtitle;

  /// No description provided for @homeSearchHint.
  ///
  /// In en, this message translates to:
  /// **'Search projects, cities…'**
  String get homeSearchHint;

  /// No description provided for @homeFeaturedProjects.
  ///
  /// In en, this message translates to:
  /// **'Featured projects'**
  String get homeFeaturedProjects;

  /// No description provided for @homeExploreProjects.
  ///
  /// In en, this message translates to:
  /// **'Explore projects'**
  String get homeExploreProjects;

  /// No description provided for @homeContactUs.
  ///
  /// In en, this message translates to:
  /// **'Contact us'**
  String get homeContactUs;

  /// No description provided for @homeAskAssistant.
  ///
  /// In en, this message translates to:
  /// **'Ask the assistant'**
  String get homeAskAssistant;

  /// No description provided for @viewAll.
  ///
  /// In en, this message translates to:
  /// **'View all'**
  String get viewAll;

  /// No description provided for @viewDetails.
  ///
  /// In en, this message translates to:
  /// **'View details'**
  String get viewDetails;

  /// No description provided for @projectsTitle.
  ///
  /// In en, this message translates to:
  /// **'Projects'**
  String get projectsTitle;

  /// No description provided for @projectsSearchHint.
  ///
  /// In en, this message translates to:
  /// **'Search projects'**
  String get projectsSearchHint;

  /// No description provided for @unitsTitle.
  ///
  /// In en, this message translates to:
  /// **'Units'**
  String get unitsTitle;

  /// No description provided for @filtersTitle.
  ///
  /// In en, this message translates to:
  /// **'Filters'**
  String get filtersTitle;

  /// No description provided for @filterCity.
  ///
  /// In en, this message translates to:
  /// **'City'**
  String get filterCity;

  /// No description provided for @filterType.
  ///
  /// In en, this message translates to:
  /// **'Type'**
  String get filterType;

  /// No description provided for @filterStatus.
  ///
  /// In en, this message translates to:
  /// **'Status'**
  String get filterStatus;

  /// No description provided for @filterPriceRange.
  ///
  /// In en, this message translates to:
  /// **'Price range'**
  String get filterPriceRange;

  /// No description provided for @filterAreaRange.
  ///
  /// In en, this message translates to:
  /// **'Area range'**
  String get filterAreaRange;

  /// No description provided for @filterRooms.
  ///
  /// In en, this message translates to:
  /// **'Bedrooms'**
  String get filterRooms;

  /// No description provided for @filterAny.
  ///
  /// In en, this message translates to:
  /// **'Any'**
  String get filterAny;

  /// No description provided for @filterFeaturedOnly.
  ///
  /// In en, this message translates to:
  /// **'Featured only'**
  String get filterFeaturedOnly;

  /// No description provided for @minLabel.
  ///
  /// In en, this message translates to:
  /// **'Min'**
  String get minLabel;

  /// No description provided for @maxLabel.
  ///
  /// In en, this message translates to:
  /// **'Max'**
  String get maxLabel;

  /// No description provided for @sortTitle.
  ///
  /// In en, this message translates to:
  /// **'Sort by'**
  String get sortTitle;

  /// No description provided for @sortNewest.
  ///
  /// In en, this message translates to:
  /// **'Newest'**
  String get sortNewest;

  /// No description provided for @sortOldest.
  ///
  /// In en, this message translates to:
  /// **'Oldest'**
  String get sortOldest;

  /// No description provided for @sortPriceAsc.
  ///
  /// In en, this message translates to:
  /// **'Price: low to high'**
  String get sortPriceAsc;

  /// No description provided for @sortPriceDesc.
  ///
  /// In en, this message translates to:
  /// **'Price: high to low'**
  String get sortPriceDesc;

  /// No description provided for @sortAreaAsc.
  ///
  /// In en, this message translates to:
  /// **'Area: small to large'**
  String get sortAreaAsc;

  /// No description provided for @sortAreaDesc.
  ///
  /// In en, this message translates to:
  /// **'Area: large to small'**
  String get sortAreaDesc;

  /// No description provided for @applyFilters.
  ///
  /// In en, this message translates to:
  /// **'Apply'**
  String get applyFilters;

  /// No description provided for @clearFilters.
  ///
  /// In en, this message translates to:
  /// **'Clear'**
  String get clearFilters;

  /// No description provided for @resultsCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =0{No results} =1{1 result} other{{count} results}}'**
  String resultsCount(int count);

  /// No description provided for @noProjectsTitle.
  ///
  /// In en, this message translates to:
  /// **'No projects found'**
  String get noProjectsTitle;

  /// No description provided for @noProjectsMessage.
  ///
  /// In en, this message translates to:
  /// **'Try adjusting your search or filters.'**
  String get noProjectsMessage;

  /// No description provided for @noUnitsTitle.
  ///
  /// In en, this message translates to:
  /// **'No units found'**
  String get noUnitsTitle;

  /// No description provided for @noUnitsMessage.
  ///
  /// In en, this message translates to:
  /// **'Try adjusting your filters.'**
  String get noUnitsMessage;

  /// No description provided for @aboutProject.
  ///
  /// In en, this message translates to:
  /// **'About'**
  String get aboutProject;

  /// No description provided for @projectAmenities.
  ///
  /// In en, this message translates to:
  /// **'Amenities & services'**
  String get projectAmenities;

  /// No description provided for @projectLocation.
  ///
  /// In en, this message translates to:
  /// **'Location'**
  String get projectLocation;

  /// No description provided for @openInMaps.
  ///
  /// In en, this message translates to:
  /// **'Open in Maps'**
  String get openInMaps;

  /// No description provided for @projectAvailableUnits.
  ///
  /// In en, this message translates to:
  /// **'Available units'**
  String get projectAvailableUnits;

  /// No description provided for @availableUnitsCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =0{No available units} =1{1 available unit} other{{count} available units}}'**
  String availableUnitsCount(int count);

  /// No description provided for @viewUnits.
  ///
  /// In en, this message translates to:
  /// **'View units'**
  String get viewUnits;

  /// No description provided for @unitCode.
  ///
  /// In en, this message translates to:
  /// **'Unit {code}'**
  String unitCode(String code);

  /// No description provided for @unitOverview.
  ///
  /// In en, this message translates to:
  /// **'Overview'**
  String get unitOverview;

  /// No description provided for @labelArea.
  ///
  /// In en, this message translates to:
  /// **'Area'**
  String get labelArea;

  /// No description provided for @labelBedrooms.
  ///
  /// In en, this message translates to:
  /// **'Bedrooms'**
  String get labelBedrooms;

  /// No description provided for @labelBathrooms.
  ///
  /// In en, this message translates to:
  /// **'Bathrooms'**
  String get labelBathrooms;

  /// No description provided for @labelFloor.
  ///
  /// In en, this message translates to:
  /// **'Floor'**
  String get labelFloor;

  /// No description provided for @labelType.
  ///
  /// In en, this message translates to:
  /// **'Type'**
  String get labelType;

  /// No description provided for @labelPrice.
  ///
  /// In en, this message translates to:
  /// **'Price'**
  String get labelPrice;

  /// No description provided for @labelProject.
  ///
  /// In en, this message translates to:
  /// **'Project'**
  String get labelProject;

  /// No description provided for @areaValue.
  ///
  /// In en, this message translates to:
  /// **'{value} m²'**
  String areaValue(String value);

  /// No description provided for @statusAvailable.
  ///
  /// In en, this message translates to:
  /// **'Available'**
  String get statusAvailable;

  /// No description provided for @statusReserved.
  ///
  /// In en, this message translates to:
  /// **'Reserved'**
  String get statusReserved;

  /// No description provided for @statusSold.
  ///
  /// In en, this message translates to:
  /// **'Sold'**
  String get statusSold;

  /// No description provided for @requestVisit.
  ///
  /// In en, this message translates to:
  /// **'Request a visit'**
  String get requestVisit;

  /// No description provided for @requestVisitPrompt.
  ///
  /// In en, this message translates to:
  /// **'Sign in to request a visit, or contact us directly.'**
  String get requestVisitPrompt;

  /// No description provided for @contactTitle.
  ///
  /// In en, this message translates to:
  /// **'Get in touch'**
  String get contactTitle;

  /// No description provided for @contactCall.
  ///
  /// In en, this message translates to:
  /// **'Call'**
  String get contactCall;

  /// No description provided for @contactWhatsapp.
  ///
  /// In en, this message translates to:
  /// **'WhatsApp'**
  String get contactWhatsapp;

  /// No description provided for @compareTitle.
  ///
  /// In en, this message translates to:
  /// **'Compare units'**
  String get compareTitle;

  /// No description provided for @compareAdd.
  ///
  /// In en, this message translates to:
  /// **'Add to compare'**
  String get compareAdd;

  /// No description provided for @compareRemove.
  ///
  /// In en, this message translates to:
  /// **'Remove'**
  String get compareRemove;

  /// No description provided for @compareAdded.
  ///
  /// In en, this message translates to:
  /// **'Added to compare'**
  String get compareAdded;

  /// No description provided for @compareFull.
  ///
  /// In en, this message translates to:
  /// **'You can compare up to {max} units'**
  String compareFull(int max);

  /// No description provided for @compareEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'Nothing to compare yet'**
  String get compareEmptyTitle;

  /// No description provided for @compareEmptyMessage.
  ///
  /// In en, this message translates to:
  /// **'Add units from their details to compare them side by side.'**
  String get compareEmptyMessage;

  /// No description provided for @compareCount.
  ///
  /// In en, this message translates to:
  /// **'{count} selected'**
  String compareCount(int count);

  /// No description provided for @chatTitle.
  ///
  /// In en, this message translates to:
  /// **'Assistant'**
  String get chatTitle;

  /// No description provided for @chatInputHint.
  ///
  /// In en, this message translates to:
  /// **'Type a message…'**
  String get chatInputHint;

  /// No description provided for @chatRestart.
  ///
  /// In en, this message translates to:
  /// **'New chat'**
  String get chatRestart;

  /// No description provided for @chatUnavailable.
  ///
  /// In en, this message translates to:
  /// **'The assistant is unavailable right now.'**
  String get chatUnavailable;

  /// No description provided for @authWelcomeBack.
  ///
  /// In en, this message translates to:
  /// **'Welcome back'**
  String get authWelcomeBack;

  /// No description provided for @authCreateAccount.
  ///
  /// In en, this message translates to:
  /// **'Create account'**
  String get authCreateAccount;

  /// No description provided for @authLoginWithPhone.
  ///
  /// In en, this message translates to:
  /// **'Use phone instead'**
  String get authLoginWithPhone;

  /// No description provided for @authLoginWithEmail.
  ///
  /// In en, this message translates to:
  /// **'Use email instead'**
  String get authLoginWithEmail;

  /// No description provided for @authNoAccountCta.
  ///
  /// In en, this message translates to:
  /// **'Don\'t have an account? Register'**
  String get authNoAccountCta;

  /// No description provided for @authHaveAccountCta.
  ///
  /// In en, this message translates to:
  /// **'Already have an account? Log in'**
  String get authHaveAccountCta;

  /// No description provided for @authSendCode.
  ///
  /// In en, this message translates to:
  /// **'Send code'**
  String get authSendCode;

  /// No description provided for @authVerifyCode.
  ///
  /// In en, this message translates to:
  /// **'Verify'**
  String get authVerifyCode;

  /// No description provided for @authResendCode.
  ///
  /// In en, this message translates to:
  /// **'Resend code'**
  String get authResendCode;

  /// No description provided for @authOtpSentTo.
  ///
  /// In en, this message translates to:
  /// **'We sent a code to {phone}'**
  String authOtpSentTo(String phone);

  /// No description provided for @authAcceptTerms.
  ///
  /// In en, this message translates to:
  /// **'I accept the terms and conditions'**
  String get authAcceptTerms;

  /// No description provided for @fieldEmail.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get fieldEmail;

  /// No description provided for @fieldPassword.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get fieldPassword;

  /// No description provided for @fieldFullName.
  ///
  /// In en, this message translates to:
  /// **'Full name'**
  String get fieldFullName;

  /// No description provided for @fieldPhone.
  ///
  /// In en, this message translates to:
  /// **'Phone number'**
  String get fieldPhone;

  /// No description provided for @fieldOtpCode.
  ///
  /// In en, this message translates to:
  /// **'Verification code'**
  String get fieldOtpCode;

  /// No description provided for @validationRequired.
  ///
  /// In en, this message translates to:
  /// **'This field is required'**
  String get validationRequired;

  /// No description provided for @validationEmail.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid email'**
  String get validationEmail;

  /// No description provided for @validationPhone.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid phone number'**
  String get validationPhone;

  /// No description provided for @validationPasswordShort.
  ///
  /// In en, this message translates to:
  /// **'Password must be at least 8 characters'**
  String get validationPasswordShort;

  /// No description provided for @validationCodeShort.
  ///
  /// In en, this message translates to:
  /// **'Enter the code you received'**
  String get validationCodeShort;

  /// No description provided for @validationAcceptTerms.
  ///
  /// In en, this message translates to:
  /// **'Please accept the terms to continue'**
  String get validationAcceptTerms;

  /// No description provided for @accountGuestTitle.
  ///
  /// In en, this message translates to:
  /// **'You\'re browsing as a guest'**
  String get accountGuestTitle;

  /// No description provided for @accountGuestMessage.
  ///
  /// In en, this message translates to:
  /// **'Sign in to save favorites, request visits, and track your requests.'**
  String get accountGuestMessage;

  /// No description provided for @accountProfile.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get accountProfile;

  /// No description provided for @accountFavorites.
  ///
  /// In en, this message translates to:
  /// **'Favorites'**
  String get accountFavorites;

  /// No description provided for @accountMyRequests.
  ///
  /// In en, this message translates to:
  /// **'My requests'**
  String get accountMyRequests;

  /// No description provided for @accountNotifications.
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get accountNotifications;

  /// No description provided for @profileTitle.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get profileTitle;

  /// No description provided for @profileEdit.
  ///
  /// In en, this message translates to:
  /// **'Edit profile'**
  String get profileEdit;

  /// No description provided for @profileSaved.
  ///
  /// In en, this message translates to:
  /// **'Profile updated'**
  String get profileSaved;

  /// No description provided for @fieldLanguage.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get fieldLanguage;

  /// No description provided for @favoritesEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'No favorites yet'**
  String get favoritesEmptyTitle;

  /// No description provided for @favoritesEmptyMessage.
  ///
  /// In en, this message translates to:
  /// **'Tap the heart on a project or unit to save it here.'**
  String get favoritesEmptyMessage;

  /// No description provided for @favoriteAdded.
  ///
  /// In en, this message translates to:
  /// **'Added to favorites'**
  String get favoriteAdded;

  /// No description provided for @favoriteRemoved.
  ///
  /// In en, this message translates to:
  /// **'Removed from favorites'**
  String get favoriteRemoved;

  /// No description provided for @favoriteLoginPrompt.
  ///
  /// In en, this message translates to:
  /// **'Sign in to save favorites.'**
  String get favoriteLoginPrompt;

  /// No description provided for @myRequestsTitle.
  ///
  /// In en, this message translates to:
  /// **'My requests'**
  String get myRequestsTitle;

  /// No description provided for @visitRequestTitle.
  ///
  /// In en, this message translates to:
  /// **'Request a visit'**
  String get visitRequestTitle;

  /// No description provided for @fieldPreferredDate.
  ///
  /// In en, this message translates to:
  /// **'Preferred date'**
  String get fieldPreferredDate;

  /// No description provided for @fieldNotes.
  ///
  /// In en, this message translates to:
  /// **'Notes (optional)'**
  String get fieldNotes;

  /// No description provided for @selectDate.
  ///
  /// In en, this message translates to:
  /// **'Select date'**
  String get selectDate;

  /// No description provided for @visitSubmit.
  ///
  /// In en, this message translates to:
  /// **'Submit request'**
  String get visitSubmit;

  /// No description provided for @visitSubmitted.
  ///
  /// In en, this message translates to:
  /// **'Visit request sent'**
  String get visitSubmitted;

  /// No description provided for @myRequestsEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'No requests yet'**
  String get myRequestsEmptyTitle;

  /// No description provided for @myRequestsEmptyMessage.
  ///
  /// In en, this message translates to:
  /// **'Your visit requests will appear here.'**
  String get myRequestsEmptyMessage;

  /// No description provided for @visitOn.
  ///
  /// In en, this message translates to:
  /// **'Preferred: {date}'**
  String visitOn(String date);

  /// No description provided for @visitStatusPending.
  ///
  /// In en, this message translates to:
  /// **'Pending'**
  String get visitStatusPending;

  /// No description provided for @visitStatusApproved.
  ///
  /// In en, this message translates to:
  /// **'Approved'**
  String get visitStatusApproved;

  /// No description provided for @visitStatusScheduled.
  ///
  /// In en, this message translates to:
  /// **'Scheduled'**
  String get visitStatusScheduled;

  /// No description provided for @visitStatusCompleted.
  ///
  /// In en, this message translates to:
  /// **'Completed'**
  String get visitStatusCompleted;

  /// No description provided for @visitStatusCancelled.
  ///
  /// In en, this message translates to:
  /// **'Cancelled'**
  String get visitStatusCancelled;

  /// No description provided for @notificationsEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'No notifications'**
  String get notificationsEmptyTitle;

  /// No description provided for @notificationsEmptyMessage.
  ///
  /// In en, this message translates to:
  /// **'You\'re all caught up.'**
  String get notificationsEmptyMessage;

  /// No description provided for @markAllRead.
  ///
  /// In en, this message translates to:
  /// **'Mark all read'**
  String get markAllRead;

  /// No description provided for @notificationDefaultTitle.
  ///
  /// In en, this message translates to:
  /// **'Notification'**
  String get notificationDefaultTitle;

  /// No description provided for @navHome.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get navHome;

  /// No description provided for @navExplore.
  ///
  /// In en, this message translates to:
  /// **'Explore'**
  String get navExplore;

  /// No description provided for @navFavorites.
  ///
  /// In en, this message translates to:
  /// **'Favorites'**
  String get navFavorites;

  /// No description provided for @navAccount.
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get navAccount;

  /// No description provided for @navDashboard.
  ///
  /// In en, this message translates to:
  /// **'Dashboard'**
  String get navDashboard;

  /// No description provided for @navLeads.
  ///
  /// In en, this message translates to:
  /// **'Leads'**
  String get navLeads;

  /// No description provided for @navMore.
  ///
  /// In en, this message translates to:
  /// **'More'**
  String get navMore;

  /// No description provided for @authWelcomeTitle.
  ///
  /// In en, this message translates to:
  /// **'Welcome'**
  String get authWelcomeTitle;

  /// No description provided for @authWelcomeSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Sign in to continue'**
  String get authWelcomeSubtitle;

  /// No description provided for @placeholderScreen.
  ///
  /// In en, this message translates to:
  /// **'Coming soon'**
  String get placeholderScreen;

  /// No description provided for @placeholderScreenBody.
  ///
  /// In en, this message translates to:
  /// **'This screen is part of a later phase.'**
  String get placeholderScreenBody;

  /// No description provided for @accountMyProperty.
  ///
  /// In en, this message translates to:
  /// **'My property'**
  String get accountMyProperty;

  /// No description provided for @accountContracts.
  ///
  /// In en, this message translates to:
  /// **'Contracts'**
  String get accountContracts;

  /// No description provided for @accountDeposits.
  ///
  /// In en, this message translates to:
  /// **'Payments'**
  String get accountDeposits;

  /// No description provided for @accountMaintenance.
  ///
  /// In en, this message translates to:
  /// **'Maintenance'**
  String get accountMaintenance;

  /// No description provided for @myPropertyEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'No property yet'**
  String get myPropertyEmptyTitle;

  /// No description provided for @myPropertyEmptyMessage.
  ///
  /// In en, this message translates to:
  /// **'Once you reserve or own a unit, it will appear here.'**
  String get myPropertyEmptyMessage;

  /// No description provided for @myPropertyStatusOwned.
  ///
  /// In en, this message translates to:
  /// **'Owned'**
  String get myPropertyStatusOwned;

  /// No description provided for @myPropertyStatusReserved.
  ///
  /// In en, this message translates to:
  /// **'Reserved'**
  String get myPropertyStatusReserved;

  /// No description provided for @myPropertyContractNumber.
  ///
  /// In en, this message translates to:
  /// **'Contract no.'**
  String get myPropertyContractNumber;

  /// No description provided for @myPropertyReservationNumber.
  ///
  /// In en, this message translates to:
  /// **'Reservation no.'**
  String get myPropertyReservationNumber;

  /// No description provided for @myPropertySignedDate.
  ///
  /// In en, this message translates to:
  /// **'Signed on'**
  String get myPropertySignedDate;

  /// No description provided for @myPropertyInstallmentPlan.
  ///
  /// In en, this message translates to:
  /// **'Installment plan'**
  String get myPropertyInstallmentPlan;

  /// No description provided for @myPropertyInstallmentSummary.
  ///
  /// In en, this message translates to:
  /// **'{amount} / month · {months} months'**
  String myPropertyInstallmentSummary(String amount, int months);

  /// No description provided for @myPropertyRequestMaintenance.
  ///
  /// In en, this message translates to:
  /// **'Request maintenance'**
  String get myPropertyRequestMaintenance;

  /// No description provided for @myPropertyContactMessage.
  ///
  /// In en, this message translates to:
  /// **'Hello, I have a question about my unit {unit} in {project}.'**
  String myPropertyContactMessage(String project, String unit);

  /// No description provided for @contractsEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'No contracts'**
  String get contractsEmptyTitle;

  /// No description provided for @contractsEmptyMessage.
  ///
  /// In en, this message translates to:
  /// **'Your contracts will appear here once available.'**
  String get contractsEmptyMessage;

  /// No description provided for @contractStatusSigned.
  ///
  /// In en, this message translates to:
  /// **'Signed'**
  String get contractStatusSigned;

  /// No description provided for @contractStatusDraft.
  ///
  /// In en, this message translates to:
  /// **'Draft'**
  String get contractStatusDraft;

  /// No description provided for @contractsDocumentsTitle.
  ///
  /// In en, this message translates to:
  /// **'Documents'**
  String get contractsDocumentsTitle;

  /// No description provided for @documentsEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'No documents'**
  String get documentsEmptyTitle;

  /// No description provided for @documentsEmptyMessage.
  ///
  /// In en, this message translates to:
  /// **'There are no documents to show yet.'**
  String get documentsEmptyMessage;

  /// No description provided for @depositsEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'No payments'**
  String get depositsEmptyTitle;

  /// No description provided for @depositsEmptyMessage.
  ///
  /// In en, this message translates to:
  /// **'Your payments will appear here once recorded.'**
  String get depositsEmptyMessage;

  /// No description provided for @depositVerified.
  ///
  /// In en, this message translates to:
  /// **'Verified'**
  String get depositVerified;

  /// No description provided for @depositPending.
  ///
  /// In en, this message translates to:
  /// **'Pending verification'**
  String get depositPending;

  /// No description provided for @depositDetailTitle.
  ///
  /// In en, this message translates to:
  /// **'Payment details'**
  String get depositDetailTitle;

  /// No description provided for @depositPaidOn.
  ///
  /// In en, this message translates to:
  /// **'Paid on'**
  String get depositPaidOn;

  /// No description provided for @depositReceiptsTitle.
  ///
  /// In en, this message translates to:
  /// **'Receipts'**
  String get depositReceiptsTitle;

  /// No description provided for @depositNoReceipts.
  ///
  /// In en, this message translates to:
  /// **'No receipt has been attached to this payment yet.'**
  String get depositNoReceipts;

  /// No description provided for @depositTypeBooking.
  ///
  /// In en, this message translates to:
  /// **'Booking amount'**
  String get depositTypeBooking;

  /// No description provided for @depositTypeDownPayment.
  ///
  /// In en, this message translates to:
  /// **'Down payment'**
  String get depositTypeDownPayment;

  /// No description provided for @depositTypeInstallment.
  ///
  /// In en, this message translates to:
  /// **'Installment'**
  String get depositTypeInstallment;

  /// No description provided for @depositTypeFinal.
  ///
  /// In en, this message translates to:
  /// **'Final payment'**
  String get depositTypeFinal;

  /// No description provided for @depositTypePayment.
  ///
  /// In en, this message translates to:
  /// **'Payment'**
  String get depositTypePayment;

  /// No description provided for @maintenanceEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'No maintenance requests'**
  String get maintenanceEmptyTitle;

  /// No description provided for @maintenanceEmptyMessage.
  ///
  /// In en, this message translates to:
  /// **'File a request and we\'ll take care of it.'**
  String get maintenanceEmptyMessage;

  /// No description provided for @maintenanceNewRequest.
  ///
  /// In en, this message translates to:
  /// **'New request'**
  String get maintenanceNewRequest;

  /// No description provided for @maintenanceDetailTitle.
  ///
  /// In en, this message translates to:
  /// **'Request details'**
  String get maintenanceDetailTitle;

  /// No description provided for @maintenanceUnit.
  ///
  /// In en, this message translates to:
  /// **'Unit'**
  String get maintenanceUnit;

  /// No description provided for @maintenanceAttachmentsTitle.
  ///
  /// In en, this message translates to:
  /// **'Photos & documents'**
  String get maintenanceAttachmentsTitle;

  /// No description provided for @maintenanceNoAttachments.
  ///
  /// In en, this message translates to:
  /// **'No photos or documents have been attached yet.'**
  String get maintenanceNoAttachments;

  /// No description provided for @maintenanceUnitLabel.
  ///
  /// In en, this message translates to:
  /// **'Which unit?'**
  String get maintenanceUnitLabel;

  /// No description provided for @maintenanceUnitRequired.
  ///
  /// In en, this message translates to:
  /// **'Please select a unit.'**
  String get maintenanceUnitRequired;

  /// No description provided for @maintenanceNoUnitsTitle.
  ///
  /// In en, this message translates to:
  /// **'No units'**
  String get maintenanceNoUnitsTitle;

  /// No description provided for @maintenanceNoUnitsMessage.
  ///
  /// In en, this message translates to:
  /// **'You don\'t have any units to file a request against yet.'**
  String get maintenanceNoUnitsMessage;

  /// No description provided for @maintenanceCategoryLabel.
  ///
  /// In en, this message translates to:
  /// **'What needs attention?'**
  String get maintenanceCategoryLabel;

  /// No description provided for @maintenanceCategoryRequired.
  ///
  /// In en, this message translates to:
  /// **'Please select at least one category.'**
  String get maintenanceCategoryRequired;

  /// No description provided for @maintenanceDescriptionLabel.
  ///
  /// In en, this message translates to:
  /// **'Description'**
  String get maintenanceDescriptionLabel;

  /// No description provided for @maintenanceDescriptionHint.
  ///
  /// In en, this message translates to:
  /// **'Describe the issue in a few words'**
  String get maintenanceDescriptionHint;

  /// No description provided for @maintenanceDescriptionRequired.
  ///
  /// In en, this message translates to:
  /// **'Please add a short description (at least 5 characters).'**
  String get maintenanceDescriptionRequired;

  /// No description provided for @maintenanceSubmit.
  ///
  /// In en, this message translates to:
  /// **'Submit request'**
  String get maintenanceSubmit;

  /// No description provided for @maintenanceSubmitted.
  ///
  /// In en, this message translates to:
  /// **'Your request has been submitted.'**
  String get maintenanceSubmitted;

  /// No description provided for @maintenanceNoCategoriesTitle.
  ///
  /// In en, this message translates to:
  /// **'No categories'**
  String get maintenanceNoCategoriesTitle;

  /// No description provided for @maintenanceNoCategoriesMessage.
  ///
  /// In en, this message translates to:
  /// **'Maintenance categories aren\'t available right now. Please try again later.'**
  String get maintenanceNoCategoriesMessage;

  /// No description provided for @maintenanceStatusOpen.
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get maintenanceStatusOpen;

  /// No description provided for @maintenanceStatusAssigned.
  ///
  /// In en, this message translates to:
  /// **'Assigned'**
  String get maintenanceStatusAssigned;

  /// No description provided for @maintenanceStatusInProgress.
  ///
  /// In en, this message translates to:
  /// **'In progress'**
  String get maintenanceStatusInProgress;

  /// No description provided for @maintenanceStatusResolved.
  ///
  /// In en, this message translates to:
  /// **'Resolved'**
  String get maintenanceStatusResolved;

  /// No description provided for @maintenanceStatusClosed.
  ///
  /// In en, this message translates to:
  /// **'Closed'**
  String get maintenanceStatusClosed;

  /// No description provided for @maintenancePriorityLow.
  ///
  /// In en, this message translates to:
  /// **'Low'**
  String get maintenancePriorityLow;

  /// No description provided for @maintenancePriorityMedium.
  ///
  /// In en, this message translates to:
  /// **'Medium'**
  String get maintenancePriorityMedium;

  /// No description provided for @maintenancePriorityHigh.
  ///
  /// In en, this message translates to:
  /// **'High'**
  String get maintenancePriorityHigh;

  /// No description provided for @maintenancePriorityUrgent.
  ///
  /// In en, this message translates to:
  /// **'Urgent'**
  String get maintenancePriorityUrgent;

  /// No description provided for @maintenancePhotosLabel.
  ///
  /// In en, this message translates to:
  /// **'Photos (optional)'**
  String get maintenancePhotosLabel;

  /// No description provided for @maintenancePhotosHint.
  ///
  /// In en, this message translates to:
  /// **'Up to {count} images, {mb} MB each.'**
  String maintenancePhotosHint(int count, int mb);

  /// No description provided for @maintenanceAddPhoto.
  ///
  /// In en, this message translates to:
  /// **'Add photo'**
  String get maintenanceAddPhoto;

  /// No description provided for @maintenanceFromCamera.
  ///
  /// In en, this message translates to:
  /// **'Take a photo'**
  String get maintenanceFromCamera;

  /// No description provided for @maintenanceFromGallery.
  ///
  /// In en, this message translates to:
  /// **'Choose from gallery'**
  String get maintenanceFromGallery;

  /// No description provided for @maintenancePhotoUploaded.
  ///
  /// In en, this message translates to:
  /// **'Uploaded'**
  String get maintenancePhotoUploaded;

  /// No description provided for @maintenancePhotoPermissionDenied.
  ///
  /// In en, this message translates to:
  /// **'Permission is needed to access your camera or photos. You can enable it in Settings.'**
  String get maintenancePhotoPermissionDenied;

  /// No description provided for @maintenancePhotoTooMany.
  ///
  /// In en, this message translates to:
  /// **'You can attach up to {count} photos.'**
  String maintenancePhotoTooMany(int count);

  /// No description provided for @maintenancePhotoTooLarge.
  ///
  /// In en, this message translates to:
  /// **'Each photo must be {mb} MB or smaller.'**
  String maintenancePhotoTooLarge(int mb);

  /// No description provided for @maintenancePhotoUnsupported.
  ///
  /// In en, this message translates to:
  /// **'Only JPG, PNG, or WebP images are supported.'**
  String get maintenancePhotoUnsupported;

  /// No description provided for @maintenancePhotoPickFailed.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t add that photo. Please try again.'**
  String get maintenancePhotoPickFailed;

  /// No description provided for @maintenanceUploadPartial.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 photo failed to upload.} other{{count} photos failed to upload.}} Your request was still created.'**
  String maintenanceUploadPartial(int count);

  /// No description provided for @maintenanceRetryFailed.
  ///
  /// In en, this message translates to:
  /// **'Retry ({count})'**
  String maintenanceRetryFailed(int count);

  /// No description provided for @maintenanceFinishAnyway.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get maintenanceFinishAnyway;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['ar', 'en'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'ar':
      return AppLocalizationsAr();
    case 'en':
      return AppLocalizationsEn();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
