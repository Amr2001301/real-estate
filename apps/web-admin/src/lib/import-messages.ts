/**
 * The import preview's row errors and warnings come from the API in English
 * (QA run 1, F-018). On the Arabic screen they are shown in Arabic: each pattern
 * below is one message the importer produces, with its quoted values carried
 * over. A message that matches nothing is shown as the API wrote it.
 */
type Rule = [RegExp, (m: RegExpMatchArray) => string];

const RULES: Rule[] = [
  [/^Unknown building "(.+)" in phase "(.+)" \/ project "(.+)"$/, (m) => `المبنى «${m[1]}» غير موجود في المرحلة «${m[2]}» / المشروع «${m[3]}»`],
  [/^Unknown phase "(.+)" in project "(.+)" — .*$/, (m) => `المرحلة «${m[1]}» غير موجودة في المشروع «${m[2]}» — أضفها في ورقة المراحل أو تأكد من وجودها`],
  [/^Unknown project code "(.+)" — .*$/, (m) => `رمز المشروع «${m[1]}» غير معروف — أنشئ المشروع أولًا أو أضفه في ورقة المشاريع`],
  [/^(.+) must be greater than 0$/, (m) => `${m[1]} يجب أن يكون أكبر من صفر`],
  [/^must be greater than 0$/, () => 'يجب أن يكون أكبر من صفر'],
  [/^Phone "(.+)" is not a recognised Egyptian mobile number\.?$/, (m) => `الرقم «${m[1]}» ليس رقم موبايل مصريًا معروفًا`],
  [/^Phone "(.+)" was normalised to "(.+)" but that number already exists.*$/, (m) => `الرقم «${m[1]}» تحوّل إلى «${m[2]}» وهذا الرقم موجود في النظام — اكتبه بالصيغة القياسية (01XXXXXXXXX) للتأكد من العميل`],
  [/^Phone "(.+)" was normalised to "(.+)"(?: — .*)?\.?$/, (m) => `الرقم «${m[1]}» تحوّل إلى «${m[2]}» — تأكد أنه الرقم الصحيح قبل الاستيراد`],
  [/^Phone "(.+)" belongs to a staff account.*$/, (m) => `الرقم «${m[1]}» لحساب موظف — الاستيراد يعدّل حسابات العملاء فقط`],
  [/^Phone "(.+)" belongs to a removed customer account.*$/, (m) => `الرقم «${m[1]}» لعميل محذوف — استعد العميل بدل استيراده من جديد`],
  [/^Duplicate phone "(.+)" within this sheet.*$/, (m) => `الرقم «${m[1]}» مكرر في الورقة — تُرفض كل الصفوف التي تشترك فيه`],
  [/^Duplicate email "(.+)" within this sheet$/, (m) => `البريد «${m[1]}» مكرر في الورقة`],
  [/^Duplicate unit code "(.+)" within building "(.+)" in this sheet$/, (m) => `رمز الوحدة «${m[1]}» مكرر داخل المبنى «${m[2]}» في الورقة`],
  [/^Duplicate code "(.+)" within this sheet.*$/, (m) => `الرمز «${m[1]}» مكرر في الورقة — يُرفض الصفان`],
  [/^Email "(.+)" is already used by another account$/, (m) => `البريد «${m[1]}» مستخدم في حساب آخر`],
  [/^Invalid email "(.+)"$/, (m) => `البريد «${m[1]}» غير صحيح`],
  [/^Unit code is required$/, () => 'رمز الوحدة مطلوب'],
  [/^Project code is required$/, () => 'رمز المشروع مطلوب'],
  [/^Phase code is required$/, () => 'رمز المرحلة مطلوب'],
  [/^Building code is required$/, () => 'رمز المبنى مطلوب'],
  [/^Code is required$/, () => 'الرمز مطلوب'],
  [/^Full name is required when creating a new (lead|customer)$/, (m) => (m[1] === 'lead' ? 'الاسم الكامل مطلوب عند إنشاء عميل محتمل جديد' : 'الاسم الكامل مطلوب عند إنشاء عميل جديد')],
  [/^(Area|Price|City|Unit type|Building name) is required when creating a new (unit|project|building)$/, (m) => `${({ Area: 'المساحة', Price: 'السعر', City: 'المدينة', 'Unit type': 'نوع الوحدة', 'Building name': 'اسم المبنى' } as Record<string, string>)[m[1]!]} مطلوب عند إنشاء ${({ unit: 'وحدة', project: 'مشروع', building: 'مبنى' } as Record<string, string>)[m[2]!]} جديد`],
  [/^Unit "(.+)" not found — .*$/, (m) => `الوحدة «${m[1]}» غير موجودة — لن تُربط الوحدة المهتم بها`],
  [/^Unit "(.+)" is locked.*$/, (m) => `الوحدة «${m[1]}» مقفلة — عليها عقد أو حجز فعّال، ولن يُطبَّق أي تغيير على هذا الصف`],
  [/^Sheet exceeds (.+)-row limit.*$/, (m) => `الورقة تتجاوز الحد الأقصى (${m[1]} صف)`],
  [/^Required columns? missing: (.+)$/, (m) => `أعمدة مطلوبة ناقصة: ${m[1]}`],
  [/^Invalid (?:unit |phase |building )?code "(.+)": .*$/, (m) => `الرمز «${m[1]}» غير صالح: من 2 إلى 64 حرفًا، حروف كبيرة وأرقام وشرطات فقط`],
  [/^Phone cell is stored as a Number.*$/, () => 'خلية الهاتف مخزّنة كرقم فضاع الصفر في أولها — اجعل العمود نصًا في إكسل قبل الاستيراد'],
  [/^(Code|Phase code|Building code|Unit code) cell is stored as a Number\..*$/, () => 'الخلية مخزّنة كرقم — اجعل العمود نصًا في إكسل قبل الاستيراد'],
];

export function translateImportMessage(message: string, locale: string): string {
  if (locale !== 'ar') return message;
  for (const [re, fn] of RULES) {
    const m = message.match(re);
    if (m) return fn(m);
  }
  return message;
}
