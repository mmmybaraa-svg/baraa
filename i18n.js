/*
 * DARB interface localization.
 *
 * The DARB frontend ships every user-facing string hard-coded in Arabic inside
 * the HTML and JavaScript. This module adds a lightweight localization layer
 * without rewriting those files:
 *
 *   - Arabic remains the source language (the original DOM text is kept).
 *   - English is applied on top of the DOM by matching the source strings and
 *     by rewriting well-known dynamic patterns (counts, prices, dates...).
 *   - A MutationObserver keeps dynamically rendered content translated.
 *   - The choice is persisted in localStorage under "darb_language" and is
 *     wired to the radio group <input name="language"> in the settings page.
 *
 * Untranslated strings fall back to the original Arabic, so adding a missing
 * entry to the dictionary is always safe.
 */
(function () {
  'use strict';

  var D = window.DARB;
  if (!D) return;

  var STORAGE_KEY = 'darb_language';
  var SUPPORTED = ['ar', 'en'];

  /* Exact source -> English translations. Keys are whitespace-normalized. */
  var EN = {
    /* Brand and shared navigation */
    'دَرْب': 'DARB',
    'دَرْب | DARB': 'DARB',
    'دَرْب | مشوارك للجامعة، صار أوضح.': 'DARB | Your commute to university, made clearer.',
    'تسجيل الدخول | دَرْب': 'Sign in | DARB',
    'إنشاء حساب | دَرْب': 'Create account | DARB',
    'لوحة الطالب | دَرْب': 'Student dashboard | DARB',
    'لوحة السائق | دَرْب': 'Driver dashboard | DARB',
    'الملف الشخصي | دَرْب': 'Profile | DARB',
    'المحادثة | دَرْب': 'Chat | DARB',
    'الإعدادات | دَرْب': 'Settings | DARB',
    'الرحلات | دَرْب': 'Trips | DARB',
    'تفاصيل الرحلة | دَرْب': 'Trip details | DARB',
    'الرئيسية': 'Home',
    'الرحلات': 'Trips',
    'كيف يعمل': 'How it works',
    'المميزات': 'Features',
    'رحلاتي': 'My trips',
    'الملف الشخصي': 'Profile',
    'تسجيل الدخول': 'Sign in',
    'إنشاء حساب': 'Create account',
    'الإعدادات': 'Settings',
    'فتح القائمة': 'Open menu',
    'تسجيل الخروج': 'Sign out',
    'عرض كل المحادثات': 'View all conversations',
    'الرسائل': 'Messages',
    'الإشعارات': 'Notifications',
    'تحديد الكل كمقروء': 'Mark all as read',
    'حذف الكل': 'Delete all',
    'متابعة': 'Follow',
    'إلغاء المتابعة': 'Unfollow',
    'المتابعة غير متاحة': 'Following unavailable',
    'المتابعة غير متاحة بسبب وجود حظر.': 'Following is unavailable because of a block.',
    'المراسلة غير متاحة بسبب وجود حظر.': 'Messaging is unavailable because of a block.',
    'المراسلة متاحة بعد تأكيد الحجز': 'Messaging is available after the booking is confirmed.',
    'مراسلة': 'Message',
    'مستخدم دَرْب': 'DARB user',
    'أنت': 'You',
    'أنت:': 'You:',
    'سائق': 'Driver',
    'راكب': 'Passenger',
    'طالب / راكب': 'Student / passenger',
    'السيارة': 'Car',
    'موقعك': 'Your location',
    'موقع رحلتي': 'My trip location',
    'الجامعة': 'University',
    'المحافظة': 'Governorate',
    'اللواء / المنطقة': 'District / area',
    'التجمع / المحلية': 'Locality',
    'اللواء / المنطقة العامة': 'District / public area',
    'المنطقة العامة': 'Public area',
    'الوجهة المعتادة': 'Usual destination',
    'المركبة': 'Vehicle',
    'لم تتم الإضافة': 'Not added',
    'الكل': 'All',
    'متاحة': 'Available',
    'اليوم': 'Today',
    'الكل': 'All',
    'بحث': 'Search',
    'ترتيب': 'Sort',
    'التوفر': 'Availability',
    'كل الأنواع': 'All types',
    'متاحة فقط': 'Available only',
    'المسافة': 'Distance',
    'كل المسافات': 'All distances',
    'أقل من 2 كم': 'Less than 2 km',
    'أقل من 5 كم': 'Less than 5 km',
    'أقل من 10 كم': 'Less than 10 km',
    'ترتيب السعر': 'Sort by price',
    'الأقرب أولاً': 'Nearest first',
    'الأقل سعراً': 'Lowest price',
    'الأعلى سعراً': 'Highest price',
    'وقت الانطلاق': 'Departure time',
    'جميع الأوقات': 'All times',
    'الأقرب وقتاً': 'Soonest',
    'الأقرب موعداً': 'Earliest',
    'الأكثر مقاعد': 'Most seats',
    'المحافظة يدويًا': 'Governorate manually',
    'اختر المحافظة': 'Choose governorate',
    'كل المناطق': 'All areas',
    'كل التجمعات': 'All localities',
    'جميع الجامعات': 'All universities',
    'كل الجامعات': 'All universities',
    'كل المحافظات': 'All governorates',
    'اختر الجامعة': 'Choose university',
    'اختر اللواء/المنطقة': 'Choose district/area',
    'اختر التجمع/المحلية': 'Choose locality',

    /* index.html */
    'منصة تنسيق تنقّل طلابية في الأردن': 'A student transport platform in Jordan',
    'مشوارك للجامعة،': 'Your commute to university,',
    'صار أوضح.': 'made clearer.',
    'مشوارك للجامعة، صار أوضح.': 'Your commute to university, made clearer.',
    'دَرْب يساعد الطلاب والسائقين على تنظيم الرحلات الجامعية بوضوح: نقطة الانطلاق، الجامعة، الموعد، السعر، المقاعد ومعلومات المركبة في مكان واحد.': 'DARB helps students and drivers organize university trips clearly: departure point, university, time, price, seats and vehicle details in one place.',
    'استعرض الرحلات': 'Browse trips',
    'انضم إلى دَرْب': 'Join DARB',
    'رحلتك باختصار': 'Your trip at a glance',
    'يحدد منطقة الانطلاق والجامعة': 'Sets the departure area and university',
    'يشاهد الوقت والسعر والمقاعد المتاحة': 'Sees the time, price and available seats',
    'يرسل طلب الحجز وينتظر موافقة السائق': 'Sends a booking request and waits for the driver approval',
    'مسار': 'Route',
    'كيف يعمل دَرْب؟': 'How does DARB work?',
    'تجربة بسيطة من البحث إلى طلب الحجز.': 'A simple experience from search to booking request.',
    'ابحث': 'Search',
    'اختر منطقة الانطلاق والجامعة والتاريخ والوقت.': 'Choose the departure area, university, date and time.',
    'قارن': 'Compare',
    'قارن السعر، المقاعد، المركبة وتركيبة الركاب.': 'Compare price, seats, vehicle and passenger mix.',
    'اطلب': 'Book',
    'أرسل طلب الحجز وانتظر موافقة السائق.': 'Send a booking request and wait for the driver approval.',
    'ليش دَرْب؟': 'Why DARB?',
    'مصمم حول الأسئلة التي تهم الطالب قبل المشوار.': 'Built around the questions students care about before the trip.',
    'تعرف السعر': 'Know the price',
    'السعر ظاهر قبل إرسال طلب الحجز.': 'The price is shown before sending the booking request.',
    'تشوف المقاعد': 'See the seats',
    'عدد المقاعد المتاحة واضح في بطاقة الرحلة.': 'The number of available seats is clear on the trip card.',
    'تعرف الجامعة': 'Know the university',
    'الوصول للجامعة المقصودة واضح من البداية.': 'The destination university is clear from the start.',
    'معلومات المركبة': 'Vehicle info',
    'النوع والموديل والسنة تظهر ضمن التفاصيل.': 'Type, model and year appear in the details.',
    'حالة الرحلة': 'Trip status',
    'مفتوحة، مكتملة، مؤكدة أو ملغاة.': 'Open, full, confirmed or cancelled.',
    'مصمم للطلاب': 'Designed for students',
    'تجربة عربية RTL مناسبة للموبايل.': 'An Arabic RTL experience suited to mobile.',
    'للسائقين: حوّل مشوارك الجامعي إلى رحلة منظمة.': 'For drivers: turn your university commute into an organized trip.',
    'أنشئ رحلتك، حدد المقاعد والسعر، واستقبل طلبات الطلاب.': 'Create your trip, set seats and price, and receive student requests.',
    'سجل كسائق': 'Register as a driver',
    'منصة لتنظيم الرحلات الجامعية للطلاب والسائقين.': 'A platform for organizing university trips for students and drivers.',
    'روابط': 'Links',
    'الثقة والخصوصية': 'Trust and privacy',
    'لا تُعرض الإحداثيات الدقيقة للزوار.': 'Exact coordinates are not shown to visitors.',
    'تُستخدم بيانات الموقع ضمن ميزات الرحلة المرتبطة بالحجز.': 'Location data is used within trip features tied to a booking.',

    /* login.html */
    'أهلًا بعودتك': 'Welcome back',
    'ادخل إلى حسابك لإدارة رحلاتك وحجوزاتك.': 'Sign in to manage your trips and bookings.',
    'تُحفظ بيانات الحسابات والرحلات على خادم SQL Server.': 'Account and trip data are stored on a SQL Server.',
    'استخدم بريدك الإلكتروني المسجل.': 'Use your registered email.',
    'الهاتف أو البريد الإلكتروني': 'Phone or email',
    'إظهار': 'Show',
    'إخفاء': 'Hide',
    'تذكرني': 'Remember me',
    'نسيت كلمة المرور؟': 'Forgot your password?',
    'ما عندك حساب؟': "Don't have an account?",
    'أنشئ حسابًا': 'Create an account',
    'عندك حساب؟': 'Already have an account?',
    'سجّل الدخول': 'Sign in',
    'ميزة استعادة كلمة المرور غير متاحة حاليًا. تواصل مع إدارة الموقع.': 'Password recovery is currently unavailable. Contact the site administration.',
    'إظهار كلمة المرور': 'Show password',
    'إخفاء كلمة المرور': 'Hide password',

    /* register.html */
    'اختر نوع الحساب ثم أكمل بياناتك.': 'Choose your account type, then complete your details.',
    'نوع الحساب': 'Account type',
    'أنا طالب / راكب': "I'm a student / passenger",
    'ابحث عن رحلة وأرسل طلبات حجز.': 'Find a trip and send booking requests.',
    'أنا سائق': "I'm a driver",
    'أنشئ رحلات واستقبل طلبات الطلاب.': 'Create trips and receive student requests.',
    'التالي': 'Next',
    'السابق': 'Previous',
    'المعلومات الشخصية': 'Personal information',
    'الاسم الكامل': 'Full name',
    'استخدم من 3 إلى 20 حرفًا من الأحرف الإنجليزية الصغيرة والأرقام والشرطة السفلية (_) فقط.': 'Use 3 to 20 characters: lowercase English letters, digits and underscore (_) only.',
    'رقم الهاتف': 'Phone number',
    'البريد الإلكتروني': 'Email',
    'كلمة المرور': 'Password',
    'استخدم 8 أحرف على الأقل، ويُفضّل الجمع بين الأحرف الكبيرة والصغيرة والأرقام والرموز.': 'Use at least 8 characters, preferably mixing upper and lower case letters, digits and symbols.',
    'لم تكتب كلمة المرور بعد.': 'Password not entered yet.',
    'لم تُكتب كلمة المرور بعد': 'Password not entered yet',
    'تأكيد كلمة المرور': 'Confirm password',
    'الجنس': 'Gender',
    'اختر': 'Choose',
    'ذكر': 'Male',
    'أنثى': 'Female',
    'الجامعة والموقع': 'University and location',
    'المحافظة': 'Governorate',
    'اللواء / المنطقة': 'District / area',
    'التجمع / المحلية': 'Locality',
    'بيانات المركبة': 'Vehicle details',
    'إذا كنت راكبًا، فلا تحتاج إلى بيانات مركبة. اضغط التالي للمراجعة.': 'If you are a passenger, you do not need vehicle details. Press Next to review.',
    'موديل المركبة': 'Vehicle model',
    'سنة المركبة': 'Vehicle year',
    'رقم اللوحة': 'Plate number',
    'عدد مقاعد الركاب': 'Passenger seats',
    'المراجعة والموافقة': 'Review and consent',
    'عند إنشاء الحساب، تُحفظ بياناتك على خادم SQL Server وتُستخدم لتنسيق الرحلات الجامعية.': 'When you create the account, your data is stored on a SQL Server and used to coordinate university trips.',
    'أوافق على استخدام بياناتي لتشغيل خدمات دَرْب وتنسيق الرحلات.': 'I agree to the use of my data to operate DARB services and coordinate trips.',
    'إنشاء الحساب': 'Create account',
    'رسمية': 'Public',
    'خاصة': 'Private',
    'لم تُكتب كلمة المرور بعد.': 'Password not entered yet.',
    'ضعيفة': 'Weak',
    'متوسطة': 'Medium',
    'قوية': 'Strong',

    /* dashboard.html */
    'لوحة الطالب وإدارة الحجوزات.': 'Student dashboard and booking management.',
    'رحلات متاحة': 'Available trips',
    'حجوزاتي': 'My bookings',
    'الرحلة القادمة': 'Next trip',
    'السيارات القريبة منك': 'Cars near you',
    'اعثر على رحلات متجهة إلى جامعتك. تظهر المسافة فقط عند توفر موقع دقيق من الطرفين.': 'Find trips heading to your university. Distance appears only when a precise location is available from both sides.',
    'تحديد موقعي': 'Set my location',
    'حدّد موقعك أو اعرض الرحلات المتاحة': 'Set your location or browse available trips',
    'خرائط OpenStreetMap — تتطلب اتصالًا بالإنترنت. لا تُعرض الإحداثيات الرقمية.': 'OpenStreetMap — requires an internet connection. Numeric coordinates are not shown.',
    'الأقرب إليك': 'Closest to you',
    'حدّد موقعك لاحتساب المسافة. يمكن استعراض الرحلات حتى دون مشاركة الموقع.': 'Set your location to calculate distance. You can browse trips even without sharing your location.',
    'استعراض جميع الرحلات': 'Browse all trips',
    'رحلتك القادمة': 'Your next trip',
    'حجز مؤكد': 'Confirmed booking',
    'تم إلغاء الحجز': 'Booking cancelled',
    'وضع تجريبي — موقع السيارة تتم محاكاته لأغراض العرض فقط.': 'Demo mode — the car location is simulated for demonstration only.',
    'المسافة التقريبية': 'Approximate distance',
    'بانتظار المواقع': 'Waiting for locations',
    'تم تأكيد الحجز': 'Booking confirmed',
    'السائق في الطريق إليك': 'Driver on the way',
    'وصلت السيارة': 'Car arrived',
    'تم الصعود إلى السيارة': 'Picked up',
    'التوجه إلى الجامعة': 'Heading to university',
    'وصلت إلى الجامعة': 'Arrived at university',
    'بدأت الرحلة إلى الجامعة': 'Started the trip to university',
    'موقعي الحالي': 'My current location',
    'لم يتم تحديد موقع.': 'Location not set.',
    'تحديث موقعي': 'Update my location',
    'الملف': 'Profile',
    'يمكنك تعديل بياناتك من صفحة الملف الشخصي.': 'You can edit your data from the profile page.',
    'حدّد موقعك والسائقين لعرض المواقع على المخطط': 'Set your location and drivers to show positions on the map',
    'لا توجد سيارات قريبة حاليًا': 'No nearby cars right now',
    'لم نجد رحلات مطابقة من السائقين الذين شاركوا موقعهم.': 'We found no matching trips from drivers who shared their location.',
    'المسافة غير متاحة — لم يشارك السائق موقعه': 'Distance unavailable — the driver did not share a location',
    'عرض الرحلة': 'View trip',
    'احجز الآن': 'Book now',
    'احجز الرحلة': 'Book trip',
    'العودة للرحلات': 'Back to trips',
    'الانطلاق': 'Departure',
    'الموعد': 'Time',
    'المقاعد': 'Seats',
    'السائق': 'Driver',
    'اللوحة': 'Plate',
    'تركيبة الركاب': 'Passenger mix',
    'موقع المركبة الدقيق غير معروض للعامة. حالة الموقع: متاح بعد الحجز — وضع تجريبي.': 'The exact vehicle location is not shown publicly. Location status: available after booking — demo mode.',
    'الرحلة غير موجودة': 'Trip not found',
    'لا توجد رحلات مطابقة.': 'No matching trips.',
    'جرّب تغيير الفلاتر أو التاريخ.': 'Try changing the filters or the date.',
    'لا توجد حجوزات حتى الآن.': 'No bookings yet.',
    'منطقة، جامعة، سائق...': 'Area, university, driver...',

    /* driver.html */
    'إدارة رحلاتك وطلبات الركاب.': 'Manage your trips and passenger requests.',
    '+ إنشاء رحلة': '+ Create trip',
    'طلبات معلقة': 'Pending requests',
    'تجريبي': 'Demo',
    'وضع البيانات': 'Data mode',
    'طلبات الركاب': 'Passenger requests',
    'حدّث موقعك الحالي ليظهر للركاب المرتبطين برحلتك.': 'Update your current location so passengers on your trip can see it.',
    'لم يتم تحديث الموقع.': 'Location not updated.',
    'يُحفظ آخر موقع محليًا على هذا الجهاز فقط؛ لا يوجد تتبع مباشر أو إرسال تلقائي للموقع.': 'The last location is saved locally on this device only; there is no live tracking or automatic location reporting.',
    'حدّث موقعك لعرضه على المخطط.': 'Update your location to show it on the map.',
    'بيانات الرحلة': 'Trip details',
    'منطقة الانطلاق': 'Departure area',
    'التاريخ': 'Date',
    'الوقت': 'Time',
    'السعر (د.أ)': 'Price (JOD)',
    'إجمالي المقاعد': 'Total seats',
    'نوع المركبة': 'Vehicle type',
    'الموديل': 'Model',
    'السنة': 'Year',
    'حفظ الرحلة': 'Save trip',
    'رحلة مفتوحة': 'Open trip',
    'لا توجد رحلة حالية. أنشئ رحلتك الأولى.': 'No current trip. Create your first trip.',
    'قبول': 'Accept',
    'رفض': 'Reject',
    'قيد المراجعة': 'Pending review',
    'لا توجد طلبات حجز.': 'No booking requests.',
    'مؤكد': 'Confirmed',
    'مرفوض': 'Rejected',
    'ملغى': 'Cancelled',

    /* trips.html and trip cards / details */
    'استعرض الرحلات': 'Browse trips',
    'تصفح الرحلات المتاحة وتعرّف إلى تفاصيلها.': 'Browse available trips and explore their details.',
    'تفاصيل الرحلة': 'Trip details',
    'مفتوحة': 'Open',
    'مكتملة': 'Full',
    'مقاعد': 'seats',
    'متاح من': 'available of',

    /* profile.html and profile.js */
    'معلومات الحساب العامة.': 'Public account information.',
    'جار تحميل الملف الشخصي...': 'Loading profile...',
    'تعديل الملف الشخصي': 'Edit profile',
    'تعديل الملف': 'Edit profile',
    'لا تظهر بيانات الاتصال أو الموقع الدقيق في ملفك العام.': 'Contact details and exact location are not shown in your public profile.',
    'صورة الملف الشخصي': 'Profile photo',
    'JPEG أو PNG أو WebP، بحد أقصى 1 ميغابايت.': 'JPEG, PNG or WebP, up to 1 MB.',
    'الاسم الظاهر': 'Display name',
    '3–20 حرفًا إنجليزيًا أو رقمًا أو _ فقط.': '3–20 English letters, digits or _ only.',
    'نبذة قصيرة (اختياري)': 'Short bio (optional)',
    'حفظ التغييرات': 'Save changes',
    'قيّم تجربة الرحلة': 'Rate the trip experience',
    'إغلاق': 'Close',
    'اختر تقييمًا من نجمة إلى خمس نجوم': 'Choose a rating from one to five stars',
    'نجمة واحدة': 'One star',
    'نجمتان': 'Two stars',
    'ثلاث نجوم': 'Three stars',
    'أربع نجوم': 'Four stars',
    'خمس نجوم': 'Five stars',
    'تعليق اختياري': 'Optional comment',
    'شارك ملاحظاتك عن الرحلة': 'Share your feedback about the trip',
    'إرسال التقييم': 'Submit rating',
    'متابع': 'Followers',
    'يتابع': 'Following',
    'حظر المستخدم': 'Block user',
    'إلغاء الحظر': 'Unblock',
    'تقييم السائق': 'Rate driver',
    'لا يمكنك مراسلة هذا المستخدم أو متابعته.': 'You cannot message or follow this user.',
    'تقييمات الركاب': 'Passenger ratings',
    'تقييمات بعد إكمال الرحلة': 'Ratings after completing the trip',
    'لا توجد تقييمات بعد.': 'No ratings yet.',
    'لا توجد تقييمات بعد': 'No ratings yet',
    'تقييم دون تعليق.': 'Rating without a comment.',
    'الملف غير متاح': 'Profile unavailable',
    'قد يكون الحساب غير موجود أو لا يملك ملفًا عامًا.': 'The account may not exist or may not have a public profile.',
    'تعذر تحميل الملف الشخصي': 'Could not load the profile',
    'تحقق من الاتصال وحاول مرة أخرى.': 'Check your connection and try again.',
    'ملفك العام ومعلومات الحساب.': 'Your public profile and account information.',
    'مسار التقييم': 'Rating',
    'اختر تقييمًا من نجمة إلى خمس نجوم.': 'Choose a rating from one to five stars.',
    'من 5 نجوم': 'out of 5 stars',
    'إحصاءات المتابعة': 'Follow stats',
    'جارٍ التحديث...': 'Updating...',
    'تعذر تحديث حالة المتابعة والحظر. حدّث الصفحة للمزامنة.': 'Could not update the follow and block status. Refresh the page to sync.',

    /* settings.html */
    'حسابك في دَرْب': 'Your DARB account',
    'تحكّم بحسابك وخصوصيتك وطريقة استخدامك لدَرْب.': 'Manage your account, privacy and how you use DARB.',
    'ملخص الحساب': 'Account summary',
    'عرض الملف الشخصي': 'View profile',
    'أقسام الإعدادات': 'Settings sections',
    'الحساب والملف الشخصي': 'Account and profile',
    'الأمان وتسجيل الدخول': 'Security and sign-in',
    'الإشعارات': 'Notifications',
    'المحادثات والخصوصية الاجتماعية': 'Messaging and social privacy',
    'المظهر وشكل الموقع': 'Appearance',
    'الموقع والتنقل': 'Location and navigation',
    'تفضيلات الرحلات': 'Trip preferences',
    'اللغة وإمكانية الوصول': 'Language and accessibility',
    'المساعدة والدعم': 'Help and support',
    'حول دَرْب': 'About DARB',
    'جار تحميل الحساب...': 'Loading account...',
    'إدارة معلومات حسابك والبيانات المرتبطة به.': 'Manage your account information and related data.',
    'الاسم': 'Name',
    'اسم المستخدم': 'Username',
    'البريد الإلكتروني': 'Email',
    'رقم الهاتف': 'Phone number',
    'نوع الحساب': 'Account type',
    'تعديل الاسم والصورة والجامعة ومعلومات الملف متاح في صفحة الملف الشخصي. تغيير البريد أو الهاتف غير متاح من دون تحقق.': 'Editing your name, photo, university and profile info is available on the profile page. Changing the email or phone requires verification.',
    'تعديل الملف الشخصي': 'Edit profile',
    'حافظ على أمان حسابك وتحكّم بتسجيل الدخول.': 'Keep your account secure and control sign-in.',
    'تغيير كلمة المرور': 'Change password',
    'كلمة المرور الحالية': 'Current password',
    'كلمة المرور الجديدة': 'New password',
    'تأكيد كلمة المرور الجديدة': 'Confirm new password',
    'حفظ كلمة المرور الجديدة': 'Save new password',
    'تبقى الجلسة الحالية فعالة. لا يدعم النظام حاليًا إدارة الجلسات أو إبطال الجلسات الأخرى.': 'The current session stays active. The system does not currently support session management or revoking other sessions.',
    'استعادة كلمة المرور': 'Password recovery',
    'لا توجد حاليًا خدمة تحقق أو إرسال بريد/رسائل لاستعادة كلمة المرور.': 'There is currently no verification or email/SMS service to recover a password.',
    'العودة إلى تسجيل الدخول': 'Back to sign-in',
    'المصادقة الثنائية — قريبًا': 'Two-factor authentication — coming soon',
    'غير متاحة حاليًا، لذلك لا يظهر مفتاح تفعيل غير فعلي.': 'Not available yet, so no non-functional toggle is shown.',
    'الجلسات والأجهزة — قريبًا': 'Sessions and devices — coming soon',
    'لا يسجل النظام معلومات الأجهزة أو جلسات قابلة للإبطال.': 'The system does not record device information or revocable sessions.',
    'حذف الحساب': 'Delete account',
    'حذف الحساب غير متاح ذاتيًا حاليًا؛ لا نحذف الحسابات أو السجلات دون إجراء آمن وسياسة احتفاظ.': 'Self-service account deletion is not available yet; accounts or records are not deleted without a safe process and a retention policy.',
    'حذف الحساب غير متاح': 'Account deletion unavailable',
    'اختر التنبيهات التي ترغب في استقبالها.': 'Choose the alerts you want to receive.',
    'طلبات الانضمام إلى رحلاتي': 'Join requests for my trips',
    'التحكم في إنشاء إشعار عند وصول طلب حجز جديد إلى السائق. لا يؤثر ذلك على الحجز نفسه.': 'Controls whether a notification is created when a new booking request reaches the driver. This does not affect the booking itself.',
    'جار تحميل تفضيلات الإشعارات والخصوصية...': 'Loading notification and privacy preferences...',
    'إدارة الإشعارات الحالية': 'Manage current notifications',
    'يمكنك قراءة الإشعارات وحذفها من قائمة الإشعارات في شريط التنقل. سجل الإشعارات منفصل عن تفضيلات الاستلام.': 'You can read and delete notifications from the notifications list in the navigation bar. The notification log is separate from delivery preferences.',
    'تحكّم بمن يستطيع التواصل معك وكيف تظهر حالتك.': 'Control who can reach you and how your status appears.',
    'الحسابات المحظورة': 'Blocked accounts',
    'الحظر أحادي الاتجاه، ولا يحذف المحادثات أو الرسائل السابقة.': 'Blocking is one-way and does not delete previous conversations or messages.',
    'تحديث القائمة': 'Refresh list',
    'جار تحميل الحسابات المحظورة...': 'Loading blocked accounts...',
    'لا توجد حسابات محظورة حاليًا.': 'No blocked accounts right now.',
    'من يستطيع مراسلتي': 'Who can message me',
    'المراسلة متاحة حاليًا بين طرفي حجز مؤكد. لا يوجد إعداد أوسع للجمهور.': 'Messaging is currently available between the two parties of a confirmed booking. There is no broader public setting.',
    'حالة النشاط وآخر ظهور': 'Activity status and last seen',
    'لا يعرض دَرْب حالة نشاط أو آخر ظهور، لذلك لا حاجة إلى مفاتيح خصوصية غير مستخدمة.': 'DARB does not show activity status or last seen, so no unused privacy toggles are needed.',
    'مؤشر الكتابة': 'Typing indicator',
    'لا يرسل نظام المحادثات مؤشر كتابة حاليًا، لذلك لا يظهر خيار غير فعلي.': 'The messaging system does not send a typing indicator yet, so no non-functional option is shown.',
    'الظهور الاجتماعي': 'Social visibility',
    'لا توجد خيارات خصوصية منفصلة للملف العام أو قوائم المتابعة حتى الآن.': 'There are no separate privacy options for the public profile or follow lists yet.',
    'إيصالات القراءة': 'Read receipts',
    'عند الإيقاف، لن يرسل الخادم تأكيد القراءة للرسائل الجديدة أو يعرض تأكيدات قراءتك للطرف الآخر.': 'When off, the server will not send read confirmation for new messages or show your read confirmations to the other party.',
    'خصّص شكل دَرْب بما يناسبك. تطبّق التغييرات فورًا على الصفحات المشتركة.': 'Customize how DARB looks. Changes apply immediately across shared pages.',
    'السمة': 'Theme',
    'فاتح': 'Light',
    'داكن': 'Dark',
    'تلقائي حسب الجهاز': 'Automatic based on device',
    'حجم النص': 'Text size',
    'صغير': 'Small',
    'متوسط': 'Medium',
    'كبير': 'Large',
    'تقليل الحركة': 'Reduce motion',
    'تقليل الانتقالات والحركات غير الضرورية.': 'Reduce unnecessary transitions and animations.',
    'تباين أوضح': 'Higher contrast',
    'تقوية حدود الحقول ومؤشرات التركيز.': 'Strengthen field borders and focus indicators.',
    'استعادة الإعدادات الافتراضية': 'Restore defaults',
    'تُحفظ تفضيلات المظهر على هذا الجهاز فقط.': 'Appearance preferences are saved on this device only.',
    'إدارة إعدادات الموقع والأماكن المحفوظة.': 'Manage location settings and saved places.',
    'إذن الموقع في المتصفح': 'Browser location permission',
    'لا يطلب دَرْب الموقع عند فتح هذه الصفحة. يمكنك التحقق بطلب إذن لمرة واحدة، وقد تحتاج أيضًا إلى السماح به من إعدادات المتصفح.': 'DARB does not request your location when opening this page. You can verify by requesting permission once, and you may also need to allow it from browser settings.',
    'لم يتم التحقق من إذن الموقع.': 'Location permission has not been verified.',
    'التحقق بطلب إذن لمرة واحدة': 'Verify with a one-time permission request',
    'مشاركة موقعي مع ركاب رحلاتي المؤكدة': 'Share my location with passengers on my confirmed trips',
    'عند الإيقاف، يتوقف إرسال مواقع جديدة وتُحذف مواقع الرحلات المحفوظة على الخادم. هذا الخيار مستقل عن إذن الموقع في المتصفح.': 'When off, new locations stop being sent and saved trip locations are deleted from the server. This option is separate from browser location permission.',
    'لا يطلب دَرْب الموقع إلا بعد إجراء منك، وتبقى مشاركة موقع السائق محصورة بالركاب ذوي الحجوزات المؤكدة.': 'DARB only requests location after an action from you, and driver location sharing stays limited to passengers with confirmed bookings.',
    'خصّص تجربتك حسب نوع حسابك.': 'Customize your experience based on your account type.',
    'يمكنك البحث عن الرحلات وإدارة الحجوزات من الصفحات الحالية، لكن تفضيلات بحث افتراضية محفوظة بالحساب غير مدعومة بعد.': 'You can search for trips and manage bookings from the current pages, but account-saved default search preferences are not supported yet.',
    'معلومات الحساب والجامعة': 'Account and university info',
    'لا تؤثر أي تفضيلات غير محفوظة على نتائج الرحلات أو أهلية الحجز.': 'No unsaved preferences affect trip results or booking eligibility.',
    'اجعل استخدام دَرْب أوضح وأسهل.': 'Make DARB clearer and easier to use.',
    'لغة الواجهة': 'Interface language',
    'العربية': 'Arabic',
    'إعدادات حجم النص وتقليل الحركة والتباين موجودة في قسم المظهر وتطبّق عبر الصفحات المشتركة.': 'Text size, reduced motion and contrast settings are in the Appearance section and apply across shared pages.',
    'نحن هنا لمساعدتك في استخدام دَرْب.': 'We are here to help you use DARB.',
    'كيف أنشئ حسابًا؟': 'How do I create an account?',
    'استخدم رابط إنشاء الحساب وسجّل بياناتك المطلوبة. الحسابات تحفظ على خادم دَرْب.': 'Use the create account link and enter the required details. Accounts are stored on the DARB server.',
    'كيف أحجز رحلة؟': 'How do I book a trip?',
    'استعرض الرحلات، اختر رحلة مناسبة، ثم أرسل طلب الحجز وانتظر رد السائق.': 'Browse trips, choose a suitable one, then send a booking request and wait for the driver response.',
    'متى تتاح المحادثة؟': 'When is messaging available?',
    'تتاح المحادثة بين طرفي الحجز بعد تأكيده.': 'Messaging becomes available between the two parties after the booking is confirmed.',
    'كيف أحظر مستخدمًا؟': 'How do I block a user?',
    'افتح المحادثة معه واختر «حظر المستخدم». يمنع ذلك الطرف المحظور من إرسال رسائل جديدة إليك.': 'Open the conversation with them and choose "Block user". This prevents the blocked party from sending you new messages.',
    'هل يمكن استعادة كلمة المرور أو التواصل مع الدعم؟': 'Can I recover a password or contact support?',
    'خدمة استعادة كلمة المرور وتذاكر الدعم لم تُفعّل بعد. لا يوجد عنوان دعم موثق يمكن عرضه حاليًا.': 'Password recovery and support tickets are not enabled yet. There is no documented support address to show currently.',
    'مركز الدعم وإرسال البلاغات غير متاحين حاليًا. لا يتم إرسال نموذج وهمي أو الادعاء بحفظ بلاغ.': 'The support center and report submission are currently unavailable. No fake form is submitted and no report is falsely claimed to be saved.',
    'تعرّف على المنصة ومعلوماتها.': 'Learn about the platform and its information.',
    'منصة لتنظيم تنقّل طلاب الجامعات في الأردن وربط الركاب بالسائقين والرحلات المؤكدة.': 'A platform for organizing university student transport in Jordan and connecting passengers with drivers and confirmed trips.',
    'إصدار التطبيق غير محدد في ملفات المشروع.': 'The app version is not specified in the project files.',
    'لا توجد حاليًا صفحة شروط استخدام أو سياسة خصوصية منشورة ضمن التطبيق.': 'There is currently no published terms of use or privacy policy page within the app.',
    'هل أنت متأكد أنك تريد تسجيل الخروج؟': 'Are you sure you want to sign out?',

    /* chat.html and chat.js */
    'قائمة المحادثات': 'Conversation list',
    'جار تحميل المحادثات...': 'Loading conversations...',
    'جارٍ تحميل المحادثات...': 'Loading conversations...',
    'اختر محادثة': 'Choose a conversation',
    'ستظهر رسائلك هنا بعد اختيار محادثة من القائمة.': 'Your messages will appear here after choosing a conversation from the list.',
    'العودة لقائمة المحادثات': 'Back to conversation list',
    'محادثة مرتبطة بحجز': 'Conversation linked to a booking',
    'جار تحميل المحادثة...': 'Loading conversation...',
    'تحميل رسائل أقدم': 'Load older messages',
    'جار تحميل الرسائل...': 'Loading messages...',
    'اكتب رسالتك': 'Write your message',
    'اكتب رسالتك...': 'Write your message...',
    'إرسال': 'Send',
    'إرسال الرسالة': 'Send message',
    'لا توجد محادثات بعد. تبدأ المحادثة بعد تأكيد حجز.': 'No conversations yet. A conversation starts after a booking is confirmed.',
    'لا توجد محادثات بعد.': 'No conversations yet.',
    'محادثاتك محفوظة هنا.': 'Your conversations are saved here.',
    'لا توجد رسائل بعد': 'No messages yet',
    'ابدأ المحادثة برسالة متعلقة بالرحلة.': 'Start the conversation with a trip-related message.',
    'جارٍ التحقق من حالة الحظر...': 'Checking block status...',
    'لقد حظرت هذا المستخدم.': 'You have blocked this user.',
    'لا يمكنك إرسال رسائل جديدة إلى هذا المستخدم.': 'You cannot send new messages to this user.',
    'متصل مباشرة': 'Connected live',
    'جارٍ إعادة الاتصال...': 'Reconnecting...',
    'غير متصل — مزامنة دورية': 'Offline — periodic sync',
    'جارٍ الاتصال...': 'Connecting...',
    'الآن': 'Now',
    'تعذر الإرسال': 'Send failed',
    'قيد الإرسال': 'Sending',
    'تمت القراءة': 'Read',
    'تم التسليم': 'Delivered',
    'تم الإرسال': 'Sent',
    'إعادة المحاولة': 'Retry',
    'ليس لديك صلاحية لهذه المحادثة.': 'You do not have access to this conversation.',
    'بيانات المحادثة غير صالحة.': 'Conversation data is invalid.',
    'المحادثة غير متاحة لهذا الحساب.': 'The conversation is not available for this account.',
    'تعذر تحميل المحادثة بعد إنشائها.': 'Could not load the conversation after creating it.',
    'الرسالة طويلة جدًا. الحد الأقصى 2000 حرف.': 'The message is too long. The maximum is 2000 characters.',
    'تعذر إرسال الرسالة. أعد المحاولة للاستخدام الآمن.': 'Could not send the message. Try again to use it safely.',
    'وصلت الرسالة، لكن تعذر تحديث حالة التسليم أو القراءة.': 'The message arrived, but its delivery or read status could not be updated.',

    /* Notifications and messaging popovers (script.js) */
    'جارٍ تحميل المحادثات...': 'Loading conversations...',
    'لا توجد إشعارات حاليًا.': 'No notifications right now.',
    'إشعار جديد': 'New notification',
    'تحديد الإشعار كمقروء': 'Mark notification as read',
    'تحديد كمقروء': 'Mark as read',
    'حذف الإشعار': 'Delete notification',
    'تعذر تحديث المحادثات؛ قد تكون البيانات المعروضة قديمة.': 'Could not refresh conversations; the shown data may be outdated.',
    'تعذر تحميل المحادثات. تحقق من اتصالك وحاول مجددًا.': 'Could not load conversations. Check your connection and try again.',
    'تعذر تحديث الإشعارات. تحقق من اتصالك وحاول مجددًا.': 'Could not refresh notifications. Check your connection and try again.',
    'تعذر تحديث الإشعار. حاول مرة أخرى.': 'Could not update the notification. Try again.',
    'تم تحديد الإشعار كمقروء.': 'Notification marked as read.',
    'تم حذف الإشعار.': 'Notification deleted.',
    'تم تحديد جميع الإشعارات كمقروءة.': 'All notifications marked as read.',
    'تم حذف جميع الإشعارات.': 'All notifications deleted.',
    'تعذر حذف الإشعارات. حاول مرة أخرى.': 'Could not delete notifications. Try again.',
    'تعذر تحديث الإشعارات. حاول مرة أخرى.': 'Could not update notifications. Try again.',

    /* User search (script.js) */
    'ابحث عن مستخدم': 'Search for a user',
    'ابحث عن اسم أو اسم مستخدم...': 'Search by name or username...',
    'ابحث عن اسم أو اسم مستخدم': 'Search by name or username',
    'مسح البحث': 'Clear search',
    'نتائج البحث': 'Search results',
    'جارٍ البحث...': 'Searching...',
    'لم نعثر على مستخدمين يطابقون بحثك.': 'No users matched your search.',
    'انتهت جلسة الدخول. سجّل الدخول مجددًا.': 'Your session expired. Sign in again.',
    'تعذر البحث الآن. تحقق من اتصالك بالخادم وحاول مرة أخرى.': 'Could not search now. Check your server connection and try again.',
    'تعذر تحديث المتابعة. حاول مرة أخرى.': 'Could not update the follow. Try again.',
    'تمت متابعة المستخدم.': 'User followed.',
    'تم إلغاء المتابعة.': 'Unfollowed.',

    /* Auth / validation / API messages */
    'بيانات الدخول غير صحيحة. تحقق منها وحاول مرة أخرى.': 'Incorrect sign-in details. Check them and try again.',
    'يرجى إدخال الاسم الكامل.': 'Please enter the full name.',
    'الاسم قصير جدًا.': 'The name is too short.',
    'الاسم طويل جدًا.': 'The name is too long.',
    'الاسم يحتوي على رموز غير مسموح بها.': 'The name contains unsupported characters.',
    'يرجى إدخال اسم المستخدم.': 'Please enter a username.',
    'اسم المستخدم لا يقبل المسافات.': 'The username cannot contain spaces.',
    'اسم المستخدم يجب أن يحتوي على 3 أحرف على الأقل.': 'The username must be at least 3 characters.',
    'اسم المستخدم لا يمكن أن يتجاوز 20 حرفًا.': 'The username cannot exceed 20 characters.',
    'لا يُسمح بالأحرف الكبيرة. استخدم أحرفًا إنجليزية صغيرة وأرقامًا وشرطة سفلية (_) فقط.': 'Uppercase letters are not allowed. Use lowercase English letters, digits and underscore (_) only.',
    'استخدم أحرفًا إنجليزية صغيرة وأرقامًا وشرطة سفلية (_) فقط.': 'Use lowercase English letters, digits and underscore (_) only.',
    'استخدم 3–20 حرفًا: أحرف إنجليزية صغيرة وأرقام وشرطة سفلية (_) فقط.': 'Use 3–20 characters: lowercase English letters, digits and underscore (_) only.',
    'اسم المستخدم مستخدم بالفعل. اختر اسمًا آخر.': 'The username is already taken. Choose another one.',
    'يرجى إدخال البريد الإلكتروني.': 'Please enter the email address.',
    'صيغة البريد الإلكتروني غير صحيحة.': 'The email format is invalid.',
    'هذا البريد مستخدم بالفعل.': 'This email is already in use.',
    'يرجى إدخال رقم الهاتف.': 'Please enter the phone number.',
    'تحقق من صيغة رقم الهاتف.': 'Check the phone number format.',
    'رقم الهاتف مسجل مسبقًا.': 'The phone number is already registered.',
    'يرجى إدخال كلمة المرور.': 'Please enter the password.',
    'كلمة المرور قصيرة جدًا. استخدم 8 أحرف على الأقل.': 'The password is too short. Use at least 8 characters.',
    'كلمتا المرور غير متطابقتين.': 'The passwords do not match.',
    'يرجى إدخال تأكيد كلمة المرور.': 'Please confirm the password.',
    'كلمة المرور ضعيفة. استخدم 8 أحرف على الأقل مع تنوع الأحرف.': 'The password is weak. Use at least 8 characters with a variety of characters.',
    'أكمل بيانات المركبة المطلوبة قبل إنشاء الحساب.': 'Complete the required vehicle details before creating the account.',
    'تم إنشاء الحساب بنجاح. جارٍ تحويلك...': 'Account created successfully. Redirecting...',
    'تعذر تسجيل الدخول.': 'Could not sign in.',
    'تعذر إنشاء الحساب.': 'Could not create the account.',
    'تحقق من الاسم واسم المستخدم وبيانات الحساب والمركبة المطلوبة.': 'Check the name, username, account and required vehicle details.',
    'سيتم حذف بيانات التجربة المحلية بالكامل. هل أنت متأكد؟': 'All local demo data will be deleted. Are you sure?',
    'تعذرت مزامنة البيانات مع SQL Server.': 'Could not sync data with SQL Server.',
    'تعذر الاتصال بخادم SQL Server.': 'Could not connect to the SQL Server.',
    'تم حفظ البيانات، لكن تعذر تحديث العرض. أعد تحميل الصفحة.': 'Data was saved, but the view could not be refreshed. Reload the page.',
    'الخادم غير متاح. لا يمكن تسجيل الدخول أو إنشاء حساب دون الاتصال بـ SQL Server.': 'The server is unavailable. You cannot sign in or create an account without a SQL Server connection.',
    'تعذر تحميل واجهة الاتصال بالخادم.': 'Could not load the server connection interface.',
    'تم إنهاء الجلسة على هذا الجهاز، لكن تعذر تأكيد الطلب لدى الخادم. سيتم تحويلك إلى تسجيل الدخول.': 'The session was ended on this device, but the request could not be confirmed with the server. You will be redirected to sign-in.',
    'تعذر تنفيذ الطلب.': 'Could not complete the request.',

    /* Settings interactions (settings.js / settings-preferences.js) */
    'تُحفظ تفضيلات الخصوصية والإشعارات في حسابك.': 'Privacy and notification preferences are saved in your account.',
    'تعذر تحميل إعدادات الحساب.': 'Could not load account settings.',
    'جار حفظ الإعداد...': 'Saving the setting...',
    'تم حفظ الإعداد في حسابك.': 'The setting was saved in your account.',
    'تعذر حفظ الإعداد. أعد المحاولة.': 'Could not save the setting. Try again.',
    'تعذر حفظ الإعداد.': 'Could not save the setting.',
    'تعذر تهيئة إعدادات الحساب.': 'Could not initialize account settings.',
    'تعذر تحميل الإعدادات.': 'Could not load settings.',
    'لديك تغييرات غير محفوظة في نموذج كلمة المرور. هل تريد إلغاءها ومغادرة القسم؟': 'You have unsaved changes in the password form. Discard them and leave the section?',
    'تاريخ الحظر:': 'Blocked on:',
    'تم إلغاء الحظر. بقيت المحادثة والرسائل السابقة محفوظة.': 'Unblocked. The previous conversation and messages remain saved.',
    'تعذر إلغاء الحظر. حاول مرة أخرى.': 'Could not unblock. Try again.',
    'تعذر تحميل قائمة الحظر.': 'Could not load the block list.',
    'يجب أن تتكون كلمة المرور الجديدة من 6 إلى 256 حرفًا.': 'The new password must be between 6 and 256 characters.',
    'تأكيد كلمة المرور لا يطابق كلمة المرور الجديدة.': 'The password confirmation does not match the new password.',
    'تم تحديث كلمة المرور. جلستك الحالية ما زالت فعالة.': 'Password updated. Your current session is still active.',
    'تعذر تحديث كلمة المرور.': 'Could not update the password.',
    'تعذر حفظ تفضيلات المظهر على هذا الجهاز.': 'Could not save appearance preferences on this device.',
    'تمت استعادة إعدادات المظهر الافتراضية.': 'Default appearance settings restored.',
    'تعذر استعادة إعدادات المظهر على هذا الجهاز.': 'Could not restore appearance settings on this device.',
    'قائمة الإشعارات غير متاحة في هذه الجلسة.': 'The notifications list is not available in this session.',
    'الموقع غير متاح في هذا المتصفح.': 'Location is not available in this browser.',
    'جار التحقق من الإذن...': 'Checking permission...',
    'الإذن مرفوض. يمكنك تغييره من إعدادات الموقع في المتصفح.': 'Permission denied. You can change it from the browser location settings.',
    'الإذن ممنوح والموقع متاح الآن. لم تُحفظ الإحداثيات.': 'Permission granted and location is now available. Coordinates were not saved.',
    'الإذن غير ممنوح. يمكنك السماح به من إعدادات المتصفح.': 'Permission not granted. You can allow it from browser settings.',
    'انتهت مهلة طلب الموقع.': 'The location request timed out.',
    'الموقع غير متاح حاليًا.': 'Location is currently unavailable.',
    'مشاركة الموقع متوقفة من إعدادات الخصوصية.': 'Location sharing is disabled in privacy settings.',
    'تعذر التحقق من إعداد مشاركة الموقع.': 'Could not verify the location sharing setting.',
    'تعذر تحميل إعدادات الخصوصية.': 'Could not load privacy settings.',
    'تعذر التحقق من حالة الحظر. أعد المحاولة.': 'Could not check the block status. Try again.',

    /* GPS (gps.js) */
    'المتصفح لا يدعم تحديد الموقع.': 'The browser does not support geolocation.',
    'تحديد الموقع يحتاج إلى HTTPS أو localhost.': 'Location requires HTTPS or localhost.',
    'جارٍ تحديد الموقع...': 'Getting location...',
    'تم تحديد الموقع': 'Location set',
    'تم تحديث الموقع بنجاح.': 'Location updated successfully.',
    'لم نتمكن من تحديد موقعك. يمكنك السماح بالموقع أو اختيار منطقة يدويًا.': 'We could not determine your location. You can allow location or choose an area manually.',
    'لم نتمكن من تحديد موقعك. اسمح بالموقع من إعدادات المتصفح أو افتح الموقع عبر HTTPS.': 'We could not determine your location. Allow location from browser settings or open the site over HTTPS.',
    'تعذر تحديد الموقع الآن. تحقق من اتصالك وصلاحيات الموقع.': 'Could not get the location now. Check your connection and location permissions.',

    /* Driver / dashboard actions */
    'تم قبول الحجز وتحديث المقاعد.': 'Booking accepted and seats updated.',
    'تم رفض طلب الحجز.': 'Booking request rejected.',
    'تعذر تحديث طلب الحجز.': 'Could not update the booking request.',
    'تم إلغاء الرحلة.': 'Trip cancelled.',
    'تعذر إلغاء الرحلة.': 'Could not cancel the trip.',
    'آخر موقع محفوظ': 'Last saved location',
    'الرحلة القادمة': 'Next trip',

    /* Nearby map (map.js) */
    'تم اختيار منطقة انطلاق يدويًا. لا تتوفر إحداثيات موثوقة لحساب المسافة.': 'A departure area was chosen manually. No reliable coordinates are available to calculate distance.',
    'المسافات تقريبية ومحسوبة بين مواقع GPS المحفوظة للسائق والراكب.': 'Distances are approximate and calculated between the saved GPS locations of driver and passenger.',
    'لم نتمكن من تحديد موقعك. يمكنك السماح بالموقع أو اختيار منطقة يدويًا؛ لن نحسب مسافة دون إحداثيات.': 'We could not determine your location. You can allow location or choose an area manually; no distance will be calculated without coordinates.',
    'تم إلغاء الرحلة؛ التتبع متوقف.': 'The trip was cancelled; tracking is stopped.',
    'غير متاح': 'Unavailable',
    'حدّد موقعك لبدء محاكاة الاقتراب. لا تتم مشاركة موقعك دون إذنك.': 'Set your location to start the approach simulation. Your location is not shared without your permission.',
    'لم يشارك السائق موقعه بعد؛ لن يبدأ التتبع حتى يحدّث موقعه.': 'The driver has not shared a location yet; tracking will not start until they update it.',
    'الحالة': 'Status',
    'الوجهة': 'Destination',
    'الوقت المتوقع للوصول': 'Estimated time of arrival',
    'السيارة وصلت': 'Car arrived',
    'تم الصعود': 'Picked up',
    'في الطريق': 'On the way',
    'اكتملت الرحلة': 'Trip completed',
    'بدأت الرحلة إلى الجامعة. موقع السيارة والجامعة غير معروض لعدم توفر إحداثيات موثوقة.': 'The trip to the university has started. The car and university locations are not shown because reliable coordinates are unavailable.',
    'اكتملت الرحلة حسب المحاكاة التجريبية.': 'The trip completed according to the demo simulation.',
    'تم الصعود إلى السيارة. اضغط لبدء محاكاة الرحلة إلى الجامعة.': 'Picked up. Press to start the trip-to-university simulation.',
    'حدّث موقعك باستخدام زر GPS الموجود في هذه الصفحة لعرضه على المخطط.': 'Update your location using the GPS button on this page to show it on the map.',

    /* Remaining labels and map accessibility text */
    'تحديث': 'Refresh',
    'إلغاء': 'Cancel',
    'أهلاً،': 'Welcome,',
    'جامعة': 'University',
    'مقاعد الركاب': 'Passenger seats',
    'استعراض الرحلات': 'Browse trips',
    'المحادثة المحددة': 'Selected conversation',
    'تقييم من نجمة إلى خمس نجوم': 'Rating from one to five stars',
    'معاينة صورة الملف الشخصي': 'Profile photo preview',
    'خريطة إنترنت': 'Online map',
    'خريطة إنترنت لمسار الرحلة': 'Online map of the trip route',
    'خريطة توضيحية لمواقع الرحلات': 'Illustrative map of trip locations',
    'خريطة محاكاة مسار الرحلة': 'Trip route simulation map',
    'محاكاة توضيحية لمسار الرحلة': 'Illustrative trip route simulation',
    'مخطط توضيحي للمواقع المحفوظة': 'Illustrative map of saved locations',
    'خريطة إنترنت لموقع السائق': 'Online map of driver location',
    'مخطط توضيحي للموقع المحفوظ': 'Illustrative map of the saved location',
    'مخطط توضيحي لموقع السائق': 'Illustrative map of driver location',

    /* JS-generated messages: chat, driver, trips, profile, settings, maps */
    'تعذر تحميل مكتبة الاتصال الفوري.': 'Could not load the real-time connection library.',
    'تعذر تحديث الرسائل.': 'Could not refresh the messages.',
    'تعذر فتح المحادثة.': 'Could not open the conversation.',
    'تعذر تحميل المحادثات.': 'Could not load the conversations.',
    'تعذر تحميل الرسائل الأقدم.': 'Could not load older messages.',
    'تعذر تحديث المحادثات.': 'Could not refresh the conversations.',
    'مقاعد متاحة': 'Seats available',
    'السعر': 'Price',
    'النوع': 'Type',
    'قبول': 'Accept',
    'رفض': 'Reject',
    'تعديل': 'Edit',
    'تقييم': 'rating',
    'مستخدم': 'User',
    'لا توجد رحلات.': 'No trips.',
    'تحقق من بيانات الرحلة.': 'Check the trip details.',
    'لا يمكن إنشاء رحلة في وقت سابق.': 'A trip cannot be created for a past time.',
    'تم تحديث الرحلة.': 'Trip updated.',
    'تم إنشاء الرحلة.': 'Trip created.',
    'تعذر حفظ الرحلة.': 'Could not save the trip.',
    'دقيقة': 'min',
    'كم/ساعة': 'km/h',
    'من 5 نجوم': 'out of 5 stars',
    'تعذرت معالجة المتابعة.': 'Could not process the follow action.',
    'جارٍ الحظر...': 'Blocking...',
    'جارٍ إلغاء الحظر...': 'Unblocking...',
    'تم حظر المستخدم وإزالة المتابعة بينكما.': 'The user was blocked and the follow relationship was removed.',
    'تم إلغاء الحظر. لم تتم استعادة المتابعة السابقة.': 'Unblocked. The previous follow was not restored.',
    'تعذر تحديث حالة الحظر. حاول مرة أخرى.': 'Could not update the block status. Try again.',
    'اختر صورة JPEG أو PNG أو WebP لا تتجاوز 1 ميغابايت.': 'Choose a JPEG, PNG or WebP image up to 1 MB.',
    'تعذرت قراءة الصورة. حاول اختيار صورة أخرى.': 'Could not read the image. Try choosing another one.',
    'اسم المستخدم يجب أن يكون من 3 إلى 20 حرفًا إنجليزيًا أو رقمًا أو _.': 'The username must be 3 to 20 English letters, digits or _.',
    'اسم المستخدم مستخدم. اختاري اسمًا آخر.': 'The username is taken. Choose another one.',
    'تم حفظ الملف الشخصي.': 'Profile saved.',
    'تعذر حفظ التغييرات. حاول مجددًا.': 'Could not save the changes. Try again.',
    'لا يمكنك تقييم السائق قبل إكمال رحلة مؤكدة.': 'You cannot rate the driver before completing a confirmed trip.',
    'سبق أن قيّمت هذه الرحلة.': 'You already rated this trip.',
    'تم إرسال تقييمك.': 'Your rating was submitted.',
    'تعذر إرسال التقييم.': 'Could not submit the rating.',
    'يجب تسجيل الدخول بحساب راكب لإجراء الحجز.': 'You must sign in with a passenger account to book.',
    'الرحلة غير متاحة للحجز حالياً.': 'The trip is not currently available for booking.',
    'لا يمكنك حجز رحلتك الخاصة.': 'You cannot book your own trip.',
    'لديك طلب حجز قائم لهذه الرحلة.': 'You already have a pending booking for this trip.',
    'تم إرسال طلب الحجز بنجاح.': 'Booking request sent successfully.',
    'تعذر إرسال طلب الحجز.': 'Could not send the booking request.',
    '• محادثة مرتبطة بحجز': '• Conversation linked to a booking',
    'رسائل غير مقروءة': 'Unread messages',
    'إشعارات غير مقروءة': 'Unread notifications',
    '· سرعة تقديرية': '· Estimated speed',
    'لم نتمكن من تحديد موقعك. يمكنك السماح بالموقع من إعدادات المتصفح أو اختيار منطقة يدويًا.': 'We could not determine your location. You can allow location from browser settings or choose an area manually.',
    'معلومات تجريبية': 'Demo information'
  };

  /* Diacritic-insensitive lookup table built from EN. */
  var EN_NORM = {};
  Object.keys(EN).forEach(function (key) { EN_NORM[normalize(key)] = EN[key]; });

  /* Dynamic patterns translated on top of the exact dictionary. */
  var RULES = [
    [/^(.+) ← (.+)$/, '$1 → $2'],
    [/(\d+)\/(\d+) مقاعد/, '$1/$2 seats'],
    [/^(\d+) مقاعد متاحة$/, '$1 seats available'],
    [/^(\d+) مقاعد$/, '$1 seats'],
    [/^(\d+) متاح من (\d+)$/, '$1 available of $2'],
    [/^الركاب: (\d+) ذكور · (\d+) إناث$/, 'Passengers: $1 male · $2 female'],
    [/^(\d+) ذكور · (\d+) إناث · (\d+) مقاعد متاحة$/, '$1 male · $2 female · $3 seats available'],
    [/^(\d+) ذكور · (\d+) إناث$/, '$1 male · $2 female'],
    [/^من (\d+) تقييم$/, 'from $1 ratings'],
    [/^(\d+) تقييم$/, '$1 ratings'],
    [/^تبعد عنك تقريبًا (.+)$/, 'About $1 away'],
    [/^(.+) دقيقة$/, '$1 min'],
    [/^(\d+(?:\.\d+)?) كم$/, '$1 km'],
    [/^(\d+(?:\.\d+)?) م$/, '$1 m'],
    [/^آخر موقع محفوظ لهذا الجهاز: (.+)\. لا يتم إرسال تحديثات تلقائية\.$/, 'Last saved location for this device: $1. No automatic updates are sent.'],
    [/^محاكاة موقع السيارة على مسار توضيحي — آخر تحديث (.+)\.$/, 'Simulated car location on an illustrative route — last updated $1.'],
    [/^الرسائل، (.+) رسائل غير مقروءة$/, 'Messages, $1 unread'],
    [/^الإشعارات، (.+) غير مقروءة$/, 'Notifications, $1 unread'],
    [/^(\d+) رسائل غير مقروءة$/, '$1 unread'],
    [/^محادثة (.+)$/, 'Conversation $1'],
    [/^تاريخ الحظر: (.+)$/, 'Blocked on: $1'],
    [/^هل تريد إلغاء حظر (.+)\؟$/, 'Unblock $1?'],
    [/^الملف العام لـ (.+)\.$/, 'Public profile of $1.'],
    [/^أنت: (.+)$/, 'You: $1'],
    [/^(.+) من 5 نجوم$/, '$1 out of 5 stars'],
    [/^معلومات تجريبية$/, 'Demo information'],
    [/(\d+) مقاعد متاحة/g, '$1 seats available'],
    [/(\d+) مقاعد/g, '$1 seats'],
    [/^تبعد تقريبًا (.+) كم$/, 'About $1 km away'],
    [/^تبعد تقريبًا (.+) م$/, 'About $1 m away'],
    [/^تبعد تقريبًا (.+)$/, 'About $1 away'],
    [/^هل تريد حظر (.+)؟ سيمنع ذلك الرسائل الجديدة ويزيل المتابعة بينكما في الاتجاهين\. إلغاء الحظر لاحقًا لن يعيد المتابعة تلقائيًا\.$/, 'Block $1? This prevents new messages and removes the follow relationship between you in both directions. Unblocking later will not restore the follow automatically.'],
    [/^هل تريد إلغاء حظر (.+)؟ لن تُستعد علاقات المتابعة السابقة تلقائيًا\.$/, 'Unblock $1? Previous follow relationships will not be restored automatically.'],
    [/^هل أنت متأكد من حذف جميع إشعاراتك \((\d+)\)؟ لا يمكن التراجع عن هذا الإجراء\.$/, 'Are you sure you want to delete all your notifications ($1)? This action cannot be undone.'],
    [/^تعذر تنفيذ الطلب \((.+)\)\.?$/, 'Could not complete the request ($1).']
  ];

  /* Rebuild patterns without Arabic diacritics so they match normalized text. */
  RULES = RULES.map(function (rule) {
    var cleaned = rule[0].source.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');
    return [new RegExp(cleaned, rule[0].flags), rule[1]];
  });

  /* Applied to every text node in English mode (word-level replacements). */
  var SUBSTITUTIONS = [
    [/٠/g, '0'], [/١/g, '1'], [/٢/g, '2'], [/٣/g, '3'], [/٤/g, '4'],
    [/٥/g, '5'], [/٦/g, '6'], [/٧/g, '7'], [/٨/g, '8'], [/٩/g, '9'],
    [/←/g, '→'],
    [/د\.أ/g, 'JOD'],
    [/·/g, '·']
  ];

  /* Arabic month names (both Levantine and standard) -> English. */
  var MONTHS = {
    'كانون الثاني': 'January', 'يناير': 'January',
    'شباط': 'February', 'فبراير': 'February',
    'آذار': 'March', 'مارس': 'March',
    'نيسان': 'April', 'أبريل': 'April', 'ابريل': 'April',
    'أيار': 'May', 'مايو': 'May',
    'حزيران': 'June', 'يونيو': 'June',
    'تموز': 'July', 'يوليو': 'July',
    'آب': 'August', 'أغسطس': 'August',
    'أيلول': 'September', 'سبتمبر': 'September',
    'تشرين الأول': 'October', 'أكتوبر': 'October',
    'تشرين الثاني': 'November', 'نوفمبر': 'November',
    'كانون الأول': 'December', 'ديسمبر': 'December'
  };

  var ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt'];
  var originalText = new WeakMap();
  var originalAttrs = new WeakMap();
  var originalTitle = document.title;
  var locale = 'ar';
  var observer = null;

  function normalize(value) {
    return stripTashkeel(String(value || '')).replace(/\s+/g, ' ').trim();
  }

  function stripTashkeel(value) {
    return String(value || '').replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');
  }

  function has(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  function applyRules(value) {
    var out = value;
    for (var pass = 0; pass < 8; pass += 1) {
      var changed = false;
      for (var i = 0; i < RULES.length; i += 1) {
        var pattern = RULES[i][0];
        pattern.lastIndex = 0;
        if (pattern.test(out)) {
          pattern.lastIndex = 0;
          var next = out.replace(pattern, RULES[i][1]);
          if (next !== out) { out = next; changed = true; break; }
        }
      }
      if (!changed) break;
    }
    return out;
  }

  function translateString(source) {
    var key = normalize(source);
    if (!key) return null;
    if (has(EN_NORM, key)) return EN_NORM[key];
    var ruled = applyRules(key);
    return ruled === key ? null : ruled;
  }

  function applySubstitutions(value) {
    var out = value;
    for (var i = 0; i < SUBSTITUTIONS.length; i += 1) {
      out = out.replace(SUBSTITUTIONS[i][0], SUBSTITUTIONS[i][1]);
    }
    Object.keys(MONTHS).forEach(function (name) {
      if (out.indexOf(name) !== -1) out = out.split(name).join(MONTHS[name]);
    });
    return out;
  }

  /* Translate a raw text value while preserving surrounding whitespace. */
  function toEnglish(raw) {
    if (raw == null) return raw;
    if (!/\S/.test(raw)) return raw;
    var lead = (raw.match(/^\s*/) || [''])[0];
    var trail = (raw.match(/\s*$/) || [''])[0];
    var core = raw.slice(lead.length, raw.length - trail.length);
    var translated = translateString(core);
    if (translated == null) translated = core;
    return lead + applySubstitutions(translated) + trail;
  }

  function isScriptText(node) {
    var parent = node.parentElement;
    while (parent) {
      if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE' || parent.tagName === 'NOSCRIPT') return true;
      parent = parent.parentElement;
    }
    return false;
  }

  function translateTextNode(node) {
    if (!node || node.nodeType !== 3) return;
    if (isScriptText(node)) return;
    var current = node.data;
    if (!/\S/.test(current) && !originalText.has(node)) return;
    if (locale === 'en') {
      var source = originalText.has(node) ? originalText.get(node) : current;
      if (!originalText.has(node)) originalText.set(node, current);
      var next = toEnglish(source);
      if (next !== node.data) node.data = next;
    } else if (originalText.has(node)) {
      if (node.data !== originalText.get(node)) node.data = originalText.get(node);
      originalText.delete(node);
    }
  }

  function translateAttributes(element) {
    if (!element || element.nodeType !== 1) return;
    var stored = originalAttrs.get(element);
    for (var i = 0; i < ATTRIBUTES.length; i += 1) {
      var name = ATTRIBUTES[i];
      if (!element.hasAttribute(name)) continue;
      if (locale === 'en') {
        if (!stored) { stored = {}; originalAttrs.set(element, stored); }
        if (!has(stored, name)) stored[name] = element.getAttribute(name);
        var next = toEnglish(stored[name]);
        if (next !== element.getAttribute(name)) element.setAttribute(name, next);
      } else if (stored && has(stored, name)) {
        if (element.getAttribute(name) !== stored[name]) element.setAttribute(name, stored[name]);
        delete stored[name];
      }
    }
  }

  function walk(root) {
    translateAttributes(root);
    var textNodes = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var node = textNodes.nextNode();
    while (node) {
      translateTextNode(node);
      node = textNodes.nextNode();
    }
    var elements = root.querySelectorAll ? root.querySelectorAll('[placeholder],[title],[aria-label],[alt]') : [];
    for (var i = 0; i < elements.length; i += 1) translateAttributes(elements[i]);
  }

  function apply(root) {
    if (!root) return;
    walk(root);
  }

  function applyTitle() {
    if (locale === 'en') {
      var next = translateString(originalTitle);
      document.title = next == null ? applySubstitutions(originalTitle) : next;
    } else {
      document.title = originalTitle;
    }
  }

  function bindLanguageControls(root) {
    var scope = root || document;
    var controls = scope.querySelectorAll ? scope.querySelectorAll('input[name="language"]') : [];
    for (var i = 0; i < controls.length; i += 1) {
      var input = controls[i];
      input.disabled = false;
      input.checked = input.value === locale;
      if (!input.dataset.i18nBound) {
        input.dataset.i18nBound = '1';
        input.addEventListener('change', function () {
          if (this.checked) setLanguage(this.value);
        });
      }
    }
  }

  function setLanguage(next) {
    var value = SUPPORTED.indexOf(next) === -1 ? 'ar' : next;
    locale = value;
    try { localStorage.setItem(STORAGE_KEY, value); } catch (error) { /* storage may be unavailable */ }
    document.documentElement.lang = value === 'en' ? 'en' : 'ar';
    document.documentElement.dir = value === 'en' ? 'ltr' : 'rtl';
    document.documentElement.dataset.lang = value;
    applyTitle();
    if (document.body) apply(document.body);
    bindLanguageControls(document);
    window.dispatchEvent(new CustomEvent('darb:language-updated', { detail: { locale: value } }));
  }

  function readLanguage() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (SUPPORTED.indexOf(saved) !== -1) return saved;
    } catch (error) { /* ignore */ }
    return 'ar';
  }

  /* Keep native dialogs localized too. */
  var nativeConfirm = window.confirm.bind(window);
  window.confirm = function (message) {
    return nativeConfirm(locale === 'en' ? toEnglish(message) : message);
  };

  function startObserver() {
    if (observer || !document.body || typeof MutationObserver === 'undefined') return;
    observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i += 1) {
        var mutation = mutations[i];
        if (mutation.type === 'characterData') {
          translateTextNode(mutation.target);
        } else if (mutation.type === 'attributes') {
          translateAttributes(mutation.target);
        } else if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(function (node) {
            if (node.nodeType === 1) apply(node);
            else if (node.nodeType === 3) translateTextNode(node);
          });
        }
      }
      bindLanguageControls(document);
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRIBUTES
    });
  }

  locale = readLanguage();
  document.documentElement.lang = locale === 'en' ? 'en' : 'ar';
  document.documentElement.dir = locale === 'en' ? 'ltr' : 'rtl';
  document.documentElement.dataset.lang = locale;

  function boot() {
    applyTitle();
    if (document.body) apply(document.body);
    bindLanguageControls(document);
    startObserver();
  }

  D.i18n = {
    get locale() { return locale; },
    t: function (value) { return translateString(value); },
    text: toEnglish,
    apply: apply,
    setLanguage: setLanguage
  };
  D.setLanguage = setLanguage;

  window.addEventListener('storage', function (event) {
    if (event.key === STORAGE_KEY && SUPPORTED.indexOf(event.newValue) !== -1 && event.newValue !== locale) {
      setLanguage(event.newValue);
    }
  });

  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
