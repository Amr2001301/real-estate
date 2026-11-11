import { z } from 'zod';
import { TranslatableSchema } from './translatable';
export declare const AMENITY_ICONS: readonly ["pool", "gym", "garden", "park", "tree", "playground", "kids", "security", "cctv", "parking", "elevator", "clubhouse", "mall", "shop", "restaurant", "cafe", "mosque", "church", "school", "university", "hospital", "clinic", "pharmacy", "bank", "sea", "lake", "view", "jogging", "bike", "sports", "tennis", "football", "spa", "wifi", "solar", "smart-home", "generator", "hotel", "office", "metro", "road", "airport", "location", "building", "star", "check"];
export type AmenityIcon = (typeof AMENITY_ICONS)[number];
export declare const AMENITY_GROUPS: readonly ["INSIDE", "AROUND"];
export type AmenityGroup = (typeof AMENITY_GROUPS)[number];
export declare const PROJECT_DETAIL_LIMITS: {
    readonly sections: 20;
    readonly sectionTitle: 120;
    readonly sectionBody: 4000;
    readonly faqs: 30;
    readonly question: 300;
    readonly answer: 3000;
    readonly amenities: 40;
    readonly amenityName: 120;
    readonly stages: 15;
    readonly stageName: 120;
};
export declare const ProjectSectionSchema: z.ZodObject<{
    title: z.ZodObject<{
        ar: z.ZodString;
        en: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        ar: string;
        en: string;
    }, {
        ar: string;
        en: string;
    }>;
    body: z.ZodObject<{
        ar: z.ZodString;
        en: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        ar: string;
        en: string;
    }, {
        ar: string;
        en: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        ar: string;
        en: string;
    };
    title: {
        ar: string;
        en: string;
    };
}, {
    body: {
        ar: string;
        en: string;
    };
    title: {
        ar: string;
        en: string;
    };
}>;
export declare const ProjectFaqSchema: z.ZodObject<{
    question: z.ZodObject<{
        ar: z.ZodString;
        en: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        ar: string;
        en: string;
    }, {
        ar: string;
        en: string;
    }>;
    answer: z.ZodObject<{
        ar: z.ZodString;
        en: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        ar: string;
        en: string;
    }, {
        ar: string;
        en: string;
    }>;
}, "strip", z.ZodTypeAny, {
    question: {
        ar: string;
        en: string;
    };
    answer: {
        ar: string;
        en: string;
    };
}, {
    question: {
        ar: string;
        en: string;
    };
    answer: {
        ar: string;
        en: string;
    };
}>;
export declare const ProjectAmenitySchema: z.ZodObject<{
    name: z.ZodObject<{
        ar: z.ZodString;
        en: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        ar: string;
        en: string;
    }, {
        ar: string;
        en: string;
    }>;
    icon: z.ZodEnum<["pool", "gym", "garden", "park", "tree", "playground", "kids", "security", "cctv", "parking", "elevator", "clubhouse", "mall", "shop", "restaurant", "cafe", "mosque", "church", "school", "university", "hospital", "clinic", "pharmacy", "bank", "sea", "lake", "view", "jogging", "bike", "sports", "tennis", "football", "spa", "wifi", "solar", "smart-home", "generator", "hotel", "office", "metro", "road", "airport", "location", "building", "star", "check"]>;
    group: z.ZodEnum<["INSIDE", "AROUND"]>;
}, "strip", z.ZodTypeAny, {
    name: {
        ar: string;
        en: string;
    };
    icon: "building" | "location" | "view" | "pool" | "gym" | "garden" | "park" | "tree" | "playground" | "kids" | "security" | "cctv" | "parking" | "elevator" | "clubhouse" | "mall" | "shop" | "restaurant" | "cafe" | "mosque" | "church" | "school" | "university" | "hospital" | "clinic" | "pharmacy" | "bank" | "sea" | "lake" | "jogging" | "bike" | "sports" | "tennis" | "football" | "spa" | "wifi" | "solar" | "smart-home" | "generator" | "hotel" | "office" | "metro" | "road" | "airport" | "star" | "check";
    group: "INSIDE" | "AROUND";
}, {
    name: {
        ar: string;
        en: string;
    };
    icon: "building" | "location" | "view" | "pool" | "gym" | "garden" | "park" | "tree" | "playground" | "kids" | "security" | "cctv" | "parking" | "elevator" | "clubhouse" | "mall" | "shop" | "restaurant" | "cafe" | "mosque" | "church" | "school" | "university" | "hospital" | "clinic" | "pharmacy" | "bank" | "sea" | "lake" | "jogging" | "bike" | "sports" | "tennis" | "football" | "spa" | "wifi" | "solar" | "smart-home" | "generator" | "hotel" | "office" | "metro" | "road" | "airport" | "star" | "check";
    group: "INSIDE" | "AROUND";
}>;
export declare const ProgressStageSchema: z.ZodObject<{
    name: z.ZodObject<{
        ar: z.ZodString;
        en: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        ar: string;
        en: string;
    }, {
        ar: string;
        en: string;
    }>;
    percent: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: {
        ar: string;
        en: string;
    };
    percent: number;
}, {
    name: {
        ar: string;
        en: string;
    };
    percent: number;
}>;
export declare const ProjectDetailsSchema: z.ZodObject<{
    sections: z.ZodArray<z.ZodObject<{
        title: z.ZodObject<{
            ar: z.ZodString;
            en: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            ar: string;
            en: string;
        }, {
            ar: string;
            en: string;
        }>;
        body: z.ZodObject<{
            ar: z.ZodString;
            en: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            ar: string;
            en: string;
        }, {
            ar: string;
            en: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        body: {
            ar: string;
            en: string;
        };
        title: {
            ar: string;
            en: string;
        };
    }, {
        body: {
            ar: string;
            en: string;
        };
        title: {
            ar: string;
            en: string;
        };
    }>, "many">;
    faqs: z.ZodArray<z.ZodObject<{
        question: z.ZodObject<{
            ar: z.ZodString;
            en: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            ar: string;
            en: string;
        }, {
            ar: string;
            en: string;
        }>;
        answer: z.ZodObject<{
            ar: z.ZodString;
            en: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            ar: string;
            en: string;
        }, {
            ar: string;
            en: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        question: {
            ar: string;
            en: string;
        };
        answer: {
            ar: string;
            en: string;
        };
    }, {
        question: {
            ar: string;
            en: string;
        };
        answer: {
            ar: string;
            en: string;
        };
    }>, "many">;
    amenities: z.ZodArray<z.ZodObject<{
        name: z.ZodObject<{
            ar: z.ZodString;
            en: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            ar: string;
            en: string;
        }, {
            ar: string;
            en: string;
        }>;
        icon: z.ZodEnum<["pool", "gym", "garden", "park", "tree", "playground", "kids", "security", "cctv", "parking", "elevator", "clubhouse", "mall", "shop", "restaurant", "cafe", "mosque", "church", "school", "university", "hospital", "clinic", "pharmacy", "bank", "sea", "lake", "view", "jogging", "bike", "sports", "tennis", "football", "spa", "wifi", "solar", "smart-home", "generator", "hotel", "office", "metro", "road", "airport", "location", "building", "star", "check"]>;
        group: z.ZodEnum<["INSIDE", "AROUND"]>;
    }, "strip", z.ZodTypeAny, {
        name: {
            ar: string;
            en: string;
        };
        icon: "building" | "location" | "view" | "pool" | "gym" | "garden" | "park" | "tree" | "playground" | "kids" | "security" | "cctv" | "parking" | "elevator" | "clubhouse" | "mall" | "shop" | "restaurant" | "cafe" | "mosque" | "church" | "school" | "university" | "hospital" | "clinic" | "pharmacy" | "bank" | "sea" | "lake" | "jogging" | "bike" | "sports" | "tennis" | "football" | "spa" | "wifi" | "solar" | "smart-home" | "generator" | "hotel" | "office" | "metro" | "road" | "airport" | "star" | "check";
        group: "INSIDE" | "AROUND";
    }, {
        name: {
            ar: string;
            en: string;
        };
        icon: "building" | "location" | "view" | "pool" | "gym" | "garden" | "park" | "tree" | "playground" | "kids" | "security" | "cctv" | "parking" | "elevator" | "clubhouse" | "mall" | "shop" | "restaurant" | "cafe" | "mosque" | "church" | "school" | "university" | "hospital" | "clinic" | "pharmacy" | "bank" | "sea" | "lake" | "jogging" | "bike" | "sports" | "tennis" | "football" | "spa" | "wifi" | "solar" | "smart-home" | "generator" | "hotel" | "office" | "metro" | "road" | "airport" | "star" | "check";
        group: "INSIDE" | "AROUND";
    }>, "many">;
    progressStages: z.ZodArray<z.ZodObject<{
        name: z.ZodObject<{
            ar: z.ZodString;
            en: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            ar: string;
            en: string;
        }, {
            ar: string;
            en: string;
        }>;
        percent: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: {
            ar: string;
            en: string;
        };
        percent: number;
    }, {
        name: {
            ar: string;
            en: string;
        };
        percent: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    sections: {
        body: {
            ar: string;
            en: string;
        };
        title: {
            ar: string;
            en: string;
        };
    }[];
    faqs: {
        question: {
            ar: string;
            en: string;
        };
        answer: {
            ar: string;
            en: string;
        };
    }[];
    amenities: {
        name: {
            ar: string;
            en: string;
        };
        icon: "building" | "location" | "view" | "pool" | "gym" | "garden" | "park" | "tree" | "playground" | "kids" | "security" | "cctv" | "parking" | "elevator" | "clubhouse" | "mall" | "shop" | "restaurant" | "cafe" | "mosque" | "church" | "school" | "university" | "hospital" | "clinic" | "pharmacy" | "bank" | "sea" | "lake" | "jogging" | "bike" | "sports" | "tennis" | "football" | "spa" | "wifi" | "solar" | "smart-home" | "generator" | "hotel" | "office" | "metro" | "road" | "airport" | "star" | "check";
        group: "INSIDE" | "AROUND";
    }[];
    progressStages: {
        name: {
            ar: string;
            en: string;
        };
        percent: number;
    }[];
}, {
    sections: {
        body: {
            ar: string;
            en: string;
        };
        title: {
            ar: string;
            en: string;
        };
    }[];
    faqs: {
        question: {
            ar: string;
            en: string;
        };
        answer: {
            ar: string;
            en: string;
        };
    }[];
    amenities: {
        name: {
            ar: string;
            en: string;
        };
        icon: "building" | "location" | "view" | "pool" | "gym" | "garden" | "park" | "tree" | "playground" | "kids" | "security" | "cctv" | "parking" | "elevator" | "clubhouse" | "mall" | "shop" | "restaurant" | "cafe" | "mosque" | "church" | "school" | "university" | "hospital" | "clinic" | "pharmacy" | "bank" | "sea" | "lake" | "jogging" | "bike" | "sports" | "tennis" | "football" | "spa" | "wifi" | "solar" | "smart-home" | "generator" | "hotel" | "office" | "metro" | "road" | "airport" | "star" | "check";
        group: "INSIDE" | "AROUND";
    }[];
    progressStages: {
        name: {
            ar: string;
            en: string;
        };
        percent: number;
    }[];
}>;
export type ProjectSection = z.infer<typeof ProjectSectionSchema>;
export type ProjectFaq = z.infer<typeof ProjectFaqSchema>;
export type ProjectAmenity = z.infer<typeof ProjectAmenitySchema>;
export type ProgressStage = z.infer<typeof ProgressStageSchema>;
export interface ProjectProgress {
    overall: number;
    stages: Array<{
        name: z.infer<typeof TranslatableSchema> | string;
        percent: number;
    }>;
    updatedAt: string | null;
}
export declare function overallProgress(stages: ReadonlyArray<{
    percent: number;
}>): number | null;
