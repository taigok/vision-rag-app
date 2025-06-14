import pytest
import json
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import sys
import os

# Add src directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../amplify/functions/convert-worker/src'))

from handler import handler, convert_pdf_to_images, convert_pdf_with_pymupdf

class TestConvertWorker:
    """Test cases for convert-worker Lambda function"""
    
    @patch('handler.s3_client')
    def test_handler_valid_pdf(self, mock_s3):
        """Test handler with valid PDF file"""
        # Setup test event
        event = {
            'Records': [{
                's3': {
                    'bucket': {'name': 'raw-files'},
                    'object': {'key': 'private/user123/test.pdf'}
                }
            }]
        }
        
        # Mock S3 download
        mock_s3.download_file = Mock()
        
        # Mock PDF conversion
        with patch('handler.convert_pdf_to_images') as mock_convert:
            mock_convert.return_value = [Path('/tmp/page_0001.png')]
            
            # Mock S3 upload
            mock_s3.upload_file = Mock()
            
            # Set environment variable
            with patch.dict('os.environ', {'DEST_BUCKET': 'images'}):
                # Call handler
                result = handler(event, {})
        
        # Assertions
        assert result['statusCode'] == 200
        body = json.loads(result['body'])
        assert body['sourceFile'] == 'test.pdf'
        assert body['totalPages'] == 1
        assert len(body['images']) == 1
        
        # Verify S3 operations
        mock_s3.download_file.assert_called_once()
        mock_s3.upload_file.assert_called_once()
    
    def test_handler_invalid_key_format(self):
        """Test handler with invalid S3 key format"""
        event = {
            'Records': [{
                's3': {
                    'bucket': {'name': 'raw-files'},
                    'object': {'key': 'invalid/key'}
                }
            }]
        }
        
        # Should return None for invalid key
        result = handler(event, {})
        assert result is None
    
    @patch('handler.s3_client')
    def test_handler_unsupported_file_type(self, mock_s3):
        """Test handler with unsupported file type"""
        event = {
            'Records': [{
                's3': {
                    'bucket': {'name': 'raw-files'},
                    'object': {'key': 'private/user123/test.txt'}
                }
            }]
        }
        
        # Mock S3 download
        mock_s3.download_file = Mock()
        
        with patch.dict('os.environ', {'DEST_BUCKET': 'images'}):
            result = handler(event, {})
        
        # Should return None for unsupported file type
        assert result is None
    
    @patch('handler.convert_from_path')
    def test_convert_pdf_to_images_success(self, mock_convert):
        """Test successful PDF to image conversion"""
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            pdf_path = temp_path / 'test.pdf'
            
            # Create mock PDF file
            pdf_path.touch()
            
            # Mock PIL images
            mock_image = Mock()
            mock_image.save = Mock()
            mock_convert.return_value = [mock_image]
            
            # Convert
            images = convert_pdf_to_images(pdf_path, temp_path)
            
            # Assertions
            assert len(images) == 1
            assert images[0].name == 'page_0001.png'
            mock_image.save.assert_called_once()
    
    @patch('handler.convert_from_path')
    @patch('handler.convert_pdf_with_pymupdf')
    def test_convert_pdf_fallback_to_pymupdf(self, mock_pymupdf, mock_convert):
        """Test fallback to PyMuPDF when pdf2image fails"""
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            pdf_path = temp_path / 'test.pdf'
            pdf_path.touch()
            
            # Make pdf2image fail
            mock_convert.side_effect = Exception("pdf2image failed")
            
            # Mock PyMuPDF conversion
            mock_pymupdf.return_value = [temp_path / 'page_0001.png']
            
            # Convert
            images = convert_pdf_to_images(pdf_path, temp_path)
            
            # Should have used PyMuPDF fallback
            mock_pymupdf.assert_called_once_with(pdf_path, temp_path)
            assert len(images) == 1
    
    @patch('handler.fitz')
    def test_convert_pdf_with_pymupdf(self, mock_fitz):
        """Test PyMuPDF conversion"""
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            pdf_path = temp_path / 'test.pdf'
            pdf_path.touch()
            
            # Mock PDF document
            mock_doc = Mock()
            mock_doc.page_count = 2
            mock_page = Mock()
            mock_pix = Mock()
            mock_pix.save = Mock()
            mock_page.get_pixmap.return_value = mock_pix
            mock_doc.__getitem__ = Mock(return_value=mock_page)
            mock_fitz.open.return_value = mock_doc
            
            # Convert
            images = convert_pdf_with_pymupdf(pdf_path, temp_path)
            
            # Assertions
            assert len(images) == 2
            assert mock_pix.save.call_count == 2
            mock_doc.close.assert_called_once()