import os
from io import BytesIO
from django.conf import settings
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable, KeepTogether, Image as RLImage

from config.firm_settings import get_firm_details
from config.date_utils import format_nairobi_datetime, format_nairobi_date


def generate_client_report_pdf(matter, updates, next_hearing, period_covered, generated_at=None):
    """
    Generates a professional, restrained client progress report PDF for a single matter.
    """
    if generated_at is None:
        generated_at = timezone.now()

    firm = get_firm_details()
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=1.8 * cm,
        rightMargin=1.8 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
    )

    usable_width = A4[0] - 3.6 * cm
    styles = getSampleStyleSheet()

    # Custom styles
    firm_name_style = ParagraphStyle(
        'FirmName',
        parent=styles['Normal'],
        fontSize=15,
        leading=18,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#111111'),
    )
    firm_contact_style = ParagraphStyle(
        'FirmContact',
        parent=styles['Normal'],
        fontSize=8,
        leading=11,
        fontName='Helvetica',
        textColor=colors.HexColor('#4B5563'),
    )
    report_title_style = ParagraphStyle(
        'ReportTitle',
        parent=styles['Normal'],
        fontSize=13,
        leading=16,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#111111'),
        alignment=1,  # Center
    )
    report_subtitle_style = ParagraphStyle(
        'ReportSubTitle',
        parent=styles['Normal'],
        fontSize=8.5,
        leading=11,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#6B7280'),
        alignment=1,
    )
    section_heading_style = ParagraphStyle(
        'SectionHeading',
        parent=styles['Normal'],
        fontSize=10.5,
        leading=13,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#111111'),
        spaceAfter=4,
    )
    meta_label_style = ParagraphStyle(
        'MetaLabel',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#4B5563'),
    )
    meta_val_style = ParagraphStyle(
        'MetaVal',
        parent=styles['Normal'],
        fontSize=8.5,
        leading=11,
        fontName='Helvetica',
        textColor=colors.HexColor('#111111'),
    )
    update_meta_style = ParagraphStyle(
        'UpdateMeta',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#374151'),
    )
    update_title_style = ParagraphStyle(
        'UpdateTitle',
        parent=styles['Normal'],
        fontSize=9.5,
        leading=12,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#111111'),
        spaceAfter=3,
    )
    update_narrative_style = ParagraphStyle(
        'UpdateNarrative',
        parent=styles['Normal'],
        fontSize=8.5,
        leading=12,
        fontName='Helvetica',
        textColor=colors.HexColor('#1F2937'),
    )
    hearing_note_style = ParagraphStyle(
        'HearingNote',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        fontName='Helvetica-Oblique',
        textColor=colors.HexColor('#2563EB'),
        spaceAfter=2,
    )
    next_hearing_bold = ParagraphStyle(
        'NextHearingBold',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#1E3A8A'),
    )

    story = []

    # 1. Firm Letterhead Header
    logo_path = os.path.join(os.path.dirname(__file__), 'logo.png')
    firm_lines = [
        Paragraph(firm['firm_name'].upper(), firm_name_style),
        Paragraph(f"{firm['advocate_name']} • {firm['advocate_title']}", firm_contact_style),
        Paragraph(f"Tel: {firm['firm_phone']}  |  Email: {firm['firm_email']}", firm_contact_style),
    ]
    if 'firm_address' in firm and firm['firm_address']:
        firm_lines.append(Paragraph(firm['firm_address'], firm_contact_style))

    if os.path.exists(logo_path):
        logo_img = RLImage(logo_path, width=1.6 * cm, height=1.6 * cm)
        header_table = Table(
            [[logo_img, firm_lines]],
            colWidths=[2.0 * cm, usable_width - 2.0 * cm]
        )
    else:
        header_table = Table([[firm_lines]], colWidths=[usable_width])

    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#111111'), spaceAfter=8))

    # 2. Document Title
    story.append(Paragraph("CLIENT MATTER PROGRESS REPORT", report_title_style))
    story.append(Spacer(1, 2))
    story.append(Paragraph("PRIVILEGED & CONFIDENTIAL CLIENT UPDATE", report_subtitle_style))
    story.append(Spacer(1, 10))

    # 3. Matter Metadata Summary Table
    client_name = matter.client.display_name if matter.client else 'N/A'
    meta_data = [
        [
            Paragraph("Client Name:", meta_label_style),
            Paragraph(client_name, meta_val_style),
            Paragraph("Matter Reference:", meta_label_style),
            Paragraph(matter.matter_reference, meta_val_style),
        ],
        [
            Paragraph("Matter Title:", meta_label_style),
            Paragraph(matter.title, meta_val_style),
            Paragraph("Status:", meta_label_style),
            Paragraph(matter.get_status_display(), meta_val_style),
        ],
        [
            Paragraph("Court / Forum:", meta_label_style),
            Paragraph(matter.court or 'N/A', meta_val_style),
            Paragraph("Court Case No.:", meta_label_style),
            Paragraph(matter.case_number or 'N/A', meta_val_style),
        ],
        [
            Paragraph("Date Generated:", meta_label_style),
            Paragraph(format_nairobi_datetime(generated_at), meta_val_style),
            Paragraph("Period Covered:", meta_label_style),
            Paragraph(period_covered, meta_val_style),
        ],
    ]
    col_w = [2.8 * cm, (usable_width - 5.6 * cm) / 2, 2.8 * cm, (usable_width - 5.6 * cm) / 2]
    meta_table = Table(meta_data, colWidths=col_w)
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F9FAFB')),
        ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor('#E5E7EB')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#F3F4F6')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 12))

    # 4. Chronological Case Updates
    story.append(Paragraph("Matter Proceedings & Progress Updates", section_heading_style))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#E5E7EB'), spaceAfter=8))

    if not updates:
        no_updates_table = Table(
            [[Paragraph("No client-facing updates recorded for this reporting period.", meta_val_style)]],
            colWidths=[usable_width]
        )
        no_updates_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F9FAFB')),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
            ('PADDING', (0, 0), (-1, -1), 10),
        ]))
        story.append(no_updates_table)
        story.append(Spacer(1, 12))
    else:
        for idx, u in enumerate(updates):
            update_elements = []

            # Meta line: Date & Category
            cat_display = u.get_category_display() if hasattr(u, 'get_category_display') else u.category
            dt_str = format_nairobi_datetime(u.event_datetime)
            update_elements.append(Paragraph(f"{dt_str}  •  {cat_display.upper()}", update_meta_style))
            update_elements.append(Spacer(1, 2))

            # Completed hearing if applicable
            if u.hearing:
                h_name = u.hearing.get_hearing_type_display() if hasattr(u.hearing, 'get_hearing_type_display') else 'Court Appearance'
                h_date = format_nairobi_datetime(u.hearing.hearing_date)
                update_elements.append(Paragraph(f"Hearing Conducted: {h_name} on {h_date}", hearing_note_style))

            # Title
            update_elements.append(Paragraph(u.title, update_title_style))

            # Narrative
            clean_desc = u.description.replace('\n', '<br/>')
            update_elements.append(Paragraph(clean_desc, update_narrative_style))

            entry_table = Table([[update_elements]], colWidths=[usable_width])
            entry_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FFFFFF' if idx % 2 == 0 else '#FAFAFA')),
                ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
                ('PADDING', (0, 0), (-1, -1), 8),
            ]))

            story.append(KeepTogether(entry_table))
            story.append(Spacer(1, 6))

    story.append(Spacer(1, 6))

    # 5. Next Scheduled Court Date (Prominently displayed)
    story.append(Paragraph("Next Scheduled Court Appearance", section_heading_style))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#E5E7EB'), spaceAfter=8))

    if next_hearing:
        h_type = next_hearing.get_hearing_type_display() if hasattr(next_hearing, 'get_hearing_type_display') else next_hearing.hearing_type
        h_date = format_nairobi_datetime(next_hearing.hearing_date)
        h_court = next_hearing.court or matter.court or 'Court registry not specified'
        h_loc = next_hearing.location_details or 'Courtroom / Physical Appearance'

        next_content = [
            Paragraph(f"<b>Upcoming Event:</b> {h_type.upper()}", next_hearing_bold),
            Spacer(1, 2),
            Paragraph(f"<b>Scheduled Date & Time:</b> {h_date}", next_hearing_bold),
            Spacer(1, 2),
            Paragraph(f"<b>Court / Tribunal:</b> {h_court}", meta_val_style),
            Paragraph(f"<b>Location / Format:</b> {h_loc}", meta_val_style),
        ]
        if next_hearing.notes:
            next_content.append(Paragraph(f"<b>Directions / Reminders:</b> {next_hearing.notes}", meta_val_style))

        next_table = Table([[next_content]], colWidths=[usable_width])
        next_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#EFF6FF')),
            ('BOX', (0, 0), (-1, -1), 1.0, colors.HexColor('#3B82F6')),
            ('PADDING', (0, 0), (-1, -1), 10),
        ]))
        story.append(KeepTogether(next_table))
    else:
        no_h_table = Table(
            [[Paragraph("No future court appearance is currently scheduled. Further directions will be communicated once scheduled by the Court Registry.", meta_val_style)]],
            colWidths=[usable_width]
        )
        no_h_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F9FAFB')),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
            ('PADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(no_h_table)

    story.append(Spacer(1, 16))

    # 6. Sign-off Footer
    sign_off_content = [
        Paragraph("<b>Siwolo P.O Law Advocates</b>", ParagraphStyle('Sign1', parent=styles['Normal'], fontSize=9, leading=12, fontName='Helvetica-Bold')),
        Paragraph("Advocates, Commissioners for Oaths & Notaries Public", ParagraphStyle('Sign2', parent=styles['Normal'], fontSize=8, leading=10, textColor=colors.HexColor('#4B5563'))),
        Paragraph(f"{firm['advocate_name']} — {firm['advocate_title']}", ParagraphStyle('Sign3', parent=styles['Normal'], fontSize=8, leading=10, textColor=colors.HexColor('#6B7280'))),
    ]
    sign_table = Table([[sign_off_content]], colWidths=[usable_width])
    sign_table.setStyle(TableStyle([
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(KeepTogether(sign_table))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
