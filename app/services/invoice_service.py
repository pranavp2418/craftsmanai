import os
import uuid
import logging
from io import BytesIO
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_RIGHT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib import colors
from reportlab.lib.colors import HexColor

from app.models.subscription import Payment, UserSubscription, SubscriptionStatus
from app.models.invoice import Invoice
from app.services.storage_service import upload_file_to_supabase

logger = logging.getLogger(__name__)

def generate_invoice_pdf_bytes(payment: Payment, db: Session = None) -> bytes:
    """
    Generate ReportLab PDF bytes for a payment invoice matching the CraftsmanAI design template.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )
    
    styles = getSampleStyleSheet()
    story = []
    
    # 1. Top gold bar
    top_bar = Table([['']], colWidths=[540], rowHeights=[4])
    top_bar.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), HexColor('#C5A059')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(top_bar)
    story.append(Spacer(1, 15))
    
    # logo image or fallback
    logo_path = "app/assets/craftsman.png"
    if os.path.exists(logo_path):
        logo_img = Image(logo_path, width=75, height=38)
    else:
        logo_img = Paragraph("<b>CraftsmanAI</b>", ParagraphStyle(name="TempLogo", fontSize=18, leading=22))
        
    invoice_num = payment.invoice_id or f"INV-{uuid.uuid4().hex[:8].upper()}"
    created_date = payment.created_at.strftime("%m/%d/%Y") if payment.created_at else "N/A"
    status_val = payment.status.value if hasattr(payment.status, 'value') else str(payment.status)
    currency_val = payment.currency or "USD"
    
    # Badge Table
    status_colors = {
        "PAID": HexColor("#00B074"),
        "DUE": HexColor("#FFA800"),
        "FAILED": HexColor("#F44336"),
        "REFUNDED": HexColor("#9E9E9E"),
        "CREDITED": HexColor("#2196F3")
    }
    badge_bg = status_colors.get(status_val.upper(), HexColor("#00B074"))
    
    badge_table = Table([[Paragraph(f"<b>{status_val.upper()}</b>", ParagraphStyle(name="BText", textColor=colors.white, fontName="Helvetica-Bold", fontSize=8, alignment=1))]], colWidths=[60], rowHeights=[16], hAlign='RIGHT')
    badge_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), badge_bg),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ]))
    
    # Details Table
    details_data = [
        [Paragraph("<font color='#666666'>Invoice #:</font>", styles["Normal"]), Paragraph(f"<b>{invoice_num}</b>", ParagraphStyle(name="R1", alignment=TA_RIGHT, fontSize=8.5))],
        [Paragraph("<font color='#666666'>Invoice Date:</font>", styles["Normal"]), Paragraph(f"<b>{created_date}</b>", ParagraphStyle(name="R2", alignment=TA_RIGHT, fontSize=8.5))],
        [Paragraph("<font color='#666666'>Due Date:</font>", styles["Normal"]), Paragraph(f"<b>{created_date}</b>", ParagraphStyle(name="R3", alignment=TA_RIGHT, fontSize=8.5))],
        [Paragraph("<font color='#666666'>Currency:</font>", styles["Normal"]), Paragraph(f"<b>{currency_val}</b>", ParagraphStyle(name="R4", alignment=TA_RIGHT, fontSize=8.5))],
    ]
    details_table = Table(details_data, colWidths=[80, 100], hAlign='RIGHT')
    details_table.setStyle(TableStyle([
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ]))
    
    company_info = [
        logo_img,
        Spacer(1, 8),
        Paragraph("<b>CraftsmanAI</b>", styles["Normal"]),
        Spacer(1, 3),
        Paragraph("<font color='#666666'>Houston, TX, USA<br/>info@craftsmanai.app | craftsmanai.app</font>", ParagraphStyle(name="CompanySub", fontSize=8, leading=10))
    ]
    
    header_table = Table([[company_info, [
        Paragraph("<b>INVOICE</b>", ParagraphStyle(name="InvTitle", fontSize=24, leading=26, alignment=TA_RIGHT, fontName="Helvetica-Bold")),
        Spacer(1, 4),
        badge_table,
        Spacer(1, 8),
        details_table
    ]]], colWidths=[270, 270])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 15))
    
    # 2. Billed To / Purchase Info Boxes
    def create_info_box(title: str, lines: list, width: float) -> Table:
        box_style_title = ParagraphStyle(
            name=f"BoxTitle_{title}",
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=10,
            textColor=HexColor('#9E7B45')
        )
        box_style_body = ParagraphStyle(
            name=f"BoxBody_{title}",
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=HexColor('#333333')
        )
        
        content = [Paragraph(f"<b>{title}</b>", box_style_title), Spacer(1, 5)]
        for line in lines:
            content.append(Paragraph(line, box_style_body))
        
        box_table = Table([[content]], colWidths=[width])
        box_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), HexColor('#FBFBFA')),
            ('BOX', (0,0), (-1,-1), 0.5, HexColor('#E5E5E5')),
            ('TOPPADDING', (0,0), (-1,-1), 8),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
            ('LEFTPADDING', (0,0), (-1,-1), 10),
            ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ]))
        return box_table
        
    full_name = payment.user.full_name if (payment.user and payment.user.full_name) else "N/A"
    email_val = payment.user.email if (payment.user and payment.user.email) else "N/A"
    stripe_cust_id = payment.stripe_customer_id or "N/A"
    
    billed_to_lines = [
        full_name,
        email_val,
        f"Customer ID: {stripe_cust_id}",
        f"Workspace: {full_name} - Workspace"
    ]
    billed_to_box = create_info_box("BILLED TO", billed_to_lines, 259)
    
    # Get top-up pack details if applicable
    topup_pack = None
    if payment.topup_pack_id and db:
        from app.models.subscription import TopupPack
        topup_pack = db.query(TopupPack).filter(TopupPack.id == payment.topup_pack_id).first()
        
    plan = payment.plan
    purchase_type = "Render Top-Up" if topup_pack else "Plan Upgrade"
    
    plan_val = f"Top-Up" if topup_pack else (plan.name if plan else "N/A")
    renders_added_val = str(topup_pack.renders) if topup_pack else (str(plan.monthly_renders) if (plan and plan.monthly_renders != -1) else "Unlimited")
    
    billing_period_val = "N/A"
    if payment.created_at:
        if topup_pack and db:
            active_sub = db.query(UserSubscription).filter(
                UserSubscription.user_id == payment.user_id,
                UserSubscription.status == SubscriptionStatus.ACTIVE
            ).first()
            if active_sub:
                start_date_val = active_sub.start_date.strftime("%m/%d/%Y")
                end_date_val = active_sub.end_date.strftime("%m/%d/%Y")
                billing_period_val = f"{start_date_val} - {end_date_val}"
            else:
                billing_period_val = payment.created_at.strftime("%m/%d/%Y")
        else:
            duration_days = plan.duration_days if (plan and plan.duration_days) else 30
            end_date_val = (payment.created_at + timedelta(days=duration_days)).strftime("%m/%d/%Y")
            start_date_val = payment.created_at.strftime("%m/%d/%Y")
            billing_period_val = f"{start_date_val} - {end_date_val}"
            
    purchase_lines = [
        f"Type: {purchase_type}",
        f"Plan: {plan_val}",
        f"Billing Period: {billing_period_val}",
        f"Render Credits Added: {renders_added_val}"
    ]
    purchase_details_box = create_info_box("PURCHASE / UPGRADE DETAILS", purchase_lines, 259)
    
    info_tables = Table([[billed_to_box, '', purchase_details_box]], colWidths=[259, 22, 259])
    info_tables.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(info_tables)
    story.append(Spacer(1, 15))
    
    # 3. Invoice Items Table
    plan_name = plan.name if plan else "Plan"
    item_desc = f"Render Top-Up - {topup_pack.renders} Renders" if topup_pack else f"{plan_name} Plan Upgrade"
    item_term = "Add-on" if topup_pack else "Monthly subscription"
    item_qty = "1"
    item_price = f"USD ${float(payment.amount):.2f}"
    item_total = f"USD ${float(payment.amount):.2f}"
    
    items_data = [
        ["Description", "Billing Term", "Qty", "Unit Price", "Total"],
        [item_desc, item_term, item_qty, item_price, item_total]
    ]
    items_table = Table(items_data, colWidths=[180, 130, 40, 95, 95])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.black),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8.5),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
        ('TOPPADDING', (0, 0), (-1, 0), 6),
        ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#E5E5E5')),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 15))
    
    # 4. Notes / Terms and Totals Box
    notes_content = [
        Paragraph("<b>Notes / Terms</b>", ParagraphStyle(name="NotesTitle", fontName="Helvetica-Bold", fontSize=8.5, leading=10, textColor=HexColor('#9E7B45'))),
        Spacer(1, 4),
        Paragraph("This invoice confirms a CraftsmanAI purchase, upgrade, add-on, or render top-up. Access, plan limits, and render credits are updated after successful payment confirmation. For billing questions, include the invoice number when contacting support.", ParagraphStyle(name="NotesBody", fontName="Helvetica", fontSize=7.5, leading=10, textColor=HexColor('#666666')))
    ]
    notes_box = Table([[notes_content]], colWidths=[302])
    notes_box.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), HexColor('#FBFBFA')),
        ('BOX', (0,0), (-1,-1), 0.5, HexColor('#E5E5E5')),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    
    subtotal_val = float(payment.amount)
    totals_data = [
        [Paragraph("Subtotal", styles["Normal"]), Paragraph(f"USD ${subtotal_val:.2f}", ParagraphStyle(name="Tot1", alignment=TA_RIGHT, fontSize=8))],
        [Paragraph("Discount / Promo", styles["Normal"]), Paragraph("USD $0.00", ParagraphStyle(name="Tot2", alignment=TA_RIGHT, fontSize=8))],
        [Paragraph("Tax", styles["Normal"]), Paragraph("USD $0.00", ParagraphStyle(name="Tot3", alignment=TA_RIGHT, fontSize=8))],
        [Paragraph("<b>Total</b>", styles["Normal"]), Paragraph(f"<b>USD ${subtotal_val:.2f}</b>", ParagraphStyle(name="Tot4", alignment=TA_RIGHT, fontSize=8))],
        [Paragraph("Amount Paid", styles["Normal"]), Paragraph(f"USD ${subtotal_val:.2f}", ParagraphStyle(name="Tot5", alignment=TA_RIGHT, fontSize=8))],
        [Paragraph("Balance Due", styles["Normal"]), Paragraph("USD $0.00", ParagraphStyle(name="Tot6", alignment=TA_RIGHT, fontSize=8))],
    ]
    totals_table = Table(totals_data, colWidths=[100, 116])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (1,0), (1,-1), 'RIGHT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('LINEBELOW', (0, 2), (1, 2), 0.5, HexColor('#E5E5E5')),
        ('LINEBELOW', (0, 3), (1, 3), 0.5, HexColor('#E5E5E5')),
    ]))
    
    bottom_table = Table([[notes_box, '', totals_table]], colWidths=[302, 22, 216])
    bottom_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
     ]))
    story.append(bottom_table)
    story.append(Spacer(1, 15))
    
    # 5. Transactions Table
    txn_data = [
        ["Date", "Transaction ID", "Payment Method", "Amount"],
        [created_date, payment.stripe_payment_intent_id or 'N/A', payment.payment_method or 'Card', f"USD ${subtotal_val:.2f}"]
    ]
    txn_table = Table(txn_data, colWidths=[100, 230, 120, 90])
    txn_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.black),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8.5),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
        ('TOPPADDING', (0, 0), (-1, 0), 6),
        ('ALIGN', (3, 0), (3, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#E5E5E5')),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(Paragraph("<b>Transactions</b>", ParagraphStyle(name="TxTitle", fontName="Helvetica-Bold", fontSize=11, leading=14)))
    story.append(Spacer(1, 8))
    story.append(txn_table)
    story.append(Spacer(1, 20))
    
    # 6. Bottom Bar & Footer
    bottom_bar = Table([['']], colWidths=[540], rowHeights=[1])
    bottom_bar.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), HexColor('#C5A059')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(bottom_bar)
    story.append(Spacer(1, 8))
    
    footer_text_table = Table([[
        Paragraph(f"<font color='#888888'>Generated on {created_date}</font>", ParagraphStyle(name="F1", fontSize=7.5)),
        Paragraph("<font color='#888888'>craftsmanai.app</font>", ParagraphStyle(name="F2", alignment=1, fontSize=7.5)),
        Paragraph("<font color='#888888'>Invoice template - CraftsmanAI billing</font>", ParagraphStyle(name="F3", alignment=2, fontSize=7.5))
    ]], colWidths=[180, 180, 180])
    footer_text_table.setStyle(TableStyle([
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(footer_text_table)
    
    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


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
        pdf_bytes = generate_invoice_pdf_bytes(payment, db)

        # 2. Upload to Supabase Storage under the requested /craftsman/invoic folder
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
