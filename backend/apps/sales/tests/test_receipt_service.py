from decimal import Decimal
from types import SimpleNamespace
from django.test import SimpleTestCase
from django.utils import timezone

from apps.sales.services import ReceiptService


class ReceiptServicePdfGenerationTests(SimpleTestCase):
    def test_generate_pdf_receipt_returns_pdf_bytes(self):
        sale = SimpleNamespace(
            receipt_number="1001",
            created_at=timezone.now(),
            user=None,
            customer=None,
            subtotal=Decimal("10.00"),
            tax=Decimal("0.00"),
            discount=Decimal("0.00"),
            total=Decimal("10.00"),
            cash_received=Decimal("10.00"),
            change_given=Decimal("0.00"),
            get_payment_method_display=lambda: "Cash",
            items=SimpleNamespace(all=lambda: []),
            tenant=SimpleNamespace(name="Acme Store", currency="MWK"),
            outlet=SimpleNamespace(name="Main Outlet", address="", phone="", email="", settings={}),
        )

        buffer = ReceiptService._generate_pdf_receipt(sale)

        self.assertTrue(buffer.getvalue().startswith(b"%PDF"))

    def test_encode_decode_pdf_content_roundtrip(self):
        pdf_bytes = b"%PDF-1.4\n%\xE2\xE3\xCF\xD3\ntest content"
        
        encoded = ReceiptService._encode_pdf_content(pdf_bytes)
        self.assertTrue(encoded.startswith(ReceiptService._PDF_CONTENT_PREFIX))
        
        decoded = ReceiptService.decode_pdf_content(encoded)
        self.assertEqual(decoded, pdf_bytes)
