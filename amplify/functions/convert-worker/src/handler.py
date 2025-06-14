import os
import json
import tempfile
import uuid
from pathlib import Path
import boto3
import fitz  # PyMuPDF
from pdf2image import convert_from_path
from PIL import Image

s3_client = boto3.client('s3')

def handler(event, context):
    """
    Convert PDF/PPTX files to PNG images
    Triggered by S3 ObjectCreated events on raw-files bucket
    """
    print(f"Event: {json.dumps(event)}")
    
    # Get S3 event details
    record = event['Records'][0]['s3']
    source_bucket = record['bucket']['name']
    source_key = record['object']['key']
    
    # Extract user ID and file info
    # Expected format: private/{userId}/{filename}
    parts = source_key.split('/')
    if len(parts) < 3 or parts[0] != 'private':
        print(f"Invalid key format: {source_key}")
        return
    
    user_id = parts[1]
    filename = parts[2]
    file_extension = Path(filename).suffix.lower()
    
    # Download the file
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        input_file = temp_path / filename
        
        print(f"Downloading {source_key} from {source_bucket}")
        s3_client.download_file(source_bucket, source_key, str(input_file))
        
        # Generate unique document ID
        doc_id = str(uuid.uuid4())
        
        # Convert based on file type
        images = []
        
        if file_extension == '.pdf':
            images = convert_pdf_to_images(input_file, temp_path)
        elif file_extension in ['.pptx', '.ppt']:
            images = convert_pptx_to_images(input_file, temp_path)
        else:
            print(f"Unsupported file type: {file_extension}")
            return
        
        # Upload images to destination bucket
        dest_bucket = os.environ['DEST_BUCKET']
        uploaded_images = []
        
        for idx, image_path in enumerate(images):
            # Create S3 key for image
            image_key = f"private/{user_id}/{doc_id}/page_{idx+1:04d}.png"
            
            # Upload image
            print(f"Uploading image to {dest_bucket}/{image_key}")
            s3_client.upload_file(
                str(image_path),
                dest_bucket,
                image_key,
                ExtraArgs={
                    'ContentType': 'image/png',
                    'Metadata': {
                        'source-document': filename,
                        'document-id': doc_id,
                        'page-number': str(idx + 1),
                        'total-pages': str(len(images))
                    }
                }
            )
            
            uploaded_images.append({
                'bucket': dest_bucket,
                'key': image_key,
                'page': idx + 1
            })
        
        print(f"Successfully converted {filename} to {len(images)} images")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'documentId': doc_id,
                'sourceFile': filename,
                'totalPages': len(images),
                'images': uploaded_images
            })
        }

def convert_pdf_to_images(pdf_path, output_dir):
    """Convert PDF to PNG images using pdf2image"""
    images = []
    
    try:
        # Convert PDF to images
        pil_images = convert_from_path(
            pdf_path,
            dpi=150,
            fmt='png',
            output_folder=output_dir
        )
        
        # Save images
        for idx, pil_image in enumerate(pil_images):
            image_path = output_dir / f"page_{idx+1:04d}.png"
            pil_image.save(image_path, 'PNG')
            images.append(image_path)
            
    except Exception as e:
        print(f"Error converting PDF: {e}")
        # Fallback to PyMuPDF
        images = convert_pdf_with_pymupdf(pdf_path, output_dir)
    
    return images

def convert_pdf_with_pymupdf(pdf_path, output_dir):
    """Fallback PDF conversion using PyMuPDF"""
    images = []
    
    pdf_document = fitz.open(pdf_path)
    
    for page_num in range(pdf_document.page_count):
        page = pdf_document[page_num]
        
        # Render page to image
        mat = fitz.Matrix(2, 2)  # 2x zoom for better quality
        pix = page.get_pixmap(matrix=mat)
        
        # Save image
        image_path = output_dir / f"page_{page_num+1:04d}.png"
        pix.save(str(image_path))
        images.append(image_path)
    
    pdf_document.close()
    return images

def convert_pptx_to_images(pptx_path, output_dir):
    """Convert PPTX to PNG images"""
    # For simplicity, we'll convert PPTX to PDF first, then to images
    # In production, you might use python-pptx or unoconv
    
    # This is a placeholder - actual implementation would require
    # additional dependencies like python-pptx or LibreOffice
    print("PPTX conversion not implemented in this demo")
    
    # For now, create a dummy image
    dummy_image = Image.new('RGB', (1920, 1080), color='white')
    image_path = output_dir / "page_0001.png"
    dummy_image.save(image_path)
    
    return [image_path]