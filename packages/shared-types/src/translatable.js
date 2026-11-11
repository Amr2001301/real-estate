"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslatableSchema = void 0;
exports.pickLocale = pickLocale;
const zod_1 = require("zod");
exports.TranslatableSchema = zod_1.z.object({
    ar: zod_1.z.string().min(1),
    en: zod_1.z.string().min(1),
});
function pickLocale(value, locale) {
    return value[locale] ?? value.en ?? value.ar;
}
//# sourceMappingURL=translatable.js.map