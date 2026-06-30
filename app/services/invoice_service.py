import os
import uuid
import logging
from io import BytesIO
from typing import Any
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_RIGHT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from sqlalchemy.orm import Session

from app.models.subscription import Payment
from app.models.invoice import Invoice
from app.services.storage_service import upload_file_to_supabase

logger = logging.getLogger(__name__)

def generate_invoice_pdf_bytes(payment: Payment) -> bytes:
    """
    Generate ReportLab PDF bytes for a payment invoice.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    
    # Get styles
    styles = getSampleStyleSheet()
    story = []

    # -----------------------------
    # HEADER (Company + Invoice Info)
    # -----------------------------
    invoice_num = payment.invoice_id or f"INV-{uuid.uuid4().hex[:8].upper()}"
    created_date = payment.created_at.strftime("%d/%m/%Y") if payment.created_at else "N/A"
    status_val = payment.status.value if hasattr(payment.status, 'value') else str(payment.status)
    email_val = payment.user.email if (payment.user and payment.user.email) else "N/A"

    header_data = [
        [
            Paragraph(
                f"""
                <b>Craftsmen</b><br/>
                1 Main St.<br/>
                Beverly Hills, CA<br/>
                Phone: +1 (800) 555-5555<br/>
                {email_val}
                """,
                styles["Normal"]
            ),
            Paragraph(
                f"""
                <b>Invoice #{invoice_num}</b><br/>
                Date: {created_date}<br/>
                Status: {status_val}
                """,
                ParagraphStyle(name="Right", alignment=TA_RIGHT)
            )
        ]
    ]

    header_table = Table(header_data, colWidths=[3.5 * inch, 2.5 * inch])
    story.append(header_table)
    story.append(Spacer(1, 20))

    # -----------------------------
    # INVOICED TO
    # -----------------------------
    story.append(Paragraph("<b>Invoiced To</b>", styles["Heading3"]))
    story.append(Spacer(1, 8))

    full_name = payment.user.full_name if (payment.user and payment.user.full_name) else "N/A"
    stripe_cust_id = payment.stripe_customer_id or "N/A"

    story.append(Paragraph(
        f"""
        {full_name}<br/>
        {email_val}<br/>
        Customer ID: {stripe_cust_id}
        """,
        styles["Normal"]
    ))
    story.append(Spacer(1, 20))

    # -----------------------------
    # MAIN ITEM TABLE (2 columns)
    # -----------------------------
    plan_name = payment.plan.name if payment.plan else "Plan"

    items_table = Table([
        ["Description", "Total"],
        [plan_name, f"USD ${float(payment.amount):.2f}"],
    ], colWidths=[4.5 * inch, 1.5 * inch])

    items_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.black),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ALIGN", (1, 1), (1, -1), "RIGHT"),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
    ]))

    story.append(items_table)
    story.append(Spacer(1, 20))

    # -----------------------------
    # TOTALS (RIGHT SIDE BLOCK)
    # -----------------------------
    subtotal = float(payment.amount)
    credit = 0.00
    total = subtotal - credit

    totals_table = Table([
        ["Sub Total", f"USD ${subtotal:.2f}"],
        ["Credit", f"USD ${credit:.2f}"],
        ["Total", f"USD ${total:.2f}"],
    ], colWidths=[4.5 * inch, 1.5 * inch])

    totals_table.setStyle(TableStyle([
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
    ]))

    story.append(totals_table)
    story.append(Spacer(1, 30))

    # -----------------------------
    # TRANSACTIONS
    # -----------------------------
    story.append(Paragraph("<b>Transactions</b>", styles["Heading3"]))
    story.append(Spacer(1, 10))

    txn_table = Table([
        ["Date", "Transaction ID", "Amount"],
        [
            created_date,
            stripe_cust_id,
            f"USD ${total:.2f}"
        ]
    ], colWidths=[2 * inch, 3 * inch, 1 * inch])

    txn_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.black),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ALIGN", (2, 1), (2, -1), "RIGHT"),
    ]))

    story.append(txn_table)
    story.append(Spacer(1, 30))

    # -----------------------------
    # FOOTER
    # -----------------------------
    story.append(Paragraph(
        f"PDF Generated on {created_date}",
        styles["Normal"]
    ))
    story.append(Paragraph(
        "Powered by Fonix",
        styles["Normal"]
    ))
    
    # Build PDF
    doc.build(story)
    
    # Get PDF data
    buffer.seek(0)
    pdf_data = buffer.getvalue()
    buffer.close()
    return pdf_data


def generate_and_store_invoice(db: Session, payment: Payment) -> Invoice:
    """
    Generate the PDF invoice for a completed payment, upload it to Supabase storage,
    and save the Invoice record with the storage URL.
    """
    try:
        # Check if an invoice already exists for this payment
        existing_invoice = db.query(Invoice).filter(Invoice.payment_id == payment.id).first()
        if existing_invoice:
            logger.info(f"Invoice already exists for payment {payment.id}")
            return existing_invoice

        # Generate a unique invoice number if not available
        invoice_number = payment.invoice_id or f"INV-{uuid.uuid4().hex[:8].upper()}"
        logger.info(f"Generating PDF for invoice: {invoice_number}")

        # 1. Generate PDF bytes
        pdf_bytes = generate_invoice_pdf_bytes(payment)

        # 2. Upload to Supabase Storage under the requested /crafstman/invoic folder
        bucket_path = f"craftsman/invoices/{invoice_number}.pdf"
        logger.info(f"Uploading invoice PDF to Supabase storage path: {bucket_path}")
        
        pdf_url = upload_file_to_supabase(
            file_bytes=pdf_bytes,
            content_type="application/pdf",
            bucket_path=bucket_path
        )
        logger.info(f"Invoice PDF stored successfully. URL: {pdf_url}")

        # 3. Create Invoice database record
        new_invoice = Invoice(
            invoice_number=invoice_number,
            payment_id=payment.id,
            amount=payment.amount,
            currency=payment.currency,
            pdf_url=pdf_url
        )
        db.add(new_invoice)
        db.flush()
        logger.info(f"Successfully saved invoice record for payment {payment.id} in DB.")
        return new_invoice

    except Exception as e:
        logger.error(f"Error in generate_and_store_invoice: {str(e)}")
        # Fallback creation of the invoice row if the PDF/Supabase layer fails
        # so the user never loses database-level invoice access.
        try:
            # Generate a NEW unique invoice number to avoid duplicate key error
            invoice_number = f"INV-{uuid.uuid4().hex[:8].upper()}"
            fallback_invoice = Invoice(
                invoice_number=invoice_number,
                payment_id=payment.id,
                amount=payment.amount,
                currency=payment.currency,
                pdf_url=f"/api/v2/invoices/payment/{payment.id}/download"
            )
            db.add(fallback_invoice)
            db.flush()
            return fallback_invoice
        except Exception as inner_e:
            logger.error(f"Fallback invoice creation failed: {str(inner_e)}")
            raise e
