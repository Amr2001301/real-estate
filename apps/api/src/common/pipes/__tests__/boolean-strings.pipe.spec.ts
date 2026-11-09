import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';
import { BooleanStringsPipe } from '../boolean-strings.pipe';

/** F-075: `?flag=false` and a string "false" used to read as true (implicit Boolean("false")). */
class Flags {
  @IsOptional() @IsBoolean() sales?: boolean;
  @IsOptional() @IsBoolean() finance?: boolean;
}
class Query {
  @IsOptional() @IsBoolean() withoutPlan?: boolean;
  @IsOptional() @IsBoolean() verified?: boolean;
}
class Body {
  @IsOptional() @ValidateNested() @Type(() => Flags) email?: Flags;
  @IsOptional() @IsBoolean() active?: boolean;
}

const pipeline = async (value: unknown, metatype: new () => object, type: 'query' | 'body' = 'query') => {
  const meta = { type, metatype } as never;
  const first = new BooleanStringsPipe().transform(value, meta);
  return new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
    transformOptions: { enableImplicitConversion: true },
  }).transform(first, meta);
};

describe('BooleanStringsPipe + ValidationPipe', () => {
  it('reads "false" and "0" as false, "true" and "1" as true (query strings)', async () => {
    expect(await pipeline({ withoutPlan: 'false' }, Query)).toMatchObject({ withoutPlan: false });
    expect(await pipeline({ withoutPlan: '0', verified: 'FALSE' }, Query)).toMatchObject({ withoutPlan: false, verified: false });
    expect(await pipeline({ withoutPlan: 'true', verified: '1' }, Query)).toMatchObject({ withoutPlan: true, verified: true });
  });
  it('refuses any other string for a boolean', async () => {
    await expect(pipeline({ withoutPlan: 'no' }, Query)).rejects.toBeInstanceOf(BadRequestException);
    await expect(pipeline({ active: 'maybe' }, Body, 'body')).rejects.toBeInstanceOf(BadRequestException);
  });
  it('keeps real booleans and leaves other fields alone', async () => {
    expect(await pipeline({ active: false }, Body, 'body')).toMatchObject({ active: false });
    expect(await pipeline({ active: true }, Body, 'body')).toMatchObject({ active: true });
    expect(await pipeline({}, Query)).toEqual({});
  });
  it('reaches a nested DTO (the notification preferences body)', async () => {
    const out = (await pipeline({ email: { finance: 'false', sales: true } }, Body, 'body')) as Body;
    expect(out.email?.finance).toBe(false);
    expect(out.email?.sales).toBe(true);
    await expect(pipeline({ email: { finance: 'no' } }, Body, 'body')).rejects.toBeInstanceOf(BadRequestException);
  });
  it('does nothing without a DTO class or for primitives', () => {
    const pipe = new BooleanStringsPipe();
    expect(pipe.transform('false', { type: 'query', metatype: String } as never)).toBe('false');
    expect(pipe.transform({ a: 'false' }, { type: 'body', metatype: undefined } as never)).toEqual({ a: 'false' });
  });
});
