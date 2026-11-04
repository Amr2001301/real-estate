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
  /// **'Devora'**
  String get customerAppTitle;

  /// Staff app display name
  ///
  /// In en, this message translates to:
  /// **'Devora Staff'**
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

  /// No description provided for @logoutConfirmMessage.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to log out?'**
  String get logoutConfirmMessage;

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

  /// No description provided for @offlineMessage.
  ///
  /// In en, this message translates to:
  /// **'No internet connection'**
  String get offlineMessage;

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

  /// No description provided for @homeHeroEyebrow.
  ///
  /// In en, this message translates to:
  /// **'Curated properties'**
  String get homeHeroEyebrow;

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

  /// No description provided for @homeFeaturedUnits.
  ///
  /// In en, this message translates to:
  /// **'Selected units'**
  String get homeFeaturedUnits;

  /// No description provided for @homeCtaTitle.
  ///
  /// In en, this message translates to:
  /// **'Start your property journey with confidence'**
  String get homeCtaTitle;

  /// No description provided for @homeCtaSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Our advisors are here to guide you every step of the way.'**
  String get homeCtaSubtitle;

  /// No description provided for @homeCtaAction.
  ///
  /// In en, this message translates to:
  /// **'Talk to an advisor'**
  String get homeCtaAction;

  /// No description provided for @homeCtaSecondary.
  ///
  /// In en, this message translates to:
  /// **'Browse units'**
  String get homeCtaSecondary;

  /// No description provided for @homeCtaEyebrow.
  ///
  /// In en, this message translates to:
  /// **'Get started'**
  String get homeCtaEyebrow;

  /// No description provided for @homeSearchAction.
  ///
  /// In en, this message translates to:
  /// **'Search'**
  String get homeSearchAction;

  /// No description provided for @homeFilterAction.
  ///
  /// In en, this message translates to:
  /// **'Filters'**
  String get homeFilterAction;

  /// No description provided for @homeFilterTypeLabel.
  ///
  /// In en, this message translates to:
  /// **'Property type'**
  String get homeFilterTypeLabel;

  /// No description provided for @homeFilterAllUnits.
  ///
  /// In en, this message translates to:
  /// **'All units & filters'**
  String get homeFilterAllUnits;

  /// No description provided for @homeTypeResidential.
  ///
  /// In en, this message translates to:
  /// **'Residential'**
  String get homeTypeResidential;

  /// No description provided for @homeTypeOffice.
  ///
  /// In en, this message translates to:
  /// **'Office'**
  String get homeTypeOffice;

  /// No description provided for @homeTypeCommercial.
  ///
  /// In en, this message translates to:
  /// **'Commercial'**
  String get homeTypeCommercial;

  /// No description provided for @homeTypeMedical.
  ///
  /// In en, this message translates to:
  /// **'Medical'**
  String get homeTypeMedical;

  /// No description provided for @homeTypeHotel.
  ///
  /// In en, this message translates to:
  /// **'Hospitality'**
  String get homeTypeHotel;

  /// No description provided for @homeFilterHelper.
  ///
  /// In en, this message translates to:
  /// **'Choose a property type for a quick search.'**
  String get homeFilterHelper;

  /// No description provided for @homeFilterViewResults.
  ///
  /// In en, this message translates to:
  /// **'View results'**
  String get homeFilterViewResults;

  /// No description provided for @homeFilterClearSelection.
  ///
  /// In en, this message translates to:
  /// **'Clear selection'**
  String get homeFilterClearSelection;

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

  /// No description provided for @homeGuestGreeting.
  ///
  /// In en, this message translates to:
  /// **'Welcome'**
  String get homeGuestGreeting;

  /// No description provided for @homeGuestSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Discover the best projects and units'**
  String get homeGuestSubtitle;

  /// No description provided for @homeGreeting.
  ///
  /// In en, this message translates to:
  /// **'Hi, {name}'**
  String homeGreeting(String name);

  /// No description provided for @homeOwnerRole.
  ///
  /// In en, this message translates to:
  /// **'Unit owner'**
  String get homeOwnerRole;

  /// No description provided for @homeAfterSales.
  ///
  /// In en, this message translates to:
  /// **'After-sales services'**
  String get homeAfterSales;

  /// No description provided for @homeNextInstallment.
  ///
  /// In en, this message translates to:
  /// **'Next installment'**
  String get homeNextInstallment;

  /// No description provided for @homeInstallmentsRemaining.
  ///
  /// In en, this message translates to:
  /// **'{count} installments remaining'**
  String homeInstallmentsRemaining(int count);

  /// No description provided for @homeNoDuePayments.
  ///
  /// In en, this message translates to:
  /// **'No payments due'**
  String get homeNoDuePayments;

  /// No description provided for @homeNoDuePaymentsHint.
  ///
  /// In en, this message translates to:
  /// **'You\'re all caught up.'**
  String get homeNoDuePaymentsHint;

  /// No description provided for @homeViewInstallments.
  ///
  /// In en, this message translates to:
  /// **'View installments'**
  String get homeViewInstallments;

  /// No description provided for @homeRecentActivity.
  ///
  /// In en, this message translates to:
  /// **'Recent updates'**
  String get homeRecentActivity;

  /// No description provided for @homePaymentDueSoon.
  ///
  /// In en, this message translates to:
  /// **'Due soon'**
  String get homePaymentDueSoon;

  /// No description provided for @homePaymentUpcoming.
  ///
  /// In en, this message translates to:
  /// **'Upcoming'**
  String get homePaymentUpcoming;

  /// No description provided for @homeMonthlyInstallment.
  ///
  /// In en, this message translates to:
  /// **'Monthly'**
  String get homeMonthlyInstallment;

  /// No description provided for @homeViewContractPdf.
  ///
  /// In en, this message translates to:
  /// **'View contract PDF'**
  String get homeViewContractPdf;

  /// No description provided for @homeOwnershipSummary.
  ///
  /// In en, this message translates to:
  /// **'Ownership summary'**
  String get homeOwnershipSummary;

  /// No description provided for @homeOwnerEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'Start your property journey'**
  String get homeOwnerEmptyTitle;

  /// No description provided for @homeOwnerEmptyMessage.
  ///
  /// In en, this message translates to:
  /// **'Browse projects and units, save what matters, or request a visit.'**
  String get homeOwnerEmptyMessage;

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

  /// No description provided for @projectsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Browse projects and available units'**
  String get projectsSubtitle;

  /// No description provided for @projectsSearchHint.
  ///
  /// In en, this message translates to:
  /// **'Search projects'**
  String get projectsSearchHint;

  /// No description provided for @unitsSearchHint.
  ///
  /// In en, this message translates to:
  /// **'Search by code, type, project…'**
  String get unitsSearchHint;

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

  /// No description provided for @filterAreaUnit.
  ///
  /// In en, this message translates to:
  /// **'m²'**
  String get filterAreaUnit;

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

  /// No description provided for @projectOverview.
  ///
  /// In en, this message translates to:
  /// **'Overview'**
  String get projectOverview;

  /// No description provided for @projectAbout.
  ///
  /// In en, this message translates to:
  /// **'About the project'**
  String get projectAbout;

  /// No description provided for @projectUnits.
  ///
  /// In en, this message translates to:
  /// **'Project units'**
  String get projectUnits;

  /// No description provided for @labelAvailableUnits.
  ///
  /// In en, this message translates to:
  /// **'Available units'**
  String get labelAvailableUnits;

  /// No description provided for @labelCity.
  ///
  /// In en, this message translates to:
  /// **'City'**
  String get labelCity;

  /// No description provided for @labelAmenities.
  ///
  /// In en, this message translates to:
  /// **'Amenities'**
  String get labelAmenities;

  /// No description provided for @browseUnits.
  ///
  /// In en, this message translates to:
  /// **'Browse units'**
  String get browseUnits;

  /// No description provided for @talkToAdvisor.
  ///
  /// In en, this message translates to:
  /// **'Talk to an advisor'**
  String get talkToAdvisor;

  /// No description provided for @projectInterestedTitle.
  ///
  /// In en, this message translates to:
  /// **'Interested in this project?'**
  String get projectInterestedTitle;

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

  /// No description provided for @unitAbout.
  ///
  /// In en, this message translates to:
  /// **'About this unit'**
  String get unitAbout;

  /// No description provided for @unitAboutGeneric.
  ///
  /// In en, this message translates to:
  /// **'A carefully selected unit within a distinguished project — balancing comfort, location, and value.'**
  String get unitAboutGeneric;

  /// No description provided for @unitWithinProject.
  ///
  /// In en, this message translates to:
  /// **'Part of the project'**
  String get unitWithinProject;

  /// No description provided for @viewProject.
  ///
  /// In en, this message translates to:
  /// **'View project'**
  String get viewProject;

  /// No description provided for @viewProjectUnits.
  ///
  /// In en, this message translates to:
  /// **'View units'**
  String get viewProjectUnits;

  /// No description provided for @unitPlanTitle.
  ///
  /// In en, this message translates to:
  /// **'Unit plan'**
  String get unitPlanTitle;

  /// No description provided for @unitPlanOnRequest.
  ///
  /// In en, this message translates to:
  /// **'The detailed floor plan is available on request — contact us to receive it.'**
  String get unitPlanOnRequest;

  /// No description provided for @unitPlanRequest.
  ///
  /// In en, this message translates to:
  /// **'Request the plan'**
  String get unitPlanRequest;

  /// No description provided for @unitOtherInProject.
  ///
  /// In en, this message translates to:
  /// **'Other units in this project'**
  String get unitOtherInProject;

  /// No description provided for @requestInfo.
  ///
  /// In en, this message translates to:
  /// **'Request info'**
  String get requestInfo;

  /// No description provided for @infoRequestTitle.
  ///
  /// In en, this message translates to:
  /// **'Request Information'**
  String get infoRequestTitle;

  /// No description provided for @infoRequestMessage.
  ///
  /// In en, this message translates to:
  /// **'Message'**
  String get infoRequestMessage;

  /// No description provided for @infoRequestMessageHint.
  ///
  /// In en, this message translates to:
  /// **'What would you like to know about this project?'**
  String get infoRequestMessageHint;

  /// No description provided for @infoRequestMessageRequired.
  ///
  /// In en, this message translates to:
  /// **'Please enter a message'**
  String get infoRequestMessageRequired;

  /// No description provided for @infoRequestSubmit.
  ///
  /// In en, this message translates to:
  /// **'Send Request'**
  String get infoRequestSubmit;

  /// No description provided for @infoRequestSuccess.
  ///
  /// In en, this message translates to:
  /// **'Your request has been sent. We\'ll be in touch soon.'**
  String get infoRequestSuccess;

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

  /// No description provided for @compareSelectUnits.
  ///
  /// In en, this message translates to:
  /// **'Choose units to compare'**
  String get compareSelectUnits;

  /// No description provided for @compareSelectedCount.
  ///
  /// In en, this message translates to:
  /// **'{count}/{max} units'**
  String compareSelectedCount(int count, int max);

  /// No description provided for @compareNow.
  ///
  /// In en, this message translates to:
  /// **'Compare now'**
  String get compareNow;

  /// No description provided for @compareNeedMore.
  ///
  /// In en, this message translates to:
  /// **'Select another unit to compare'**
  String get compareNeedMore;

  /// No description provided for @compareAddAnother.
  ///
  /// In en, this message translates to:
  /// **'Add another unit to start comparing'**
  String get compareAddAnother;

  /// No description provided for @compareAddUnit.
  ///
  /// In en, this message translates to:
  /// **'Add a unit'**
  String get compareAddUnit;

  /// No description provided for @compareStepSelect.
  ///
  /// In en, this message translates to:
  /// **'Select'**
  String get compareStepSelect;

  /// No description provided for @compareStepLimit.
  ///
  /// In en, this message translates to:
  /// **'Up to 4'**
  String get compareStepLimit;

  /// No description provided for @compareStepCompare.
  ///
  /// In en, this message translates to:
  /// **'Compare'**
  String get compareStepCompare;

  /// No description provided for @compareBrowseUnits.
  ///
  /// In en, this message translates to:
  /// **'Browse units'**
  String get compareBrowseUnits;

  /// No description provided for @compareSelectionHint.
  ///
  /// In en, this message translates to:
  /// **'Select 2 to 4 units to compare'**
  String get compareSelectionHint;

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

  /// No description provided for @authEyebrow.
  ///
  /// In en, this message translates to:
  /// **'Devora Real Estate'**
  String get authEyebrow;

  /// No description provided for @authLoginSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Sign in to continue your property journey.'**
  String get authLoginSubtitle;

  /// No description provided for @authRegisterSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Create your account to unlock every feature.'**
  String get authRegisterSubtitle;

  /// No description provided for @authPhoneSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Enter your phone and we\'ll send a verification code.'**
  String get authPhoneSubtitle;

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

  /// No description provided for @authForgotPassword.
  ///
  /// In en, this message translates to:
  /// **'Forgot password?'**
  String get authForgotPassword;

  /// No description provided for @authForgotPasswordTitle.
  ///
  /// In en, this message translates to:
  /// **'Reset password'**
  String get authForgotPasswordTitle;

  /// No description provided for @authForgotPasswordSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Enter your email address and we\'ll send you a reset link.'**
  String get authForgotPasswordSubtitle;

  /// No description provided for @authForgotPasswordSent.
  ///
  /// In en, this message translates to:
  /// **'If that email is registered, a reset link has been sent.'**
  String get authForgotPasswordSent;

  /// No description provided for @authForgotPasswordSend.
  ///
  /// In en, this message translates to:
  /// **'Send reset link'**
  String get authForgotPasswordSend;

  /// No description provided for @authResetPasswordTitle.
  ///
  /// In en, this message translates to:
  /// **'New password'**
  String get authResetPasswordTitle;

  /// No description provided for @authResetPasswordSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Enter the token from your email and choose a new password.'**
  String get authResetPasswordSubtitle;

  /// No description provided for @authResetToken.
  ///
  /// In en, this message translates to:
  /// **'Reset token'**
  String get authResetToken;

  /// No description provided for @authNewPassword.
  ///
  /// In en, this message translates to:
  /// **'New password'**
  String get authNewPassword;

  /// No description provided for @authResetSuccess.
  ///
  /// In en, this message translates to:
  /// **'Password updated. Please log in.'**
  String get authResetSuccess;

  /// No description provided for @authResetSubmit.
  ///
  /// In en, this message translates to:
  /// **'Set new password'**
  String get authResetSubmit;

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

  /// No description provided for @fieldCompanyCode.
  ///
  /// In en, this message translates to:
  /// **'Company Code'**
  String get fieldCompanyCode;

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

  /// No description provided for @validationCompanyCode.
  ///
  /// In en, this message translates to:
  /// **'Enter the company code'**
  String get validationCompanyCode;

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

  /// No description provided for @profileAccountSettings.
  ///
  /// In en, this message translates to:
  /// **'Account & Performance'**
  String get profileAccountSettings;

  /// No description provided for @staffSectionTools.
  ///
  /// In en, this message translates to:
  /// **'Advisor Tools'**
  String get staffSectionTools;

  /// No description provided for @staffMyClientsDesc.
  ///
  /// In en, this message translates to:
  /// **'Manage clients and active opportunities'**
  String get staffMyClientsDesc;

  /// No description provided for @staffMyLeadsDesc.
  ///
  /// In en, this message translates to:
  /// **'Track sales stages and communication'**
  String get staffMyLeadsDesc;

  /// No description provided for @staffMyTargetsDesc.
  ///
  /// In en, this message translates to:
  /// **'Sales and unit targets'**
  String get staffMyTargetsDesc;

  /// No description provided for @staffMyBonusDesc.
  ///
  /// In en, this message translates to:
  /// **'Paid and pending amounts'**
  String get staffMyBonusDesc;

  /// No description provided for @staffMyVisitsDesc.
  ///
  /// In en, this message translates to:
  /// **'Visits schedule and follow-ups'**
  String get staffMyVisitsDesc;

  /// No description provided for @staffSectionOperations.
  ///
  /// In en, this message translates to:
  /// **'Sales Management'**
  String get staffSectionOperations;

  /// No description provided for @staffMyReservationsDesc.
  ///
  /// In en, this message translates to:
  /// **'Track unit bookings'**
  String get staffMyReservationsDesc;

  /// No description provided for @staffMyContractsDesc.
  ///
  /// In en, this message translates to:
  /// **'Manage contracts and documents'**
  String get staffMyContractsDesc;

  /// No description provided for @staffMyInventoryDesc.
  ///
  /// In en, this message translates to:
  /// **'Browse available units and projects'**
  String get staffMyInventoryDesc;

  /// No description provided for @staffMyCalculatorDesc.
  ///
  /// In en, this message translates to:
  /// **'Installment plan calculations'**
  String get staffMyCalculatorDesc;

  /// No description provided for @staffMyInquiriesDesc.
  ///
  /// In en, this message translates to:
  /// **'Customer requests and inquiries'**
  String get staffMyInquiriesDesc;

  /// No description provided for @staffShortcutPerformance.
  ///
  /// In en, this message translates to:
  /// **'My Performance'**
  String get staffShortcutPerformance;

  /// No description provided for @staffShortcutVisits.
  ///
  /// In en, this message translates to:
  /// **'My Visits'**
  String get staffShortcutVisits;

  /// No description provided for @staffShortcutClients.
  ///
  /// In en, this message translates to:
  /// **'My Clients'**
  String get staffShortcutClients;

  /// No description provided for @staffShortcutCommissions.
  ///
  /// In en, this message translates to:
  /// **'My Commissions'**
  String get staffShortcutCommissions;

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

  /// No description provided for @phoneChangeTitle.
  ///
  /// In en, this message translates to:
  /// **'Confirm your new number'**
  String get phoneChangeTitle;

  /// No description provided for @phoneChangeConfirm.
  ///
  /// In en, this message translates to:
  /// **'Confirm'**
  String get phoneChangeConfirm;

  /// No description provided for @phoneChanged.
  ///
  /// In en, this message translates to:
  /// **'Phone number changed'**
  String get phoneChanged;

  /// No description provided for @profileDeleteAccount.
  ///
  /// In en, this message translates to:
  /// **'Delete my account'**
  String get profileDeleteAccount;

  /// No description provided for @profileDeleteAccountTitle.
  ///
  /// In en, this message translates to:
  /// **'Delete your account?'**
  String get profileDeleteAccountTitle;

  /// No description provided for @profileDeleteAccountBody.
  ///
  /// In en, this message translates to:
  /// **'Your name, phone, e-mail and photo are removed and you are signed out. Your contract and payment records stay with the company. This cannot be undone.'**
  String get profileDeleteAccountBody;

  /// No description provided for @profileDeleteAccountConfirm.
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get profileDeleteAccountConfirm;

  /// No description provided for @fieldLanguage.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get fieldLanguage;

  /// No description provided for @settingsSecurity.
  ///
  /// In en, this message translates to:
  /// **'Security & Password'**
  String get settingsSecurity;

  /// No description provided for @settingsSupport.
  ///
  /// In en, this message translates to:
  /// **'Support & Help'**
  String get settingsSupport;

  /// No description provided for @bonusViewAll.
  ///
  /// In en, this message translates to:
  /// **'View Commissions'**
  String get bonusViewAll;

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

  /// No description provided for @navFinance.
  ///
  /// In en, this message translates to:
  /// **'Finance'**
  String get navFinance;

  /// No description provided for @financeHubSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Your installments, payments, and contracts in one place.'**
  String get financeHubSubtitle;

  /// No description provided for @financeInstallmentsDesc.
  ///
  /// In en, this message translates to:
  /// **'Schedule, due dates, and payment proofs'**
  String get financeInstallmentsDesc;

  /// No description provided for @financeDepositsDesc.
  ///
  /// In en, this message translates to:
  /// **'Booking and down-payment receipts'**
  String get financeDepositsDesc;

  /// No description provided for @financeContractsDesc.
  ///
  /// In en, this message translates to:
  /// **'Signed contracts and documents'**
  String get financeContractsDesc;

  /// No description provided for @dashboardWelcome.
  ///
  /// In en, this message translates to:
  /// **'Welcome back'**
  String get dashboardWelcome;

  /// No description provided for @dashboardQuickActions.
  ///
  /// In en, this message translates to:
  /// **'Quick actions'**
  String get dashboardQuickActions;

  /// No description provided for @dashboardOverview.
  ///
  /// In en, this message translates to:
  /// **'Overview'**
  String get dashboardOverview;

  /// No description provided for @accountSectionServices.
  ///
  /// In en, this message translates to:
  /// **'Customer services'**
  String get accountSectionServices;

  /// No description provided for @accountRoleCustomer.
  ///
  /// In en, this message translates to:
  /// **'Customer'**
  String get accountRoleCustomer;

  /// No description provided for @navCompare.
  ///
  /// In en, this message translates to:
  /// **'Compare'**
  String get navCompare;

  /// No description provided for @featuredBadge.
  ///
  /// In en, this message translates to:
  /// **'Featured'**
  String get featuredBadge;

  /// No description provided for @compareAddUnits.
  ///
  /// In en, this message translates to:
  /// **'Add units to compare'**
  String get compareAddUnits;

  /// No description provided for @accountSectionSettings.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get accountSectionSettings;

  /// No description provided for @moreSignInTitle.
  ///
  /// In en, this message translates to:
  /// **'Sign in to your account'**
  String get moreSignInTitle;

  /// No description provided for @moreSignInSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Continue your journey and keep your favorites & comparisons.'**
  String get moreSignInSubtitle;

  /// No description provided for @moreSectionGeneral.
  ///
  /// In en, this message translates to:
  /// **'General'**
  String get moreSectionGeneral;

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

  /// No description provided for @myPropertyHandedOverDate.
  ///
  /// In en, this message translates to:
  /// **'Handed over on'**
  String get myPropertyHandedOverDate;

  /// No description provided for @myPropertyNotHandedOver.
  ///
  /// In en, this message translates to:
  /// **'Not handed over yet — maintenance requests open at handover'**
  String get myPropertyNotHandedOver;

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

  /// No description provided for @contractsSearchHint.
  ///
  /// In en, this message translates to:
  /// **'Search by name, phone or number'**
  String get contractsSearchHint;

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

  /// No description provided for @contractSignedDate.
  ///
  /// In en, this message translates to:
  /// **'Date signed:'**
  String get contractSignedDate;

  /// No description provided for @contractsDocumentsTitle.
  ///
  /// In en, this message translates to:
  /// **'Documents'**
  String get contractsDocumentsTitle;

  /// No description provided for @contractCustomer.
  ///
  /// In en, this message translates to:
  /// **'Customer'**
  String get contractCustomer;

  /// No description provided for @contractUnit.
  ///
  /// In en, this message translates to:
  /// **'Unit'**
  String get contractUnit;

  /// No description provided for @contractTotalAmount.
  ///
  /// In en, this message translates to:
  /// **'Total amount'**
  String get contractTotalAmount;

  /// No description provided for @contractDownPayment.
  ///
  /// In en, this message translates to:
  /// **'Down payment'**
  String get contractDownPayment;

  /// No description provided for @contractSalesRep.
  ///
  /// In en, this message translates to:
  /// **'Sales rep'**
  String get contractSalesRep;

  /// No description provided for @contractMonthlyPayment.
  ///
  /// In en, this message translates to:
  /// **'Monthly payment'**
  String get contractMonthlyPayment;

  /// No description provided for @contractInstallmentLabel.
  ///
  /// In en, this message translates to:
  /// **'Installment plan'**
  String get contractInstallmentLabel;

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

  /// No description provided for @navDeposits.
  ///
  /// In en, this message translates to:
  /// **'Deposits'**
  String get navDeposits;

  /// No description provided for @recordDeposit.
  ///
  /// In en, this message translates to:
  /// **'Record Payment'**
  String get recordDeposit;

  /// No description provided for @depositAmount.
  ///
  /// In en, this message translates to:
  /// **'Amount'**
  String get depositAmount;

  /// No description provided for @depositPaymentDate.
  ///
  /// In en, this message translates to:
  /// **'Payment date'**
  String get depositPaymentDate;

  /// No description provided for @depositSelectInstallment.
  ///
  /// In en, this message translates to:
  /// **'Select installment'**
  String get depositSelectInstallment;

  /// No description provided for @depositContractRef.
  ///
  /// In en, this message translates to:
  /// **'Contract'**
  String get depositContractRef;

  /// No description provided for @depositRecordSuccess.
  ///
  /// In en, this message translates to:
  /// **'Payment recorded successfully'**
  String get depositRecordSuccess;

  /// No description provided for @installmentsTitle.
  ///
  /// In en, this message translates to:
  /// **'Installments'**
  String get installmentsTitle;

  /// No description provided for @installmentsEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'No installments yet'**
  String get installmentsEmptyTitle;

  /// No description provided for @installmentsEmptyMessage.
  ///
  /// In en, this message translates to:
  /// **'Your installment schedule will appear here once a plan is active.'**
  String get installmentsEmptyMessage;

  /// No description provided for @installmentStatusPending.
  ///
  /// In en, this message translates to:
  /// **'Pending'**
  String get installmentStatusPending;

  /// No description provided for @installmentStatusPaid.
  ///
  /// In en, this message translates to:
  /// **'Paid'**
  String get installmentStatusPaid;

  /// No description provided for @installmentStatusOverdue.
  ///
  /// In en, this message translates to:
  /// **'Overdue'**
  String get installmentStatusOverdue;

  /// No description provided for @installmentStatusCancelled.
  ///
  /// In en, this message translates to:
  /// **'Cancelled (rescheduled)'**
  String get installmentStatusCancelled;

  /// No description provided for @installmentDueOn.
  ///
  /// In en, this message translates to:
  /// **'Due on {date}'**
  String installmentDueOn(String date);

  /// No description provided for @installmentAmount.
  ///
  /// In en, this message translates to:
  /// **'Amount'**
  String get installmentAmount;

  /// No description provided for @paymentProofTitle.
  ///
  /// In en, this message translates to:
  /// **'Payment proof'**
  String get paymentProofTitle;

  /// No description provided for @paymentProofSubmit.
  ///
  /// In en, this message translates to:
  /// **'Submit proof'**
  String get paymentProofSubmit;

  /// No description provided for @paymentProofResubmit.
  ///
  /// In en, this message translates to:
  /// **'Resubmit proof'**
  String get paymentProofResubmit;

  /// No description provided for @paymentProofChooseFile.
  ///
  /// In en, this message translates to:
  /// **'Choose file'**
  String get paymentProofChooseFile;

  /// No description provided for @paymentProofMethodLabel.
  ///
  /// In en, this message translates to:
  /// **'Payment method'**
  String get paymentProofMethodLabel;

  /// No description provided for @paymentProofMethodBankTransfer.
  ///
  /// In en, this message translates to:
  /// **'Bank transfer'**
  String get paymentProofMethodBankTransfer;

  /// No description provided for @paymentProofMethodCashDeposit.
  ///
  /// In en, this message translates to:
  /// **'Cash deposit'**
  String get paymentProofMethodCashDeposit;

  /// No description provided for @paymentProofMethodManualCard.
  ///
  /// In en, this message translates to:
  /// **'Manual card'**
  String get paymentProofMethodManualCard;

  /// No description provided for @paymentProofMethodOther.
  ///
  /// In en, this message translates to:
  /// **'Other'**
  String get paymentProofMethodOther;

  /// No description provided for @paymentProofNoteHint.
  ///
  /// In en, this message translates to:
  /// **'Add a note (optional)'**
  String get paymentProofNoteHint;

  /// No description provided for @paymentProofStatusPendingReview.
  ///
  /// In en, this message translates to:
  /// **'Pending review'**
  String get paymentProofStatusPendingReview;

  /// No description provided for @paymentProofStatusApproved.
  ///
  /// In en, this message translates to:
  /// **'Approved'**
  String get paymentProofStatusApproved;

  /// No description provided for @paymentProofStatusRejected.
  ///
  /// In en, this message translates to:
  /// **'Rejected'**
  String get paymentProofStatusRejected;

  /// No description provided for @paymentProofRejectionReason.
  ///
  /// In en, this message translates to:
  /// **'Reason: {reason}'**
  String paymentProofRejectionReason(String reason);

  /// No description provided for @paymentProofSubmittedSuccess.
  ///
  /// In en, this message translates to:
  /// **'Proof submitted successfully'**
  String get paymentProofSubmittedSuccess;

  /// No description provided for @paymentProofUploadFailed.
  ///
  /// In en, this message translates to:
  /// **'Upload failed. Please try again.'**
  String get paymentProofUploadFailed;

  /// No description provided for @paymentProofFileTooLarge.
  ///
  /// In en, this message translates to:
  /// **'File is too large (max 25 MB)'**
  String get paymentProofFileTooLarge;

  /// No description provided for @paymentProofUnsupportedType.
  ///
  /// In en, this message translates to:
  /// **'Unsupported file type. PDF, JPEG, PNG, or WebP only.'**
  String get paymentProofUnsupportedType;

  /// No description provided for @paymentProofNoFile.
  ///
  /// In en, this message translates to:
  /// **'Please choose a file first.'**
  String get paymentProofNoFile;

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

  /// No description provided for @maintenancePriorityValue.
  ///
  /// In en, this message translates to:
  /// **'{value} priority'**
  String maintenancePriorityValue(String value);

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

  /// No description provided for @navClients.
  ///
  /// In en, this message translates to:
  /// **'Clients'**
  String get navClients;

  /// No description provided for @navProjects.
  ///
  /// In en, this message translates to:
  /// **'Projects'**
  String get navProjects;

  /// No description provided for @navProfile.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get navProfile;

  /// No description provided for @navUnits.
  ///
  /// In en, this message translates to:
  /// **'Units'**
  String get navUnits;

  /// No description provided for @staffLoginSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Sign in to your staff account'**
  String get staffLoginSubtitle;

  /// No description provided for @errorTenantMismatch.
  ///
  /// In en, this message translates to:
  /// **'Your session does not match this company. Please sign in again.'**
  String get errorTenantMismatch;

  /// No description provided for @roleSales.
  ///
  /// In en, this message translates to:
  /// **'Sales Advisor'**
  String get roleSales;

  /// No description provided for @roleSalesManager.
  ///
  /// In en, this message translates to:
  /// **'Sales Manager'**
  String get roleSalesManager;

  /// No description provided for @roleBroker.
  ///
  /// In en, this message translates to:
  /// **'Broker'**
  String get roleBroker;

  /// No description provided for @roleAdmin.
  ///
  /// In en, this message translates to:
  /// **'Administrator'**
  String get roleAdmin;

  /// No description provided for @roleMaintenance.
  ///
  /// In en, this message translates to:
  /// **'Maintenance Supervisor'**
  String get roleMaintenance;

  /// No description provided for @roleStaff.
  ///
  /// In en, this message translates to:
  /// **'Staff'**
  String get roleStaff;

  /// No description provided for @brokerComingSoonTitle.
  ///
  /// In en, this message translates to:
  /// **'Broker workspace coming soon'**
  String get brokerComingSoonTitle;

  /// No description provided for @brokerComingSoonMessage.
  ///
  /// In en, this message translates to:
  /// **'Your broker tools are on the way. You\'ll be able to manage submissions and commissions here soon.'**
  String get brokerComingSoonMessage;

  /// No description provided for @dashboardLeads.
  ///
  /// In en, this message translates to:
  /// **'Leads'**
  String get dashboardLeads;

  /// No description provided for @dashboardTodayVisits.
  ///
  /// In en, this message translates to:
  /// **'Today\'s visits'**
  String get dashboardTodayVisits;

  /// No description provided for @dashboardScheduledVisits.
  ///
  /// In en, this message translates to:
  /// **'Scheduled visits'**
  String get dashboardScheduledVisits;

  /// No description provided for @dashboardReservations.
  ///
  /// In en, this message translates to:
  /// **'Reservations'**
  String get dashboardReservations;

  /// No description provided for @dashboardPipeline.
  ///
  /// In en, this message translates to:
  /// **'Pipeline'**
  String get dashboardPipeline;

  /// No description provided for @leadStageNew.
  ///
  /// In en, this message translates to:
  /// **'New'**
  String get leadStageNew;

  /// No description provided for @leadStageInterested.
  ///
  /// In en, this message translates to:
  /// **'Interested'**
  String get leadStageInterested;

  /// No description provided for @leadStageVisit.
  ///
  /// In en, this message translates to:
  /// **'Visit'**
  String get leadStageVisit;

  /// No description provided for @leadStageNegotiation.
  ///
  /// In en, this message translates to:
  /// **'Negotiation'**
  String get leadStageNegotiation;

  /// No description provided for @leadStageWon.
  ///
  /// In en, this message translates to:
  /// **'Won'**
  String get leadStageWon;

  /// No description provided for @leadStageLost.
  ///
  /// In en, this message translates to:
  /// **'Lost'**
  String get leadStageLost;

  /// No description provided for @leadsSearchHint.
  ///
  /// In en, this message translates to:
  /// **'Search by name or phone'**
  String get leadsSearchHint;

  /// No description provided for @leadsFilterAll.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get leadsFilterAll;

  /// No description provided for @leadsFilterSource.
  ///
  /// In en, this message translates to:
  /// **'Source'**
  String get leadsFilterSource;

  /// No description provided for @leadsFilterDateFrom.
  ///
  /// In en, this message translates to:
  /// **'From date'**
  String get leadsFilterDateFrom;

  /// No description provided for @leadsFilterDateTo.
  ///
  /// In en, this message translates to:
  /// **'To date'**
  String get leadsFilterDateTo;

  /// No description provided for @leadsFilterApply.
  ///
  /// In en, this message translates to:
  /// **'Apply filters'**
  String get leadsFilterApply;

  /// No description provided for @leadsFilterClear.
  ///
  /// In en, this message translates to:
  /// **'Clear all'**
  String get leadsFilterClear;

  /// No description provided for @leadsActiveFilters.
  ///
  /// In en, this message translates to:
  /// **'Active filters'**
  String get leadsActiveFilters;

  /// No description provided for @leadsFilterSheet.
  ///
  /// In en, this message translates to:
  /// **'Filter leads'**
  String get leadsFilterSheet;

  /// No description provided for @leadsMine.
  ///
  /// In en, this message translates to:
  /// **'My leads'**
  String get leadsMine;

  /// No description provided for @leadsEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'No leads'**
  String get leadsEmptyTitle;

  /// No description provided for @leadsEmptyMessage.
  ///
  /// In en, this message translates to:
  /// **'Leads assigned to you will appear here.'**
  String get leadsEmptyMessage;

  /// No description provided for @leadInterest.
  ///
  /// In en, this message translates to:
  /// **'Interested in'**
  String get leadInterest;

  /// No description provided for @leadAssignedTo.
  ///
  /// In en, this message translates to:
  /// **'Assigned to'**
  String get leadAssignedTo;

  /// No description provided for @leadChangeStage.
  ///
  /// In en, this message translates to:
  /// **'Change stage'**
  String get leadChangeStage;

  /// No description provided for @leadAddNote.
  ///
  /// In en, this message translates to:
  /// **'Add a note'**
  String get leadAddNote;

  /// No description provided for @leadNoteHint.
  ///
  /// In en, this message translates to:
  /// **'Write a note…'**
  String get leadNoteHint;

  /// No description provided for @leadTimeline.
  ///
  /// In en, this message translates to:
  /// **'Timeline'**
  String get leadTimeline;

  /// No description provided for @leadTimelineEmpty.
  ///
  /// In en, this message translates to:
  /// **'No activity yet.'**
  String get leadTimelineEmpty;

  /// No description provided for @leadActivityCall.
  ///
  /// In en, this message translates to:
  /// **'Call logged'**
  String get leadActivityCall;

  /// No description provided for @leadActivityEmail.
  ///
  /// In en, this message translates to:
  /// **'Email logged'**
  String get leadActivityEmail;

  /// No description provided for @leadActivityStatusChange.
  ///
  /// In en, this message translates to:
  /// **'Stage changed'**
  String get leadActivityStatusChange;

  /// No description provided for @leadActivityVisit.
  ///
  /// In en, this message translates to:
  /// **'Visit'**
  String get leadActivityVisit;

  /// No description provided for @leadActivityNote.
  ///
  /// In en, this message translates to:
  /// **'Note added'**
  String get leadActivityNote;

  /// No description provided for @leadActivityReservation.
  ///
  /// In en, this message translates to:
  /// **'Reservation'**
  String get leadActivityReservation;

  /// No description provided for @leadActivityCreated.
  ///
  /// In en, this message translates to:
  /// **'Lead created'**
  String get leadActivityCreated;

  /// No description provided for @leadNew.
  ///
  /// In en, this message translates to:
  /// **'New lead'**
  String get leadNew;

  /// No description provided for @leadCreate.
  ///
  /// In en, this message translates to:
  /// **'Create lead'**
  String get leadCreate;

  /// No description provided for @leadCreated.
  ///
  /// In en, this message translates to:
  /// **'Lead created.'**
  String get leadCreated;

  /// No description provided for @leadFullName.
  ///
  /// In en, this message translates to:
  /// **'Full name'**
  String get leadFullName;

  /// No description provided for @leadFullNameRequired.
  ///
  /// In en, this message translates to:
  /// **'Please enter a name.'**
  String get leadFullNameRequired;

  /// No description provided for @leadPhone.
  ///
  /// In en, this message translates to:
  /// **'Phone'**
  String get leadPhone;

  /// No description provided for @leadEmail.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get leadEmail;

  /// No description provided for @leadNotes.
  ///
  /// In en, this message translates to:
  /// **'Notes'**
  String get leadNotes;

  /// No description provided for @clientsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Track your clients and their current opportunities'**
  String get clientsSubtitle;

  /// No description provided for @leadsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Track sales stages and communicate with your leads'**
  String get leadsSubtitle;

  /// No description provided for @clientsSearchHint.
  ///
  /// In en, this message translates to:
  /// **'Search clients'**
  String get clientsSearchHint;

  /// No description provided for @clientsEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'No clients'**
  String get clientsEmptyTitle;

  /// No description provided for @clientsEmptyMessage.
  ///
  /// In en, this message translates to:
  /// **'Clients from your leads will appear here.'**
  String get clientsEmptyMessage;

  /// No description provided for @clientsLeadCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 lead} other{{count} leads}}'**
  String clientsLeadCount(int count);

  /// No description provided for @salesOpportunityCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 opportunity} other{{count} opportunities}}'**
  String salesOpportunityCount(int count);

  /// No description provided for @callClient.
  ///
  /// In en, this message translates to:
  /// **'Call client'**
  String get callClient;

  /// No description provided for @clientLeads.
  ///
  /// In en, this message translates to:
  /// **'Leads'**
  String get clientLeads;

  /// No description provided for @projectsEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'No projects'**
  String get projectsEmptyTitle;

  /// No description provided for @projectsEmptyMessage.
  ///
  /// In en, this message translates to:
  /// **'Projects will appear here.'**
  String get projectsEmptyMessage;

  /// No description provided for @projectStatusPublished.
  ///
  /// In en, this message translates to:
  /// **'Published'**
  String get projectStatusPublished;

  /// No description provided for @projectStatusDraft.
  ///
  /// In en, this message translates to:
  /// **'Draft'**
  String get projectStatusDraft;

  /// No description provided for @projectStatusArchived.
  ///
  /// In en, this message translates to:
  /// **'Archived'**
  String get projectStatusArchived;

  /// No description provided for @projectAvailableLabel.
  ///
  /// In en, this message translates to:
  /// **'Available'**
  String get projectAvailableLabel;

  /// No description provided for @projectTotalLabel.
  ///
  /// In en, this message translates to:
  /// **'Total'**
  String get projectTotalLabel;

  /// No description provided for @projectSoldLabel.
  ///
  /// In en, this message translates to:
  /// **'Sold'**
  String get projectSoldLabel;

  /// No description provided for @projectStartingFrom.
  ///
  /// In en, this message translates to:
  /// **'From'**
  String get projectStartingFrom;

  /// No description provided for @priceOnRequest.
  ///
  /// In en, this message translates to:
  /// **'Price on request'**
  String get priceOnRequest;

  /// No description provided for @projectUnitTypes.
  ///
  /// In en, this message translates to:
  /// **'Types'**
  String get projectUnitTypes;

  /// No description provided for @unitsEmptyMessage.
  ///
  /// In en, this message translates to:
  /// **'No units in this project yet.'**
  String get unitsEmptyMessage;

  /// No description provided for @unitType.
  ///
  /// In en, this message translates to:
  /// **'Type'**
  String get unitType;

  /// No description provided for @unitBedrooms.
  ///
  /// In en, this message translates to:
  /// **'Bedrooms'**
  String get unitBedrooms;

  /// No description provided for @unitArea.
  ///
  /// In en, this message translates to:
  /// **'Area'**
  String get unitArea;

  /// No description provided for @unitPrice.
  ///
  /// In en, this message translates to:
  /// **'Price'**
  String get unitPrice;

  /// No description provided for @unitStatusAvailable.
  ///
  /// In en, this message translates to:
  /// **'Available'**
  String get unitStatusAvailable;

  /// No description provided for @unitStatusReserved.
  ///
  /// In en, this message translates to:
  /// **'Reserved'**
  String get unitStatusReserved;

  /// No description provided for @unitStatusSold.
  ///
  /// In en, this message translates to:
  /// **'Sold'**
  String get unitStatusSold;

  /// No description provided for @showMore.
  ///
  /// In en, this message translates to:
  /// **'Show more'**
  String get showMore;

  /// No description provided for @showLess.
  ///
  /// In en, this message translates to:
  /// **'Show less'**
  String get showLess;

  /// No description provided for @viewUnit.
  ///
  /// In en, this message translates to:
  /// **'View unit'**
  String get viewUnit;

  /// No description provided for @unitFloor.
  ///
  /// In en, this message translates to:
  /// **'Floor'**
  String get unitFloor;

  /// No description provided for @unitBathrooms.
  ///
  /// In en, this message translates to:
  /// **'Bathrooms'**
  String get unitBathrooms;

  /// No description provided for @unitDetails.
  ///
  /// In en, this message translates to:
  /// **'Unit details'**
  String get unitDetails;

  /// No description provided for @pricePerMeter.
  ///
  /// In en, this message translates to:
  /// **'Price per m²'**
  String get pricePerMeter;

  /// No description provided for @navVisits.
  ///
  /// In en, this message translates to:
  /// **'Visits'**
  String get navVisits;

  /// No description provided for @navReservations.
  ///
  /// In en, this message translates to:
  /// **'Reservations'**
  String get navReservations;

  /// No description provided for @navContracts.
  ///
  /// In en, this message translates to:
  /// **'Contracts'**
  String get navContracts;

  /// No description provided for @visitsToday.
  ///
  /// In en, this message translates to:
  /// **'Today'**
  String get visitsToday;

  /// No description provided for @visitsEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'No visits'**
  String get visitsEmptyTitle;

  /// No description provided for @visitsEmptyMessage.
  ///
  /// In en, this message translates to:
  /// **'Scheduled visits will appear here.'**
  String get visitsEmptyMessage;

  /// No description provided for @visitNew.
  ///
  /// In en, this message translates to:
  /// **'Schedule visit'**
  String get visitNew;

  /// No description provided for @visitCreate.
  ///
  /// In en, this message translates to:
  /// **'Create visit'**
  String get visitCreate;

  /// No description provided for @visitCreated.
  ///
  /// In en, this message translates to:
  /// **'Visit scheduled.'**
  String get visitCreated;

  /// No description provided for @visitProject.
  ///
  /// In en, this message translates to:
  /// **'Project'**
  String get visitProject;

  /// No description provided for @visitProjectRequired.
  ///
  /// In en, this message translates to:
  /// **'Please select a project.'**
  String get visitProjectRequired;

  /// No description provided for @visitSelectProject.
  ///
  /// In en, this message translates to:
  /// **'Select a project'**
  String get visitSelectProject;

  /// No description provided for @visitWhen.
  ///
  /// In en, this message translates to:
  /// **'Date & time'**
  String get visitWhen;

  /// No description provided for @visitPickDateTime.
  ///
  /// In en, this message translates to:
  /// **'Pick date & time'**
  String get visitPickDateTime;

  /// No description provided for @visitScheduleRequired.
  ///
  /// In en, this message translates to:
  /// **'Please pick a date & time.'**
  String get visitScheduleRequired;

  /// No description provided for @visitLocation.
  ///
  /// In en, this message translates to:
  /// **'Location'**
  String get visitLocation;

  /// No description provided for @visitNotes.
  ///
  /// In en, this message translates to:
  /// **'Notes'**
  String get visitNotes;

  /// No description provided for @visitSectionClient.
  ///
  /// In en, this message translates to:
  /// **'Client'**
  String get visitSectionClient;

  /// No description provided for @visitSectionClientSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Choose the client type linked to this visit.'**
  String get visitSectionClientSubtitle;

  /// No description provided for @visitClientTypeLead.
  ///
  /// In en, this message translates to:
  /// **'CRM Lead'**
  String get visitClientTypeLead;

  /// No description provided for @visitClientTypeRegistered.
  ///
  /// In en, this message translates to:
  /// **'Registered Client'**
  String get visitClientTypeRegistered;

  /// No description provided for @visitClientTypeWalkin.
  ///
  /// In en, this message translates to:
  /// **'Walk-in (No Account)'**
  String get visitClientTypeWalkin;

  /// No description provided for @visitLeadRequired.
  ///
  /// In en, this message translates to:
  /// **'Please select a lead.'**
  String get visitLeadRequired;

  /// No description provided for @visitClientRequired.
  ///
  /// In en, this message translates to:
  /// **'Please select a registered client.'**
  String get visitClientRequired;

  /// No description provided for @visitWalkInNameLabel.
  ///
  /// In en, this message translates to:
  /// **'Client Name'**
  String get visitWalkInNameLabel;

  /// No description provided for @visitWalkInNameHint.
  ///
  /// In en, this message translates to:
  /// **'e.g. Ahmed Khaled'**
  String get visitWalkInNameHint;

  /// No description provided for @visitWalkInPhoneLabel.
  ///
  /// In en, this message translates to:
  /// **'Phone Number'**
  String get visitWalkInPhoneLabel;

  /// No description provided for @visitWalkInPhoneHint.
  ///
  /// In en, this message translates to:
  /// **'e.g. 01012345678'**
  String get visitWalkInPhoneHint;

  /// No description provided for @visitWalkInNameRequired.
  ///
  /// In en, this message translates to:
  /// **'Please enter the client name.'**
  String get visitWalkInNameRequired;

  /// No description provided for @visitWalkInPhoneRequired.
  ///
  /// In en, this message translates to:
  /// **'Please enter the phone number.'**
  String get visitWalkInPhoneRequired;

  /// No description provided for @visitClientSearch.
  ///
  /// In en, this message translates to:
  /// **'Search by name or phone...'**
  String get visitClientSearch;

  /// No description provided for @visitClientSelect.
  ///
  /// In en, this message translates to:
  /// **'— Select a registered client —'**
  String get visitClientSelect;

  /// No description provided for @visitLeadSearch.
  ///
  /// In en, this message translates to:
  /// **'Search by client name...'**
  String get visitLeadSearch;

  /// No description provided for @visitLeadSelect.
  ///
  /// In en, this message translates to:
  /// **'— Select a lead —'**
  String get visitLeadSelect;

  /// No description provided for @visitSectionProject.
  ///
  /// In en, this message translates to:
  /// **'Project & Unit'**
  String get visitSectionProject;

  /// No description provided for @visitSectionProjectSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Select the project to visit. Optionally pick a specific unit.'**
  String get visitSectionProjectSubtitle;

  /// No description provided for @visitSelectUnit.
  ///
  /// In en, this message translates to:
  /// **'— No specific unit —'**
  String get visitSelectUnit;

  /// No description provided for @visitNoUnit.
  ///
  /// In en, this message translates to:
  /// **'No specific unit'**
  String get visitNoUnit;

  /// No description provided for @visitNoUnits.
  ///
  /// In en, this message translates to:
  /// **'No units available for this project.'**
  String get visitNoUnits;

  /// No description provided for @visitSectionSchedule.
  ///
  /// In en, this message translates to:
  /// **'Visit Schedule'**
  String get visitSectionSchedule;

  /// No description provided for @visitSectionScheduleSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Set the visit date and add any notes.'**
  String get visitSectionScheduleSubtitle;

  /// No description provided for @visitUpdateStatus.
  ///
  /// In en, this message translates to:
  /// **'Update status'**
  String get visitUpdateStatus;

  /// No description provided for @visitActionConfirm.
  ///
  /// In en, this message translates to:
  /// **'Confirm'**
  String get visitActionConfirm;

  /// No description provided for @visitActionComplete.
  ///
  /// In en, this message translates to:
  /// **'Complete'**
  String get visitActionComplete;

  /// No description provided for @visitActionCancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get visitActionCancel;

  /// No description provided for @visitActionNoShow.
  ///
  /// In en, this message translates to:
  /// **'No-show'**
  String get visitActionNoShow;

  /// No description provided for @visitReasonTitle.
  ///
  /// In en, this message translates to:
  /// **'Add a reason'**
  String get visitReasonTitle;

  /// No description provided for @visitReasonHint.
  ///
  /// In en, this message translates to:
  /// **'Optional reason'**
  String get visitReasonHint;

  /// No description provided for @visitStatusConfirmed.
  ///
  /// In en, this message translates to:
  /// **'Confirmed'**
  String get visitStatusConfirmed;

  /// No description provided for @visitStatusNoShow.
  ///
  /// In en, this message translates to:
  /// **'No-show'**
  String get visitStatusNoShow;

  /// No description provided for @visitStatusRescheduled.
  ///
  /// In en, this message translates to:
  /// **'Rescheduled'**
  String get visitStatusRescheduled;

  /// No description provided for @visitStatusPendingReschedule.
  ///
  /// In en, this message translates to:
  /// **'Reschedule requested'**
  String get visitStatusPendingReschedule;

  /// No description provided for @appointmentStatusAwaitingCustomer.
  ///
  /// In en, this message translates to:
  /// **'Awaiting your confirmation'**
  String get appointmentStatusAwaitingCustomer;

  /// No description provided for @appointmentStatusConfirmedByCustomer.
  ///
  /// In en, this message translates to:
  /// **'Confirmed by you'**
  String get appointmentStatusConfirmedByCustomer;

  /// No description provided for @appointmentStatusPendingRescheduleCustomer.
  ///
  /// In en, this message translates to:
  /// **'You requested a reschedule'**
  String get appointmentStatusPendingRescheduleCustomer;

  /// No description provided for @appointmentStatusAwaitingCustomerStaff.
  ///
  /// In en, this message translates to:
  /// **'Awaiting customer confirmation'**
  String get appointmentStatusAwaitingCustomerStaff;

  /// No description provided for @appointmentStatusConfirmedByCustomerStaff.
  ///
  /// In en, this message translates to:
  /// **'Customer confirmed'**
  String get appointmentStatusConfirmedByCustomerStaff;

  /// No description provided for @appointmentStatusPendingRescheduleStaff.
  ///
  /// In en, this message translates to:
  /// **'Customer requested reschedule'**
  String get appointmentStatusPendingRescheduleStaff;

  /// No description provided for @appointmentActionConfirm.
  ///
  /// In en, this message translates to:
  /// **'Confirm appointment'**
  String get appointmentActionConfirm;

  /// No description provided for @appointmentActionRequestReschedule.
  ///
  /// In en, this message translates to:
  /// **'Request reschedule'**
  String get appointmentActionRequestReschedule;

  /// No description provided for @appointmentRescheduleReasonLabel.
  ///
  /// In en, this message translates to:
  /// **'Reason for reschedule (optional)'**
  String get appointmentRescheduleReasonLabel;

  /// No description provided for @appointmentRescheduleReasonHint.
  ///
  /// In en, this message translates to:
  /// **'E.g. I have another commitment at that time.'**
  String get appointmentRescheduleReasonHint;

  /// No description provided for @appointmentSendReschedule.
  ///
  /// In en, this message translates to:
  /// **'Send request'**
  String get appointmentSendReschedule;

  /// No description provided for @appointmentConfirmSuccess.
  ///
  /// In en, this message translates to:
  /// **'Visit confirmed. We\'ll see you on the agreed date.'**
  String get appointmentConfirmSuccess;

  /// No description provided for @appointmentRescheduleSuccess.
  ///
  /// In en, this message translates to:
  /// **'Your reschedule request was sent.'**
  String get appointmentRescheduleSuccess;

  /// No description provided for @appointmentProposedDateLabel.
  ///
  /// In en, this message translates to:
  /// **'Proposed date'**
  String get appointmentProposedDateLabel;

  /// No description provided for @preferredTimeLabel.
  ///
  /// In en, this message translates to:
  /// **'Preferred time'**
  String get preferredTimeLabel;

  /// No description provided for @customerMessageLabel.
  ///
  /// In en, this message translates to:
  /// **'Customer message'**
  String get customerMessageLabel;

  /// No description provided for @customerRescheduleReasonLabel.
  ///
  /// In en, this message translates to:
  /// **'Reschedule reason'**
  String get customerRescheduleReasonLabel;

  /// No description provided for @visitReschedule.
  ///
  /// In en, this message translates to:
  /// **'Reschedule'**
  String get visitReschedule;

  /// No description provided for @visitRescheduleSuccess.
  ///
  /// In en, this message translates to:
  /// **'Visit rescheduled.'**
  String get visitRescheduleSuccess;

  /// No description provided for @visitReassign.
  ///
  /// In en, this message translates to:
  /// **'Reassign'**
  String get visitReassign;

  /// No description provided for @visitReassignSalesHint.
  ///
  /// In en, this message translates to:
  /// **'Enter staff member ID'**
  String get visitReassignSalesHint;

  /// No description provided for @visitReassignSuccess.
  ///
  /// In en, this message translates to:
  /// **'Visit reassigned.'**
  String get visitReassignSuccess;

  /// No description provided for @visitSalesFeedback.
  ///
  /// In en, this message translates to:
  /// **'Sales feedback'**
  String get visitSalesFeedback;

  /// No description provided for @visitFeedbackNotes.
  ///
  /// In en, this message translates to:
  /// **'Feedback notes'**
  String get visitFeedbackNotes;

  /// No description provided for @visitFeedbackRating.
  ///
  /// In en, this message translates to:
  /// **'Rating (1–5)'**
  String get visitFeedbackRating;

  /// No description provided for @visitFeedbackSubmit.
  ///
  /// In en, this message translates to:
  /// **'Submit feedback'**
  String get visitFeedbackSubmit;

  /// No description provided for @visitFeedbackSuccess.
  ///
  /// In en, this message translates to:
  /// **'Feedback submitted.'**
  String get visitFeedbackSuccess;

  /// No description provided for @reservationsEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'No reservations'**
  String get reservationsEmptyTitle;

  /// No description provided for @reservationsEmptyMessage.
  ///
  /// In en, this message translates to:
  /// **'Reservations will appear here.'**
  String get reservationsEmptyMessage;

  /// No description provided for @reservationNew.
  ///
  /// In en, this message translates to:
  /// **'New reservation'**
  String get reservationNew;

  /// No description provided for @reservationCreate.
  ///
  /// In en, this message translates to:
  /// **'Reserve unit'**
  String get reservationCreate;

  /// No description provided for @reservationCreated.
  ///
  /// In en, this message translates to:
  /// **'Reservation created.'**
  String get reservationCreated;

  /// No description provided for @reservationUnit.
  ///
  /// In en, this message translates to:
  /// **'Unit'**
  String get reservationUnit;

  /// No description provided for @reservationUnitRequired.
  ///
  /// In en, this message translates to:
  /// **'Please select a unit.'**
  String get reservationUnitRequired;

  /// No description provided for @reservationSelectUnit.
  ///
  /// In en, this message translates to:
  /// **'Select a unit'**
  String get reservationSelectUnit;

  /// No description provided for @reservationPickProjectFirst.
  ///
  /// In en, this message translates to:
  /// **'Select a project to see its units.'**
  String get reservationPickProjectFirst;

  /// No description provided for @reservationSectionUnit.
  ///
  /// In en, this message translates to:
  /// **'Property unit'**
  String get reservationSectionUnit;

  /// No description provided for @reservationSectionUnitSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Select the unit to reserve. It must be in an available status.'**
  String get reservationSectionUnitSubtitle;

  /// No description provided for @reservationSectionClient.
  ///
  /// In en, this message translates to:
  /// **'Client'**
  String get reservationSectionClient;

  /// No description provided for @reservationSectionClientSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Select a CRM lead to link to this reservation.'**
  String get reservationSectionClientSubtitle;

  /// No description provided for @reservationLeadLabel.
  ///
  /// In en, this message translates to:
  /// **'CRM lead'**
  String get reservationLeadLabel;

  /// No description provided for @reservationLeadSelect.
  ///
  /// In en, this message translates to:
  /// **'— Select a lead —'**
  String get reservationLeadSelect;

  /// No description provided for @reservationLeadRequired.
  ///
  /// In en, this message translates to:
  /// **'A CRM lead is required to create a reservation'**
  String get reservationLeadRequired;

  /// No description provided for @reservationLeadSearch.
  ///
  /// In en, this message translates to:
  /// **'Search by client name...'**
  String get reservationLeadSearch;

  /// No description provided for @reservationSectionDetails.
  ///
  /// In en, this message translates to:
  /// **'Reservation details'**
  String get reservationSectionDetails;

  /// No description provided for @reservationSectionDetailsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Set the reservation validity period and optional notes.'**
  String get reservationSectionDetailsSubtitle;

  /// No description provided for @reservationSectionPlanSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Choose an installment plan for the unit, or set the booking amount manually.'**
  String get reservationSectionPlanSubtitle;

  /// No description provided for @reservationExpiryLabel.
  ///
  /// In en, this message translates to:
  /// **'Reservation validity (hours)'**
  String get reservationExpiryLabel;

  /// No description provided for @reservationExpiryHint.
  ///
  /// In en, this message translates to:
  /// **'Time the reservation stays pending before auto-expiring'**
  String get reservationExpiryHint;

  /// No description provided for @reservationExpiry24.
  ///
  /// In en, this message translates to:
  /// **'24 hours — 1 day'**
  String get reservationExpiry24;

  /// No description provided for @reservationExpiry48.
  ///
  /// In en, this message translates to:
  /// **'48 hours — 2 days'**
  String get reservationExpiry48;

  /// No description provided for @reservationExpiry72.
  ///
  /// In en, this message translates to:
  /// **'72 hours — 3 days (default)'**
  String get reservationExpiry72;

  /// No description provided for @reservationExpiry120.
  ///
  /// In en, this message translates to:
  /// **'120 hours — 5 days'**
  String get reservationExpiry120;

  /// No description provided for @reservationExpiry168.
  ///
  /// In en, this message translates to:
  /// **'168 hours — 1 week'**
  String get reservationExpiry168;

  /// No description provided for @reservationExpiry336.
  ///
  /// In en, this message translates to:
  /// **'336 hours — 2 weeks'**
  String get reservationExpiry336;

  /// No description provided for @reservationNotesLabel.
  ///
  /// In en, this message translates to:
  /// **'Notes (optional)'**
  String get reservationNotesLabel;

  /// No description provided for @reservationSectionPlan.
  ///
  /// In en, this message translates to:
  /// **'Installment plan'**
  String get reservationSectionPlan;

  /// No description provided for @reservationPlanOptional.
  ///
  /// In en, this message translates to:
  /// **'— No plan (optional) —'**
  String get reservationPlanOptional;

  /// No description provided for @reservationPlanNoUnit.
  ///
  /// In en, this message translates to:
  /// **'Select a unit first to see available plans'**
  String get reservationPlanNoUnit;

  /// No description provided for @reservationBookingAmountTitle.
  ///
  /// In en, this message translates to:
  /// **'Booking amount method'**
  String get reservationBookingAmountTitle;

  /// No description provided for @reservationBookingAmountDesc.
  ///
  /// In en, this message translates to:
  /// **'Leave it calculated from the plan, or enter a fixed value or a percentage of the unit price.'**
  String get reservationBookingAmountDesc;

  /// No description provided for @reservationBookingModePlan.
  ///
  /// In en, this message translates to:
  /// **'From installment plan'**
  String get reservationBookingModePlan;

  /// No description provided for @reservationBookingModeFixed.
  ///
  /// In en, this message translates to:
  /// **'Fixed amount'**
  String get reservationBookingModeFixed;

  /// No description provided for @reservationBookingModePercent.
  ///
  /// In en, this message translates to:
  /// **'Percentage of unit price'**
  String get reservationBookingModePercent;

  /// No description provided for @reservationBookingFixedLabel.
  ///
  /// In en, this message translates to:
  /// **'Booking amount'**
  String get reservationBookingFixedLabel;

  /// No description provided for @reservationBookingFixedHint.
  ///
  /// In en, this message translates to:
  /// **'Enter fixed amount'**
  String get reservationBookingFixedHint;

  /// No description provided for @reservationBookingPercentLabel.
  ///
  /// In en, this message translates to:
  /// **'Percentage %'**
  String get reservationBookingPercentLabel;

  /// No description provided for @reservationBookingPercentHint.
  ///
  /// In en, this message translates to:
  /// **'Enter percentage (0.01 – 100)'**
  String get reservationBookingPercentHint;

  /// No description provided for @reservationBookingNotesLabel.
  ///
  /// In en, this message translates to:
  /// **'Booking amount notes'**
  String get reservationBookingNotesLabel;

  /// No description provided for @reservationBookingNotesHint.
  ///
  /// In en, this message translates to:
  /// **'Optional internal notes about the booking amount...'**
  String get reservationBookingNotesHint;

  /// No description provided for @reservationBooking.
  ///
  /// In en, this message translates to:
  /// **'Booking amount'**
  String get reservationBooking;

  /// No description provided for @reservationPlan.
  ///
  /// In en, this message translates to:
  /// **'Plan'**
  String get reservationPlan;

  /// No description provided for @reservationExpiresOn.
  ///
  /// In en, this message translates to:
  /// **'Expires'**
  String get reservationExpiresOn;

  /// No description provided for @reservationExpiredOn.
  ///
  /// In en, this message translates to:
  /// **'Expired'**
  String get reservationExpiredOn;

  /// No description provided for @reservationStatusPending.
  ///
  /// In en, this message translates to:
  /// **'Pending'**
  String get reservationStatusPending;

  /// No description provided for @reservationStatusApproved.
  ///
  /// In en, this message translates to:
  /// **'Approved'**
  String get reservationStatusApproved;

  /// No description provided for @reservationStatusRejected.
  ///
  /// In en, this message translates to:
  /// **'Rejected'**
  String get reservationStatusRejected;

  /// No description provided for @reservationStatusCancelled.
  ///
  /// In en, this message translates to:
  /// **'Cancelled'**
  String get reservationStatusCancelled;

  /// No description provided for @reservationStatusExpired.
  ///
  /// In en, this message translates to:
  /// **'Expired'**
  String get reservationStatusExpired;

  /// No description provided for @reservationStatusConverted.
  ///
  /// In en, this message translates to:
  /// **'Converted'**
  String get reservationStatusConverted;

  /// No description provided for @planTemplatesTitle.
  ///
  /// In en, this message translates to:
  /// **'Installment Plans'**
  String get planTemplatesTitle;

  /// No description provided for @planTemplatesSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Track payment plans and installments'**
  String get planTemplatesSubtitle;

  /// No description provided for @planTemplatesSearch.
  ///
  /// In en, this message translates to:
  /// **'Search plans...'**
  String get planTemplatesSearch;

  /// No description provided for @planTemplatesEmpty.
  ///
  /// In en, this message translates to:
  /// **'No installment plans'**
  String get planTemplatesEmpty;

  /// No description provided for @planTemplatesEmptyDesc.
  ///
  /// In en, this message translates to:
  /// **'No plan templates have been created yet'**
  String get planTemplatesEmptyDesc;

  /// No description provided for @planTemplatesOpenCalculator.
  ///
  /// In en, this message translates to:
  /// **'Open Calculator'**
  String get planTemplatesOpenCalculator;

  /// No description provided for @planTemplatesMonths.
  ///
  /// In en, this message translates to:
  /// **'{n} months'**
  String planTemplatesMonths(int n);

  /// No description provided for @calculatorTitle.
  ///
  /// In en, this message translates to:
  /// **'Installment calculator'**
  String get calculatorTitle;

  /// No description provided for @calculatorPlans.
  ///
  /// In en, this message translates to:
  /// **'Plan presets'**
  String get calculatorPlans;

  /// No description provided for @calculatorPrice.
  ///
  /// In en, this message translates to:
  /// **'Unit price'**
  String get calculatorPrice;

  /// No description provided for @calculatorDownPayment.
  ///
  /// In en, this message translates to:
  /// **'Down payment'**
  String get calculatorDownPayment;

  /// No description provided for @calculatorReservation.
  ///
  /// In en, this message translates to:
  /// **'Reservation amount'**
  String get calculatorReservation;

  /// No description provided for @calculatorMonths.
  ///
  /// In en, this message translates to:
  /// **'Number of months'**
  String get calculatorMonths;

  /// No description provided for @calculatorMonthsShort.
  ///
  /// In en, this message translates to:
  /// **'mo'**
  String get calculatorMonthsShort;

  /// No description provided for @calculatorIncrease.
  ///
  /// In en, this message translates to:
  /// **'Increase %'**
  String get calculatorIncrease;

  /// No description provided for @calculatorInvalid.
  ///
  /// In en, this message translates to:
  /// **'Please check the values: months ≥ 1, and down payment + reservation must not exceed the price.'**
  String get calculatorInvalid;

  /// No description provided for @calculatorCompute.
  ///
  /// In en, this message translates to:
  /// **'Calculate'**
  String get calculatorCompute;

  /// No description provided for @calculatorResult.
  ///
  /// In en, this message translates to:
  /// **'Result'**
  String get calculatorResult;

  /// No description provided for @calculatorFinanced.
  ///
  /// In en, this message translates to:
  /// **'Financed amount'**
  String get calculatorFinanced;

  /// No description provided for @calculatorTotal.
  ///
  /// In en, this message translates to:
  /// **'Total payable'**
  String get calculatorTotal;

  /// No description provided for @calculatorMonthlyN.
  ///
  /// In en, this message translates to:
  /// **'Monthly ({months} months)'**
  String calculatorMonthlyN(int months);

  /// No description provided for @summaryUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Unavailable'**
  String get summaryUnavailable;

  /// No description provided for @bonusTitle.
  ///
  /// In en, this message translates to:
  /// **'Bonus & commission'**
  String get bonusTitle;

  /// No description provided for @bonusEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'No bonus entries'**
  String get bonusEmptyTitle;

  /// No description provided for @bonusEmptyMessage.
  ///
  /// In en, this message translates to:
  /// **'Your bonus and commission entries will appear here.'**
  String get bonusEmptyMessage;

  /// No description provided for @bonusPaid.
  ///
  /// In en, this message translates to:
  /// **'Paid'**
  String get bonusPaid;

  /// No description provided for @bonusPending.
  ///
  /// In en, this message translates to:
  /// **'Pending'**
  String get bonusPending;

  /// No description provided for @bonusStatusPending.
  ///
  /// In en, this message translates to:
  /// **'Pending'**
  String get bonusStatusPending;

  /// No description provided for @bonusStatusApproved.
  ///
  /// In en, this message translates to:
  /// **'Approved'**
  String get bonusStatusApproved;

  /// No description provided for @bonusStatusPaid.
  ///
  /// In en, this message translates to:
  /// **'Paid'**
  String get bonusStatusPaid;

  /// No description provided for @targetsTitle.
  ///
  /// In en, this message translates to:
  /// **'Targets'**
  String get targetsTitle;

  /// No description provided for @targetsNone.
  ///
  /// In en, this message translates to:
  /// **'No target set for this period.'**
  String get targetsNone;

  /// No description provided for @targetsHistory.
  ///
  /// In en, this message translates to:
  /// **'Target history'**
  String get targetsHistory;

  /// No description provided for @targetsActivity.
  ///
  /// In en, this message translates to:
  /// **'This period'**
  String get targetsActivity;

  /// No description provided for @targetsSignedContracts.
  ///
  /// In en, this message translates to:
  /// **'Signed contracts'**
  String get targetsSignedContracts;

  /// No description provided for @targetAmount.
  ///
  /// In en, this message translates to:
  /// **'Sales amount'**
  String get targetAmount;

  /// No description provided for @targetUnits.
  ///
  /// In en, this message translates to:
  /// **'Units sold'**
  String get targetUnits;

  /// No description provided for @targetsUnitsN.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 unit} other{{count} units}}'**
  String targetsUnitsN(int count);

  /// No description provided for @teamPerfTitle.
  ///
  /// In en, this message translates to:
  /// **'Team Performance'**
  String get teamPerfTitle;

  /// No description provided for @teamTargetsManageTitle.
  ///
  /// In en, this message translates to:
  /// **'Manage Team Targets'**
  String get teamTargetsManageTitle;

  /// No description provided for @teamTargetEdit.
  ///
  /// In en, this message translates to:
  /// **'Edit target'**
  String get teamTargetEdit;

  /// No description provided for @teamTargetFor.
  ///
  /// In en, this message translates to:
  /// **'Target for {name}'**
  String teamTargetFor(String name);

  /// No description provided for @teamTargetSaved.
  ///
  /// In en, this message translates to:
  /// **'Target saved.'**
  String get teamTargetSaved;

  /// No description provided for @teamPerfRealizedValue.
  ///
  /// In en, this message translates to:
  /// **'Realized value'**
  String get teamPerfRealizedValue;

  /// No description provided for @teamPerfEmpty.
  ///
  /// In en, this message translates to:
  /// **'No performance data for this period.'**
  String get teamPerfEmpty;

  /// No description provided for @teamPerfTotalSales.
  ///
  /// In en, this message translates to:
  /// **'Total Sales'**
  String get teamPerfTotalSales;

  /// No description provided for @teamPerfAvgAchievement.
  ///
  /// In en, this message translates to:
  /// **'Avg Achievement'**
  String get teamPerfAvgAchievement;

  /// No description provided for @teamPerfDetails.
  ///
  /// In en, this message translates to:
  /// **'Team Details'**
  String get teamPerfDetails;

  /// No description provided for @teamTargetAdd.
  ///
  /// In en, this message translates to:
  /// **'Add Target'**
  String get teamTargetAdd;

  /// No description provided for @teamTargetCount.
  ///
  /// In en, this message translates to:
  /// **'Targets'**
  String get teamTargetCount;

  /// No description provided for @teamTargetTotalUnits.
  ///
  /// In en, this message translates to:
  /// **'Total Units Target'**
  String get teamTargetTotalUnits;

  /// No description provided for @teamTargetTotalAmount.
  ///
  /// In en, this message translates to:
  /// **'Total Amount Target'**
  String get teamTargetTotalAmount;

  /// No description provided for @teamTargetRegistered.
  ///
  /// In en, this message translates to:
  /// **'Registered Targets'**
  String get teamTargetRegistered;

  /// No description provided for @teamTargetNoTarget.
  ///
  /// In en, this message translates to:
  /// **'No target'**
  String get teamTargetNoTarget;

  /// No description provided for @teamTargetAchievedValue.
  ///
  /// In en, this message translates to:
  /// **'Achieved Value'**
  String get teamTargetAchievedValue;

  /// No description provided for @teamTargetMember.
  ///
  /// In en, this message translates to:
  /// **'Member'**
  String get teamTargetMember;

  /// No description provided for @teamTargetAddNew.
  ///
  /// In en, this message translates to:
  /// **'Add monthly target'**
  String get teamTargetAddNew;

  /// No description provided for @profilePerformance.
  ///
  /// In en, this message translates to:
  /// **'Performance'**
  String get profilePerformance;

  /// No description provided for @profileActiveLeads.
  ///
  /// In en, this message translates to:
  /// **'Active leads'**
  String get profileActiveLeads;

  /// No description provided for @navCommissions.
  ///
  /// In en, this message translates to:
  /// **'Commissions'**
  String get navCommissions;

  /// No description provided for @brokerDashLeads.
  ///
  /// In en, this message translates to:
  /// **'Total leads'**
  String get brokerDashLeads;

  /// No description provided for @brokerDashApprovedLeads.
  ///
  /// In en, this message translates to:
  /// **'Approved leads'**
  String get brokerDashApprovedLeads;

  /// No description provided for @brokerDashApprovedReservations.
  ///
  /// In en, this message translates to:
  /// **'Approved reservations'**
  String get brokerDashApprovedReservations;

  /// No description provided for @brokerRecentLeads.
  ///
  /// In en, this message translates to:
  /// **'Recent leads'**
  String get brokerRecentLeads;

  /// No description provided for @brokerRecentReservations.
  ///
  /// In en, this message translates to:
  /// **'Recent reservations'**
  String get brokerRecentReservations;

  /// No description provided for @brokerCommissionPct.
  ///
  /// In en, this message translates to:
  /// **'Commission'**
  String get brokerCommissionPct;

  /// No description provided for @brokerProjectsEmptyMessage.
  ///
  /// In en, this message translates to:
  /// **'You don\'t have access to any projects yet.'**
  String get brokerProjectsEmptyMessage;

  /// No description provided for @brokerLeadsEmptyMessage.
  ///
  /// In en, this message translates to:
  /// **'Leads you submit will appear here.'**
  String get brokerLeadsEmptyMessage;

  /// No description provided for @brokerLeadNew.
  ///
  /// In en, this message translates to:
  /// **'Add lead'**
  String get brokerLeadNew;

  /// No description provided for @brokerLeadCreated.
  ///
  /// In en, this message translates to:
  /// **'Lead submitted.'**
  String get brokerLeadCreated;

  /// No description provided for @brokerLeadName.
  ///
  /// In en, this message translates to:
  /// **'Full name'**
  String get brokerLeadName;

  /// No description provided for @brokerLeadPhone.
  ///
  /// In en, this message translates to:
  /// **'Phone'**
  String get brokerLeadPhone;

  /// No description provided for @brokerLeadEmail.
  ///
  /// In en, this message translates to:
  /// **'Email (optional)'**
  String get brokerLeadEmail;

  /// No description provided for @brokerLeadNote.
  ///
  /// In en, this message translates to:
  /// **'Note (optional)'**
  String get brokerLeadNote;

  /// No description provided for @brokerLeadSubmit.
  ///
  /// In en, this message translates to:
  /// **'Submit lead'**
  String get brokerLeadSubmit;

  /// No description provided for @brokerSelectLead.
  ///
  /// In en, this message translates to:
  /// **'Select a lead'**
  String get brokerSelectLead;

  /// No description provided for @brokerLeadStatusPending.
  ///
  /// In en, this message translates to:
  /// **'Pending review'**
  String get brokerLeadStatusPending;

  /// No description provided for @brokerLeadStatusApproved.
  ///
  /// In en, this message translates to:
  /// **'Approved'**
  String get brokerLeadStatusApproved;

  /// No description provided for @brokerLeadStatusRejected.
  ///
  /// In en, this message translates to:
  /// **'Rejected'**
  String get brokerLeadStatusRejected;

  /// No description provided for @brokerLeadStatusDuplicate.
  ///
  /// In en, this message translates to:
  /// **'Duplicate'**
  String get brokerLeadStatusDuplicate;

  /// No description provided for @brokerLeadStatusExpired.
  ///
  /// In en, this message translates to:
  /// **'Expired'**
  String get brokerLeadStatusExpired;

  /// No description provided for @brokerCommissionsEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'No commissions'**
  String get brokerCommissionsEmptyTitle;

  /// No description provided for @brokerCommissionsEmptyMessage.
  ///
  /// In en, this message translates to:
  /// **'Your commissions will appear here.'**
  String get brokerCommissionsEmptyMessage;

  /// No description provided for @paymentReviewTitle.
  ///
  /// In en, this message translates to:
  /// **'Payment Review'**
  String get paymentReviewTitle;

  /// No description provided for @paymentReviewSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Review payment proofs submitted by customers'**
  String get paymentReviewSubtitle;

  /// No description provided for @paymentReviewEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'No payment proofs pending review'**
  String get paymentReviewEmptyTitle;

  /// No description provided for @paymentReviewEmptyMessage.
  ///
  /// In en, this message translates to:
  /// **'Customer payment proofs awaiting review will appear here.'**
  String get paymentReviewEmptyMessage;

  /// No description provided for @paymentReviewReadOnly.
  ///
  /// In en, this message translates to:
  /// **'Approving or rejecting is available to admins only.'**
  String get paymentReviewReadOnly;

  /// No description provided for @paymentMethodLabel.
  ///
  /// In en, this message translates to:
  /// **'Payment method'**
  String get paymentMethodLabel;

  /// No description provided for @paymentSubmittedDate.
  ///
  /// In en, this message translates to:
  /// **'Submitted date'**
  String get paymentSubmittedDate;

  /// No description provided for @paymentDueDate.
  ///
  /// In en, this message translates to:
  /// **'Due date'**
  String get paymentDueDate;

  /// No description provided for @paymentCustomerNote.
  ///
  /// In en, this message translates to:
  /// **'Customer note'**
  String get paymentCustomerNote;

  /// No description provided for @paymentReference.
  ///
  /// In en, this message translates to:
  /// **'Reference number'**
  String get paymentReference;

  /// No description provided for @paymentProofAttached.
  ///
  /// In en, this message translates to:
  /// **'Proof attached'**
  String get paymentProofAttached;

  /// No description provided for @paymentOpenProof.
  ///
  /// In en, this message translates to:
  /// **'Open proof'**
  String get paymentOpenProof;

  /// No description provided for @paymentDownloadProof.
  ///
  /// In en, this message translates to:
  /// **'Download proof'**
  String get paymentDownloadProof;

  /// No description provided for @paymentProofUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Proof unavailable'**
  String get paymentProofUnavailable;

  /// No description provided for @paymentCouldNotOpenProof.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t open the proof'**
  String get paymentCouldNotOpenProof;

  /// No description provided for @paymentProofExpired.
  ///
  /// In en, this message translates to:
  /// **'The proof link expired — tap again'**
  String get paymentProofExpired;

  /// No description provided for @paymentApprove.
  ///
  /// In en, this message translates to:
  /// **'Approve payment'**
  String get paymentApprove;

  /// No description provided for @paymentReject.
  ///
  /// In en, this message translates to:
  /// **'Reject payment'**
  String get paymentReject;

  /// No description provided for @paymentRejectReason.
  ///
  /// In en, this message translates to:
  /// **'Rejection reason'**
  String get paymentRejectReason;

  /// No description provided for @paymentReasonRequired.
  ///
  /// In en, this message translates to:
  /// **'A rejection reason is required'**
  String get paymentReasonRequired;

  /// No description provided for @paymentApproved.
  ///
  /// In en, this message translates to:
  /// **'Payment approved'**
  String get paymentApproved;

  /// No description provided for @paymentRejected.
  ///
  /// In en, this message translates to:
  /// **'Payment rejected'**
  String get paymentRejected;

  /// No description provided for @paymentStatusPending.
  ///
  /// In en, this message translates to:
  /// **'Pending review'**
  String get paymentStatusPending;

  /// No description provided for @paymentStatusApproved.
  ///
  /// In en, this message translates to:
  /// **'Verified'**
  String get paymentStatusApproved;

  /// No description provided for @paymentStatusRejected.
  ///
  /// In en, this message translates to:
  /// **'Rejected'**
  String get paymentStatusRejected;

  /// No description provided for @paymentMethodCash.
  ///
  /// In en, this message translates to:
  /// **'Cash'**
  String get paymentMethodCash;

  /// No description provided for @paymentMethodBankTransfer.
  ///
  /// In en, this message translates to:
  /// **'Bank transfer'**
  String get paymentMethodBankTransfer;

  /// No description provided for @paymentMethodCheque.
  ///
  /// In en, this message translates to:
  /// **'Cheque'**
  String get paymentMethodCheque;

  /// No description provided for @paymentMethodOther.
  ///
  /// In en, this message translates to:
  /// **'Other'**
  String get paymentMethodOther;

  /// No description provided for @homeInstallmentsRemainingLabel.
  ///
  /// In en, this message translates to:
  /// **'Remaining'**
  String get homeInstallmentsRemainingLabel;

  /// No description provided for @homeLastPaymentLabel.
  ///
  /// In en, this message translates to:
  /// **'Last payment'**
  String get homeLastPaymentLabel;

  /// No description provided for @homePlanMonthsSuffix.
  ///
  /// In en, this message translates to:
  /// **'/ mo · {months} months'**
  String homePlanMonthsSuffix(int months);

  /// No description provided for @supervisorMaintenanceTitle.
  ///
  /// In en, this message translates to:
  /// **'Maintenance Requests'**
  String get supervisorMaintenanceTitle;

  /// No description provided for @supervisorDashboardTitle.
  ///
  /// In en, this message translates to:
  /// **'Maintenance Supervisor'**
  String get supervisorDashboardTitle;

  /// No description provided for @supervisorDashboardSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Track assigned requests and confirm resolution status'**
  String get supervisorDashboardSubtitle;

  /// No description provided for @supervisorRoleBadge.
  ///
  /// In en, this message translates to:
  /// **'Maintenance Supervisor'**
  String get supervisorRoleBadge;

  /// No description provided for @maintenanceWelcomeUser.
  ///
  /// In en, this message translates to:
  /// **'Hello, {name}'**
  String maintenanceWelcomeUser(String name);

  /// No description provided for @maintenanceWelcomeFallback.
  ///
  /// In en, this message translates to:
  /// **'Welcome'**
  String get maintenanceWelcomeFallback;

  /// No description provided for @maintenanceSupervisorRole.
  ///
  /// In en, this message translates to:
  /// **'Maintenance Supervisor'**
  String get maintenanceSupervisorRole;

  /// No description provided for @maintenanceAssignedSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Your assigned requests and resolution approvals'**
  String get maintenanceAssignedSubtitle;

  /// No description provided for @supervisorStatTotal.
  ///
  /// In en, this message translates to:
  /// **'Total'**
  String get supervisorStatTotal;

  /// No description provided for @supervisorStatAssigned.
  ///
  /// In en, this message translates to:
  /// **'Assigned'**
  String get supervisorStatAssigned;

  /// No description provided for @supervisorStatInProgress.
  ///
  /// In en, this message translates to:
  /// **'In Progress'**
  String get supervisorStatInProgress;

  /// No description provided for @supervisorStatClosed.
  ///
  /// In en, this message translates to:
  /// **'Closed'**
  String get supervisorStatClosed;

  /// No description provided for @supervisorFilterAll.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get supervisorFilterAll;

  /// No description provided for @supervisorFilterActive.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get supervisorFilterActive;

  /// No description provided for @supervisorFilterClosed.
  ///
  /// In en, this message translates to:
  /// **'Closed'**
  String get supervisorFilterClosed;

  /// No description provided for @supervisorSummaryTotalLabel.
  ///
  /// In en, this message translates to:
  /// **'Total Requests'**
  String get supervisorSummaryTotalLabel;

  /// No description provided for @supervisorNoDescription.
  ///
  /// In en, this message translates to:
  /// **'No description'**
  String get supervisorNoDescription;

  /// No description provided for @supervisorViewDetails.
  ///
  /// In en, this message translates to:
  /// **'View Details'**
  String get supervisorViewDetails;

  /// No description provided for @supervisorDetailTitle.
  ///
  /// In en, this message translates to:
  /// **'Request Details'**
  String get supervisorDetailTitle;

  /// No description provided for @supervisorNoAssignedTitle.
  ///
  /// In en, this message translates to:
  /// **'No assigned requests yet'**
  String get supervisorNoAssignedTitle;

  /// No description provided for @supervisorNoAssignedMessage.
  ///
  /// In en, this message translates to:
  /// **'Maintenance requests will appear here once assigned to you by management.'**
  String get supervisorNoAssignedMessage;

  /// No description provided for @supervisorFilterEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'No requests with this filter'**
  String get supervisorFilterEmptyTitle;

  /// No description provided for @supervisorFilterEmptyMessage.
  ///
  /// In en, this message translates to:
  /// **'Try selecting a different filter.'**
  String get supervisorFilterEmptyMessage;

  /// No description provided for @supervisorDetailCustomerLabel.
  ///
  /// In en, this message translates to:
  /// **'Customer'**
  String get supervisorDetailCustomerLabel;

  /// No description provided for @supervisorDetailPhoneLabel.
  ///
  /// In en, this message translates to:
  /// **'Phone'**
  String get supervisorDetailPhoneLabel;

  /// No description provided for @supervisorDetailUnitLabel.
  ///
  /// In en, this message translates to:
  /// **'Unit'**
  String get supervisorDetailUnitLabel;

  /// No description provided for @supervisorDetailSlaTitle.
  ///
  /// In en, this message translates to:
  /// **'Timeline & Tracking'**
  String get supervisorDetailSlaTitle;

  /// No description provided for @supervisorDetailOverdueLabel.
  ///
  /// In en, this message translates to:
  /// **'Overdue'**
  String get supervisorDetailOverdueLabel;

  /// No description provided for @supervisorDetailComplaintLabel.
  ///
  /// In en, this message translates to:
  /// **'Complaint filed'**
  String get supervisorDetailComplaintLabel;

  /// No description provided for @supervisorDetailUnresolvedLabel.
  ///
  /// In en, this message translates to:
  /// **'Unresolved'**
  String get supervisorDetailUnresolvedLabel;

  /// No description provided for @supervisorDetailDueDateLabel.
  ///
  /// In en, this message translates to:
  /// **'Target date'**
  String get supervisorDetailDueDateLabel;

  /// No description provided for @supervisorDetailAssignedDateLabel.
  ///
  /// In en, this message translates to:
  /// **'Assigned date'**
  String get supervisorDetailAssignedDateLabel;

  /// No description provided for @supervisorDetailComplaintDateLabel.
  ///
  /// In en, this message translates to:
  /// **'Complaint date'**
  String get supervisorDetailComplaintDateLabel;

  /// No description provided for @supervisorDetailStatusTitle.
  ///
  /// In en, this message translates to:
  /// **'Update Status'**
  String get supervisorDetailStatusTitle;

  /// No description provided for @supervisorDetailConfirmTitle.
  ///
  /// In en, this message translates to:
  /// **'Supervisor Confirmation'**
  String get supervisorDetailConfirmTitle;

  /// No description provided for @supervisorDetailConfirmInstruction.
  ///
  /// In en, this message translates to:
  /// **'After completing the repair, confirm that the issue is resolved.'**
  String get supervisorDetailConfirmInstruction;

  /// No description provided for @supervisorDetailConfirmLocked.
  ///
  /// In en, this message translates to:
  /// **'Confirmation is available once the request is marked as resolved.'**
  String get supervisorDetailConfirmLocked;

  /// No description provided for @supervisorDetailConfirmAction.
  ///
  /// In en, this message translates to:
  /// **'Confirm Resolution'**
  String get supervisorDetailConfirmAction;

  /// No description provided for @supervisorDetailConfirmedAtPrefix.
  ///
  /// In en, this message translates to:
  /// **'You confirmed resolution on'**
  String get supervisorDetailConfirmedAtPrefix;

  /// No description provided for @supervisorDetailFeedbackTitle.
  ///
  /// In en, this message translates to:
  /// **'Customer Feedback'**
  String get supervisorDetailFeedbackTitle;

  /// No description provided for @supervisorDetailCustomerConfirmedAtPrefix.
  ///
  /// In en, this message translates to:
  /// **'Customer confirmed resolution on'**
  String get supervisorDetailCustomerConfirmedAtPrefix;

  /// No description provided for @supervisorDetailAttachmentsTitle.
  ///
  /// In en, this message translates to:
  /// **'Attachments'**
  String get supervisorDetailAttachmentsTitle;

  /// No description provided for @supervisorDetailAttachmentFallback.
  ///
  /// In en, this message translates to:
  /// **'Attachment'**
  String get supervisorDetailAttachmentFallback;

  /// No description provided for @maintenanceOverdue.
  ///
  /// In en, this message translates to:
  /// **'Overdue'**
  String get maintenanceOverdue;

  /// No description provided for @maintenanceComplaint.
  ///
  /// In en, this message translates to:
  /// **'Complaint'**
  String get maintenanceComplaint;

  /// No description provided for @maintenanceUnresolved.
  ///
  /// In en, this message translates to:
  /// **'Unresolved'**
  String get maintenanceUnresolved;

  /// No description provided for @maintenanceFallbackTitle.
  ///
  /// In en, this message translates to:
  /// **'Maintenance request'**
  String get maintenanceFallbackTitle;

  /// No description provided for @maintenanceDetailSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Review the request and update execution status'**
  String get maintenanceDetailSubtitle;

  /// No description provided for @maintenanceIssueDescription.
  ///
  /// In en, this message translates to:
  /// **'Issue Description'**
  String get maintenanceIssueDescription;

  /// No description provided for @maintenanceCustomerInfo.
  ///
  /// In en, this message translates to:
  /// **'Customer & Unit Info'**
  String get maintenanceCustomerInfo;

  /// No description provided for @maintenanceWorkflow.
  ///
  /// In en, this message translates to:
  /// **'Stage & Follow-up'**
  String get maintenanceWorkflow;

  /// No description provided for @maintenanceUpdateStatus.
  ///
  /// In en, this message translates to:
  /// **'Update Status'**
  String get maintenanceUpdateStatus;

  /// No description provided for @maintenanceApproveSolution.
  ///
  /// In en, this message translates to:
  /// **'Approve Solution'**
  String get maintenanceApproveSolution;

  /// No description provided for @maintenanceConfirmationUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Confirmation is available after marking the request as resolved.'**
  String get maintenanceConfirmationUnavailable;

  /// No description provided for @maintenanceAttachments.
  ///
  /// In en, this message translates to:
  /// **'Attachments'**
  String get maintenanceAttachments;

  /// No description provided for @maintenanceNoTargetDate.
  ///
  /// In en, this message translates to:
  /// **'No target date'**
  String get maintenanceNoTargetDate;

  /// No description provided for @maintenanceCallCustomer.
  ///
  /// In en, this message translates to:
  /// **'Call Customer'**
  String get maintenanceCallCustomer;

  /// No description provided for @maintenanceDirectionsToUnit.
  ///
  /// In en, this message translates to:
  /// **'Directions to Unit'**
  String get maintenanceDirectionsToUnit;

  /// No description provided for @maintenanceLocationUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Unit location unavailable'**
  String get maintenanceLocationUnavailable;

  /// No description provided for @maintenanceImagePreview.
  ///
  /// In en, this message translates to:
  /// **'Image Preview'**
  String get maintenanceImagePreview;

  /// No description provided for @maintenanceClosePreview.
  ///
  /// In en, this message translates to:
  /// **'Close Preview'**
  String get maintenanceClosePreview;

  /// No description provided for @maintenanceActionUnavailable.
  ///
  /// In en, this message translates to:
  /// **'No action available'**
  String get maintenanceActionUnavailable;

  /// No description provided for @maintenanceClosedState.
  ///
  /// In en, this message translates to:
  /// **'Request Closed'**
  String get maintenanceClosedState;

  /// No description provided for @maintenanceOpenAttachment.
  ///
  /// In en, this message translates to:
  /// **'Open attachment'**
  String get maintenanceOpenAttachment;

  /// No description provided for @maintenanceNoPreviewAvailable.
  ///
  /// In en, this message translates to:
  /// **'Preview is not available for this attachment'**
  String get maintenanceNoPreviewAvailable;

  /// No description provided for @maintenanceProblemSolved.
  ///
  /// In en, this message translates to:
  /// **'Problem Solved'**
  String get maintenanceProblemSolved;

  /// No description provided for @maintenanceOpenDirections.
  ///
  /// In en, this message translates to:
  /// **'Open Directions'**
  String get maintenanceOpenDirections;

  /// No description provided for @maintenanceLocationPreview.
  ///
  /// In en, this message translates to:
  /// **'Unit Location'**
  String get maintenanceLocationPreview;

  /// No description provided for @maintenanceMapPreviewUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Map preview not available'**
  String get maintenanceMapPreviewUnavailable;

  /// No description provided for @maintenanceActionHintInProgress.
  ///
  /// In en, this message translates to:
  /// **'After resolving the issue, update the status to confirm resolution.'**
  String get maintenanceActionHintInProgress;

  /// No description provided for @maintenanceCompactDetailTitle.
  ///
  /// In en, this message translates to:
  /// **'Maintenance Request Details'**
  String get maintenanceCompactDetailTitle;

  /// No description provided for @salesRoleChip.
  ///
  /// In en, this message translates to:
  /// **'Sales Advisor'**
  String get salesRoleChip;

  /// No description provided for @dashboardWelcomeUser.
  ///
  /// In en, this message translates to:
  /// **'Welcome back, {name}'**
  String dashboardWelcomeUser(String name);

  /// No description provided for @dashboardTodaySnapshot.
  ///
  /// In en, this message translates to:
  /// **'Today\'s Snapshot'**
  String get dashboardTodaySnapshot;

  /// No description provided for @dashboardTodayFocus.
  ///
  /// In en, this message translates to:
  /// **'Today\'s Priorities'**
  String get dashboardTodayFocus;

  /// No description provided for @dashboardMonthlyPerformance.
  ///
  /// In en, this message translates to:
  /// **'Monthly Performance'**
  String get dashboardMonthlyPerformance;

  /// No description provided for @dashboardFocusAllClear.
  ///
  /// In en, this message translates to:
  /// **'No urgent priorities right now'**
  String get dashboardFocusAllClear;

  /// No description provided for @dashboardSuggestedProperties.
  ///
  /// In en, this message translates to:
  /// **'Suggested Properties'**
  String get dashboardSuggestedProperties;

  /// No description provided for @staffShareWithClient.
  ///
  /// In en, this message translates to:
  /// **'Share with client'**
  String get staffShareWithClient;

  /// No description provided for @staffAddInterestedClient.
  ///
  /// In en, this message translates to:
  /// **'Add interested client'**
  String get staffAddInterestedClient;

  /// No description provided for @staffSendToClient.
  ///
  /// In en, this message translates to:
  /// **'Send to client'**
  String get staffSendToClient;

  /// No description provided for @staffEditProject.
  ///
  /// In en, this message translates to:
  /// **'Edit project'**
  String get staffEditProject;

  /// No description provided for @leadClientSection.
  ///
  /// In en, this message translates to:
  /// **'Client'**
  String get leadClientSection;

  /// No description provided for @leadClientSectionSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Pick an existing client or create a new one'**
  String get leadClientSectionSubtitle;

  /// No description provided for @leadInterestSection.
  ///
  /// In en, this message translates to:
  /// **'Interest & Source'**
  String get leadInterestSection;

  /// No description provided for @leadInterestSectionSubtitle.
  ///
  /// In en, this message translates to:
  /// **'How did the client hear about us?'**
  String get leadInterestSectionSubtitle;

  /// No description provided for @leadNotesSectionSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Optional remarks or follow-up details'**
  String get leadNotesSectionSubtitle;

  /// No description provided for @leadNotesHint.
  ///
  /// In en, this message translates to:
  /// **'Write a note…'**
  String get leadNotesHint;

  /// No description provided for @leadSource.
  ///
  /// In en, this message translates to:
  /// **'Lead source'**
  String get leadSource;

  /// No description provided for @leadSourceHint.
  ///
  /// In en, this message translates to:
  /// **'Select a source'**
  String get leadSourceHint;

  /// No description provided for @leadSourceEmpty.
  ///
  /// In en, this message translates to:
  /// **'No sources available'**
  String get leadSourceEmpty;

  /// No description provided for @leadTabExisting.
  ///
  /// In en, this message translates to:
  /// **'Existing'**
  String get leadTabExisting;

  /// No description provided for @leadTabNew.
  ///
  /// In en, this message translates to:
  /// **'New'**
  String get leadTabNew;

  /// No description provided for @leadSearchHint.
  ///
  /// In en, this message translates to:
  /// **'Search by name or phone…'**
  String get leadSearchHint;

  /// No description provided for @leadSearchEmpty.
  ///
  /// In en, this message translates to:
  /// **'No clients found'**
  String get leadSearchEmpty;

  /// No description provided for @leadClientSelected.
  ///
  /// In en, this message translates to:
  /// **'Selected client'**
  String get leadClientSelected;

  /// No description provided for @leadChangeClient.
  ///
  /// In en, this message translates to:
  /// **'Change'**
  String get leadChangeClient;

  /// No description provided for @leadContextProject.
  ///
  /// In en, this message translates to:
  /// **'Project'**
  String get leadContextProject;

  /// No description provided for @leadContextUnit.
  ///
  /// In en, this message translates to:
  /// **'Unit'**
  String get leadContextUnit;

  /// No description provided for @leadInterestPreFilled.
  ///
  /// In en, this message translates to:
  /// **'Interest pre-filled from'**
  String get leadInterestPreFilled;

  /// No description provided for @companySelectTitle.
  ///
  /// In en, this message translates to:
  /// **'Select Developer'**
  String get companySelectTitle;

  /// No description provided for @companySelectSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Search for the developer whose app you\'d like to use'**
  String get companySelectSubtitle;

  /// No description provided for @companySearchHint.
  ///
  /// In en, this message translates to:
  /// **'Search by company name or code'**
  String get companySearchHint;

  /// No description provided for @companySearchEmpty.
  ///
  /// In en, this message translates to:
  /// **'No companies found'**
  String get companySearchEmpty;

  /// No description provided for @companySearchMinLength.
  ///
  /// In en, this message translates to:
  /// **'Enter at least 2 characters to search'**
  String get companySearchMinLength;

  /// No description provided for @companySelectButton.
  ///
  /// In en, this message translates to:
  /// **'Select'**
  String get companySelectButton;

  /// No description provided for @companyNotAvailable.
  ///
  /// In en, this message translates to:
  /// **'This company is not available. Please try a different company.'**
  String get companyNotAvailable;

  /// No description provided for @companyChangeTitle.
  ///
  /// In en, this message translates to:
  /// **'Change Developer'**
  String get companyChangeTitle;

  /// No description provided for @sectionFloorPlans.
  ///
  /// In en, this message translates to:
  /// **'Floor Plans'**
  String get sectionFloorPlans;

  /// No description provided for @sectionWarrantyItems.
  ///
  /// In en, this message translates to:
  /// **'Components & Warranties'**
  String get sectionWarrantyItems;

  /// No description provided for @warrantyActive.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get warrantyActive;

  /// No description provided for @warrantyExpired.
  ///
  /// In en, this message translates to:
  /// **'Expired'**
  String get warrantyExpired;

  /// No description provided for @warrantyUntil.
  ///
  /// In en, this message translates to:
  /// **'Until'**
  String get warrantyUntil;

  /// No description provided for @labelSupplier.
  ///
  /// In en, this message translates to:
  /// **'Supplier'**
  String get labelSupplier;

  /// No description provided for @labelContractor.
  ///
  /// In en, this message translates to:
  /// **'Contractor'**
  String get labelContractor;

  /// No description provided for @staffTfaTitle.
  ///
  /// In en, this message translates to:
  /// **'Two-step sign-in'**
  String get staffTfaTitle;

  /// No description provided for @staffTfaCodeHint.
  ///
  /// In en, this message translates to:
  /// **'Open your authenticator app and enter the 6-digit code.'**
  String get staffTfaCodeHint;

  /// No description provided for @staffTfaCodeLabel.
  ///
  /// In en, this message translates to:
  /// **'Code from the app'**
  String get staffTfaCodeLabel;

  /// No description provided for @staffTfaRecoveryLabel.
  ///
  /// In en, this message translates to:
  /// **'Recovery code'**
  String get staffTfaRecoveryLabel;

  /// No description provided for @staffTfaUseRecovery.
  ///
  /// In en, this message translates to:
  /// **'Have a recovery code instead?'**
  String get staffTfaUseRecovery;

  /// No description provided for @staffTfaUseApp.
  ///
  /// In en, this message translates to:
  /// **'Use the code from the app'**
  String get staffTfaUseApp;

  /// No description provided for @staffTfaVerify.
  ///
  /// In en, this message translates to:
  /// **'Confirm'**
  String get staffTfaVerify;

  /// No description provided for @staffTfaBack.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get staffTfaBack;

  /// No description provided for @staffTfaWrongCode.
  ///
  /// In en, this message translates to:
  /// **'Wrong code — check the current code in the app'**
  String get staffTfaWrongCode;

  /// No description provided for @staffTfaLocked.
  ///
  /// In en, this message translates to:
  /// **'Too many wrong codes — try again in 15 minutes'**
  String get staffTfaLocked;

  /// No description provided for @staffTfaExpired.
  ///
  /// In en, this message translates to:
  /// **'This step timed out — sign in again'**
  String get staffTfaExpired;

  /// No description provided for @staffTfaInvalidFormat.
  ///
  /// In en, this message translates to:
  /// **'Enter the 6-digit code'**
  String get staffTfaInvalidFormat;

  /// No description provided for @staffTfaSetupTitle.
  ///
  /// In en, this message translates to:
  /// **'Turn on two-step sign-in'**
  String get staffTfaSetupTitle;

  /// No description provided for @staffTfaSetupHint.
  ///
  /// In en, this message translates to:
  /// **'Your company requires a code from an authenticator app with your password. Add this key to an authenticator app (Google Authenticator, Microsoft Authenticator), then enter the code it shows.'**
  String get staffTfaSetupHint;

  /// No description provided for @staffTfaOpenApp.
  ///
  /// In en, this message translates to:
  /// **'Add to authenticator app'**
  String get staffTfaOpenApp;

  /// No description provided for @staffTfaNoApp.
  ///
  /// In en, this message translates to:
  /// **'No authenticator app on this phone — copy the key and add it by hand'**
  String get staffTfaNoApp;

  /// No description provided for @staffTfaKeyLabel.
  ///
  /// In en, this message translates to:
  /// **'Key'**
  String get staffTfaKeyLabel;

  /// No description provided for @staffTfaCopy.
  ///
  /// In en, this message translates to:
  /// **'Copy'**
  String get staffTfaCopy;

  /// No description provided for @staffTfaCopied.
  ///
  /// In en, this message translates to:
  /// **'Copied'**
  String get staffTfaCopied;

  /// No description provided for @staffTfaEnable.
  ///
  /// In en, this message translates to:
  /// **'Turn on and continue'**
  String get staffTfaEnable;

  /// No description provided for @staffTfaCodesTitle.
  ///
  /// In en, this message translates to:
  /// **'Recovery codes'**
  String get staffTfaCodesTitle;

  /// No description provided for @staffTfaCodesHint.
  ///
  /// In en, this message translates to:
  /// **'Keep these somewhere safe. Each works once if you do not have your phone, and they will not be shown again.'**
  String get staffTfaCodesHint;

  /// No description provided for @staffTfaCodesContinue.
  ///
  /// In en, this message translates to:
  /// **'Saved them — continue'**
  String get staffTfaCodesContinue;

  /// No description provided for @leadLostTitle.
  ///
  /// In en, this message translates to:
  /// **'Why was this customer lost?'**
  String get leadLostTitle;

  /// No description provided for @leadLostHint.
  ///
  /// In en, this message translates to:
  /// **'Pick the reason — it feeds the lost reasons report.'**
  String get leadLostHint;

  /// No description provided for @leadLostNote.
  ///
  /// In en, this message translates to:
  /// **'Details (optional)'**
  String get leadLostNote;

  /// No description provided for @leadLostConfirm.
  ///
  /// In en, this message translates to:
  /// **'Mark as lost'**
  String get leadLostConfirm;

  /// No description provided for @leadLostEmpty.
  ///
  /// In en, this message translates to:
  /// **'Your company has no lost reasons yet — ask an admin to add them from the dashboard.'**
  String get leadLostEmpty;

  /// No description provided for @leadLostReasonLabel.
  ///
  /// In en, this message translates to:
  /// **'Lost reason'**
  String get leadLostReasonLabel;

  /// No description provided for @followUpsTitle.
  ///
  /// In en, this message translates to:
  /// **'Follow-ups'**
  String get followUpsTitle;

  /// No description provided for @followUpsHint.
  ///
  /// In en, this message translates to:
  /// **'Customers due a call: overdue first, then today, then upcoming.'**
  String get followUpsHint;

  /// No description provided for @followUpsOverdue.
  ///
  /// In en, this message translates to:
  /// **'Overdue'**
  String get followUpsOverdue;

  /// No description provided for @followUpsToday.
  ///
  /// In en, this message translates to:
  /// **'Today'**
  String get followUpsToday;

  /// No description provided for @followUpsUpcoming.
  ///
  /// In en, this message translates to:
  /// **'Upcoming'**
  String get followUpsUpcoming;

  /// No description provided for @followUpsEmptyOverdue.
  ///
  /// In en, this message translates to:
  /// **'No overdue follow-ups — great work.'**
  String get followUpsEmptyOverdue;

  /// No description provided for @followUpsEmptyToday.
  ///
  /// In en, this message translates to:
  /// **'No follow-ups left today.'**
  String get followUpsEmptyToday;

  /// No description provided for @followUpsEmptyUpcoming.
  ///
  /// In en, this message translates to:
  /// **'No upcoming follow-ups.'**
  String get followUpsEmptyUpcoming;

  /// No description provided for @followUpsEmptyHint.
  ///
  /// In en, this message translates to:
  /// **'Set the next follow-up whenever you log an activity on a customer.'**
  String get followUpsEmptyHint;

  /// No description provided for @followUpsFocusLine.
  ///
  /// In en, this message translates to:
  /// **'{overdue} overdue · {today} today'**
  String followUpsFocusLine(int overdue, int today);

  /// No description provided for @followUpsLastActivity.
  ///
  /// In en, this message translates to:
  /// **'Last activity'**
  String get followUpsLastActivity;

  /// No description provided for @followUpsNoActivity.
  ///
  /// In en, this message translates to:
  /// **'No activity yet'**
  String get followUpsNoActivity;

  /// No description provided for @leadNextAction.
  ///
  /// In en, this message translates to:
  /// **'Next follow-up'**
  String get leadNextAction;

  /// No description provided for @leadNextActionNone.
  ///
  /// In en, this message translates to:
  /// **'No follow-up set — pick a time when you log the next activity.'**
  String get leadNextActionNone;

  /// No description provided for @leadLogActivity.
  ///
  /// In en, this message translates to:
  /// **'Log activity'**
  String get leadLogActivity;

  /// No description provided for @leadLogActivityHint.
  ///
  /// In en, this message translates to:
  /// **'A call, a meeting, a WhatsApp chat or a note — with the next follow-up.'**
  String get leadLogActivityHint;

  /// No description provided for @noteKindNote.
  ///
  /// In en, this message translates to:
  /// **'Note'**
  String get noteKindNote;

  /// No description provided for @noteKindCall.
  ///
  /// In en, this message translates to:
  /// **'Call'**
  String get noteKindCall;

  /// No description provided for @noteKindMeeting.
  ///
  /// In en, this message translates to:
  /// **'Meeting'**
  String get noteKindMeeting;

  /// No description provided for @noteKindWhatsapp.
  ///
  /// In en, this message translates to:
  /// **'WhatsApp'**
  String get noteKindWhatsapp;

  /// No description provided for @noteKindFollowUp.
  ///
  /// In en, this message translates to:
  /// **'Follow-up'**
  String get noteKindFollowUp;

  /// No description provided for @callResultLabel.
  ///
  /// In en, this message translates to:
  /// **'Call result'**
  String get callResultLabel;

  /// No description provided for @callResultAnswered.
  ///
  /// In en, this message translates to:
  /// **'Answered'**
  String get callResultAnswered;

  /// No description provided for @callResultNoAnswer.
  ///
  /// In en, this message translates to:
  /// **'No answer'**
  String get callResultNoAnswer;

  /// No description provided for @callResultBusy.
  ///
  /// In en, this message translates to:
  /// **'Busy'**
  String get callResultBusy;

  /// No description provided for @callResultUnreachable.
  ///
  /// In en, this message translates to:
  /// **'Unreachable'**
  String get callResultUnreachable;

  /// No description provided for @callResultWrongNumber.
  ///
  /// In en, this message translates to:
  /// **'Wrong number'**
  String get callResultWrongNumber;

  /// No description provided for @activityWhatHappened.
  ///
  /// In en, this message translates to:
  /// **'What happened?'**
  String get activityWhatHappened;

  /// No description provided for @activityBodyHint.
  ///
  /// In en, this message translates to:
  /// **'Write what happened and what you agreed…'**
  String get activityBodyHint;

  /// No description provided for @activityNextKeep.
  ///
  /// In en, this message translates to:
  /// **'Keep as is'**
  String get activityNextKeep;

  /// No description provided for @activityNextNone.
  ///
  /// In en, this message translates to:
  /// **'No follow-up'**
  String get activityNextNone;

  /// No description provided for @activityNextIn1h.
  ///
  /// In en, this message translates to:
  /// **'In an hour'**
  String get activityNextIn1h;

  /// No description provided for @activityNextTomorrow.
  ///
  /// In en, this message translates to:
  /// **'Tomorrow'**
  String get activityNextTomorrow;

  /// No description provided for @activityNextIn3Days.
  ///
  /// In en, this message translates to:
  /// **'In 3 days'**
  String get activityNextIn3Days;

  /// No description provided for @activityNextWeek.
  ///
  /// In en, this message translates to:
  /// **'In a week'**
  String get activityNextWeek;

  /// No description provided for @activityNextPick.
  ///
  /// In en, this message translates to:
  /// **'Other time…'**
  String get activityNextPick;

  /// No description provided for @activityNextType.
  ///
  /// In en, this message translates to:
  /// **'Type'**
  String get activityNextType;

  /// No description provided for @activityNextNote.
  ///
  /// In en, this message translates to:
  /// **'Note for the follow-up (optional)'**
  String get activityNextNote;

  /// No description provided for @activityPastDate.
  ///
  /// In en, this message translates to:
  /// **'Pick a time in the future'**
  String get activityPastDate;

  /// No description provided for @activitySave.
  ///
  /// In en, this message translates to:
  /// **'Save activity'**
  String get activitySave;

  /// No description provided for @noteReply.
  ///
  /// In en, this message translates to:
  /// **'Reply'**
  String get noteReply;

  /// No description provided for @noteReplyHint.
  ///
  /// In en, this message translates to:
  /// **'Write a reply…'**
  String get noteReplyHint;

  /// No description provided for @noteReplySend.
  ///
  /// In en, this message translates to:
  /// **'Send'**
  String get noteReplySend;

  /// No description provided for @activitySectionWhatSubtitle.
  ///
  /// In en, this message translates to:
  /// **'The kind of activity, and how a call went'**
  String get activitySectionWhatSubtitle;

  /// No description provided for @activitySectionDetails.
  ///
  /// In en, this message translates to:
  /// **'Details'**
  String get activitySectionDetails;

  /// No description provided for @activitySectionDetailsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'What happened and what you agreed'**
  String get activitySectionDetailsSubtitle;

  /// No description provided for @activitySectionNextSubtitle.
  ///
  /// In en, this message translates to:
  /// **'When will you contact the customer again?'**
  String get activitySectionNextSubtitle;

  /// No description provided for @activityNextSet.
  ///
  /// In en, this message translates to:
  /// **'Set a time'**
  String get activityNextSet;

  /// No description provided for @activityNextWhen.
  ///
  /// In en, this message translates to:
  /// **'When'**
  String get activityNextWhen;

  /// No description provided for @calendarTitle.
  ///
  /// In en, this message translates to:
  /// **'Calendar'**
  String get calendarTitle;

  /// No description provided for @calendarEmptyDay.
  ///
  /// In en, this message translates to:
  /// **'Nothing on this day'**
  String get calendarEmptyDay;

  /// No description provided for @calendarEmptyHint.
  ///
  /// In en, this message translates to:
  /// **'Visits, follow-ups, reservations running out and contract signings show here on their day.'**
  String get calendarEmptyHint;

  /// No description provided for @calendarTypeVisit.
  ///
  /// In en, this message translates to:
  /// **'Visit'**
  String get calendarTypeVisit;

  /// No description provided for @calendarTypeFollowUp.
  ///
  /// In en, this message translates to:
  /// **'Follow-up'**
  String get calendarTypeFollowUp;

  /// No description provided for @calendarTypeReservationExpiry.
  ///
  /// In en, this message translates to:
  /// **'Reservation expires'**
  String get calendarTypeReservationExpiry;

  /// No description provided for @calendarTypeContract.
  ///
  /// In en, this message translates to:
  /// **'Contract signed'**
  String get calendarTypeContract;

  /// No description provided for @calendarDone.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get calendarDone;

  /// No description provided for @calendarPrevWeek.
  ///
  /// In en, this message translates to:
  /// **'Previous week'**
  String get calendarPrevWeek;

  /// No description provided for @calendarNextWeek.
  ///
  /// In en, this message translates to:
  /// **'Next week'**
  String get calendarNextWeek;

  /// No description provided for @depositTypeFee.
  ///
  /// In en, this message translates to:
  /// **'Fees & penalties'**
  String get depositTypeFee;

  /// No description provided for @planTypeBouncePenalty.
  ///
  /// In en, this message translates to:
  /// **'Bounced-cheque penalty'**
  String get planTypeBouncePenalty;

  /// No description provided for @planTypeLateFee.
  ///
  /// In en, this message translates to:
  /// **'Late fee'**
  String get planTypeLateFee;

  /// No description provided for @planTypeTransferFee.
  ///
  /// In en, this message translates to:
  /// **'Transfer fee'**
  String get planTypeTransferFee;

  /// No description provided for @chequesTitle.
  ///
  /// In en, this message translates to:
  /// **'Cheques'**
  String get chequesTitle;

  /// No description provided for @chequeStatusPending.
  ///
  /// In en, this message translates to:
  /// **'Not deposited'**
  String get chequeStatusPending;

  /// No description provided for @chequeStatusDeposited.
  ///
  /// In en, this message translates to:
  /// **'At the bank'**
  String get chequeStatusDeposited;

  /// No description provided for @chequeStatusCleared.
  ///
  /// In en, this message translates to:
  /// **'Cleared'**
  String get chequeStatusCleared;

  /// No description provided for @chequeStatusBounced.
  ///
  /// In en, this message translates to:
  /// **'Bounced'**
  String get chequeStatusBounced;

  /// No description provided for @chequeStatusReplaced.
  ///
  /// In en, this message translates to:
  /// **'Replaced'**
  String get chequeStatusReplaced;

  /// No description provided for @chequeStatusCancelled.
  ///
  /// In en, this message translates to:
  /// **'Cancelled'**
  String get chequeStatusCancelled;

  /// No description provided for @chequesEmpty.
  ///
  /// In en, this message translates to:
  /// **'No cheques here'**
  String get chequesEmpty;

  /// No description provided for @chequesEmptyHint.
  ///
  /// In en, this message translates to:
  /// **'Customers\' cheques show here, the soonest due first.'**
  String get chequesEmptyHint;

  /// No description provided for @chequeDueForDeposit.
  ///
  /// In en, this message translates to:
  /// **'Due for deposit'**
  String get chequeDueForDeposit;

  /// No description provided for @chequeNumberLabel.
  ///
  /// In en, this message translates to:
  /// **'Cheque number'**
  String get chequeNumberLabel;

  /// No description provided for @chequeBank.
  ///
  /// In en, this message translates to:
  /// **'Bank'**
  String get chequeBank;

  /// No description provided for @chequeDueDate.
  ///
  /// In en, this message translates to:
  /// **'Due'**
  String get chequeDueDate;

  /// No description provided for @chequeAmount.
  ///
  /// In en, this message translates to:
  /// **'Amount'**
  String get chequeAmount;

  /// No description provided for @chequeCustomer.
  ///
  /// In en, this message translates to:
  /// **'Customer'**
  String get chequeCustomer;

  /// No description provided for @chequeContract.
  ///
  /// In en, this message translates to:
  /// **'Contract'**
  String get chequeContract;

  /// No description provided for @chequeReservation.
  ///
  /// In en, this message translates to:
  /// **'Reservation'**
  String get chequeReservation;

  /// No description provided for @chequeRecordedBy.
  ///
  /// In en, this message translates to:
  /// **'Recorded by'**
  String get chequeRecordedBy;

  /// No description provided for @chequeClearedOn.
  ///
  /// In en, this message translates to:
  /// **'Cleared on'**
  String get chequeClearedOn;

  /// No description provided for @chequeBouncedOn.
  ///
  /// In en, this message translates to:
  /// **'Bounced on'**
  String get chequeBouncedOn;

  /// No description provided for @chequeBounceReason.
  ///
  /// In en, this message translates to:
  /// **'Bounce reason'**
  String get chequeBounceReason;

  /// No description provided for @chequeReplacedBy.
  ///
  /// In en, this message translates to:
  /// **'Replaced by cheque'**
  String get chequeReplacedBy;

  /// No description provided for @chequePayments.
  ///
  /// In en, this message translates to:
  /// **'Payments it covers'**
  String get chequePayments;

  /// No description provided for @chequeInstallmentDue.
  ///
  /// In en, this message translates to:
  /// **'Installment due'**
  String get chequeInstallmentDue;

  /// No description provided for @chequeOnDashboard.
  ///
  /// In en, this message translates to:
  /// **'Bouncing, cancelling and replacing are done on the web dashboard.'**
  String get chequeOnDashboard;

  /// No description provided for @chequeActionDeposit.
  ///
  /// In en, this message translates to:
  /// **'Deposited at the bank'**
  String get chequeActionDeposit;

  /// No description provided for @chequeDepositTitle.
  ///
  /// In en, this message translates to:
  /// **'Record cheque deposit'**
  String get chequeDepositTitle;

  /// No description provided for @chequeDepositHint.
  ///
  /// In en, this message translates to:
  /// **'The cheque will be recorded as deposited at the bank, waiting to clear.'**
  String get chequeDepositHint;

  /// No description provided for @chequeActionClear.
  ///
  /// In en, this message translates to:
  /// **'Cleared'**
  String get chequeActionClear;

  /// No description provided for @chequeClearTitle.
  ///
  /// In en, this message translates to:
  /// **'Record cheque clearing'**
  String get chequeClearTitle;

  /// No description provided for @chequeClearHint.
  ///
  /// In en, this message translates to:
  /// **'The payment the cheque covers will be recorded as paid on the clearing date.'**
  String get chequeClearHint;

  /// No description provided for @chequeClearDate.
  ///
  /// In en, this message translates to:
  /// **'Clearing date'**
  String get chequeClearDate;

  /// No description provided for @chequeConfirm.
  ///
  /// In en, this message translates to:
  /// **'Confirm'**
  String get chequeConfirm;

  /// No description provided for @chequeDepositedDone.
  ///
  /// In en, this message translates to:
  /// **'Cheque deposit recorded'**
  String get chequeDepositedDone;

  /// No description provided for @chequeClearedDone.
  ///
  /// In en, this message translates to:
  /// **'Cheque clearing recorded'**
  String get chequeClearedDone;

  /// No description provided for @assistantTitle.
  ///
  /// In en, this message translates to:
  /// **'AI assistant'**
  String get assistantTitle;

  /// No description provided for @assistantNewChat.
  ///
  /// In en, this message translates to:
  /// **'New chat'**
  String get assistantNewChat;

  /// No description provided for @assistantWelcome.
  ///
  /// In en, this message translates to:
  /// **'Ask about your company\'s data'**
  String get assistantWelcome;

  /// No description provided for @assistantScopeHint.
  ///
  /// In en, this message translates to:
  /// **'Overdue installments, available units, leads, reservations and visits. It answers only from the data you can see and changes nothing. Each question counts against the company\'s package.'**
  String get assistantScopeHint;

  /// No description provided for @assistantPlaceholder.
  ///
  /// In en, this message translates to:
  /// **'Type your question…'**
  String get assistantPlaceholder;

  /// No description provided for @assistantSend.
  ///
  /// In en, this message translates to:
  /// **'Send'**
  String get assistantSend;

  /// No description provided for @assistantThinking.
  ///
  /// In en, this message translates to:
  /// **'Looking through the data…'**
  String get assistantThinking;

  /// No description provided for @assistantSuggestOverdue.
  ///
  /// In en, this message translates to:
  /// **'Which customers have overdue installments?'**
  String get assistantSuggestOverdue;

  /// No description provided for @assistantSuggestUnits.
  ///
  /// In en, this message translates to:
  /// **'Which units with 3+ bedrooms are available?'**
  String get assistantSuggestUnits;

  /// No description provided for @assistantSuggestSummary.
  ///
  /// In en, this message translates to:
  /// **'A quick summary of sales and reservations'**
  String get assistantSuggestSummary;

  /// No description provided for @assistantSuggestVisits.
  ///
  /// In en, this message translates to:
  /// **'What visits do I have today and tomorrow?'**
  String get assistantSuggestVisits;

  /// No description provided for @assistantNotConfigured.
  ///
  /// In en, this message translates to:
  /// **'The AI assistant is not available on the platform right now.'**
  String get assistantNotConfigured;

  /// No description provided for @assistantNotActive.
  ///
  /// In en, this message translates to:
  /// **'The assistant isn\'t enabled for your company or its package ended — contact your company admin.'**
  String get assistantNotActive;

  /// No description provided for @assistantExhausted.
  ///
  /// In en, this message translates to:
  /// **'This month\'s questions are used up — contact your company admin.'**
  String get assistantExhausted;

  /// No description provided for @assistantErrorExhausted.
  ///
  /// In en, this message translates to:
  /// **'This month\'s questions are used up.'**
  String get assistantErrorExhausted;

  /// No description provided for @assistantErrorNotActive.
  ///
  /// In en, this message translates to:
  /// **'The assistant isn\'t enabled or its package ended.'**
  String get assistantErrorNotActive;

  /// No description provided for @assistantErrorUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t reach the assistant — the question was not counted; try again.'**
  String get assistantErrorUnavailable;

  /// No description provided for @assistantErrorRate.
  ///
  /// In en, this message translates to:
  /// **'Too many questions in a short time — wait a minute and try again.'**
  String get assistantErrorRate;

  /// No description provided for @signTitle.
  ///
  /// In en, this message translates to:
  /// **'Customer signature'**
  String get signTitle;

  /// No description provided for @signNotSent.
  ///
  /// In en, this message translates to:
  /// **'Not sent for signature yet'**
  String get signNotSent;

  /// No description provided for @signNotSentHint.
  ///
  /// In en, this message translates to:
  /// **'Send the booking form to the customer to sign on their phone: a code goes to their number and they sign by hand.'**
  String get signNotSentHint;

  /// No description provided for @signStatePending.
  ///
  /// In en, this message translates to:
  /// **'Waiting for the customer'**
  String get signStatePending;

  /// No description provided for @signStateSigned.
  ///
  /// In en, this message translates to:
  /// **'Signed by the customer'**
  String get signStateSigned;

  /// No description provided for @signStateExpired.
  ///
  /// In en, this message translates to:
  /// **'The link expired'**
  String get signStateExpired;

  /// No description provided for @signStateCancelled.
  ///
  /// In en, this message translates to:
  /// **'The request was cancelled'**
  String get signStateCancelled;

  /// No description provided for @signCodeTo.
  ///
  /// In en, this message translates to:
  /// **'The code goes to {phone}'**
  String signCodeTo(String phone);

  /// No description provided for @signExpires.
  ///
  /// In en, this message translates to:
  /// **'The link works until {when}'**
  String signExpires(String when);

  /// No description provided for @signSignedBy.
  ///
  /// In en, this message translates to:
  /// **'Signed as {name} — {when}'**
  String signSignedBy(String name, String when);

  /// No description provided for @signSentAt.
  ///
  /// In en, this message translates to:
  /// **'Sent {when}'**
  String signSentAt(String when);

  /// No description provided for @signOutdated.
  ///
  /// In en, this message translates to:
  /// **'The booking changed after the customer signed — the signature is on an older version. Send a new link.'**
  String get signOutdated;

  /// No description provided for @signSend.
  ///
  /// In en, this message translates to:
  /// **'Send for signature'**
  String get signSend;

  /// No description provided for @signSendNew.
  ///
  /// In en, this message translates to:
  /// **'Send a new link'**
  String get signSendNew;

  /// No description provided for @signCancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel request'**
  String get signCancel;

  /// No description provided for @signNewLinkTitle.
  ///
  /// In en, this message translates to:
  /// **'Send a new link?'**
  String get signNewLinkTitle;

  /// No description provided for @signNewLinkBody.
  ///
  /// In en, this message translates to:
  /// **'The link sent before will stop working.'**
  String get signNewLinkBody;

  /// No description provided for @signCancelTitle.
  ///
  /// In en, this message translates to:
  /// **'Cancel the signature request?'**
  String get signCancelTitle;

  /// No description provided for @signCancelBody.
  ///
  /// In en, this message translates to:
  /// **'The customer\'s link will stop working.'**
  String get signCancelBody;

  /// No description provided for @signCancelConfirm.
  ///
  /// In en, this message translates to:
  /// **'Cancel request'**
  String get signCancelConfirm;

  /// No description provided for @signLinkReady.
  ///
  /// In en, this message translates to:
  /// **'The signing link is ready'**
  String get signLinkReady;

  /// No description provided for @signLinkHint.
  ///
  /// In en, this message translates to:
  /// **'Send it to the customer now — the link is not shown again, and works for 72 hours.'**
  String get signLinkHint;

  /// No description provided for @signCopy.
  ///
  /// In en, this message translates to:
  /// **'Copy'**
  String get signCopy;

  /// No description provided for @signCopied.
  ///
  /// In en, this message translates to:
  /// **'Link copied'**
  String get signCopied;

  /// No description provided for @signShare.
  ///
  /// In en, this message translates to:
  /// **'Share'**
  String get signShare;

  /// No description provided for @signShareMessage.
  ///
  /// In en, this message translates to:
  /// **'Hello {name}, here is the link to review and sign your booking form:\n{url}'**
  String signShareMessage(String name, String url);

  /// No description provided for @campaignsTitle.
  ///
  /// In en, this message translates to:
  /// **'Campaigns'**
  String get campaignsTitle;

  /// No description provided for @campaignsEmpty.
  ///
  /// In en, this message translates to:
  /// **'No campaigns'**
  String get campaignsEmpty;

  /// No description provided for @campaignsEmptyHint.
  ///
  /// In en, this message translates to:
  /// **'Campaigns are set up and their spend recorded on the web dashboard.'**
  String get campaignsEmptyHint;

  /// No description provided for @campaignsSpend.
  ///
  /// In en, this message translates to:
  /// **'Total spend'**
  String get campaignsSpend;

  /// No description provided for @campaignsLeads.
  ///
  /// In en, this message translates to:
  /// **'Leads'**
  String get campaignsLeads;

  /// No description provided for @campaignsCpl.
  ///
  /// In en, this message translates to:
  /// **'Cost per lead'**
  String get campaignsCpl;

  /// No description provided for @campaignsWon.
  ///
  /// In en, this message translates to:
  /// **'Sales'**
  String get campaignsWon;

  /// No description provided for @campaignsCpa.
  ///
  /// In en, this message translates to:
  /// **'Cost per sale'**
  String get campaignsCpa;

  /// No description provided for @campaignLeadsCount.
  ///
  /// In en, this message translates to:
  /// **'{n} leads'**
  String campaignLeadsCount(String n);

  /// No description provided for @campaignWonCount.
  ///
  /// In en, this message translates to:
  /// **'{n} sales'**
  String campaignWonCount(String n);

  /// No description provided for @campaignLostCount.
  ///
  /// In en, this message translates to:
  /// **'{n} leads lost'**
  String campaignLostCount(String n);

  /// No description provided for @campaignBudgetOf.
  ///
  /// In en, this message translates to:
  /// **'of a {n} budget'**
  String campaignBudgetOf(String n);

  /// No description provided for @campaignQualified.
  ///
  /// In en, this message translates to:
  /// **'Qualified'**
  String get campaignQualified;

  /// No description provided for @campaignChannel.
  ///
  /// In en, this message translates to:
  /// **'Channel'**
  String get campaignChannel;

  /// No description provided for @campaignProject.
  ///
  /// In en, this message translates to:
  /// **'Project'**
  String get campaignProject;

  /// No description provided for @campaignSource.
  ///
  /// In en, this message translates to:
  /// **'Source'**
  String get campaignSource;

  /// No description provided for @campaignPeriod.
  ///
  /// In en, this message translates to:
  /// **'Period'**
  String get campaignPeriod;

  /// No description provided for @campaignBudget.
  ///
  /// In en, this message translates to:
  /// **'Budget'**
  String get campaignBudget;

  /// No description provided for @campaignCode.
  ///
  /// In en, this message translates to:
  /// **'Link code'**
  String get campaignCode;

  /// No description provided for @campaignPlatforms.
  ///
  /// In en, this message translates to:
  /// **'Where its leads came from'**
  String get campaignPlatforms;

  /// No description provided for @campaignSpendLog.
  ///
  /// In en, this message translates to:
  /// **'Spend'**
  String get campaignSpendLog;

  /// No description provided for @campaignSpendEmpty.
  ///
  /// In en, this message translates to:
  /// **'No spend recorded yet.'**
  String get campaignSpendEmpty;

  /// No description provided for @campaignOnDashboard.
  ///
  /// In en, this message translates to:
  /// **'Edit the campaign and record spend on the web dashboard.'**
  String get campaignOnDashboard;

  /// No description provided for @campaignStatusPlanned.
  ///
  /// In en, this message translates to:
  /// **'Planned'**
  String get campaignStatusPlanned;

  /// No description provided for @campaignStatusActive.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get campaignStatusActive;

  /// No description provided for @campaignStatusPaused.
  ///
  /// In en, this message translates to:
  /// **'Paused'**
  String get campaignStatusPaused;

  /// No description provided for @campaignStatusEnded.
  ///
  /// In en, this message translates to:
  /// **'Ended'**
  String get campaignStatusEnded;

  /// No description provided for @campaignChannelFacebook.
  ///
  /// In en, this message translates to:
  /// **'Meta (Facebook + Instagram)'**
  String get campaignChannelFacebook;

  /// No description provided for @campaignChannelInstagram.
  ///
  /// In en, this message translates to:
  /// **'Instagram'**
  String get campaignChannelInstagram;

  /// No description provided for @campaignChannelTiktok.
  ///
  /// In en, this message translates to:
  /// **'TikTok'**
  String get campaignChannelTiktok;

  /// No description provided for @campaignChannelGoogle.
  ///
  /// In en, this message translates to:
  /// **'Google'**
  String get campaignChannelGoogle;

  /// No description provided for @campaignChannelSnapchat.
  ///
  /// In en, this message translates to:
  /// **'Snapchat'**
  String get campaignChannelSnapchat;

  /// No description provided for @campaignChannelWhatsapp.
  ///
  /// In en, this message translates to:
  /// **'WhatsApp'**
  String get campaignChannelWhatsapp;

  /// No description provided for @campaignChannelSms.
  ///
  /// In en, this message translates to:
  /// **'SMS'**
  String get campaignChannelSms;

  /// No description provided for @campaignChannelEmail.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get campaignChannelEmail;

  /// No description provided for @campaignChannelBillboard.
  ///
  /// In en, this message translates to:
  /// **'Billboards'**
  String get campaignChannelBillboard;

  /// No description provided for @campaignChannelEvent.
  ///
  /// In en, this message translates to:
  /// **'Event'**
  String get campaignChannelEvent;

  /// No description provided for @campaignChannelOther.
  ///
  /// In en, this message translates to:
  /// **'Other'**
  String get campaignChannelOther;

  /// No description provided for @campaignPlatformFacebook.
  ///
  /// In en, this message translates to:
  /// **'Facebook'**
  String get campaignPlatformFacebook;

  /// No description provided for @campaignPlatformInstagram.
  ///
  /// In en, this message translates to:
  /// **'Instagram'**
  String get campaignPlatformInstagram;

  /// No description provided for @campaignPlatformMessenger.
  ///
  /// In en, this message translates to:
  /// **'Messenger'**
  String get campaignPlatformMessenger;

  /// No description provided for @campaignPlatformAudience.
  ///
  /// In en, this message translates to:
  /// **'Audience Network'**
  String get campaignPlatformAudience;

  /// No description provided for @campaignPlatformOther.
  ///
  /// In en, this message translates to:
  /// **'Other source'**
  String get campaignPlatformOther;

  /// No description provided for @campaignPlatformUnknown.
  ///
  /// In en, this message translates to:
  /// **'Not known'**
  String get campaignPlatformUnknown;

  /// No description provided for @leadCampaign.
  ///
  /// In en, this message translates to:
  /// **'Campaign'**
  String get leadCampaign;

  /// No description provided for @leadCampaignHint.
  ///
  /// In en, this message translates to:
  /// **'The campaign that brought the lead (optional)'**
  String get leadCampaignHint;

  /// No description provided for @leadCampaignNone.
  ///
  /// In en, this message translates to:
  /// **'No campaign'**
  String get leadCampaignNone;

  /// No description provided for @campaignsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Spend, leads and sales from each campaign'**
  String get campaignsSubtitle;

  /// No description provided for @campaignFrom.
  ///
  /// In en, this message translates to:
  /// **'From {n}'**
  String campaignFrom(String n);

  /// No description provided for @campaignUntil.
  ///
  /// In en, this message translates to:
  /// **'Until {n}'**
  String campaignUntil(String n);

  /// No description provided for @duplicatesTitle.
  ///
  /// In en, this message translates to:
  /// **'Duplicate leads'**
  String get duplicatesTitle;

  /// No description provided for @duplicatesSubtitle.
  ///
  /// In en, this message translates to:
  /// **'One customer, several open leads — merge them'**
  String get duplicatesSubtitle;

  /// No description provided for @duplicatesHow.
  ///
  /// In en, this message translates to:
  /// **'Pick the lead to keep; the others merge into it with their notes, calls and visits. It takes what it lacks (campaign, source, project, owner, next follow-up) and the furthest stage reached.'**
  String get duplicatesHow;

  /// No description provided for @duplicatesEmpty.
  ///
  /// In en, this message translates to:
  /// **'No duplicate leads'**
  String get duplicatesEmpty;

  /// No description provided for @duplicatesEmptyHint.
  ///
  /// In en, this message translates to:
  /// **'Every customer has a single open lead.'**
  String get duplicatesEmptyHint;

  /// No description provided for @duplicatesOpenLeads.
  ///
  /// In en, this message translates to:
  /// **'{n} open leads'**
  String duplicatesOpenLeads(String n);

  /// No description provided for @duplicatesKeep.
  ///
  /// In en, this message translates to:
  /// **'Keep'**
  String get duplicatesKeep;

  /// No description provided for @duplicatesMerge.
  ///
  /// In en, this message translates to:
  /// **'Merge'**
  String get duplicatesMerge;

  /// No description provided for @duplicatesOwner.
  ///
  /// In en, this message translates to:
  /// **'Owner'**
  String get duplicatesOwner;

  /// No description provided for @duplicatesUnassigned.
  ///
  /// In en, this message translates to:
  /// **'Unassigned'**
  String get duplicatesUnassigned;

  /// No description provided for @duplicatesAdded.
  ///
  /// In en, this message translates to:
  /// **'Added'**
  String get duplicatesAdded;

  /// No description provided for @duplicatesActivities.
  ///
  /// In en, this message translates to:
  /// **'{n} activities'**
  String duplicatesActivities(String n);

  /// No description provided for @duplicatesLocked.
  ///
  /// In en, this message translates to:
  /// **'Has a reservation or a broker — keep this one instead'**
  String get duplicatesLocked;

  /// No description provided for @duplicatesMergeN.
  ///
  /// In en, this message translates to:
  /// **'Merge {n} into the kept lead'**
  String duplicatesMergeN(String n);

  /// No description provided for @duplicatesConfirmTitle.
  ///
  /// In en, this message translates to:
  /// **'Merge the leads?'**
  String get duplicatesConfirmTitle;

  /// No description provided for @duplicatesConfirmBody.
  ///
  /// In en, this message translates to:
  /// **'Their notes and history move to the kept lead, then they are removed.'**
  String get duplicatesConfirmBody;

  /// No description provided for @duplicatesMerged.
  ///
  /// In en, this message translates to:
  /// **'{n} merged'**
  String duplicatesMerged(String n);

  /// No description provided for @securityDevices.
  ///
  /// In en, this message translates to:
  /// **'Devices'**
  String get securityDevices;

  /// No description provided for @securityDevicesHint.
  ///
  /// In en, this message translates to:
  /// **'The devices signed in to your account. If one isn\'t yours, sign it out and change your password.'**
  String get securityDevicesHint;

  /// No description provided for @securityThisDevice.
  ///
  /// In en, this message translates to:
  /// **'This device'**
  String get securityThisDevice;

  /// No description provided for @securityLastSeen.
  ///
  /// In en, this message translates to:
  /// **'Last used {when}'**
  String securityLastSeen(String when);

  /// No description provided for @securityDeviceIphone.
  ///
  /// In en, this message translates to:
  /// **'iPhone'**
  String get securityDeviceIphone;

  /// No description provided for @securityDeviceAndroid.
  ///
  /// In en, this message translates to:
  /// **'Android'**
  String get securityDeviceAndroid;

  /// No description provided for @securityDeviceBrowser.
  ///
  /// In en, this message translates to:
  /// **'Browser'**
  String get securityDeviceBrowser;

  /// No description provided for @securityDeviceUnknown.
  ///
  /// In en, this message translates to:
  /// **'Device'**
  String get securityDeviceUnknown;

  /// No description provided for @securityBrowserOn.
  ///
  /// In en, this message translates to:
  /// **'{browser} on {os}'**
  String securityBrowserOn(String browser, String os);

  /// No description provided for @securitySignOut.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get securitySignOut;

  /// No description provided for @securitySignOutTitle.
  ///
  /// In en, this message translates to:
  /// **'Sign this device out?'**
  String get securitySignOutTitle;

  /// No description provided for @securitySignOutBody.
  ///
  /// In en, this message translates to:
  /// **'{device} will have to sign in again.'**
  String securitySignOutBody(String device);

  /// No description provided for @securitySignedOut.
  ///
  /// In en, this message translates to:
  /// **'The device was signed out'**
  String get securitySignedOut;

  /// No description provided for @securitySignOutOthers.
  ///
  /// In en, this message translates to:
  /// **'Sign out all other devices'**
  String get securitySignOutOthers;

  /// No description provided for @securitySignOutOthersTitle.
  ///
  /// In en, this message translates to:
  /// **'Sign out all other devices?'**
  String get securitySignOutOthersTitle;

  /// No description provided for @securitySignOutOthersBody.
  ///
  /// In en, this message translates to:
  /// **'Every device but this phone will have to sign in again.'**
  String get securitySignOutOthersBody;

  /// No description provided for @securitySignedOutOthers.
  ///
  /// In en, this message translates to:
  /// **'{n} devices signed out'**
  String securitySignedOutOthers(String n);

  /// No description provided for @securityOn.
  ///
  /// In en, this message translates to:
  /// **'On'**
  String get securityOn;

  /// No description provided for @securityOff.
  ///
  /// In en, this message translates to:
  /// **'Off'**
  String get securityOff;

  /// No description provided for @securityTfaHint.
  ///
  /// In en, this message translates to:
  /// **'A code from an authenticator app with your password at each sign-in.'**
  String get securityTfaHint;

  /// No description provided for @securityTfaRequired.
  ///
  /// In en, this message translates to:
  /// **'Your company requires two-step sign-in, so it can\'t be turned off.'**
  String get securityTfaRequired;

  /// No description provided for @securityTfaTurnOn.
  ///
  /// In en, this message translates to:
  /// **'Turn on two-step sign-in'**
  String get securityTfaTurnOn;

  /// No description provided for @securityTfaTurnOff.
  ///
  /// In en, this message translates to:
  /// **'Turn off'**
  String get securityTfaTurnOff;

  /// No description provided for @securityTfaSetupHint.
  ///
  /// In en, this message translates to:
  /// **'Add this key to an authenticator app (Google or Microsoft Authenticator), then type the code it shows.'**
  String get securityTfaSetupHint;

  /// No description provided for @securityTfaOffBody.
  ///
  /// In en, this message translates to:
  /// **'Enter your password and a code from the app to turn two-step sign-in off.'**
  String get securityTfaOffBody;

  /// No description provided for @securityTfaOffDone.
  ///
  /// In en, this message translates to:
  /// **'Two-step sign-in is off'**
  String get securityTfaOffDone;

  /// No description provided for @securityRecoveryLeft.
  ///
  /// In en, this message translates to:
  /// **'{n} recovery codes left'**
  String securityRecoveryLeft(String n);

  /// No description provided for @securityNewCodes.
  ///
  /// In en, this message translates to:
  /// **'New recovery codes'**
  String get securityNewCodes;

  /// No description provided for @securityNewCodesBody.
  ///
  /// In en, this message translates to:
  /// **'The old codes stop working. Enter a code from the app to get new ones.'**
  String get securityNewCodesBody;

  /// No description provided for @securityPasswordHint.
  ///
  /// In en, this message translates to:
  /// **'A strong password of at least 8 characters.'**
  String get securityPasswordHint;

  /// No description provided for @securityChangePassword.
  ///
  /// In en, this message translates to:
  /// **'Change password'**
  String get securityChangePassword;

  /// No description provided for @securityCurrentPassword.
  ///
  /// In en, this message translates to:
  /// **'Current password'**
  String get securityCurrentPassword;

  /// No description provided for @securityPasswordAgain.
  ///
  /// In en, this message translates to:
  /// **'Type the new password again'**
  String get securityPasswordAgain;

  /// No description provided for @securityPasswordMismatch.
  ///
  /// In en, this message translates to:
  /// **'The passwords don\'t match'**
  String get securityPasswordMismatch;

  /// No description provided for @securityPasswordChanged.
  ///
  /// In en, this message translates to:
  /// **'Password changed'**
  String get securityPasswordChanged;

  /// No description provided for @leadDupTitle.
  ///
  /// In en, this message translates to:
  /// **'This customer already has an open lead'**
  String get leadDupTitle;

  /// No description provided for @leadDupDesc.
  ///
  /// In en, this message translates to:
  /// **'A second lead splits their follow-up in two. Carry on with the open one, or add a new one if this is really a different request.'**
  String get leadDupDesc;

  /// No description provided for @leadDupOwner.
  ///
  /// In en, this message translates to:
  /// **'Owner'**
  String get leadDupOwner;

  /// No description provided for @leadDupUnassigned.
  ///
  /// In en, this message translates to:
  /// **'Unassigned'**
  String get leadDupUnassigned;

  /// No description provided for @leadDupOpen.
  ///
  /// In en, this message translates to:
  /// **'Open the lead'**
  String get leadDupOpen;

  /// No description provided for @leadDupAnyway.
  ///
  /// In en, this message translates to:
  /// **'Add a new lead anyway'**
  String get leadDupAnyway;

  /// No description provided for @reservationDecideTitle.
  ///
  /// In en, this message translates to:
  /// **'Waiting for your approval'**
  String get reservationDecideTitle;

  /// No description provided for @reservationDecideDesc.
  ///
  /// In en, this message translates to:
  /// **'Approving lets the booking go on to a contract. Rejecting frees the unit.'**
  String get reservationDecideDesc;

  /// No description provided for @reservationBookedBy.
  ///
  /// In en, this message translates to:
  /// **'Booked by {name}'**
  String reservationBookedBy(String name);

  /// No description provided for @reservationApprove.
  ///
  /// In en, this message translates to:
  /// **'Approve'**
  String get reservationApprove;

  /// No description provided for @reservationReject.
  ///
  /// In en, this message translates to:
  /// **'Reject'**
  String get reservationReject;

  /// No description provided for @reservationApproveConfirm.
  ///
  /// In en, this message translates to:
  /// **'Approve this reservation?'**
  String get reservationApproveConfirm;

  /// No description provided for @reservationRejectTitle.
  ///
  /// In en, this message translates to:
  /// **'Reject the reservation'**
  String get reservationRejectTitle;

  /// No description provided for @reservationRejectReasonHint.
  ///
  /// In en, this message translates to:
  /// **'Reason (the rep sees it)'**
  String get reservationRejectReasonHint;

  /// No description provided for @reservationApprovedDone.
  ///
  /// In en, this message translates to:
  /// **'Reservation approved'**
  String get reservationApprovedDone;

  /// No description provided for @reservationRejectedDone.
  ///
  /// In en, this message translates to:
  /// **'Reservation rejected'**
  String get reservationRejectedDone;

  /// No description provided for @contractDeliveryPromised.
  ///
  /// In en, this message translates to:
  /// **'Handover in the contract'**
  String get contractDeliveryPromised;

  /// No description provided for @contractDeliveryExpected.
  ///
  /// In en, this message translates to:
  /// **'Expected handover now'**
  String get contractDeliveryExpected;

  /// No description provided for @contractDeliveryLate.
  ///
  /// In en, this message translates to:
  /// **'{days} days late'**
  String contractDeliveryLate(int days);

  /// No description provided for @unitSpecsTitle.
  ///
  /// In en, this message translates to:
  /// **'Unit specs'**
  String get unitSpecsTitle;

  /// No description provided for @unitAreaValue.
  ///
  /// In en, this message translates to:
  /// **'{n} m²'**
  String unitAreaValue(String n);

  /// No description provided for @unitSpecNetArea.
  ///
  /// In en, this message translates to:
  /// **'Net area'**
  String get unitSpecNetArea;

  /// No description provided for @unitSpecGarden.
  ///
  /// In en, this message translates to:
  /// **'Garden'**
  String get unitSpecGarden;

  /// No description provided for @unitSpecRoof.
  ///
  /// In en, this message translates to:
  /// **'Roof'**
  String get unitSpecRoof;

  /// No description provided for @unitSpecTerrace.
  ///
  /// In en, this message translates to:
  /// **'Terrace'**
  String get unitSpecTerrace;

  /// No description provided for @unitSpecLand.
  ///
  /// In en, this message translates to:
  /// **'Land area'**
  String get unitSpecLand;

  /// No description provided for @unitSpecFinishing.
  ///
  /// In en, this message translates to:
  /// **'Finishing'**
  String get unitSpecFinishing;

  /// No description provided for @unitSpecView.
  ///
  /// In en, this message translates to:
  /// **'View'**
  String get unitSpecView;

  /// No description provided for @unitSpecOrientation.
  ///
  /// In en, this message translates to:
  /// **'Orientation'**
  String get unitSpecOrientation;

  /// No description provided for @unitSpecDelivery.
  ///
  /// In en, this message translates to:
  /// **'Handover'**
  String get unitSpecDelivery;

  /// No description provided for @unitDeliveryNow.
  ///
  /// In en, this message translates to:
  /// **'Ready to move in'**
  String get unitDeliveryNow;

  /// No description provided for @unitFinishingCoreShell.
  ///
  /// In en, this message translates to:
  /// **'Core & shell'**
  String get unitFinishingCoreShell;

  /// No description provided for @unitFinishingSemi.
  ///
  /// In en, this message translates to:
  /// **'Semi-finished'**
  String get unitFinishingSemi;

  /// No description provided for @unitFinishingFull.
  ///
  /// In en, this message translates to:
  /// **'Fully finished'**
  String get unitFinishingFull;

  /// No description provided for @unitFinishingFurnished.
  ///
  /// In en, this message translates to:
  /// **'Furnished'**
  String get unitFinishingFurnished;

  /// No description provided for @unitViewGarden.
  ///
  /// In en, this message translates to:
  /// **'Garden'**
  String get unitViewGarden;

  /// No description provided for @unitViewPool.
  ///
  /// In en, this message translates to:
  /// **'Pool'**
  String get unitViewPool;

  /// No description provided for @unitViewLagoon.
  ///
  /// In en, this message translates to:
  /// **'Lagoon'**
  String get unitViewLagoon;

  /// No description provided for @unitViewSea.
  ///
  /// In en, this message translates to:
  /// **'Sea'**
  String get unitViewSea;

  /// No description provided for @unitViewNile.
  ///
  /// In en, this message translates to:
  /// **'Nile'**
  String get unitViewNile;

  /// No description provided for @unitViewClub.
  ///
  /// In en, this message translates to:
  /// **'Clubhouse'**
  String get unitViewClub;

  /// No description provided for @unitViewLandscape.
  ///
  /// In en, this message translates to:
  /// **'Landscape'**
  String get unitViewLandscape;

  /// No description provided for @unitViewMainStreet.
  ///
  /// In en, this message translates to:
  /// **'Main street'**
  String get unitViewMainStreet;

  /// No description provided for @unitViewSideStreet.
  ///
  /// In en, this message translates to:
  /// **'Side street'**
  String get unitViewSideStreet;

  /// No description provided for @unitOrientationNorth.
  ///
  /// In en, this message translates to:
  /// **'North'**
  String get unitOrientationNorth;

  /// No description provided for @unitOrientationSouth.
  ///
  /// In en, this message translates to:
  /// **'South'**
  String get unitOrientationSouth;

  /// No description provided for @unitOrientationEast.
  ///
  /// In en, this message translates to:
  /// **'East'**
  String get unitOrientationEast;

  /// No description provided for @unitOrientationWest.
  ///
  /// In en, this message translates to:
  /// **'West'**
  String get unitOrientationWest;

  /// No description provided for @unitOrientationNorthEast.
  ///
  /// In en, this message translates to:
  /// **'North-east'**
  String get unitOrientationNorthEast;

  /// No description provided for @unitOrientationNorthWest.
  ///
  /// In en, this message translates to:
  /// **'North-west'**
  String get unitOrientationNorthWest;

  /// No description provided for @unitOrientationSouthEast.
  ///
  /// In en, this message translates to:
  /// **'South-east'**
  String get unitOrientationSouthEast;

  /// No description provided for @unitOrientationSouthWest.
  ///
  /// In en, this message translates to:
  /// **'South-west'**
  String get unitOrientationSouthWest;

  /// No description provided for @contentAboutCompany.
  ///
  /// In en, this message translates to:
  /// **'About the company'**
  String get contentAboutCompany;

  /// No description provided for @contentPageEmpty.
  ///
  /// In en, this message translates to:
  /// **'This page is empty for now.'**
  String get contentPageEmpty;

  /// No description provided for @installmentPaidOn.
  ///
  /// In en, this message translates to:
  /// **'Paid on {date}'**
  String installmentPaidOn(String date);

  /// No description provided for @reservationEventCreated.
  ///
  /// In en, this message translates to:
  /// **'Reservation created'**
  String get reservationEventCreated;

  /// No description provided for @reservationEventApproved.
  ///
  /// In en, this message translates to:
  /// **'Reservation approved'**
  String get reservationEventApproved;

  /// No description provided for @reservationEventRejected.
  ///
  /// In en, this message translates to:
  /// **'Reservation rejected'**
  String get reservationEventRejected;

  /// No description provided for @reservationEventCancelled.
  ///
  /// In en, this message translates to:
  /// **'Reservation cancelled'**
  String get reservationEventCancelled;

  /// No description provided for @reservationEventExpired.
  ///
  /// In en, this message translates to:
  /// **'Reservation expired'**
  String get reservationEventExpired;

  /// No description provided for @reservationEventNoteAdded.
  ///
  /// In en, this message translates to:
  /// **'Note added'**
  String get reservationEventNoteAdded;

  /// No description provided for @reservationEventPaymentConfirmed.
  ///
  /// In en, this message translates to:
  /// **'Booking payment confirmed'**
  String get reservationEventPaymentConfirmed;

  /// No description provided for @reservationEventPaymentUnconfirmed.
  ///
  /// In en, this message translates to:
  /// **'Booking payment unconfirmed'**
  String get reservationEventPaymentUnconfirmed;

  /// No description provided for @reservationEventConverted.
  ///
  /// In en, this message translates to:
  /// **'Converted to a contract'**
  String get reservationEventConverted;

  /// No description provided for @reservationEventOther.
  ///
  /// In en, this message translates to:
  /// **'Reservation updated'**
  String get reservationEventOther;

  /// No description provided for @visitEventRequestCreated.
  ///
  /// In en, this message translates to:
  /// **'Visit requested'**
  String get visitEventRequestCreated;

  /// No description provided for @visitEventRequestReviewed.
  ///
  /// In en, this message translates to:
  /// **'Visit request reviewed'**
  String get visitEventRequestReviewed;

  /// No description provided for @visitEventRequestRejected.
  ///
  /// In en, this message translates to:
  /// **'Visit request rejected'**
  String get visitEventRequestRejected;

  /// No description provided for @visitEventRequestCancelled.
  ///
  /// In en, this message translates to:
  /// **'Visit request cancelled'**
  String get visitEventRequestCancelled;

  /// No description provided for @visitEventScheduled.
  ///
  /// In en, this message translates to:
  /// **'Visit scheduled'**
  String get visitEventScheduled;

  /// No description provided for @visitEventConfirmed.
  ///
  /// In en, this message translates to:
  /// **'Visit confirmed'**
  String get visitEventConfirmed;

  /// No description provided for @visitEventCompleted.
  ///
  /// In en, this message translates to:
  /// **'Visit completed'**
  String get visitEventCompleted;

  /// No description provided for @visitEventCancelled.
  ///
  /// In en, this message translates to:
  /// **'Visit cancelled'**
  String get visitEventCancelled;

  /// No description provided for @visitEventNoShow.
  ///
  /// In en, this message translates to:
  /// **'Client did not show'**
  String get visitEventNoShow;

  /// No description provided for @visitEventRescheduled.
  ///
  /// In en, this message translates to:
  /// **'Visit rescheduled'**
  String get visitEventRescheduled;

  /// No description provided for @visitEventSalesAssigned.
  ///
  /// In en, this message translates to:
  /// **'Assigned to a sales advisor'**
  String get visitEventSalesAssigned;

  /// No description provided for @visitEventNoteAdded.
  ///
  /// In en, this message translates to:
  /// **'Note added'**
  String get visitEventNoteAdded;

  /// No description provided for @visitEventCustomerConfirmed.
  ///
  /// In en, this message translates to:
  /// **'Client confirmed'**
  String get visitEventCustomerConfirmed;

  /// No description provided for @visitEventCustomerRescheduleRequested.
  ///
  /// In en, this message translates to:
  /// **'Client asked to reschedule'**
  String get visitEventCustomerRescheduleRequested;

  /// No description provided for @visitEventReminderSent.
  ///
  /// In en, this message translates to:
  /// **'Reminder sent'**
  String get visitEventReminderSent;

  /// No description provided for @visitEventSalesReassigned.
  ///
  /// In en, this message translates to:
  /// **'Visit reassigned'**
  String get visitEventSalesReassigned;

  /// No description provided for @visitEventFeedbackSubmitted.
  ///
  /// In en, this message translates to:
  /// **'Feedback added'**
  String get visitEventFeedbackSubmitted;

  /// No description provided for @visitEventOther.
  ///
  /// In en, this message translates to:
  /// **'Visit updated'**
  String get visitEventOther;

  /// No description provided for @authPhoneTitle.
  ///
  /// In en, this message translates to:
  /// **'Sign in with your phone'**
  String get authPhoneTitle;

  /// No description provided for @fieldFullNameNewAccount.
  ///
  /// In en, this message translates to:
  /// **'Full name (new accounts only)'**
  String get fieldFullNameNewAccount;

  /// No description provided for @brokerLeadSectionContact.
  ///
  /// In en, this message translates to:
  /// **'Client details'**
  String get brokerLeadSectionContact;

  /// No description provided for @brokerLeadSectionContactSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Name and phone are required; email is optional.'**
  String get brokerLeadSectionContactSubtitle;

  /// No description provided for @brokerSectionNoteSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Anything that helps the sales team reach the client.'**
  String get brokerSectionNoteSubtitle;

  /// No description provided for @brokerReservationClientSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Pick one of the leads you added.'**
  String get brokerReservationClientSubtitle;

  /// No description provided for @brokerReservationNewSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Request a unit booking for your client'**
  String get brokerReservationNewSubtitle;

  /// No description provided for @brokerLeadNewSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Add the prospective client\'s details'**
  String get brokerLeadNewSubtitle;

  /// No description provided for @followUpsYesterday.
  ///
  /// In en, this message translates to:
  /// **'Yesterday'**
  String get followUpsYesterday;

  /// No description provided for @brokerAvailableProjects.
  ///
  /// In en, this message translates to:
  /// **'Available projects'**
  String get brokerAvailableProjects;

  /// No description provided for @brokerAchievementSnapshot.
  ///
  /// In en, this message translates to:
  /// **'Performance snapshot'**
  String get brokerAchievementSnapshot;

  /// No description provided for @brokerActivityBadge.
  ///
  /// In en, this message translates to:
  /// **'Activity'**
  String get brokerActivityBadge;

  /// No description provided for @brokerLeadsSent.
  ///
  /// In en, this message translates to:
  /// **'Leads sent'**
  String get brokerLeadsSent;

  /// No description provided for @brokerAcceptanceRate.
  ///
  /// In en, this message translates to:
  /// **'Acceptance rate'**
  String get brokerAcceptanceRate;

  /// No description provided for @brokerSignedContracts.
  ///
  /// In en, this message translates to:
  /// **'Signed contracts'**
  String get brokerSignedContracts;

  /// No description provided for @brokerPendingLeads.
  ///
  /// In en, this message translates to:
  /// **'{n, plural, =1{1 lead waiting for approval} other{{n} leads waiting for approval}}'**
  String brokerPendingLeads(int n);

  /// No description provided for @brokerPendingReservations.
  ///
  /// In en, this message translates to:
  /// **'{n, plural, =1{1 reservation waiting for review} other{{n} reservations waiting for review}}'**
  String brokerPendingReservations(int n);

  /// No description provided for @brokerChipWaiting.
  ///
  /// In en, this message translates to:
  /// **'Waiting'**
  String get brokerChipWaiting;

  /// No description provided for @brokerChipReview.
  ///
  /// In en, this message translates to:
  /// **'Review'**
  String get brokerChipReview;

  /// No description provided for @brokerChipGood.
  ///
  /// In en, this message translates to:
  /// **'Good'**
  String get brokerChipGood;

  /// No description provided for @brokerFocusAllClear.
  ///
  /// In en, this message translates to:
  /// **'Nothing urgent — great work!'**
  String get brokerFocusAllClear;

  /// No description provided for @brokerNoProjects.
  ///
  /// In en, this message translates to:
  /// **'No projects available'**
  String get brokerNoProjects;

  /// No description provided for @brokerCommissionsDue.
  ///
  /// In en, this message translates to:
  /// **'Total commissions due'**
  String get brokerCommissionsDue;

  /// No description provided for @brokerCommissionsNone.
  ///
  /// In en, this message translates to:
  /// **'No commissions yet'**
  String get brokerCommissionsNone;

  /// No description provided for @brokerSalesVolume.
  ///
  /// In en, this message translates to:
  /// **'Sales volume'**
  String get brokerSalesVolume;

  /// No description provided for @brokerSignedValue.
  ///
  /// In en, this message translates to:
  /// **'Total value of signed contracts'**
  String get brokerSignedValue;

  /// No description provided for @daysAgo.
  ///
  /// In en, this message translates to:
  /// **'{n} days ago'**
  String daysAgo(int n);

  /// No description provided for @maintenanceActionStart.
  ///
  /// In en, this message translates to:
  /// **'Start work'**
  String get maintenanceActionStart;

  /// No description provided for @maintenanceActionReopen.
  ///
  /// In en, this message translates to:
  /// **'Reopen'**
  String get maintenanceActionReopen;

  /// No description provided for @maintenanceResolvedByBoth.
  ///
  /// In en, this message translates to:
  /// **'Both sides confirmed the fix'**
  String get maintenanceResolvedByBoth;

  /// No description provided for @maintenanceResolvedByCustomer.
  ///
  /// In en, this message translates to:
  /// **'The customer confirmed the fix'**
  String get maintenanceResolvedByCustomer;

  /// No description provided for @maintenanceResolvedBySupervisor.
  ///
  /// In en, this message translates to:
  /// **'The supervisor confirmed the fix'**
  String get maintenanceResolvedBySupervisor;

  /// No description provided for @maintenanceResolvedByNone.
  ///
  /// In en, this message translates to:
  /// **'Not confirmed yet'**
  String get maintenanceResolvedByNone;

  /// No description provided for @maintenanceOutOfWarranty.
  ///
  /// In en, this message translates to:
  /// **'Out of warranty'**
  String get maintenanceOutOfWarranty;

  /// No description provided for @maintenanceWarrantyUnknown.
  ///
  /// In en, this message translates to:
  /// **'Warranty unknown'**
  String get maintenanceWarrantyUnknown;

  /// No description provided for @maintenanceDeadlinePassed.
  ///
  /// In en, this message translates to:
  /// **'Past the deadline'**
  String get maintenanceDeadlinePassed;

  /// No description provided for @maintenanceTimeLeft.
  ///
  /// In en, this message translates to:
  /// **'Time left'**
  String get maintenanceTimeLeft;

  /// No description provided for @timeUnitDay.
  ///
  /// In en, this message translates to:
  /// **'days'**
  String get timeUnitDay;

  /// No description provided for @timeUnitHour.
  ///
  /// In en, this message translates to:
  /// **'hours'**
  String get timeUnitHour;

  /// No description provided for @timeUnitMinute.
  ///
  /// In en, this message translates to:
  /// **'min'**
  String get timeUnitMinute;

  /// No description provided for @timeUnitSecond.
  ///
  /// In en, this message translates to:
  /// **'sec'**
  String get timeUnitSecond;

  /// No description provided for @maintenanceDeadlineOver.
  ///
  /// In en, this message translates to:
  /// **'The deadline has passed'**
  String get maintenanceDeadlineOver;

  /// No description provided for @maintenanceDeadlineUsed.
  ///
  /// In en, this message translates to:
  /// **'{pct}% of the time used'**
  String maintenanceDeadlineUsed(String pct);

  /// No description provided for @unitTitle.
  ///
  /// In en, this message translates to:
  /// **'Unit {code}'**
  String unitTitle(String code);

  /// No description provided for @whatsappOpenFailed.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t open WhatsApp'**
  String get whatsappOpenFailed;

  /// No description provided for @maintenanceDirections.
  ///
  /// In en, this message translates to:
  /// **'Directions'**
  String get maintenanceDirections;

  /// No description provided for @maintenanceWarrantyEnds.
  ///
  /// In en, this message translates to:
  /// **'Warranty ends'**
  String get maintenanceWarrantyEnds;

  /// No description provided for @maintenanceServicedItem.
  ///
  /// In en, this message translates to:
  /// **'Item serviced'**
  String get maintenanceServicedItem;

  /// No description provided for @maintenanceRequestDate.
  ///
  /// In en, this message translates to:
  /// **'Request date'**
  String get maintenanceRequestDate;

  /// No description provided for @maintenancePriorityLabel.
  ///
  /// In en, this message translates to:
  /// **'Priority'**
  String get maintenancePriorityLabel;

  /// No description provided for @teamPerfSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Track your reps\' performance'**
  String get teamPerfSubtitle;

  /// No description provided for @teamTargetsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Set the team\'s monthly targets'**
  String get teamTargetsSubtitle;

  /// No description provided for @teamManagement.
  ///
  /// In en, this message translates to:
  /// **'Team management'**
  String get teamManagement;

  /// No description provided for @fromLabel.
  ///
  /// In en, this message translates to:
  /// **'From'**
  String get fromLabel;

  /// No description provided for @clientTagOwner.
  ///
  /// In en, this message translates to:
  /// **'Owner'**
  String get clientTagOwner;

  /// No description provided for @clientTagClient.
  ///
  /// In en, this message translates to:
  /// **'Client'**
  String get clientTagClient;

  /// No description provided for @kpiLeads.
  ///
  /// In en, this message translates to:
  /// **'Leads'**
  String get kpiLeads;

  /// No description provided for @calculatorInputs.
  ///
  /// In en, this message translates to:
  /// **'Inputs'**
  String get calculatorInputs;

  /// No description provided for @brokerProjectsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Projects open to you'**
  String get brokerProjectsSubtitle;

  /// No description provided for @brokerAddLeadForUnit.
  ///
  /// In en, this message translates to:
  /// **'Add a lead for this unit'**
  String get brokerAddLeadForUnit;

  /// No description provided for @brokerAddLeadForProject.
  ///
  /// In en, this message translates to:
  /// **'Add a lead for this project'**
  String get brokerAddLeadForProject;

  /// No description provided for @detailsLabel.
  ///
  /// In en, this message translates to:
  /// **'Details'**
  String get detailsLabel;

  /// No description provided for @aboutTheProject.
  ///
  /// In en, this message translates to:
  /// **'About the project'**
  String get aboutTheProject;

  /// No description provided for @projectFeatures.
  ///
  /// In en, this message translates to:
  /// **'Project features'**
  String get projectFeatures;

  /// No description provided for @projectLocationTitle.
  ///
  /// In en, this message translates to:
  /// **'Project location'**
  String get projectLocationTitle;

  /// No description provided for @totalLabel.
  ///
  /// In en, this message translates to:
  /// **'Total'**
  String get totalLabel;

  /// No description provided for @availableLabel.
  ///
  /// In en, this message translates to:
  /// **'Available'**
  String get availableLabel;

  /// No description provided for @unavailableLabel.
  ///
  /// In en, this message translates to:
  /// **'Unavailable'**
  String get unavailableLabel;

  /// No description provided for @brokerCommissionsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Your commissions and what is due'**
  String get brokerCommissionsSubtitle;

  /// No description provided for @brokerReservationDetails.
  ///
  /// In en, this message translates to:
  /// **'Reservation request'**
  String get brokerReservationDetails;

  /// No description provided for @brokerReserveForLead.
  ///
  /// In en, this message translates to:
  /// **'Request a booking for this client'**
  String get brokerReserveForLead;

  /// No description provided for @leadSingular.
  ///
  /// In en, this message translates to:
  /// **'Lead'**
  String get leadSingular;

  /// No description provided for @shareProjectBody.
  ///
  /// In en, this message translates to:
  /// **'See the project and its available units:'**
  String get shareProjectBody;

  /// No description provided for @shareUnitBody.
  ///
  /// In en, this message translates to:
  /// **'See the unit\'s details:'**
  String get shareUnitBody;

  /// No description provided for @paidDateLabel.
  ///
  /// In en, this message translates to:
  /// **'Paid on'**
  String get paidDateLabel;

  /// No description provided for @proofFilesTitle.
  ///
  /// In en, this message translates to:
  /// **'Proof files'**
  String get proofFilesTitle;

  /// No description provided for @tapFileToOpen.
  ///
  /// In en, this message translates to:
  /// **'Tap a file to open or download it'**
  String get tapFileToOpen;

  /// No description provided for @submitProofSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Attach your payment receipt for review'**
  String get submitProofSubtitle;

  /// No description provided for @fileReadyToSend.
  ///
  /// In en, this message translates to:
  /// **'The file is ready to send'**
  String get fileReadyToSend;

  /// No description provided for @proofFileTypes.
  ///
  /// In en, this message translates to:
  /// **'PDF · JPG · PNG · WebP (up to 25 MB)'**
  String get proofFileTypes;

  /// No description provided for @viewApprovedProof.
  ///
  /// In en, this message translates to:
  /// **'View the approved proof'**
  String get viewApprovedProof;

  /// No description provided for @tapToViewAttachment.
  ///
  /// In en, this message translates to:
  /// **'Tap to view or download the attachment'**
  String get tapToViewAttachment;

  /// No description provided for @paymentProofResubmitTitle.
  ///
  /// In en, this message translates to:
  /// **'Resubmit payment proof'**
  String get paymentProofResubmitTitle;

  /// No description provided for @paymentProofResubmitHint.
  ///
  /// In en, this message translates to:
  /// **'Your last proof was rejected — attach a new document'**
  String get paymentProofResubmitHint;

  /// No description provided for @paymentProofSubmitHint.
  ///
  /// In en, this message translates to:
  /// **'Attach a photo or PDF as proof of payment'**
  String get paymentProofSubmitHint;

  /// No description provided for @financeSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Your payments and contracts'**
  String get financeSubtitle;

  /// No description provided for @accountMyPropertySubtitle.
  ///
  /// In en, this message translates to:
  /// **'Your units and their status'**
  String get accountMyPropertySubtitle;

  /// No description provided for @accountMaintenanceSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Maintenance and repair requests'**
  String get accountMaintenanceSubtitle;

  /// No description provided for @moreAssistantSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Chat with our assistant'**
  String get moreAssistantSubtitle;

  /// No description provided for @moreBenefitFavorites.
  ///
  /// In en, this message translates to:
  /// **'Save favourites'**
  String get moreBenefitFavorites;

  /// No description provided for @moreBenefitCompare.
  ///
  /// In en, this message translates to:
  /// **'Compare units'**
  String get moreBenefitCompare;

  /// No description provided for @moreBenefitTrack.
  ///
  /// In en, this message translates to:
  /// **'Track your journey'**
  String get moreBenefitTrack;

  /// No description provided for @tapToViewReceipts.
  ///
  /// In en, this message translates to:
  /// **'Tap to view or download the receipts'**
  String get tapToViewReceipts;

  /// No description provided for @createdDateLabel.
  ///
  /// In en, this message translates to:
  /// **'Created on'**
  String get createdDateLabel;

  /// No description provided for @tapToViewDocuments.
  ///
  /// In en, this message translates to:
  /// **'Tap to view or download the attached documents'**
  String get tapToViewDocuments;

  /// No description provided for @maintenanceFollowUpTitle.
  ///
  /// In en, this message translates to:
  /// **'Resolution and rating'**
  String get maintenanceFollowUpTitle;

  /// No description provided for @maintenanceTargetDate.
  ///
  /// In en, this message translates to:
  /// **'Target fix date'**
  String get maintenanceTargetDate;

  /// No description provided for @maintenanceStartsAfterApproval.
  ///
  /// In en, this message translates to:
  /// **'Starts once the request is approved'**
  String get maintenanceStartsAfterApproval;

  /// No description provided for @maintenanceSupervisorConfirmation.
  ///
  /// In en, this message translates to:
  /// **'Supervisor confirmation'**
  String get maintenanceSupervisorConfirmation;

  /// No description provided for @maintenanceOverdueComplaintHint.
  ///
  /// In en, this message translates to:
  /// **'Your request is past its target date — you can file a complaint.'**
  String get maintenanceOverdueComplaintHint;

  /// No description provided for @maintenanceFileComplaint.
  ///
  /// In en, this message translates to:
  /// **'File a complaint'**
  String get maintenanceFileComplaint;

  /// No description provided for @maintenanceYourRating.
  ///
  /// In en, this message translates to:
  /// **'Your rating'**
  String get maintenanceYourRating;

  /// No description provided for @maintenanceYouConfirmedOn.
  ///
  /// In en, this message translates to:
  /// **'You confirmed the fix on {date}'**
  String maintenanceYouConfirmedOn(String date);

  /// No description provided for @maintenanceComplaintSent.
  ///
  /// In en, this message translates to:
  /// **'Your complaint was filed; our team will follow it up.'**
  String get maintenanceComplaintSent;

  /// No description provided for @maintenanceRatingRequired.
  ///
  /// In en, this message translates to:
  /// **'Please choose a rating from 1 to 5 stars.'**
  String get maintenanceRatingRequired;

  /// No description provided for @maintenanceRatingThanks.
  ///
  /// In en, this message translates to:
  /// **'Thank you! The fix is confirmed and your rating sent.'**
  String get maintenanceRatingThanks;

  /// No description provided for @maintenanceConfirmPrompt.
  ///
  /// In en, this message translates to:
  /// **'Was the problem fixed? Confirm and rate the service'**
  String get maintenanceConfirmPrompt;

  /// No description provided for @maintenanceRatingNoteHint.
  ///
  /// In en, this message translates to:
  /// **'Add a note about the service (optional)'**
  String get maintenanceRatingNoteHint;

  /// No description provided for @maintenanceConfirmAndRate.
  ///
  /// In en, this message translates to:
  /// **'Confirm the fix and send the rating'**
  String get maintenanceConfirmAndRate;

  /// No description provided for @serviceRequests.
  ///
  /// In en, this message translates to:
  /// **'Service requests'**
  String get serviceRequests;

  /// No description provided for @maintenanceStatusOpenPlural.
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get maintenanceStatusOpenPlural;

  /// No description provided for @maintenanceNewSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Tell us the problem and we\'ll handle it'**
  String get maintenanceNewSubtitle;

  /// No description provided for @maintenanceFromCameraHint.
  ///
  /// In en, this message translates to:
  /// **'Take a photo now'**
  String get maintenanceFromCameraHint;

  /// No description provided for @maintenanceFromGalleryHint.
  ///
  /// In en, this message translates to:
  /// **'Pick from your photos'**
  String get maintenanceFromGalleryHint;

  /// No description provided for @noResults.
  ///
  /// In en, this message translates to:
  /// **'No results'**
  String get noResults;

  /// No description provided for @favoritesFilterEmpty.
  ///
  /// In en, this message translates to:
  /// **'Nothing saved in this category'**
  String get favoritesFilterEmpty;

  /// No description provided for @favoritesSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Saved units'**
  String get favoritesSubtitle;

  /// No description provided for @favoritesTabUnits.
  ///
  /// In en, this message translates to:
  /// **'Units'**
  String get favoritesTabUnits;

  /// No description provided for @favoritesTabProjects.
  ///
  /// In en, this message translates to:
  /// **'Projects'**
  String get favoritesTabProjects;

  /// No description provided for @favoriteKindProject.
  ///
  /// In en, this message translates to:
  /// **'Project'**
  String get favoriteKindProject;

  /// No description provided for @favoriteKindUnit.
  ///
  /// In en, this message translates to:
  /// **'Unit'**
  String get favoriteKindUnit;

  /// No description provided for @savedBadge.
  ///
  /// In en, this message translates to:
  /// **'Saved'**
  String get savedBadge;

  /// No description provided for @requestsFilterEmpty.
  ///
  /// In en, this message translates to:
  /// **'No requests in this category'**
  String get requestsFilterEmpty;

  /// No description provided for @requestsNew.
  ///
  /// In en, this message translates to:
  /// **'New'**
  String get requestsNew;

  /// No description provided for @requestsConfirmed.
  ///
  /// In en, this message translates to:
  /// **'Confirmed'**
  String get requestsConfirmed;

  /// No description provided for @requestsCompleted.
  ///
  /// In en, this message translates to:
  /// **'Completed'**
  String get requestsCompleted;

  /// No description provided for @requestsCancelled.
  ///
  /// In en, this message translates to:
  /// **'Cancelled'**
  String get requestsCancelled;

  /// No description provided for @preferredDateLabel.
  ///
  /// In en, this message translates to:
  /// **'Preferred date'**
  String get preferredDateLabel;

  /// No description provided for @salesRepLabel.
  ///
  /// In en, this message translates to:
  /// **'Sales consultant'**
  String get salesRepLabel;

  /// No description provided for @noMessage.
  ///
  /// In en, this message translates to:
  /// **'No message'**
  String get noMessage;

  /// No description provided for @requestDateValue.
  ///
  /// In en, this message translates to:
  /// **'Requested on {date}'**
  String requestDateValue(String date);

  /// No description provided for @installmentsPaidOf.
  ///
  /// In en, this message translates to:
  /// **'{paid} of {total} installments paid'**
  String installmentsPaidOf(int paid, int total);

  /// No description provided for @ofTotal.
  ///
  /// In en, this message translates to:
  /// **'of {total}'**
  String ofTotal(int total);

  /// No description provided for @summaryTab.
  ///
  /// In en, this message translates to:
  /// **'Summary'**
  String get summaryTab;

  /// No description provided for @financialPanel.
  ///
  /// In en, this message translates to:
  /// **'Financial overview'**
  String get financialPanel;

  /// No description provided for @monthsCount.
  ///
  /// In en, this message translates to:
  /// **'{n} months'**
  String monthsCount(int n);

  /// No description provided for @overdueTotal.
  ///
  /// In en, this message translates to:
  /// **'Total overdue'**
  String get overdueTotal;

  /// No description provided for @overdueInstallments.
  ///
  /// In en, this message translates to:
  /// **'{n, plural, =1{1 overdue installment} other{{n} overdue installments}}'**
  String overdueInstallments(int n);

  /// No description provided for @lastDueOn.
  ///
  /// In en, this message translates to:
  /// **'last due {date}'**
  String lastDueOn(String date);

  /// No description provided for @remainingLabel.
  ///
  /// In en, this message translates to:
  /// **'Remaining'**
  String get remainingLabel;

  /// No description provided for @planDuration.
  ///
  /// In en, this message translates to:
  /// **'Plan length'**
  String get planDuration;

  /// No description provided for @contractDetails.
  ///
  /// In en, this message translates to:
  /// **'Contract details'**
  String get contractDetails;

  /// No description provided for @myUnits.
  ///
  /// In en, this message translates to:
  /// **'My units'**
  String get myUnits;

  /// No description provided for @myPortfolio.
  ///
  /// In en, this message translates to:
  /// **'My property portfolio'**
  String get myPortfolio;

  /// No description provided for @unitsCount.
  ///
  /// In en, this message translates to:
  /// **'{n, plural, =1{1 unit} other{{n} units}}'**
  String unitsCount(int n);

  /// No description provided for @overdueCountBadge.
  ///
  /// In en, this message translates to:
  /// **'{n} overdue'**
  String overdueCountBadge(int n);

  /// No description provided for @onTrackBadge.
  ///
  /// In en, this message translates to:
  /// **'On track'**
  String get onTrackBadge;

  /// No description provided for @paymentProgress.
  ///
  /// In en, this message translates to:
  /// **'Payment progress'**
  String get paymentProgress;

  /// No description provided for @notificationPrefsTitle.
  ///
  /// In en, this message translates to:
  /// **'Notification settings'**
  String get notificationPrefsTitle;

  /// No description provided for @statementTitle.
  ///
  /// In en, this message translates to:
  /// **'Statement of account'**
  String get statementTitle;

  /// No description provided for @statementOpenHint.
  ///
  /// In en, this message translates to:
  /// **'Everything you paid and what is left'**
  String get statementOpenHint;

  /// No description provided for @statementBalance.
  ///
  /// In en, this message translates to:
  /// **'Left on the contract'**
  String get statementBalance;

  /// No description provided for @statementAsOf.
  ///
  /// In en, this message translates to:
  /// **'As of {date}'**
  String statementAsOf(String date);

  /// No description provided for @statementPaid.
  ///
  /// In en, this message translates to:
  /// **'Paid'**
  String get statementPaid;

  /// No description provided for @statementDueToday.
  ///
  /// In en, this message translates to:
  /// **'Due today'**
  String get statementDueToday;

  /// No description provided for @statementUpcoming.
  ///
  /// In en, this message translates to:
  /// **'Not due yet'**
  String get statementUpcoming;

  /// No description provided for @statementAwaiting.
  ///
  /// In en, this message translates to:
  /// **'Awaiting confirmation'**
  String get statementAwaiting;

  /// No description provided for @statementMovements.
  ///
  /// In en, this message translates to:
  /// **'Movements'**
  String get statementMovements;

  /// No description provided for @statementContractValue.
  ///
  /// In en, this message translates to:
  /// **'Contract value'**
  String get statementContractValue;

  /// No description provided for @statementPaymentOf.
  ///
  /// In en, this message translates to:
  /// **'Payment: {what}'**
  String statementPaymentOf(String what);

  /// No description provided for @statementPaymentOfBy.
  ///
  /// In en, this message translates to:
  /// **'Payment: {what} — {how}'**
  String statementPaymentOfBy(String what, String how);

  /// No description provided for @statementReversalOf.
  ///
  /// In en, this message translates to:
  /// **'Payment reversed: {what}'**
  String statementReversalOf(String what);

  /// No description provided for @statementWaiverOf.
  ///
  /// In en, this message translates to:
  /// **'Waived: {what}'**
  String statementWaiverOf(String what);

  /// No description provided for @statementDueOn.
  ///
  /// In en, this message translates to:
  /// **'due {date}'**
  String statementDueOn(String date);

  /// No description provided for @statementMarkedPaid.
  ///
  /// In en, this message translates to:
  /// **'marked paid'**
  String get statementMarkedPaid;

  /// No description provided for @statementReason.
  ///
  /// In en, this message translates to:
  /// **'Reason: {reason}'**
  String statementReason(String reason);

  /// No description provided for @statementBalanceAfter.
  ///
  /// In en, this message translates to:
  /// **'Balance {amount}'**
  String statementBalanceAfter(String amount);

  /// No description provided for @statementAwaitingNote.
  ///
  /// In en, this message translates to:
  /// **'Payments awaiting confirmation (a proof under review, a cheque not cleared) are not in the balance until they are confirmed.'**
  String get statementAwaitingNote;

  /// No description provided for @ledgerTitle.
  ///
  /// In en, this message translates to:
  /// **'Owed to us & by us'**
  String get ledgerTitle;

  /// No description provided for @ledgerSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Receivables & payables'**
  String get ledgerSubtitle;

  /// No description provided for @ledgerNet.
  ///
  /// In en, this message translates to:
  /// **'Net position'**
  String get ledgerNet;

  /// No description provided for @ledgerNetForCompany.
  ///
  /// In en, this message translates to:
  /// **'In the company\'s favour'**
  String get ledgerNetForCompany;

  /// No description provided for @ledgerNetOnCompany.
  ///
  /// In en, this message translates to:
  /// **'Owed by the company'**
  String get ledgerNetOnCompany;

  /// No description provided for @ledgerReceivables.
  ///
  /// In en, this message translates to:
  /// **'Receivables'**
  String get ledgerReceivables;

  /// No description provided for @ledgerPayables.
  ///
  /// In en, this message translates to:
  /// **'Payables'**
  String get ledgerPayables;

  /// No description provided for @ledgerReceivablesTitle.
  ///
  /// In en, this message translates to:
  /// **'Receivables — owed to the company'**
  String get ledgerReceivablesTitle;

  /// No description provided for @ledgerPayablesTitle.
  ///
  /// In en, this message translates to:
  /// **'Payables — owed by the company'**
  String get ledgerPayablesTitle;

  /// No description provided for @ledgerGroupInstallments.
  ///
  /// In en, this message translates to:
  /// **'Contract installments'**
  String get ledgerGroupInstallments;

  /// No description provided for @ledgerGroupBookings.
  ///
  /// In en, this message translates to:
  /// **'Booking amounts'**
  String get ledgerGroupBookings;

  /// No description provided for @ledgerGroupFees.
  ///
  /// In en, this message translates to:
  /// **'Fees & penalties'**
  String get ledgerGroupFees;

  /// No description provided for @ledgerGroupClawbacks.
  ///
  /// In en, this message translates to:
  /// **'Clawbacks from brokers & staff'**
  String get ledgerGroupClawbacks;

  /// No description provided for @ledgerGroupCommissions.
  ///
  /// In en, this message translates to:
  /// **'Broker commissions'**
  String get ledgerGroupCommissions;

  /// No description provided for @ledgerGroupBonuses.
  ///
  /// In en, this message translates to:
  /// **'Sales team bonuses'**
  String get ledgerGroupBonuses;

  /// No description provided for @ledgerGroupTopUps.
  ///
  /// In en, this message translates to:
  /// **'Commission top-ups'**
  String get ledgerGroupTopUps;

  /// No description provided for @ledgerGroupRefunds.
  ///
  /// In en, this message translates to:
  /// **'Refunds owed to customers'**
  String get ledgerGroupRefunds;

  /// No description provided for @ledgerGroupOnHold.
  ///
  /// In en, this message translates to:
  /// **'On hold pending a decision'**
  String get ledgerGroupOnHold;

  /// No description provided for @ledgerOnHoldNote.
  ///
  /// In en, this message translates to:
  /// **'not in the total'**
  String get ledgerOnHoldNote;

  /// No description provided for @statementDueTodayShort.
  ///
  /// In en, this message translates to:
  /// **'Due today'**
  String get statementDueTodayShort;

  /// No description provided for @ledgerStateUpcoming.
  ///
  /// In en, this message translates to:
  /// **'Not due yet'**
  String get ledgerStateUpcoming;

  /// No description provided for @ledgerStateOnItsWay.
  ///
  /// In en, this message translates to:
  /// **'On its way'**
  String get ledgerStateOnItsWay;

  /// No description provided for @ledgerStatePendingApproval.
  ///
  /// In en, this message translates to:
  /// **'Awaiting approval'**
  String get ledgerStatePendingApproval;

  /// No description provided for @ledgerTypeCommission.
  ///
  /// In en, this message translates to:
  /// **'Commission'**
  String get ledgerTypeCommission;

  /// No description provided for @ledgerTypeBonus.
  ///
  /// In en, this message translates to:
  /// **'Bonus'**
  String get ledgerTypeBonus;

  /// No description provided for @ledgerTypeCommissionClawback.
  ///
  /// In en, this message translates to:
  /// **'Commission clawback'**
  String get ledgerTypeCommissionClawback;

  /// No description provided for @ledgerTypeBonusClawback.
  ///
  /// In en, this message translates to:
  /// **'Bonus clawback'**
  String get ledgerTypeBonusClawback;

  /// No description provided for @ledgerTypePriceChangeClawback.
  ///
  /// In en, this message translates to:
  /// **'Commission reduction'**
  String get ledgerTypePriceChangeClawback;

  /// No description provided for @ledgerPeriodAll.
  ///
  /// In en, this message translates to:
  /// **'All open balances'**
  String get ledgerPeriodAll;

  /// No description provided for @ledgerPeriodThisMonth.
  ///
  /// In en, this message translates to:
  /// **'This month'**
  String get ledgerPeriodThisMonth;

  /// No description provided for @ledgerPeriodNextMonth.
  ///
  /// In en, this message translates to:
  /// **'Next month'**
  String get ledgerPeriodNextMonth;

  /// No description provided for @ledgerPeriodQuarter.
  ///
  /// In en, this message translates to:
  /// **'This quarter'**
  String get ledgerPeriodQuarter;

  /// No description provided for @ledgerPeriodYear.
  ///
  /// In en, this message translates to:
  /// **'This year'**
  String get ledgerPeriodYear;

  /// No description provided for @ledgerItems.
  ///
  /// In en, this message translates to:
  /// **'{n, plural, =0{No items} =1{1 item} other{{n} items}}'**
  String ledgerItems(int n);

  /// No description provided for @ledgerEmpty.
  ///
  /// In en, this message translates to:
  /// **'No items in this period.'**
  String get ledgerEmpty;

  /// No description provided for @detailPhotosFullscreen.
  ///
  /// In en, this message translates to:
  /// **'View photos full screen'**
  String get detailPhotosFullscreen;

  /// No description provided for @detailClose.
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get detailClose;

  /// No description provided for @detailTotalPrice.
  ///
  /// In en, this message translates to:
  /// **'Total price'**
  String get detailTotalPrice;

  /// No description provided for @detailPricesFrom.
  ///
  /// In en, this message translates to:
  /// **'Prices from'**
  String get detailPricesFrom;

  /// No description provided for @detailOrFrom.
  ///
  /// In en, this message translates to:
  /// **'or from {amount} {period}'**
  String detailOrFrom(String amount, String period);

  /// No description provided for @detailPeriodMonthly.
  ///
  /// In en, this message translates to:
  /// **'a month'**
  String get detailPeriodMonthly;

  /// No description provided for @detailPeriodQuarterly.
  ///
  /// In en, this message translates to:
  /// **'every 3 months'**
  String get detailPeriodQuarterly;

  /// No description provided for @detailPeriodSemiAnnual.
  ///
  /// In en, this message translates to:
  /// **'every 6 months'**
  String get detailPeriodSemiAnnual;

  /// No description provided for @detailPeriodYearly.
  ///
  /// In en, this message translates to:
  /// **'a year'**
  String get detailPeriodYearly;

  /// No description provided for @detailUpfrontPct.
  ///
  /// In en, this message translates to:
  /// **'Down {pct}'**
  String detailUpfrontPct(String pct);

  /// No description provided for @detailTerm.
  ///
  /// In en, this message translates to:
  /// **'Term'**
  String get detailTerm;

  /// No description provided for @detailYears.
  ///
  /// In en, this message translates to:
  /// **'{n, plural, =1{1 year} other{{n} years}}'**
  String detailYears(int n);

  /// No description provided for @detailMonths.
  ///
  /// In en, this message translates to:
  /// **'{n, plural, =1{1 month} other{{n} months}}'**
  String detailMonths(int n);

  /// No description provided for @detailHandover.
  ///
  /// In en, this message translates to:
  /// **'Handover'**
  String get detailHandover;

  /// No description provided for @detailCalcInstallment.
  ///
  /// In en, this message translates to:
  /// **'Work out your instalment'**
  String get detailCalcInstallment;

  /// No description provided for @detailTabOverview.
  ///
  /// In en, this message translates to:
  /// **'Overview'**
  String get detailTabOverview;

  /// No description provided for @detailTabFloorPlan.
  ///
  /// In en, this message translates to:
  /// **'Floor plan'**
  String get detailTabFloorPlan;

  /// No description provided for @detailTabPayment.
  ///
  /// In en, this message translates to:
  /// **'Payment plan'**
  String get detailTabPayment;

  /// No description provided for @detailTabLocation.
  ///
  /// In en, this message translates to:
  /// **'Location'**
  String get detailTabLocation;

  /// No description provided for @detailTabSimilar.
  ///
  /// In en, this message translates to:
  /// **'Similar'**
  String get detailTabSimilar;

  /// No description provided for @detailTabUnits.
  ///
  /// In en, this message translates to:
  /// **'Units'**
  String get detailTabUnits;

  /// No description provided for @detailTabAmenities.
  ///
  /// In en, this message translates to:
  /// **'Amenities'**
  String get detailTabAmenities;

  /// No description provided for @detailRowBooking.
  ///
  /// In en, this message translates to:
  /// **'Booking'**
  String get detailRowBooking;

  /// No description provided for @detailRowDownPayment.
  ///
  /// In en, this message translates to:
  /// **'Down payment'**
  String get detailRowDownPayment;

  /// No description provided for @detailRowInstallments.
  ///
  /// In en, this message translates to:
  /// **'Instalments ({count})'**
  String detailRowInstallments(int count);

  /// No description provided for @detailRowFinal.
  ///
  /// In en, this message translates to:
  /// **'Final payment'**
  String get detailRowFinal;

  /// No description provided for @detailRowTotal.
  ///
  /// In en, this message translates to:
  /// **'Total'**
  String get detailRowTotal;

  /// No description provided for @detailRowDiscount.
  ///
  /// In en, this message translates to:
  /// **'Discount'**
  String get detailRowDiscount;

  /// No description provided for @detailCashPayment.
  ///
  /// In en, this message translates to:
  /// **'Cash payment'**
  String get detailCashPayment;

  /// No description provided for @detailInstallmentMonthly.
  ///
  /// In en, this message translates to:
  /// **'Monthly instalment'**
  String get detailInstallmentMonthly;

  /// No description provided for @detailInstallmentQuarterly.
  ///
  /// In en, this message translates to:
  /// **'Quarterly instalment'**
  String get detailInstallmentQuarterly;

  /// No description provided for @detailInstallmentSemiAnnual.
  ///
  /// In en, this message translates to:
  /// **'Half-yearly instalment'**
  String get detailInstallmentSemiAnnual;

  /// No description provided for @detailInstallmentYearly.
  ///
  /// In en, this message translates to:
  /// **'Yearly instalment'**
  String get detailInstallmentYearly;

  /// No description provided for @detailCalcPlan.
  ///
  /// In en, this message translates to:
  /// **'Plan'**
  String get detailCalcPlan;

  /// No description provided for @detailCalcDuration.
  ///
  /// In en, this message translates to:
  /// **'Duration'**
  String get detailCalcDuration;

  /// No description provided for @detailCalcUpfront.
  ///
  /// In en, this message translates to:
  /// **'Down'**
  String get detailCalcUpfront;

  /// No description provided for @detailCalcCount.
  ///
  /// In en, this message translates to:
  /// **'Instalments'**
  String get detailCalcCount;

  /// No description provided for @detailCalcTotal.
  ///
  /// In en, this message translates to:
  /// **'Total paid'**
  String get detailCalcTotal;

  /// No description provided for @detailCalcNote.
  ///
  /// In en, this message translates to:
  /// **'Figures come from the current payment plans; the final plan is set at signing.'**
  String get detailCalcNote;

  /// No description provided for @detailProjectOffer.
  ///
  /// In en, this message translates to:
  /// **'{pct} down, up to {term}'**
  String detailProjectOffer(String pct, String term);

  /// No description provided for @detailAvailableUnits.
  ///
  /// In en, this message translates to:
  /// **'Available units'**
  String get detailAvailableUnits;

  /// No description provided for @detailSimilarUnits.
  ///
  /// In en, this message translates to:
  /// **'Similar units'**
  String get detailSimilarUnits;

  /// No description provided for @detailPaymentPlans.
  ///
  /// In en, this message translates to:
  /// **'Payment plans'**
  String get detailPaymentPlans;

  /// No description provided for @detailPlanTerm.
  ///
  /// In en, this message translates to:
  /// **'{pct} down'**
  String detailPlanTerm(String pct);

  /// No description provided for @detailUpTo.
  ///
  /// In en, this message translates to:
  /// **'up to {term}'**
  String detailUpTo(String term);

  /// No description provided for @pageNotFoundTitle.
  ///
  /// In en, this message translates to:
  /// **'Page not found'**
  String get pageNotFoundTitle;

  /// No description provided for @pageNotFoundMessage.
  ///
  /// In en, this message translates to:
  /// **'The link is wrong or this page is no longer available.'**
  String get pageNotFoundMessage;

  /// No description provided for @pageNotFoundHome.
  ///
  /// In en, this message translates to:
  /// **'Back to home'**
  String get pageNotFoundHome;

  /// No description provided for @pageNoAccessTitle.
  ///
  /// In en, this message translates to:
  /// **'This page is not available to your account'**
  String get pageNoAccessTitle;

  /// No description provided for @pageNoAccessMessage.
  ///
  /// In en, this message translates to:
  /// **'Ask your company\'s administrator for access to it.'**
  String get pageNoAccessMessage;

  /// No description provided for @companyUnavailableTitle.
  ///
  /// In en, this message translates to:
  /// **'The app is not available right now'**
  String get companyUnavailableTitle;

  /// No description provided for @companyUnavailableMessage.
  ///
  /// In en, this message translates to:
  /// **'The service is paused for now. Try again later or contact the company.'**
  String get companyUnavailableMessage;

  /// No description provided for @pageKindAboutSub.
  ///
  /// In en, this message translates to:
  /// **'Get to know the company and its projects'**
  String get pageKindAboutSub;

  /// No description provided for @pageKindPrivacySub.
  ///
  /// In en, this message translates to:
  /// **'How we look after your data'**
  String get pageKindPrivacySub;

  /// No description provided for @pageKindTermsSub.
  ///
  /// In en, this message translates to:
  /// **'The terms of using the service'**
  String get pageKindTermsSub;

  /// No description provided for @pageKindPaymentSub.
  ///
  /// In en, this message translates to:
  /// **'The payment plans and methods on offer'**
  String get pageKindPaymentSub;

  /// No description provided for @pageKindFaqSub.
  ///
  /// In en, this message translates to:
  /// **'Answers to the most common questions'**
  String get pageKindFaqSub;

  /// No description provided for @pageKindContactSub.
  ///
  /// In en, this message translates to:
  /// **'Ways to reach the company'**
  String get pageKindContactSub;

  /// No description provided for @contentContactTitle.
  ///
  /// In en, this message translates to:
  /// **'Contact us'**
  String get contentContactTitle;

  /// No description provided for @contentContactSub.
  ///
  /// In en, this message translates to:
  /// **'Our team is ready to answer your questions.'**
  String get contentContactSub;

  /// No description provided for @contentContactCall.
  ///
  /// In en, this message translates to:
  /// **'Call'**
  String get contentContactCall;

  /// No description provided for @contentContactWhatsApp.
  ///
  /// In en, this message translates to:
  /// **'WhatsApp'**
  String get contentContactWhatsApp;

  /// No description provided for @contractMoneyTitle.
  ///
  /// In en, this message translates to:
  /// **'Payment summary'**
  String get contractMoneyTitle;

  /// No description provided for @contractPaidShare.
  ///
  /// In en, this message translates to:
  /// **'{percent} of the contract paid'**
  String contractPaidShare(String percent);

  /// No description provided for @contractRemaining.
  ///
  /// In en, this message translates to:
  /// **'Remaining'**
  String get contractRemaining;

  /// No description provided for @contractNextInstallment.
  ///
  /// In en, this message translates to:
  /// **'Next installment'**
  String get contractNextInstallment;

  /// No description provided for @contractNextDue.
  ///
  /// In en, this message translates to:
  /// **'Due on {date}'**
  String contractNextDue(String date);

  /// No description provided for @contractNextOverdue.
  ///
  /// In en, this message translates to:
  /// **'Overdue since {date}'**
  String contractNextOverdue(String date);

  /// No description provided for @contractNoUpcoming.
  ///
  /// In en, this message translates to:
  /// **'Nothing is due from you right now.'**
  String get contractNoUpcoming;

  /// No description provided for @contractViewInstallments.
  ///
  /// In en, this message translates to:
  /// **'All installments'**
  String get contractViewInstallments;

  /// No description provided for @contractPlanTitle.
  ///
  /// In en, this message translates to:
  /// **'Payment plan'**
  String get contractPlanTitle;

  /// No description provided for @contractPlanEach.
  ///
  /// In en, this message translates to:
  /// **'Each installment'**
  String get contractPlanEach;

  /// No description provided for @contractPlanDuration.
  ///
  /// In en, this message translates to:
  /// **'Duration'**
  String get contractPlanDuration;

  /// No description provided for @contractPlanStart.
  ///
  /// In en, this message translates to:
  /// **'First installment'**
  String get contractPlanStart;

  /// No description provided for @contractPlanFrequency.
  ///
  /// In en, this message translates to:
  /// **'Every'**
  String get contractPlanFrequency;

  /// No description provided for @contractPlanCash.
  ///
  /// In en, this message translates to:
  /// **'Paid in full, no installments'**
  String get contractPlanCash;

  /// No description provided for @freqMonthly.
  ///
  /// In en, this message translates to:
  /// **'month'**
  String get freqMonthly;

  /// No description provided for @freqQuarterly.
  ///
  /// In en, this message translates to:
  /// **'3 months'**
  String get freqQuarterly;

  /// No description provided for @freqSemiAnnual.
  ///
  /// In en, this message translates to:
  /// **'6 months'**
  String get freqSemiAnnual;

  /// No description provided for @freqAnnual.
  ///
  /// In en, this message translates to:
  /// **'year'**
  String get freqAnnual;

  /// No description provided for @contractUnitTitle.
  ///
  /// In en, this message translates to:
  /// **'The unit'**
  String get contractUnitTitle;

  /// No description provided for @statementCharge.
  ///
  /// In en, this message translates to:
  /// **'Charge'**
  String get statementCharge;

  /// No description provided for @statementPayment.
  ///
  /// In en, this message translates to:
  /// **'Paid'**
  String get statementPayment;

  /// No description provided for @depositStatusTitle.
  ///
  /// In en, this message translates to:
  /// **'Payment status'**
  String get depositStatusTitle;

  /// No description provided for @depositDetailsTitle.
  ///
  /// In en, this message translates to:
  /// **'Payment details'**
  String get depositDetailsTitle;

  /// No description provided for @depositStateCollected.
  ///
  /// In en, this message translates to:
  /// **'Confirmed'**
  String get depositStateCollected;

  /// No description provided for @depositStatePendingReview.
  ///
  /// In en, this message translates to:
  /// **'Under review'**
  String get depositStatePendingReview;

  /// No description provided for @depositStateChequePending.
  ///
  /// In en, this message translates to:
  /// **'Cheque not cleared yet'**
  String get depositStateChequePending;

  /// No description provided for @depositStateRejected.
  ///
  /// In en, this message translates to:
  /// **'Rejected'**
  String get depositStateRejected;

  /// No description provided for @depositStateReversed.
  ///
  /// In en, this message translates to:
  /// **'Reversed by the company'**
  String get depositStateReversed;

  /// No description provided for @depositStateBounced.
  ///
  /// In en, this message translates to:
  /// **'Cheque returned'**
  String get depositStateBounced;

  /// No description provided for @depositStepSent.
  ///
  /// In en, this message translates to:
  /// **'You sent the proof'**
  String get depositStepSent;

  /// No description provided for @depositStepRecorded.
  ///
  /// In en, this message translates to:
  /// **'Recorded by the company'**
  String get depositStepRecorded;

  /// No description provided for @depositStepReview.
  ///
  /// In en, this message translates to:
  /// **'Company review'**
  String get depositStepReview;

  /// No description provided for @depositStepConfirmed.
  ///
  /// In en, this message translates to:
  /// **'Payment confirmed'**
  String get depositStepConfirmed;

  /// No description provided for @depositStepRejected.
  ///
  /// In en, this message translates to:
  /// **'Proof rejected'**
  String get depositStepRejected;

  /// No description provided for @depositStepWaiting.
  ///
  /// In en, this message translates to:
  /// **'Waiting'**
  String get depositStepWaiting;

  /// No description provided for @depositMethod.
  ///
  /// In en, this message translates to:
  /// **'Payment method'**
  String get depositMethod;

  /// No description provided for @depositForInstallment.
  ///
  /// In en, this message translates to:
  /// **'For the installment due on'**
  String get depositForInstallment;

  /// No description provided for @depositBookingNumber.
  ///
  /// In en, this message translates to:
  /// **'Booking number'**
  String get depositBookingNumber;

  /// No description provided for @depositRejectedReason.
  ///
  /// In en, this message translates to:
  /// **'Why it was rejected'**
  String get depositRejectedReason;

  /// No description provided for @paymentMethodCard.
  ///
  /// In en, this message translates to:
  /// **'Card'**
  String get paymentMethodCard;

  /// No description provided for @requestReplyNote.
  ///
  /// In en, this message translates to:
  /// **'Our team will get back to you within one working day.'**
  String get requestReplyNote;

  /// No description provided for @requestAbout.
  ///
  /// In en, this message translates to:
  /// **'Your request is about'**
  String get requestAbout;

  /// No description provided for @requestContactTitle.
  ///
  /// In en, this message translates to:
  /// **'We will reach you on'**
  String get requestContactTitle;

  /// No description provided for @requestContactEdit.
  ///
  /// In en, this message translates to:
  /// **'Edit your details'**
  String get requestContactEdit;

  /// No description provided for @visitPickDay.
  ///
  /// In en, this message translates to:
  /// **'Pick a day'**
  String get visitPickDay;

  /// No description provided for @visitPickTime.
  ///
  /// In en, this message translates to:
  /// **'Pick a time'**
  String get visitPickTime;

  /// No description provided for @visitNotesHint.
  ///
  /// In en, this message translates to:
  /// **'e.g. I\'d like to see the units with a garden'**
  String get visitNotesHint;

  /// No description provided for @visitSummary.
  ///
  /// In en, this message translates to:
  /// **'Your visit on {day} at {time}'**
  String visitSummary(String day, String time);

  /// No description provided for @visitDoneTitle.
  ///
  /// In en, this message translates to:
  /// **'Your visit request is in'**
  String get visitDoneTitle;

  /// No description provided for @visitDoneMessage.
  ///
  /// In en, this message translates to:
  /// **'We\'ll confirm the time with you shortly; you\'ll find the request in «My requests».'**
  String get visitDoneMessage;

  /// No description provided for @infoTopicsTitle.
  ///
  /// In en, this message translates to:
  /// **'What would you like to know?'**
  String get infoTopicsTitle;

  /// No description provided for @infoTopicPrices.
  ///
  /// In en, this message translates to:
  /// **'Prices and payment plans'**
  String get infoTopicPrices;

  /// No description provided for @infoTopicAreas.
  ///
  /// In en, this message translates to:
  /// **'Available sizes'**
  String get infoTopicAreas;

  /// No description provided for @infoTopicDelivery.
  ///
  /// In en, this message translates to:
  /// **'Handover date'**
  String get infoTopicDelivery;

  /// No description provided for @infoTopicFinishing.
  ///
  /// In en, this message translates to:
  /// **'Finishing and specs'**
  String get infoTopicFinishing;

  /// No description provided for @infoTopicLocation.
  ///
  /// In en, this message translates to:
  /// **'Location and services'**
  String get infoTopicLocation;

  /// No description provided for @infoMessageOptional.
  ///
  /// In en, this message translates to:
  /// **'More details (optional)'**
  String get infoMessageOptional;

  /// No description provided for @infoTopicsRequired.
  ///
  /// In en, this message translates to:
  /// **'Pick a topic or write your question.'**
  String get infoTopicsRequired;

  /// No description provided for @infoTopicsLine.
  ///
  /// In en, this message translates to:
  /// **'Topics: {topics}'**
  String infoTopicsLine(String topics);

  /// No description provided for @infoDoneTitle.
  ///
  /// In en, this message translates to:
  /// **'Your question is sent'**
  String get infoDoneTitle;

  /// No description provided for @infoDoneMessage.
  ///
  /// In en, this message translates to:
  /// **'A sales advisor will reply soon; you\'ll find the request in «My requests».'**
  String get infoDoneMessage;

  /// No description provided for @requestGoToRequests.
  ///
  /// In en, this message translates to:
  /// **'My requests'**
  String get requestGoToRequests;

  /// No description provided for @requestBrowseProjects.
  ///
  /// In en, this message translates to:
  /// **'Browse projects'**
  String get requestBrowseProjects;

  /// No description provided for @maintenanceDoneTitle.
  ///
  /// In en, this message translates to:
  /// **'Your maintenance request is in'**
  String get maintenanceDoneTitle;

  /// No description provided for @maintenanceDoneMessage.
  ///
  /// In en, this message translates to:
  /// **'The maintenance team will contact you to book a visit; follow the request from «Maintenance».'**
  String get maintenanceDoneMessage;

  /// No description provided for @maintenanceDoneBack.
  ///
  /// In en, this message translates to:
  /// **'Maintenance requests'**
  String get maintenanceDoneBack;

  /// No description provided for @maintenanceDoneHome.
  ///
  /// In en, this message translates to:
  /// **'Back to home'**
  String get maintenanceDoneHome;

  /// No description provided for @shGreetMorning.
  ///
  /// In en, this message translates to:
  /// **'Good morning,'**
  String get shGreetMorning;

  /// No description provided for @shGreetEvening.
  ///
  /// In en, this message translates to:
  /// **'Good evening,'**
  String get shGreetEvening;

  /// No description provided for @shGoalTitle.
  ///
  /// In en, this message translates to:
  /// **'This month\'s target'**
  String get shGoalTitle;

  /// No description provided for @shOfTarget.
  ///
  /// In en, this message translates to:
  /// **'of {target}'**
  String shOfTarget(String target);

  /// No description provided for @shOfGoal.
  ///
  /// In en, this message translates to:
  /// **'of target'**
  String get shOfGoal;

  /// No description provided for @shGoalUnits.
  ///
  /// In en, this message translates to:
  /// **'Units'**
  String get shGoalUnits;

  /// No description provided for @shDaysLeftLabel.
  ///
  /// In en, this message translates to:
  /// **'Left this month'**
  String get shDaysLeftLabel;

  /// No description provided for @shDaysLeft.
  ///
  /// In en, this message translates to:
  /// **'{n} days'**
  String shDaysLeft(int n);

  /// No description provided for @shNoTarget.
  ///
  /// In en, this message translates to:
  /// **'No target set for you this month yet.'**
  String get shNoTarget;

  /// No description provided for @shActLead.
  ///
  /// In en, this message translates to:
  /// **'New lead'**
  String get shActLead;

  /// No description provided for @shActVisit.
  ///
  /// In en, this message translates to:
  /// **'Schedule visit'**
  String get shActVisit;

  /// No description provided for @shActReservation.
  ///
  /// In en, this message translates to:
  /// **'New booking'**
  String get shActReservation;

  /// No description provided for @shActCalculator.
  ///
  /// In en, this message translates to:
  /// **'Calculator'**
  String get shActCalculator;

  /// No description provided for @shFigures.
  ///
  /// In en, this message translates to:
  /// **'Your month in numbers'**
  String get shFigures;

  /// No description provided for @shOpenLeads.
  ///
  /// In en, this message translates to:
  /// **'Open leads'**
  String get shOpenLeads;

  /// No description provided for @shStaleN.
  ///
  /// In en, this message translates to:
  /// **'{n} need follow-up'**
  String shStaleN(int n);

  /// No description provided for @shAllFollowed.
  ///
  /// In en, this message translates to:
  /// **'All followed up'**
  String get shAllFollowed;

  /// No description provided for @shUpcomingVisits.
  ///
  /// In en, this message translates to:
  /// **'Upcoming visits'**
  String get shUpcomingVisits;

  /// No description provided for @shTodayN.
  ///
  /// In en, this message translates to:
  /// **'{n} today'**
  String shTodayN(int n);

  /// No description provided for @shActiveReservations.
  ///
  /// In en, this message translates to:
  /// **'Active bookings'**
  String get shActiveReservations;

  /// No description provided for @shExpiringN.
  ///
  /// In en, this message translates to:
  /// **'{n} expiring soon'**
  String shExpiringN(int n);

  /// No description provided for @shNoneExpiring.
  ///
  /// In en, this message translates to:
  /// **'None expiring soon'**
  String get shNoneExpiring;

  /// No description provided for @shContractsMonth.
  ///
  /// In en, this message translates to:
  /// **'Contracts this month'**
  String get shContractsMonth;

  /// No description provided for @shUnitsSoldN.
  ///
  /// In en, this message translates to:
  /// **'{n, plural, =1{1 unit sold} other{{n} units sold}}'**
  String shUnitsSoldN(int n);

  /// No description provided for @shRealized.
  ///
  /// In en, this message translates to:
  /// **'Sales value'**
  String get shRealized;

  /// No description provided for @shAvgDeal.
  ///
  /// In en, this message translates to:
  /// **'Average deal'**
  String get shAvgDeal;

  /// No description provided for @shAttention.
  ///
  /// In en, this message translates to:
  /// **'Needs your attention'**
  String get shAttention;

  /// No description provided for @shAttStale.
  ///
  /// In en, this message translates to:
  /// **'Leads with no follow-up for {n} days'**
  String shAttStale(int n);

  /// No description provided for @shAttLapsing.
  ///
  /// In en, this message translates to:
  /// **'Bookings ending this week'**
  String get shAttLapsing;

  /// No description provided for @shAttUnconfirmed.
  ///
  /// In en, this message translates to:
  /// **'Visits not confirmed yet'**
  String get shAttUnconfirmed;

  /// No description provided for @shFollowUps.
  ///
  /// In en, this message translates to:
  /// **'Follow-ups'**
  String get shFollowUps;

  /// No description provided for @shAll.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get shAll;

  /// No description provided for @shOverdue.
  ///
  /// In en, this message translates to:
  /// **'Overdue'**
  String get shOverdue;

  /// No description provided for @shToday.
  ///
  /// In en, this message translates to:
  /// **'Today'**
  String get shToday;

  /// No description provided for @shUpcoming.
  ///
  /// In en, this message translates to:
  /// **'Upcoming'**
  String get shUpcoming;

  /// No description provided for @shNoFollowUps.
  ///
  /// In en, this message translates to:
  /// **'No follow-ups in this list.'**
  String get shNoFollowUps;

  /// No description provided for @shAgenda.
  ///
  /// In en, this message translates to:
  /// **'This week'**
  String get shAgenda;

  /// No description provided for @shAllAppointments.
  ///
  /// In en, this message translates to:
  /// **'All appointments'**
  String get shAllAppointments;

  /// No description provided for @shTagVisit.
  ///
  /// In en, this message translates to:
  /// **'Visit'**
  String get shTagVisit;

  /// No description provided for @shTagExpiry.
  ///
  /// In en, this message translates to:
  /// **'Booking ends'**
  String get shTagExpiry;

  /// No description provided for @shConfirmed.
  ///
  /// In en, this message translates to:
  /// **'Confirmed'**
  String get shConfirmed;

  /// No description provided for @shDayEmpty.
  ///
  /// In en, this message translates to:
  /// **'Nothing on this day.'**
  String get shDayEmpty;

  /// No description provided for @shNextUp.
  ///
  /// In en, this message translates to:
  /// **'Next: {when}'**
  String shNextUp(String when);

  /// No description provided for @shPipeline.
  ///
  /// In en, this message translates to:
  /// **'Sales pipeline'**
  String get shPipeline;

  /// No description provided for @shLeadsLink.
  ///
  /// In en, this message translates to:
  /// **'Leads'**
  String get shLeadsLink;

  /// No description provided for @shMillion.
  ///
  /// In en, this message translates to:
  /// **'M'**
  String get shMillion;

  /// No description provided for @shThousand.
  ///
  /// In en, this message translates to:
  /// **'K'**
  String get shThousand;

  /// No description provided for @shWithRep.
  ///
  /// In en, this message translates to:
  /// **'With {name}'**
  String shWithRep(String name);

  /// No description provided for @mhTeamGoal.
  ///
  /// In en, this message translates to:
  /// **'The team\'s target this month'**
  String get mhTeamGoal;

  /// No description provided for @mhUnitsSold.
  ///
  /// In en, this message translates to:
  /// **'Units sold'**
  String get mhUnitsSold;

  /// No description provided for @mhUnitsN.
  ///
  /// In en, this message translates to:
  /// **'{n, plural, =1{1 unit} other{{n} units}}'**
  String mhUnitsN(int n);

  /// No description provided for @mhActTargets.
  ///
  /// In en, this message translates to:
  /// **'Team targets'**
  String get mhActTargets;

  /// No description provided for @mhActBonus.
  ///
  /// In en, this message translates to:
  /// **'My earnings'**
  String get mhActBonus;

  /// No description provided for @mhFigures.
  ///
  /// In en, this message translates to:
  /// **'Your team this month'**
  String get mhFigures;

  /// No description provided for @mhActiveTeam.
  ///
  /// In en, this message translates to:
  /// **'Active team'**
  String get mhActiveTeam;

  /// No description provided for @mhAllActive.
  ///
  /// In en, this message translates to:
  /// **'Everyone is active'**
  String get mhAllActive;

  /// No description provided for @mhInactiveN.
  ///
  /// In en, this message translates to:
  /// **'{n} inactive'**
  String mhInactiveN(int n);

  /// No description provided for @mhDecide.
  ///
  /// In en, this message translates to:
  /// **'Needs your decision'**
  String get mhDecide;

  /// No description provided for @mhPending.
  ///
  /// In en, this message translates to:
  /// **'Bookings waiting for your approval'**
  String get mhPending;

  /// No description provided for @mhInactiveReps.
  ///
  /// In en, this message translates to:
  /// **'Reps with no activity this month'**
  String get mhInactiveReps;

  /// No description provided for @mhLeaderboard.
  ///
  /// In en, this message translates to:
  /// **'Team ranking'**
  String get mhLeaderboard;

  /// No description provided for @mhPerformance.
  ///
  /// In en, this message translates to:
  /// **'Performance'**
  String get mhPerformance;

  /// No description provided for @mhRankSub.
  ///
  /// In en, this message translates to:
  /// **'{contracts, plural, =1{1 contract} other{{contracts} contracts}} · {pct} of target'**
  String mhRankSub(int contracts, String pct);

  /// No description provided for @mhRankNoTarget.
  ///
  /// In en, this message translates to:
  /// **'{contracts, plural, =1{1 contract} other{{contracts} contracts}} · no target'**
  String mhRankNoTarget(int contracts);

  /// No description provided for @mhTeamAgenda.
  ///
  /// In en, this message translates to:
  /// **'The team\'s week'**
  String get mhTeamAgenda;

  /// No description provided for @mhNoTeam.
  ///
  /// In en, this message translates to:
  /// **'No reps in your team yet.'**
  String get mhNoTeam;
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
