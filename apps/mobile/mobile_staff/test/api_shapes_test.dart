import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/contracts/data/dtos/contract_dtos.dart';
import 'package:mobile_staff/features/deposits/data/dtos/staff_deposit_dto.dart';
import 'package:mobile_staff/features/reservations/data/dtos/reservation_dtos.dart';

/// Responses in the API's real shape: money and other decimals arrive as
/// strings, and a reservation's `notes` is its own text while the notes
/// thread is `reservationNotes`. These pages used to open on «حدث خطأ غير
/// متوقع» for any reservation with a note, any contract with a plan and any
/// payment.
void main() {
  test('a reservation with its own note and a notes thread', () {
    final dto = ReservationDetailDto.fromJson({
      'id': 'r1',
      'reservationNumber': 'RES-2026-0005',
      'status': 'CONVERTED',
      'notes': 'حجز وحدة سكنية',
      'bookingAmount': '100000',
      'snapshotMonthlyInstallment': '70709.33',
      'expiresAt': '2026-11-08T19:45:42.255Z',
      'createdAt': '2026-10-21T08:00:00.000Z',
      'installmentPlanTemplate': {'id': 'p1', 'name': 'خطة 5 سنوات', 'status': 'ACTIVE', 'reservationAmount': '100000'},
      'reservationNotes': [
        {
          'id': 'n1',
          'body': 'العميل طلب يأجل الدفعة',
          'author': {'fullName': 'محمود البنا'},
          'createdAt': '2026-10-22T08:00:00.000Z',
        },
      ],
      'activities': [
        {'id': 'a1', 'type': 'CREATED', 'note': null, 'createdAt': '2026-10-21T08:00:00.000Z'},
      ],
    });
    expect(dto.reservation.id, 'r1');
    expect(dto.notes.single.body, 'العميل طلب يأجل الدفعة');
    expect(dto.notes.single.authorName, 'محمود البنا');
    expect(dto.activities.single.status, 'CREATED');
    expect(dto.planName, 'خطة 5 سنوات');
  });

  test('a contract whose plan amounts are decimal strings', () {
    final dto = StaffContractDetailDto.fromJson({
      'id': 'c1',
      'contractNumber': 'CON-2026-0026',
      'totalAmount': '6880000',
      'downPayment': '688000',
      'signedAt': '2026-11-01T08:00:00.000Z',
      'createdAt': '2026-10-31T08:00:00.000Z',
      'status': 'SIGNED',
      'customer': {'id': 'u1', 'fullName': 'خالد غالي', 'phone': '+201009900005'},
      'unit': {'id': 'x1', 'code': 'DF-NG-B01-202', 'type': '2BR', 'price': '6880000'},
      'installmentPlan': {
        'totalMonths': 36,
        'monthlyAmount': '169222.22',
        'installments': [
          {
            'id': 'i1',
            'type': 'DOWN_PAYMENT',
            'dueDate': '2026-11-01T00:00:00.000Z',
            'amount': '688000',
            'status': 'PENDING',
          },
        ],
      },
    });
    expect(dto.installmentPlanMonths, 36);
    expect(dto.installmentPlanMonthlyAmount, 169222.22);
    expect(dto.installments, hasLength(1));
  });

  test('a payment whose amount is a decimal string', () {
    final dto = StaffDepositDto.fromJson({
      'id': 'd1',
      'type': 'INSTALLMENT',
      'amount': '113222.22',
      'paidAt': '2026-11-01T18:45:36.245Z',
      'createdAt': '2026-11-01T18:45:36.245Z',
      'verified': false,
      'reviewStatus': 'PENDING_REVIEW',
      'paymentMethod': 'CHEQUE',
      'contract': {
        'id': 'c1',
        'contractNumber': 'CON-2026-0008',
        'customer': {'fullName': 'وليد حنا'},
      },
    });
    expect(dto.amount, 113222.22);
  });
}
