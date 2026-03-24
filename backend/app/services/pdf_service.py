"""
PDF Service - Xử lý các thao tác với PDF
"""

import os
from io import BytesIO
from datetime import datetime
from typing import List, Dict, Tuple
from PyPDF2 import PdfReader, PdfWriter, PdfMerger
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image


def get_pdf_page_count(file_path: str) -> int:
    """Get number of pages in PDF"""
    try:
        reader = PdfReader(file_path)
        return len(reader.pages)
    except:
        return 1


def merge_and_sign_pdfs(
    pdf_docs: List,
    output_path: str,
    signers: List,
    positions_by_signer_doc: Dict[Tuple, List],
    signature_images: Dict[int, str] = None
):
    """
    Merge PDF documents and add signatures
    
    Args:
        pdf_docs: List of Document objects
        output_path: Output file path
        signers: List of signed WorkflowSigner objects
        positions_by_signer_doc: Dict of {(signer_id, doc_id): [positions]}
        signature_images: Dict of {user_id: image_path}
    """
    if signature_images is None:
        signature_images = {}
    
    # Get main document
    main_doc = None
    attachment_docs = []
    
    for doc in pdf_docs:
        if hasattr(doc, 'file_type') and doc.file_type == 'main':
            main_doc = doc
        else:
            attachment_docs.append(doc)
    
    # Use first PDF as main if no main specified
    if not main_doc and pdf_docs:
        main_doc = pdf_docs[0]
        attachment_docs = pdf_docs[1:]
    
    if not main_doc:
        raise ValueError("No main document found")
    
    # Read main PDF
    main_reader = PdfReader(main_doc.file_path)
    
    # Create output PDF writer
    writer = PdfWriter()
    
    # Copy all pages from main PDF
    for page in main_reader.pages:
        writer.add_page(page)
    
    # Add attachment pages
    for attach_doc in attachment_docs:
        try:
            attach_reader = PdfReader(attach_doc.file_path)
            for page in attach_reader.pages:
                writer.add_page(page)
        except:
            # If can't read as PDF, create a placeholder page
            _create_placeholder_page(writer, attach_doc)
    
    # Add signatures to all pages
    for signer in signers:
        user_id = signer.user_id
        signature_path = signature_images.get(user_id)
        
        # Get signature positions for this signer
        for doc in pdf_docs:
            key = (signer.id, doc.id)
            if key not in positions_by_signer_doc:
                continue
            
            positions = positions_by_signer_doc[key]
            
            for pos in positions:
                if pos.position_type == "signature":
                    # Add signature image
                    _add_signature_to_page(
                        writer,
                        page_num=pos.page - 1,  # 0-indexed
                        x=pos.x,
                        y=pos.y,
                        width=pos.width,
                        height=pos.height,
                        signature_path=signature_path
                    )
                elif pos.position_type == "date":
                    # Add date text
                    signed_date = signer.signed_at.strftime("%d/%m/%Y") if signer.signed_at else datetime.now().strftime("%d/%m/%Y")
                    _add_date_text(
                        writer,
                        page_num=pos.page - 1,
                        x=pos.x,
                        y=pos.y,
                        width=pos.width,
                        height=pos.height,
                        date_text=signed_date
                    )
    
    # Write output
    with open(output_path, "wb") as output_file:
        writer.write(output_file)
    
    return output_path


def _create_placeholder_page(writer: PdfWriter, doc):
    """Create a placeholder page for non-PDF attachments"""
    # Create a simple PDF page with document info
    packet = BytesIO()
    c = canvas.Canvas(packet, pagesize=A4)
    
    # Add title
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50*mm, 270*mm, "ATTACHMENT")
    
    # Add document info
    c.setFont("Helvetica", 12)
    c.drawString(50*mm, 250*mm, f"File: {doc.original_filename}")
    c.drawString(50*mm, 235*mm, f"Type: {doc.mime_type}")
    c.drawString(50*mm, 220*mm, f"Size: {doc.file_size} bytes" if doc.file_size else "Size: N/A")
    
    c.save()
    packet.seek(0)
    
    # Add to writer
    reader = PdfReader(packet)
    for page in reader.pages:
        writer.add_page(page)


def _add_signature_to_page(
    writer: PdfWriter,
    page_num: int,
    x: float,
    y: float,
    width: float,
    height: float,
    signature_path: str = None
):
    """Add signature image to page"""
    if page_num >= len(writer.pages):
        return
    
    # Create signature image if not provided
    if not signature_path or not os.path.exists(signature_path):
        # Create a simple signature placeholder
        signature_path = _create_default_signature()
    
    try:
        # Open signature image
        img = Image.open(signature_path)
        
        # Convert to RGB if necessary
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Save to bytes
        img_bytes = BytesIO()
        img.save(img_bytes, format='PNG')
        img_bytes.seek(0)
        
        # Create signature page overlay
        packet = BytesIO()
        c = canvas.Canvas(packet, pagesize=A4)
        
        # Draw image
        c.drawImage(
            ImageReader(img_bytes),
            x * mm,  # Convert to mm
            y * mm,
            width * mm,
            height * mm,
            preserveAspectRatio=True
        )
        
        c.save()
        packet.seek(0)
        
        # Merge with page
        overlay_reader = PdfReader(packet)
        overlay_page = overlay_reader.pages[0]
        
        writer.pages[page_num].merge_page(overlay_page)
    
    except Exception as e:
        print(f"Error adding signature: {e}")
        # Add text placeholder instead
        _add_signature_placeholder(writer, page_num, x, y, width, height)


def _add_signature_placeholder(
    writer: PdfWriter,
    page_num: int,
    x: float,
    y: float,
    width: float,
    height: float
):
    """Add placeholder for signature"""
    if page_num >= len(writer.pages):
        return
    
    packet = BytesIO()
    c = canvas.Canvas(packet, pagesize=A4)
    
    # Draw rectangle
    c.setStrokeColorRGB(0, 0, 0)
    c.setFillColorRGB(0.95, 0.95, 0.95)
    c.rect(x * mm, y * mm, width * mm, height * mm, fill=1)
    
    # Add text
    c.setFont("Helvetica", 8)
    c.drawString(x * mm + 2, y * mm + height * mm / 2, "Signed")
    
    c.save()
    packet.seek(0)
    
    overlay_reader = PdfReader(packet)
    overlay_page = overlay_reader.pages[0]
    
    writer.pages[page_num].merge_page(overlay_page)


def _add_date_text(
    writer: PdfWriter,
    page_num: int,
    x: float,
    y: float,
    width: float,
    height: float,
    date_text: str
):
    """Add date text to page"""
    if page_num >= len(writer.pages):
        return
    
    packet = BytesIO()
    c = canvas.Canvas(packet, pagesize=A4)
    
    # Draw date text
    c.setFont("Helvetica", 10)
    c.drawString(x * mm, y * mm + height * mm / 2 - 5, date_text)
    
    c.save()
    packet.seek(0)
    
    overlay_reader = PdfReader(packet)
    overlay_page = overlay_reader.pages[0]
    
    writer.pages[page_num].merge_page(overlay_page)


def _create_default_signature() -> str:
    """Create a default signature image"""
    from PIL import Image, ImageDraw, ImageFont
    
    # Create image
    img = Image.new('RGBA', (200, 80), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw signature line
    draw.line([(20, 60), (180, 60)], fill=(0, 0, 0, 255), width=2)
    
    # Try to use a font, fallback to default
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20)
    except:
        font = ImageFont.load_default()
    
    # Draw "Signature" text
    draw.text((25, 20), "Signed", fill=(0, 0, 0, 255), font=font)
    
    # Save to temp file
    temp_path = "/tmp/default_signature.png"
    img.save(temp_path)
    
    return temp_path


def create_attachment_cover_page(
    doc,
    workflow_title: str = None,
    creator_name: str = None
) -> bytes:
    """
    Create a cover page for attachment
    Returns PDF bytes
    """
    packet = BytesIO()
    
    # Create document
    c = canvas.Canvas(packet, pagesize=A4)
    width, height = A4
    
    # Title
    c.setFont("Helvetica-Bold", 18)
    c.drawCentredString(width/2, height - 50*mm, "FILE ATTACHMENT")
    
    # Horizontal line
    c.line(50*mm, height - 55*mm, width - 50*mm, height - 55*mm)
    
    # Document info
    c.setFont("Helvetica", 12)
    
    y = height - 70*mm
    
    c.drawString(50*mm, y, f"File Name: {doc.original_filename}")
    y -= 10*mm
    
    c.drawString(50*mm, y, f"File Type: {doc.mime_type or 'Unknown'}")
    y -= 10*mm
    
    if doc.file_size:
        size_mb = doc.file_size / (1024 * 1024)
        c.drawString(50*mm, y, f"File Size: {size_mb:.2f} MB")
        y -= 10*mm
    
    c.drawString(50*mm, y, f"Upload Date: {doc.created_at.strftime('%d/%m/%Y') if doc.created_at else 'N/A'}")
    
    if workflow_title:
        y -= 15*mm
        c.drawString(50*mm, y, f"Workflow: {workflow_title}")
    
    if creator_name:
        y -= 10*mm
        c.drawString(50*mm, y, f"Uploaded by: {creator_name}")
    
    # Footer
    c.setFont("Helvetica-Oblique", 9)
    c.drawCentredString(width/2, 20*mm, "This attachment is part of the main document")
    
    c.save()
    packet.seek(0)
    
    return packet.read()


def merge_pdfs(pdf_files: List[str], output_path: str) -> str:
    """Merge multiple PDF files into one"""
    merger = PdfMerger()
    
    for pdf_file in pdf_files:
        if os.path.exists(pdf_file):
            merger.append(pdf_file)
    
    with open(output_path, "wb") as output:
        merger.write(output)
    
    merger.close()
    
    return output_path
