import 'reflect-metadata';
import { BadRequestException, Body, Controller, ForbiddenException, Get, INestApplication, Module, NotFoundException, Post, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsNumber, Min } from 'class-validator';
import request from 'supertest';
import { LocalizedErrorFilter, arabicException, wantsArabic } from '../localized-error.filter';

class AmountDto {
  @IsNumber() @Min(0.01) amount!: number;
}

@Controller('t')
class TController {
  @Get('missing') missing() {
    throw new NotFoundException('Commission not found');
  }
  @Get('forbidden') forbidden() {
    throw new ForbiddenException({ message: 'Company access disabled', code: 'COMPANY_NOT_ACTIVE' });
  }
  @Get('arabic') arabic() {
    throw new BadRequestException('الصفحة غير موجودة');
  }
  @Get('boom') boom(): never {
    throw new Error('database exploded');
  }
  @Post('amount') amount(@Body() dto: AmountDto) {
    return dto;
  }
}

@Module({ controllers: [TController] })
class TModule {}

describe('LocalizedErrorFilter (F-023)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [TModule] }).compile();
    app = mod.createNestApplication();
    app.useGlobalFilters(new LocalizedErrorFilter(app.getHttpAdapter()));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
  });
  afterAll(() => app.close());

  it('answers in English when the client does not ask for Arabic', async () => {
    const res = await request(app.getHttpServer()).get('/t/missing').expect(404);
    expect(res.body.message).toBe('Commission not found');
    const en = await request(app.getHttpServer()).get('/t/missing').set('Accept-Language', 'en').expect(404);
    expect(en.body.message).toBe('Commission not found');
  });

  it('answers in Arabic for Accept-Language: ar, keeping the status and the other fields', async () => {
    const res = await request(app.getHttpServer()).get('/t/missing').set('Accept-Language', 'ar-EG,ar;q=0.9').expect(404);
    expect(res.body.message).toBe('العمولة غير موجودة');
    const forbidden = await request(app.getHttpServer()).get('/t/forbidden').set('Accept-Language', 'ar').expect(403);
    expect(forbidden.body.message).toBe('الدخول إلى الشركة معطّل');
    expect(forbidden.body.code).toBe('COMPANY_NOT_ACTIVE');
  });

  it('X-Locale wins over Accept-Language', async () => {
    const res = await request(app.getHttpServer()).get('/t/missing').set('Accept-Language', 'en').set('X-Locale', 'ar').expect(404);
    expect(res.body.message).toBe('العمولة غير موجودة');
  });

  it('translates every message of a validation error', async () => {
    const res = await request(app.getHttpServer()).post('/t/amount').set('Accept-Language', 'ar').send({ amount: 0, extra: 1 }).expect(400);
    expect(res.body.message).toEqual(expect.arrayContaining(['الحقل extra غير مسموح به', 'amount يجب ألا يقل عن 0.01']));
    const en = await request(app.getHttpServer()).post('/t/amount').send({ amount: 0 }).expect(400);
    expect(en.body.message).toEqual(['amount must not be less than 0.01']);
  });

  it('answers an unexpected error as a 500 in Arabic (and in English without the header)', async () => {
    const ar = await request(app.getHttpServer()).get('/t/boom').set('Accept-Language', 'ar').expect(500);
    expect(ar.body.message).toBe('حدث خطأ غير متوقع، حاول مرة أخرى');
    const en = await request(app.getHttpServer()).get('/t/boom').expect(500);
    expect(en.body.message).toBe('Internal server error');
  });

  it('leaves an Arabic message alone', async () => {
    const res = await request(app.getHttpServer()).get('/t/arabic').set('Accept-Language', 'ar').expect(400);
    expect(res.body.message).toBe('الصفحة غير موجودة');
  });
});

describe('wantsArabic / arabicException', () => {
  it('reads the headers', () => {
    expect(wantsArabic({ 'accept-language': 'ar' })).toBe(true);
    expect(wantsArabic({ 'accept-language': 'en-US,en;q=0.9,ar;q=0.8' })).toBe(false);
    expect(wantsArabic({ 'x-locale': 'ar', 'accept-language': 'en' })).toBe(true);
    expect(wantsArabic({})).toBe(false);
  });
  it('keeps the status of the exception', () => {
    const e = arabicException(new NotFoundException('Commission not found'));
    expect(e.getStatus()).toBe(404);
  });
});
