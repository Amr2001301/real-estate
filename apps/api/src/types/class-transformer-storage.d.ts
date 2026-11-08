/** class-transformer ships this module without a declaration; only the type lookup is used (boolean-strings.pipe). */
declare module 'class-transformer/cjs/storage' {
  export const defaultMetadataStorage: {
    findTypeMetadata(target: new () => object, propertyName: string): { typeFunction: () => unknown } | undefined;
  };
}
