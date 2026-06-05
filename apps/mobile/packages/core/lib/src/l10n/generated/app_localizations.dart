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

  /// No description provided for @filterPriceUnit.
  ///
  /// In en, this message translates to:
  /// **'EGP'**
  String get filterPriceUnit;

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

  /// No description provided for @roleSales.
  ///
  /// In en, this message translates to:
  /// **'Sales'**
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
  /// **'Admin'**
  String get roleAdmin;

  /// No description provided for @roleMaintenance.
  ///
  /// In en, this message translates to:
  /// **'Maintenance'**
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
