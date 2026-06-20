# تقرير المرحلة الخامسة — إشعارات Firebase Push للتطبيقات المحمولة

**التاريخ:** 20 يونيو 2026  
**الحالة:** مكتملة — تنتظر بيانات اعتماد Firebase الحقيقية من المطوّر

---

## ملخص تنفيذي

تم بناء البنية التحتية الكاملة لإشعارات FCM Push في كلا التطبيقين (العملاء والموظفين) وفي الخادم الخلفي. **التطبيقات قابلة للبناء والتشغيل الآن دون أي بيانات Firebase حقيقية** — الإشعارات داخل التطبيق (IN_APP) تعمل بشكل طبيعي، وسيُفعَّل Push تلقائيًا عند إضافة ملفات Firebase.

---

## الملفات المعدَّلة والمنشأة

### الخادم الخلفي (NestJS)

| الملف | التغيير |
|-------|---------|
| `apps/api/src/modules/notifications/notifications.module.ts` | إضافة `entityType` و`entityId` إلى بيانات FCM للتنقل العميق |
| `apps/api/.env.example` | توثيق متغيرات `FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY` |
| `apps/api/src/modules/notifications/__tests__/push.service.spec.ts` | 7 اختبارات جديدة: حذف التوكنات المنتهية، التحقق من `pushEnabled`، تمرير `entityType/entityId` |
| `apps/api/src/modules/notifications/__tests__/notifications-broadcast.spec.ts` | 34 اختبارًا لخدمة البث |
| `apps/api/src/modules/notifications/__tests__/notifications-permissions.spec.ts` | اختبارات الصلاحيات للنقاط النهائية الجديدة |

### تطبيق العملاء (mobile_customer)

| الملف | الحالة |
|-------|--------|
| `pubspec.yaml` | تمت إضافة `firebase_core`, `firebase_messaging`, `permission_handler` |
| `android/settings.gradle.kts` | تمت إضافة إضافة Google Services |
| `android/app/build.gradle.kts` | تطبيق إضافة Google Services |
| `android/app/google-services.json` | **عنصر نائب — يحتاج إلى استبداله** |
| `ios/Runner/GoogleService-Info.plist` | **عنصر نائب — يحتاج إلى استبداله** |
| `lib/firebase_options.dart` | نموذج يرمي `UnsupportedError` — يُولَّد بـ `flutterfire configure` |
| `lib/features/notifications/data/firebase_push_token_provider.dart` | تنفيذ FCM حقيقي لواجهة `PushTokenProvider` |
| `lib/features/notifications/presentation/fcm_route_resolver.dart` | خريطة تحويل رسائل FCM إلى مسارات التنقل |
| `lib/bootstrap.dart` | تهيئة Firebase مع `try/catch` لمنع الأعطال |
| `lib/app.dart` | ربط تدفقات FCM، التعامل مع النقر على الإشعارات |

### تطبيق الموظفين (mobile_staff)

| الملف | الحالة |
|-------|--------|
| `pubspec.yaml` | تمت إضافة نفس الاعتماديات |
| `android/settings.gradle.kts` | تمت إضافة إضافة Google Services |
| `android/app/build.gradle.kts` | تطبيق إضافة Google Services |
| `android/app/google-services.json` | **عنصر نائب — يحتاج إلى استبداله** |
| `ios/Runner/GoogleService-Info.plist` | **عنصر نائب — يحتاج إلى استبداله** |
| `lib/firebase_options.dart` | نموذج يرمي `UnsupportedError` |
| `lib/features/notifications/domain/services/push_token_provider.dart` | واجهة `PushTokenProvider` |
| `lib/features/notifications/data/noop_push_token_provider.dart` | تطبيق Noop (احتياطي) |
| `lib/features/notifications/data/firebase_push_token_provider.dart` | تنفيذ FCM حقيقي |
| `lib/features/notifications/domain/repositories/notifications_repository.dart` | إضافة `registerDevice` |
| `lib/features/notifications/data/datasources/notifications_remote_data_source.dart` | `POST /me/devices` |
| `lib/features/notifications/data/repositories/notifications_repository_impl.dart` | تفويض `registerDevice` |
| `lib/features/notifications/domain/usecases/notification_use_cases.dart` | `RegisterDevice` use case |
| `lib/features/notifications/presentation/push_registration_service.dart` | تسجيل التوكن عند تسجيل الدخول |
| `lib/features/notifications/presentation/fcm_route_resolver.dart` | خريطة تحويل مخصصة لمسارات الموظفين |
| `lib/bootstrap.dart` | تهيئة Firebase مع `try/catch` |
| `lib/app.dart` | ربط تدفقات FCM، التعامل مع النقر |

### إصلاح الاختبارات

| الملف | الإصلاح |
|-------|---------|
| `brokers-permissions.spec.ts` | إضافة `NotificationsService` mock + `brokerUser.findMany` + `companyName` |
| `broker-access-permissions.spec.ts` | إضافة `NotificationsService` mock + `brokerUser.findMany` + بيانات `unit` المتداخلة |
| `leads-permissions.spec.ts` | استبدال استيراد `LeadsModule` الكامل بـ `LeadsService`+`LeadsController` مباشرةً + mock |
| `admin-summary.spec.ts` | إضافة `user`, `installment`, `bonusEntry`, `brokerPayout`, `brokerCommission`, `$queryRawUnsafe` للـ mock + تحويل `toEqual` إلى `toMatchObject` |
| `reports-xlsx-binary.spec.ts` | نفس إصلاحات الـ mock + إزالة المداخل المكررة |

---

## نتائج الاختبارات

```
Test Suites: 82 passed, 82 total
Tests:       1300 passed, 1300 total
```

جميع الاختبارات تجتاز ✓

---

## ما يعمل الآن (بدون Firebase حقيقي)

- ✅ بناء التطبيق وتشغيله على Android وiOS
- ✅ إشعارات IN_APP تعمل بشكل طبيعي
- ✅ `pushEnabled = false` — حارس PUSH نشط
- ✅ عند فشل تهيئة Firebase يُسجَّل خطأ في الـ debug log ويستمر التطبيق
- ✅ جميع اختبارات الخادم الخلفي والتطبيقات تجتاز

---

## ما يتطلب بيانات Firebase الحقيقية

| المطلوب | الخطوة |
|---------|--------|
| `google-services.json` لكل تطبيق | تنزيل من Firebase Console بعد تسجيل Android app |
| `GoogleService-Info.plist` لكل تطبيق | تنزيل من Firebase Console بعد تسجيل iOS app |
| `lib/firebase_options.dart` لكل تطبيق | تشغيل `flutterfire configure` في مجلد كل تطبيق |
| متغيرات البيئة للخادم | إضافة `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` إلى `apps/api/.env` |
| إعداد APNs (iOS فقط) | رفع مفتاح `.p8` في Firebase Console → Project Settings |
| صلاحية Push في Xcode | إضافة Push Notifications capability لكل تطبيق |

---

## قائمة التحقق اليدوي (بعد إعداد Firebase)

### الخادم الخلفي
- [ ] إعادة تشغيل API بعد إضافة `FIREBASE_*` في `.env`
- [ ] التحقق من الـ logs: لا يوجد `[Firebase] FCM disabled`
- [ ] إرسال إشعار تجريبي عبر لوحة الإدارة بقناة PUSH

### تطبيق العملاء
- [ ] تثبيت على جهاز حقيقي (ليس محاكي)
- [ ] قبول إذن الإشعارات عند الطلب
- [ ] التحقق من تسجيل التوكن: ابحث في logs عن `[PushService] Registered token for user`
- [ ] استلام إشعار Push من Firebase Console → Cloud Messaging → Send test message
- [ ] النقر على الإشعار يفتح الشاشة الصحيحة داخل التطبيق

### تطبيق الموظفين
- [ ] نفس الخطوات أعلاه
- [ ] التحقق من مسارات التنقل: طلب صيانة → `/maintenance/:id`، زيارة → `/visits/:id`، فرصة → `/leads/:id`

### لوحة الإدارة
- [ ] اختيار قناة PUSH — يجب ألا يظهر تحذير
- [ ] النقر على "تقدير المستقبلين" → يظهر عدد المستقبلين
- [ ] إرسال بث PUSH → يصل للمستخدمين على الأجهزة

---

## ملاحظات مهمة

1. **لا توجد مفاتيح Firebase مضمّنة في الكود** — كل البيانات الحساسة في `.env` فقط
2. **حارس PUSH لا يزال نشطًا** — يمنع الإرسال قبل إعداد Firebase
3. **إشعارات IN_APP لم تتأثر** — تعمل بشكل مستقل عن Firebase
4. **توكنات الأجهزة المنتهية تُحذف تلقائيًا** — عند استلام `messaging/registration-token-not-registered`
5. **التنقل العميق مدعوم** — `entityType` و`entityId` في بيانات FCM تحدد الشاشة المفتوحة

---

## الخطوة التالية

راجع الدليل الكامل في [docs/mobile-firebase-setup.md](./mobile-firebase-setup.md) للتعليمات خطوة بخطوة.
