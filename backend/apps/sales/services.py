"""
Receipt generation service
Handles creation and formatting of digital receipts
Supports: PDF (for download/view) and ESC/POS (for thermal printing)
"""
import logging
import hashlib
from django.template import engines, TemplateSyntaxError
from django.core.files.base import ContentFile
import json
from django.utils import timezone
from decimal import Decimal
from typing import List
import re
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image as RLImage
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
import base64
from .models import Sale, Receipt
from apps.tenants.models import Tenant
from apps.accounts.models import User

logger = logging.getLogger(__name__)

# Compatibility patch: some OpenSSL builds do not support md5(usedforsecurity=...)
_orig_md5 = hashlib.md5

def _md5_compat(*args, **kwargs):
    kwargs.pop('usedforsecurity', None)
    return _orig_md5(*args, **kwargs)

_needs_md5_compat = False
try:
    _orig_md5(usedforsecurity=False)
except TypeError:
    _needs_md5_compat = True

if _needs_md5_compat:
    hashlib.md5 = _md5_compat
    try:
        from reportlab.pdfbase import pdfdoc as _pdfdoc
        _pdfdoc.md5 = _md5_compat
    except Exception:
        pass
    try:
        from reportlab.lib import utils as _rl_utils
        if hasattr(_rl_utils, 'md5'):
            _rl_utils.md5 = _md5_compat
    except Exception:
        pass


class ReceiptService:
    """Service for generating and managing digital receipts"""
    
    @staticmethod
    def generate_receipt(sale: Sale, format: str = 'pdf', user: User = None) -> Receipt:
        """
        Generate and save a receipt for a sale
        
        Args:
            sale: The Sale instance
            format: Receipt format ('pdf' or 'escpos')
            user: User who generated the receipt (defaults to sale.user)
        
        Returns:
            Receipt instance
        """
        try:
            # If a current receipt with the requested format already exists, return it.
            existing_same_format = Receipt.objects.filter(sale=sale, format=format, is_current=True, voided=False).first()
            if existing_same_format:
                logger.info(f"Found current receipt for sale {sale.id} format={format} -> receipt={existing_same_format.id}")
                return existing_same_format

            # Get user
            if not user:
                user = sale.user

            content = None
            pdf_file = None

            # Generate receipt content based on format
            if format == 'pdf':
                # Generate PDF and store as file
                pdf_buffer = ReceiptService._generate_pdf_receipt(sale)
                pdf_file = ContentFile(pdf_buffer.read(), name=f"receipt_{sale.receipt_number}.pdf")
                pdf_buffer.close()
            elif format == 'escpos':
                # Return base64-encoded ESC/POS bytes as text payload
                content = ReceiptService._generate_escpos_receipt(sale)
            else:
                # Default to PDF
                pdf_buffer = ReceiptService._generate_pdf_receipt(sale)
                pdf_file = ContentFile(pdf_buffer.read(), name=f"receipt_{sale.receipt_number}.pdf")
                pdf_buffer.close()
                format = 'pdf'
            
            # Create a new Receipt record (immutable once created)
            # Mark any existing current receipts for this sale+format as not current and voided
            previous = Receipt.objects.filter(sale=sale, format=format, is_current=True, voided=False)
            if previous.exists():
                previous.update(is_current=False, voided=True)

            receipt = Receipt.objects.create(
                tenant=sale.tenant,
                sale=sale,
                receipt_number=sale.receipt_number,
                format=format,
                content=content or '',
                pdf_file=pdf_file,
                generated_by=user,
            )

            logger.info(f"Receipt generated for sale {sale.id}: {receipt.id} format={format} by user={getattr(user, 'id', None)}")
            return receipt
            
        except Exception as e:
            logger.error(f"Error generating receipt for sale {sale.id}: {str(e)}", exc_info=True)
            raise
    
    @staticmethod
    def _generate_pdf_receipt(sale: Sale) -> BytesIO:
        """Generate PDF receipt using ReportLab"""
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer, 
            pagesize=A4, 
            rightMargin=20*mm, 
            leftMargin=20*mm, 
            topMargin=20*mm, 
            bottomMargin=20*mm
        )
        
        # Container for PDF elements
        elements = []
        styles = getSampleStyleSheet()
        
        # Get business/outlet information
        business_name = sale.tenant.name if sale.tenant else "Business"
        outlet = sale.outlet
        outlet_name = outlet.name if outlet else ""
        outlet_address = outlet.address if outlet and outlet.address else ""
        outlet_phone = outlet.phone if outlet and outlet.phone else ""
        outlet_email = outlet.email if outlet and outlet.email else ""
        
        # Get currency
        currency = sale.tenant.currency if sale.tenant and sale.tenant.currency else "MWK"
        
        # Title Style
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor('#1e3a8a'),
            alignment=TA_CENTER,
            spaceAfter=12,
        )
        
        elements.append(Paragraph(business_name.upper(), title_style))
        
        if outlet_name:
            elements.append(Paragraph(outlet_name, ParagraphStyle(
                'outlet', parent=styles['Normal'], fontSize=10, alignment=TA_CENTER
            )))
        if outlet_address:
            elements.append(Paragraph(outlet_address, ParagraphStyle(
                'address', parent=styles['Normal'], fontSize=9, alignment=TA_CENTER
            )))
        if outlet_phone:
            elements.append(Paragraph(f"Tel: {outlet_phone}", ParagraphStyle(
                'phone', parent=styles['Normal'], fontSize=9, alignment=TA_CENTER
            )))
        if outlet_email:
            elements.append(Paragraph(f"Email: {outlet_email}", ParagraphStyle(
                'email', parent=styles['Normal'], fontSize=9, alignment=TA_CENTER
            )))
        
        elements.append(Spacer(1, 12))
        
        # Receipt Info
        info_data = [
            ['Receipt #:', sale.receipt_number],
            ['Date:', sale.created_at.strftime('%Y-%m-%d %H:%M:%S')],
        ]
        
        # Add cashier info - ensure it's always shown if user exists
        if sale.user:
            # Try to get full name, fall back to first_name + last_name, then email, then username
            cashier_name = None
            if hasattr(sale.user, 'get_full_name'):
                full_name = sale.user.get_full_name()
                if full_name and full_name.strip():
                    cashier_name = full_name.strip()
            
            if not cashier_name and hasattr(sale.user, 'first_name') and hasattr(sale.user, 'last_name'):
                first = (sale.user.first_name or '').strip()
                last = (sale.user.last_name or '').strip()
                if first or last:
                    cashier_name = f"{first} {last}".strip()
            
            if not cashier_name and hasattr(sale.user, 'email') and sale.user.email:
                cashier_name = sale.user.email
            
            if not cashier_name and hasattr(sale.user, 'username') and sale.user.username:
                cashier_name = sale.user.username
            
            if cashier_name:
                info_data.append(['Cashier:', cashier_name])
        
        info_table = Table(info_data, colWidths=[40*mm, 120*mm])
        info_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.grey),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ]))
        elements.append(info_table)
        elements.append(Spacer(1, 12))
        
        # Customer info (show Walk-in if no customer)
        elements.append(Paragraph('CUSTOMER', ParagraphStyle(
            'customer_header', parent=styles['Heading2'], fontSize=12, textColor=colors.HexColor('#1e3a8a')
        )))

        customer_data = []
        if sale.customer:
            customer_data.append(['Name:', sale.customer.name or 'Walk-in'])
            if sale.customer.phone:
                customer_data.append(['Phone:', sale.customer.phone])
            if sale.customer.email:
                customer_data.append(['Email:', sale.customer.email])
        else:
            customer_data.append(['Name:', 'Walk-in'])

        customer_table = Table(customer_data, colWidths=[40*mm, 120*mm])
        customer_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.grey),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f3f4f6')),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(customer_table)
        elements.append(Spacer(1, 12))
        
        # Items
        elements.append(Paragraph('ITEMS', ParagraphStyle(
            'items_header', parent=styles['Heading2'], fontSize=12, textColor=colors.HexColor('#1e3a8a')
        )))
        
        items_data = [['Item', 'Qty', 'Price', 'Total']]
        
        for item in sale.items.all():
            base_name = item.product_name or (item.product.name if item.product else "Item")
            item_name = base_name
            if item.unit_name:
                item_name = f"{item_name} {item.unit_name}"

            safe_qty = item.quantity or 0
            safe_price = item.price or Decimal('0')
            safe_total = item.total or (safe_price * Decimal(safe_qty))

            items_data.append([
                item_name,
                str(safe_qty),
                f"{currency} {safe_price:,.2f}",
                f"{currency} {safe_total:,.2f}"
            ])
        
        items_table = Table(items_data, colWidths=[80*mm, 25*mm, 30*mm, 35*mm])
        items_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a8a')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (1, 0), (1, -1), 'CENTER'),
            ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9fafb')]),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(items_table)
        elements.append(Spacer(1, 12))
        
        # Totals
        totals_data = [
            ['Subtotal:', f"{currency} {sale.subtotal:,.2f}"],
        ]
        
        if sale.tax and sale.tax > 0:
            totals_data.append(['Tax:', f"{currency} {sale.tax:,.2f}"])
        
        if sale.discount and sale.discount > 0:
            totals_data.append(['Discount:', f"-{currency} {sale.discount:,.2f}"])
        
        totals_data.append(['TOTAL:', f"{currency} {sale.total:,.2f}"])
        totals_data.append(['Payment Method:', sale.get_payment_method_display()])
        
        if sale.cash_received:
            totals_data.append(['Cash Received:', f"{currency} {sale.cash_received:,.2f}"])
        
        if sale.change_given and sale.change_given > 0:
            totals_data.append(['Change:', f"{currency} {sale.change_given:,.2f}"])
        
        totals_table = Table(totals_data, colWidths=[80*mm, 80*mm])
        totals_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -2), 9),
            ('FONTSIZE', (0, -2), (-1, -1), 10),
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('TEXTCOLOR', (0, -2), (-1, -1), colors.HexColor('#1e3a8a')),
            ('FONTNAME', (0, -2), (-1, -2), 'Helvetica-Bold'),
            ('LINEABOVE', (0, -2), (-1, -2), 2, colors.HexColor('#1e3a8a')),
            ('PADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(totals_table)
        elements.append(Spacer(1, 20))
        
        # Footer
        footer_style = ParagraphStyle(
            'footer',
            parent=styles['Normal'],
            fontSize=9,
            alignment=TA_CENTER,
            textColor=colors.grey,
        )
        elements.append(Paragraph('Thank you for your business!', footer_style))
        elements.append(Paragraph('Powered by PRIMEPOS +265 997575865', footer_style))
        
        # Build PDF
        doc.build(elements)
        buffer.seek(0)
        return buffer

    @staticmethod
    def _generate_escpos_receipt(sale: Sale, paper_width: str = 'auto', printer_name: str = '') -> str:
        """Build a minimal ESC/POS byte payload for thermal printers and return base64-encoded string.

        The backend does NOT send this to any printer. The frontend should request a receipt
        with format='escpos', decode the base64 payload and forward the bytes to QZ Tray.
        """
        def b(text: str = ""):
            return (text + "\n").encode('utf-8')

        def normalize_width(value) -> str:
            if value is None:
                return ''
            raw = str(value).strip().lower()
            if raw in ('58', '58mm'):
                return '58'
            if raw in ('80', '80mm'):
                return '80'
            return ''

        def detect_width_from_text(text: str) -> str:
            if not text:
                return ''
            lowered = text.lower()
            if any(token in lowered for token in ('58mm', '58 mm', '2inch', '2 inch', '2"')):
                return '58'
            if any(token in lowered for token in ('80mm', '80 mm', '3inch', '3 inch', '3"')):
                return '80'
            if re.search(r'(^|\D)58(\D|$)', lowered):
                return '58'
            if re.search(r'(^|\D)80(\D|$)', lowered):
                return '80'
            return ''

        def resolve_paper_width() -> str:
            explicit = normalize_width(paper_width)
            if explicit:
                return explicit

            from_printer_name = detect_width_from_text(printer_name)
            if from_printer_name:
                return from_printer_name

            outlet_settings = sale.outlet.settings if sale.outlet and isinstance(sale.outlet.settings, dict) else {}
            candidates = [
                outlet_settings.get('paper_width'),
                outlet_settings.get('printer_paper_width'),
                outlet_settings.get('receipt_paper_width'),
                (outlet_settings.get('receipt') or {}).get('paper_width') if isinstance(outlet_settings.get('receipt'), dict) else None,
                (outlet_settings.get('receipts') or {}).get('paper_width') if isinstance(outlet_settings.get('receipts'), dict) else None,
                (outlet_settings.get('printing') or {}).get('paper_width') if isinstance(outlet_settings.get('printing'), dict) else None,
            ]

            for value in candidates:
                normalized = normalize_width(value)
                if normalized:
                    return normalized

            # Safe fallback: 58mm template fits both 58mm and 80mm printers.
            return '58'

        width = 32 if resolve_paper_width() == '58' else 48

        def wrap_text(text: str, max_width: int) -> List[str]:
            text = (text or '').strip()
            if not text:
                return ['']
            if len(text) <= max_width:
                return [text]

            words = text.split()
            if not words:
                return [text[:max_width]]

            lines: List[str] = []
            current = ''
            for word in words:
                if len(word) > max_width:
                    if current:
                        lines.append(current)
                        current = ''
                    start = 0
                    while start < len(word):
                        lines.append(word[start:start + max_width])
                        start += max_width
                    continue

                candidate = f"{current} {word}".strip()
                if len(candidate) <= max_width:
                    current = candidate
                else:
                    lines.append(current)
                    current = word

            if current:
                lines.append(current)
            return lines or ['']

        def align_lr(left: str, right: str, max_width: int) -> List[str]:
            left = (left or '').strip()
            right = (right or '').strip()
            if not right:
                return wrap_text(left, max_width)

            min_gap = 1
            if len(left) + min_gap + len(right) <= max_width:
                return [left + (' ' * (max_width - len(left) - len(right))) + right]

            wrapped_left = wrap_text(left, max(1, max_width - len(right) - min_gap))
            if not wrapped_left:
                wrapped_left = ['']

            lines = wrapped_left[:-1]
            last_left = wrapped_left[-1]
            if len(last_left) + min_gap + len(right) <= max_width:
                lines.append(last_left + (' ' * (max_width - len(last_left) - len(right))) + right)
            else:
                lines.append(last_left)
                lines.append((' ' * max(0, max_width - len(right))) + right)
            return lines

        # ESC/POS init
        payload = bytearray()
        payload.extend(b"\x1b@")  # initialize
        currency = sale.tenant.currency if sale.tenant and sale.tenant.currency else "MWK"
        for line in ReceiptService._build_escpos_receipt_lines(
            sale=sale,
            width=width,
            currency=currency,
            wrap_text=wrap_text,
            align_lr=align_lr,
        ):
            payload.extend(b(line))

        # Paper cut (may not be supported by all printers)
        try:
            payload.extend(b("\x1dV\x00"))
        except Exception:
            pass

        # Return base64-encoded bytes so they can safely be stored/transferred as text
        return base64.b64encode(bytes(payload)).decode('ascii')

    @staticmethod
    def _resolve_cashier_name(user) -> str:
        if not user:
            return ""

        if hasattr(user, 'get_full_name'):
            full_name = user.get_full_name()
            if full_name and full_name.strip():
                return full_name.strip()

        if hasattr(user, 'first_name') and hasattr(user, 'last_name'):
            first = (user.first_name or '').strip()
            last = (user.last_name or '').strip()
            if first or last:
                return f"{first} {last}".strip()

        if hasattr(user, 'username') and user.username:
            return user.username

        if hasattr(user, 'email') and user.email:
            return user.email

        return ""

    @staticmethod
    def _build_escpos_receipt_lines(sale: Sale, width: int, currency: str, wrap_text, align_lr) -> List[str]:
        lines: List[str] = []

        business = sale.tenant.name if sale.tenant else "Business"
        outlet = sale.outlet.name if sale.outlet else ""

        lines.extend([line.center(width) for line in wrap_text(business.upper(), width)])
        if outlet:
            lines.extend([line.center(width) for line in wrap_text(outlet, width)])

        lines.extend(align_lr("Receipt #:", str(sale.receipt_number), width))
        lines.extend(align_lr("Date:", sale.created_at.strftime('%Y-%m-%d %H:%M:%S'), width))

        cashier_name = ReceiptService._resolve_cashier_name(sale.user)
        if cashier_name:
            lines.extend(align_lr("Cashier:", cashier_name, width))

        if sale.customer:
            lines.extend(align_lr("Customer:", sale.customer.name or 'Walk-in', width))
            if sale.customer.phone:
                lines.extend(align_lr("Phone:", sale.customer.phone, width))
            if sale.customer.email:
                lines.extend(align_lr("Email:", sale.customer.email, width))
        else:
            lines.extend(align_lr("Customer:", "Walk-in", width))

        lines.append("-" * width)
        for item in sale.items.all():
            name = item.product_name or (item.product.name if item.product else "Item")
            qty = item.quantity or 0
            total = item.total or (item.price or Decimal('0')) * Decimal(qty)
            right = f"{currency} {total:,.2f}"
            left = f"{name} x{qty}"
            lines.extend(align_lr(left, right, width))

        lines.append("-" * width)
        lines.extend(align_lr("Subtotal:", f"{currency} {sale.subtotal:,.2f}", width))
        if sale.tax and sale.tax > 0:
            lines.extend(align_lr("Tax:", f"{currency} {sale.tax:,.2f}", width))
        if sale.discount and sale.discount > 0:
            lines.extend(align_lr("Discount:", f"-{currency} {sale.discount:,.2f}", width))
        lines.extend(align_lr("Total:", f"{currency} {sale.total:,.2f}", width))
        lines.extend(align_lr("Payment:", sale.get_payment_method_display(), width))

        lines.append("")
        lines.extend(wrap_text("Thank you for your business!", width))
        lines.extend(wrap_text("Powered by PRIMEPOS 0997575865", width))

        return lines
    
    @staticmethod
    def get_receipt_by_number(receipt_number: str) -> Receipt:
        """Retrieve the most recent non-voided receipt matching `receipt_number`"""
        try:
            receipt = Receipt.objects.select_related('sale', 'tenant', 'generated_by').filter(
                receipt_number=receipt_number,
                voided=False,
            ).order_by('-generated_at').first()
            if not receipt:
                raise Receipt.DoesNotExist()
            receipt.increment_access()
            return receipt
        except Receipt.DoesNotExist:
            raise Receipt.DoesNotExist(f"Receipt with number {receipt_number} not found")
    
    @staticmethod
    def get_receipt_by_sale(sale_id: int) -> Receipt:
        """Retrieve the current receipt for a sale (by sale ID)"""
        receipt = Receipt.objects.select_related('sale', 'tenant', 'generated_by').filter(
            sale_id=sale_id,
            is_current=True,
            voided=False,
        ).order_by('-generated_at').first()
        if not receipt:
            raise Receipt.DoesNotExist(f"Active receipt for sale {sale_id} not found")
        receipt.increment_access()
        return receipt
    
    @staticmethod
    def regenerate_receipt(receipt_id: int, format: str = 'pdf', user: User = None) -> Receipt:
        """Regenerate a receipt by creating a new version and voiding the previous one.

        This preserves immutability by creating a new Receipt row rather than
        mutating the existing record.
        """
        try:
            old = Receipt.objects.get(id=receipt_id)
            sale = old.sale

            if not user:
                user = old.generated_by

            content = None
            pdf_file = None

            # Generate new content according to requested format
            if format == 'pdf':
                pdf_buffer = ReceiptService._generate_pdf_receipt(sale)
                pdf_file = ContentFile(pdf_buffer.read(), name=f"receipt_{sale.receipt_number}.pdf")
                pdf_buffer.close()
            elif format == 'escpos':
                content = ReceiptService._generate_escpos_receipt(sale)
            else:
                # Default to PDF
                pdf_buffer = ReceiptService._generate_pdf_receipt(sale)
                pdf_file = ContentFile(pdf_buffer.read(), name=f"receipt_{sale.receipt_number}.pdf")
                pdf_buffer.close()
                format = 'pdf'

            # Mark old as voided and not current
            old.voided = True
            old.is_current = False
            old.save(update_fields=['voided', 'is_current'])

            # Create new receipt (new immutable record)
            new_receipt = Receipt.objects.create(
                tenant=old.tenant,
                sale=sale,
                receipt_number=sale.receipt_number,
                format=format,
                content=content or '',
                pdf_file=pdf_file,
                generated_by=user,
                superseded_by=None
            )

            # Link predecessor
            old.superseded_by = new_receipt
            old.save(update_fields=['superseded_by'])

            logger.info(f"Receipt {old.id} regenerated -> new receipt {new_receipt.id} by user={getattr(user, 'id', None)}")
            return new_receipt
        except Receipt.DoesNotExist:
            raise Receipt.DoesNotExist(f"Receipt {receipt_id} not found")

