"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectDetailsSchema = exports.ProgressStageSchema = exports.ProjectAmenitySchema = exports.ProjectFaqSchema = exports.ProjectSectionSchema = exports.PROJECT_DETAIL_LIMITS = exports.AMENITY_GROUPS = exports.AMENITY_ICONS = void 0;
exports.overallProgress = overallProgress;
const zod_1 = require("zod");
exports.AMENITY_ICONS = [
    'pool', 'gym', 'garden', 'park', 'tree', 'playground', 'kids', 'security', 'cctv', 'parking',
    'elevator', 'clubhouse', 'mall', 'shop', 'restaurant', 'cafe', 'mosque', 'church', 'school',
    'university', 'hospital', 'clinic', 'pharmacy', 'bank', 'sea', 'lake', 'view', 'jogging', 'bike',
    'sports', 'tennis', 'football', 'spa', 'wifi', 'solar', 'smart-home', 'generator', 'hotel',
    'office', 'metro', 'road', 'airport', 'location', 'building', 'star', 'check',
];
exports.AMENITY_GROUPS = ['INSIDE', 'AROUND'];
exports.PROJECT_DETAIL_LIMITS = {
    sections: 20,
    sectionTitle: 120,
    sectionBody: 4000,
    faqs: 30,
    question: 300,
    answer: 3000,
    amenities: 40,
    amenityName: 120,
    stages: 15,
    stageName: 120,
};
const L = exports.PROJECT_DETAIL_LIMITS;
const text = (max) => zod_1.z.object({ ar: zod_1.z.string().max(max), en: zod_1.z.string().max(max) });
exports.ProjectSectionSchema = zod_1.z.object({ title: text(L.sectionTitle), body: text(L.sectionBody) });
exports.ProjectFaqSchema = zod_1.z.object({ question: text(L.question), answer: text(L.answer) });
exports.ProjectAmenitySchema = zod_1.z.object({
    name: text(L.amenityName),
    icon: zod_1.z.enum(exports.AMENITY_ICONS),
    group: zod_1.z.enum(exports.AMENITY_GROUPS),
});
exports.ProgressStageSchema = zod_1.z.object({ name: text(L.stageName), percent: zod_1.z.number().int().min(0).max(100) });
exports.ProjectDetailsSchema = zod_1.z.object({
    sections: zod_1.z.array(exports.ProjectSectionSchema).max(L.sections),
    faqs: zod_1.z.array(exports.ProjectFaqSchema).max(L.faqs),
    amenities: zod_1.z.array(exports.ProjectAmenitySchema).max(L.amenities),
    progressStages: zod_1.z.array(exports.ProgressStageSchema).max(L.stages),
});
function overallProgress(stages) {
    if (stages.length === 0)
        return null;
    return Math.round(stages.reduce((sum, s) => sum + s.percent, 0) / stages.length);
}
//# sourceMappingURL=project-details.js.map