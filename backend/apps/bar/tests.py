from decimal import Decimal

from django.test import SimpleTestCase

from apps.bar.serializers import CloseTabSerializer


class CloseTabSerializerPaymentTests(SimpleTestCase):
    def test_accepts_single_payment_line_for_cash(self):
        serializer = CloseTabSerializer(
            data={
                "payment_method": "cash",
                "cash_received": "100.00",
                "payment_lines": [{"payment_method": "cash", "amount": "100.00"}],
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["payment_lines"][0]["payment_method"], "cash")
        self.assertEqual(serializer.validated_data["payment_lines"][0]["amount"], Decimal("100.00"))

    def test_accepts_split_payment_lines(self):
        serializer = CloseTabSerializer(
            data={
                "payment_method": "mixed",
                "payment_lines": [
                    {"payment_method": "cash", "amount": "60.00"},
                    {"payment_method": "card", "amount": "40.00"},
                ],
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["payment_method"], "mixed")
        self.assertEqual(len(serializer.validated_data["payment_lines"]), 2)
