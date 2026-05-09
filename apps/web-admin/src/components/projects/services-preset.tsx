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

export function findPreset(ar: string): ServicePreset | undefined {
  return SERVICE_PRESETS.find((s) => s.ar === ar);
}
