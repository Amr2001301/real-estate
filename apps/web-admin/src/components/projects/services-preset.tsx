import {
  Waves,
  Dumbbell,
  Trees,
  ShieldCheck,
  Car,
  Leaf,
  Baby,
  Users,
  Wifi,
  Sparkles,
  Utensils,
  ArrowUpDown,
  type LucideIcon,
} from 'lucide-react';

export interface ServicePreset {
  ar: string;
  en: string;
  icon: LucideIcon;
}

export const SERVICE_PRESETS: ServicePreset[] = [
  { ar: 'مسبح أولمبي', en: 'Olympic Pool', icon: Waves },
  { ar: 'نادي رياضي', en: 'Gym', icon: Dumbbell },
  { ar: 'حدائق خاصة', en: 'Private Gardens', icon: Trees },
  { ar: 'أمن 24 ساعة', en: '24/7 Security', icon: ShieldCheck },
  { ar: 'مواقف ذكية', en: 'Smart Parking', icon: Car },
  { ar: 'مساحات خضراء', en: 'Green Spaces', icon: Leaf },
  { ar: 'ملعب أطفال', en: "Kids Playground", icon: Baby },
  { ar: 'قاعات اجتماعات', en: 'Meeting Rooms', icon: Users },
  { ar: 'إنترنت عالي السرعة', en: 'High-Speed Internet', icon: Wifi },
  { ar: 'صالة سبا', en: 'Spa Lounge', icon: Sparkles },
  { ar: 'مطعم', en: 'Restaurant', icon: Utensils },
  { ar: 'مصاعد', en: 'Elevators', icon: ArrowUpDown },
];

// Free-typed services ("حمام سباحة", "نادي صحي") still get a fitting icon.
const KEYWORDS: Array<[RegExp, string]> = [
  [/مسبح|سباح|حمام سباحة|pool/i, 'مسبح أولمبي'],
  [/نادي|رياض|جيم|gym|fitness/i, 'نادي رياضي'],
  [/حدائق|حديقة|garden/i, 'حدائق خاصة'],
  [/أمن|امن|حراس|security/i, 'أمن 24 ساعة'],
  [/مواقف|جراج|parking/i, 'مواقف ذكية'],
  [/خضراء|green/i, 'مساحات خضراء'],
  [/أطفال|اطفال|kids|playground/i, 'ملعب أطفال'],
  [/اجتماع|meeting/i, 'قاعات اجتماعات'],
  [/إنترنت|انترنت|wi-?fi|internet/i, 'إنترنت عالي السرعة'],
  [/سبا|spa/i, 'صالة سبا'],
  [/مطعم|كافيه|مقهى|restaurant|cafe/i, 'مطعم'],
  [/مصاعد|مصعد|elevator|lift/i, 'مصاعد'],
];

export function findPreset(ar: string): ServicePreset | undefined {
  const exact = SERVICE_PRESETS.find((s) => s.ar === ar);
  if (exact) return exact;
  const hit = KEYWORDS.find(([re]) => re.test(ar));
  return hit ? SERVICE_PRESETS.find((s) => s.ar === hit[1]) : undefined;
}
