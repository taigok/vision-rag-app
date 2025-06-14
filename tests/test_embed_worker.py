import pytest
import json
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import numpy as np
import sys
import os

# Add src directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../amplify/functions/embed-worker/src'))

from handler import handler, generate_image_embedding

class TestEmbedWorker:
    """Test cases for embed-worker Lambda function"""
    
    @patch('handler.s3_client')
    @patch('handler.faiss')
    def test_handler_valid_image(self, mock_faiss, mock_s3):
        """Test handler with valid image file"""
        # Setup test event
        event = {
            'Records': [{
                's3': {
                    'bucket': {'name': 'images'},
                    'object': {'key': 'private/user123/doc456/page_0001.png'}
                }
            }]
        }
        
        # Mock S3 list_objects_v2
        mock_s3.list_objects_v2.return_value = {
            'Contents': [
                {'Key': 'private/user123/doc456/page_0001.png'},
                {'Key': 'private/user123/doc456/page_0002.png'}
            ]
        }
        
        # Mock S3 download
        mock_s3.download_file = Mock()
        
        # Mock Faiss index
        mock_index = Mock()
        mock_index.ntotal = 0
        mock_index.add = Mock()
        mock_faiss.IndexFlatL2.return_value = mock_index
        mock_faiss.write_index = Mock()
        
        # Mock image embedding generation
        with patch('handler.generate_image_embedding') as mock_embed:
            mock_embed.return_value = np.random.randn(1024).astype('float32')
            
            # Mock S3 upload
            mock_s3.upload_file = Mock()
            
            # Set environment variable
            with patch.dict('os.environ', {'VECTOR_BUCKET': 'vector-files'}):
                # Call handler
                result = handler(event, {})
        
        # Assertions
        assert result['statusCode'] == 200
        body = json.loads(result['body'])
        assert body['documentId'] == 'doc456'
        assert body['vectorCount'] == 2
        
        # Verify operations
        assert mock_s3.list_objects_v2.call_count == 1
        assert mock_s3.download_file.call_count == 2  # Two images
        assert mock_index.add.call_count == 2
        assert mock_s3.upload_file.call_count == 2  # Index + metadata
    
    def test_handler_non_first_page(self):
        """Test handler skips non-first page images"""
        event = {
            'Records': [{
                's3': {
                    'bucket': {'name': 'images'},
                    'object': {'key': 'private/user123/doc456/page_0002.png'}
                }
            }]
        }
        
        # Should return None for non-first page
        result = handler(event, {})
        assert result is None
    
    @patch('handler.s3_client')
    def test_handler_no_images_found(self, mock_s3):
        """Test handler when no images are found"""
        event = {
            'Records': [{
                's3': {
                    'bucket': {'name': 'images'},
                    'object': {'key': 'private/user123/doc456/page_0001.png'}
                }
            }]
        }
        
        # Mock empty S3 response
        mock_s3.list_objects_v2.return_value = {}
        
        with patch.dict('os.environ', {'VECTOR_BUCKET': 'vector-files'}):
            result = handler(event, {})
        
        # Should return None when no images found
        assert result is None
    
    @patch('handler.s3_client')
    @patch('handler.faiss')
    def test_handler_no_embeddings_generated(self, mock_faiss, mock_s3):
        """Test handler when no embeddings are generated"""
        event = {
            'Records': [{
                's3': {
                    'bucket': {'name': 'images'},
                    'object': {'key': 'private/user123/doc456/page_0001.png'}
                }
            }]
        }
        
        # Mock S3 responses
        mock_s3.list_objects_v2.return_value = {
            'Contents': [{'Key': 'private/user123/doc456/page_0001.png'}]
        }
        mock_s3.download_file = Mock()
        
        # Mock Faiss index with no vectors
        mock_index = Mock()
        mock_index.ntotal = 0
        mock_faiss.IndexFlatL2.return_value = mock_index
        
        # Mock failed embedding generation
        with patch('handler.generate_image_embedding') as mock_embed:
            mock_embed.return_value = None
            
            with patch.dict('os.environ', {'VECTOR_BUCKET': 'vector-files'}):
                result = handler(event, {})
        
        # Should return error when no embeddings generated
        assert result['statusCode'] == 400
        body = json.loads(result['body'])
        assert 'error' in body
    
    @patch('handler.Image')
    def test_generate_image_embedding_success(self, mock_image_lib):
        """Test successful image embedding generation"""
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            image_path = temp_path / 'test.png'
            
            # Create mock image file
            image_path.touch()
            
            # Mock PIL Image
            mock_img = Mock()
            mock_img.mode = 'RGB'
            mock_img.thumbnail = Mock()
            mock_img.save = Mock()
            mock_image_lib.open.return_value.__enter__.return_value = mock_img
            
            # Generate embedding
            embedding = generate_image_embedding(image_path)
            
            # Assertions
            assert embedding is not None
            assert embedding.shape == (1024,)
            assert embedding.dtype == np.float32
            # Check normalization
            assert np.abs(np.linalg.norm(embedding) - 1.0) < 0.001
    
    @patch('handler.Image')
    def test_generate_image_embedding_rgb_conversion(self, mock_image_lib):
        """Test image embedding generation with RGB conversion"""
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            image_path = temp_path / 'test.png'
            image_path.touch()
            
            # Mock non-RGB image
            mock_img = Mock()
            mock_img.mode = 'RGBA'
            mock_img_rgb = Mock()
            mock_img_rgb.thumbnail = Mock()
            mock_img_rgb.save = Mock()
            mock_img.convert.return_value = mock_img_rgb
            mock_image_lib.open.return_value.__enter__.return_value = mock_img
            
            # Generate embedding
            embedding = generate_image_embedding(image_path)
            
            # Should have converted to RGB
            mock_img.convert.assert_called_once_with('RGB')
            assert embedding is not None
    
    def test_generate_image_embedding_error(self):
        """Test image embedding generation error handling"""
        # Try with non-existent file
        embedding = generate_image_embedding(Path('/nonexistent/image.png'))
        
        # Should return None on error
        assert embedding is None