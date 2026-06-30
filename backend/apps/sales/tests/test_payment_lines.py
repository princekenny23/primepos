from decimal import Decimal
from types import SimpleNamespace

from django.test import SimpleTestCase

from apps.sales.serializers import SaleSerializer


class StubSale:
    def __init__(self):
        self.pk = 1
        self.id = 1
        self.tenant = SimpleNamespace(id=1, pk=1)
        self.outlet = SimpleNamespace(
            id=1,
            pk=1,
            name="Main Outlet",
            address="",
            phone="",
            email="",
            is_active=True,
        )
        self.user = None
        self.shift = None
        self.customer = None
        self.till = None
        self.receipt_number = "1001"
        self.subtotal = Decimal("36000.00")
        self.tax = Decimal("0.00")
        self.discount = Decimal("0.00")
        self.total = Decimal("36000.00")
        self.payment_method = "mixed"
        self.payment_lines = [
            {
                "payment_method": "national_bank",
                "amount": Decimal("20000.00"),
                "other_payment_method_name": None,
            },
            {
                "payment_method": "airtel",
                "amount": Decimal("16000.00"),
                "other_payment_method_name": None,
            },
        ]
        self.status = "completed"
        self.is_void = False
        self.void_reason = ""
        self.cash_received = Decimal("0.00")
        self.change_given = Decimal("0.00")
        self.due_date = None
        self.amount_paid = Decimal("36000.00")
        self.payment_status = "paid"
        self.delivery_required = False
        self.cash_amount = Decimal("0.00")
        self.card_amount = Decimal("0.00")
        self.mobile_amount = Decimal("0.00")
        self.bank_transfer_amount = Decimal("0.00")
        self.other_amount = Decimal("0.00")
        self.tab_amount = Decimal("0.00")
        self.credit_amount = Decimal("0.00")
        self.table = None
        self.table_id = None
        self.guests = None
        self.priority = "normal"
        self.notes = ""
        self.items = []
        self.kitchen_tickets = SimpleNamespace(all=lambda: [])
        self.created_at = None
        self.updated_at = None


class SaleSerializerPaymentLinesTests(SimpleTestCase):
    def test_payment_lines_are_serialized_with_normalized_amounts(self):
        sale = StubSale()

        serializer = SaleSerializer(sale)
        data = serializer.data

        self.assertEqual(data["payment_lines"][0]["payment_method"], "national_bank")
        self.assertEqual(data["payment_lines"][0]["amount"], "20000.00")
        self.assertEqual(data["payment_lines"][1]["payment_method"], "airtel")
        self.assertEqual(data["payment_lines"][1]["amount"], "16000.00")
