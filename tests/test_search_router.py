import pytest
import json
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import numpy as np
import base64
import sys
import os

# Add src directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../amplify/functions/search-router/src'))

from handler import handler, load_or_download_index, generate_text_embedding, generate_answer_with_gemini

class TestSearchRouter:
    """Test cases for search-router Lambda function"""
    
    @patch('handler.s3_client')
    @patch('handler.faiss')
    @patch('handler.genai')
    def test_handler_text_search_success(self, mock_genai, mock_faiss, mock_s3):
        """Test successful text search"""
        # Setup test event
        event = {
            'body': json.dumps({
                'query': 'What is machine learning?',
                'userId': 'user123',
                'topK': 3
            })
        }
        
        # Mock index and metadata
        mock_index = Mock()
        mock_index.ntotal = 10
        mock_index.search.return_value = (
            np.array([[0.1, 0.2, 0.3]]),  # distances
            np.array([[0, 1, 2]])  # indices
        )
        
        metadata = {
            'documents': {
                'doc1': {
                    'images': [
                        {'global_index': 0, 'bucket': 'images', 'key': 'img1.png'},
                        {'global_index': 1, 'bucket': 'images', 'key': 'img2.png'},
                        {'global_index': 2, 'bucket': 'images', 'key': 'img3.png'},
                    ]
                }
            }
        }
        
        # Mock load_or_download_index
        with patch('handler.load_or_download_index') as mock_load:
            mock_load.return_value = (mock_index, metadata)
            
            # Mock text embedding
            with patch('handler.generate_text_embedding') as mock_embed:
                mock_embed.return_value = np.random.randn(1024).astype('float32')
                
                # Mock S3 image downloads
                mock_s3.get_object.return_value = {
                    'Body': Mock(read=Mock(return_value=b'fake_image_data'))
                }
                
                # Mock Gemini response
                mock_model = Mock()
                mock_response = Mock()
                mock_response.text = "Machine learning is a subset of AI..."
                mock_model.generate_content.return_value = mock_response
                mock_genai.GenerativeModel.return_value = mock_model
                
                # Call handler
                result = handler(event, {})
        
        # Assertions
        assert result['statusCode'] == 200
        body = json.loads(result['body'])
        assert body['answer'] == "Machine learning is a subset of AI..."
        assert len(body['sources']) == 3
        assert body['totalResults'] == 3
        
        # Verify search was called
        mock_index.search.assert_called_once()
        assert mock_s3.get_object.call_count == 3  # Downloaded 3 images
    
    def test_handler_missing_query(self):
        """Test handler with missing query"""
        event = {
            'body': json.dumps({
                'userId': 'user123'
            })
        }
        
        result = handler(event, {})
        
        assert result['statusCode'] == 400
        body = json.loads(result['body'])
        assert body['error'] == 'Query is required'
    
    def test_handler_invalid_json(self):
        """Test handler with invalid JSON body"""
        event = {
            'body': 'invalid json'
        }
        
        result = handler(event, {})
        
        assert result['statusCode'] == 400
        body = json.loads(result['body'])
        assert body['error'] == 'Invalid JSON in request body'
    
    @patch('handler.load_or_download_index')
    def test_handler_no_index_available(self, mock_load):
        """Test handler when no index is available"""
        event = {
            'body': json.dumps({
                'query': 'test query'
            })
        }
        
        # Mock no index available
        mock_load.return_value = (None, None)
        
        result = handler(event, {})
        
        assert result['statusCode'] == 404
        body = json.loads(result['body'])
        assert body['error'] == 'No index available for search'
    
    @patch('handler.s3_client')
    @patch('handler.faiss')
    def test_load_or_download_index_from_cache(self, mock_faiss, mock_s3):
        """Test loading index from cache"""
        # Create temporary cache files
        with tempfile.TemporaryDirectory() as temp_dir:
            cache_index_path = Path(temp_dir) / 'latest.index'
            cache_meta_path = Path(temp_dir) / 'latest-meta.json'
            
            # Create mock files
            cache_index_path.touch()
            with open(cache_meta_path, 'w') as f:
                json.dump({'test': 'metadata'}, f)
            
            # Mock faiss read
            mock_index = Mock()
            mock_faiss.read_index.return_value = mock_index
            
            # Patch cache paths
            with patch('handler.cached_index_path', str(cache_index_path)):
                with patch('handler.cached_meta_path', str(cache_meta_path)):
                    index, metadata = load_or_download_index()
            
            # Should load from cache without S3 call
            assert index == mock_index
            assert metadata == {'test': 'metadata'}
            mock_s3.download_file.assert_not_called()
    
    @patch('handler.s3_client')
    @patch('handler.faiss')
    def test_load_or_download_index_from_s3(self, mock_faiss, mock_s3):
        """Test downloading index from S3"""
        # Mock S3 download
        mock_s3.download_file = Mock()
        
        # Mock faiss read
        mock_index = Mock()
        mock_index.ntotal = 100
        mock_faiss.read_index.return_value = mock_index
        
        # Mock metadata file
        with patch('builtins.open', create=True) as mock_open:
            mock_file = MagicMock()
            mock_file.read.return_value = json.dumps({'test': 'metadata'})
            mock_open.return_value.__enter__.return_value = mock_file
            
            with patch.dict('os.environ', {'VECTOR_BUCKET': 'vector-files'}):
                index, metadata = load_or_download_index()
        
        # Should download from S3
        assert index == mock_index
        assert metadata == {'test': 'metadata'}
        assert mock_s3.download_file.call_count == 2  # Index + metadata
    
    def test_generate_text_embedding(self):
        """Test text embedding generation"""
        embedding = generate_text_embedding("test query")
        
        # Should return normalized embedding
        assert embedding is not None
        assert embedding.shape == (1024,)
        assert embedding.dtype == np.float32
        assert np.abs(np.linalg.norm(embedding) - 1.0) < 0.001
    
    @patch('handler.genai')
    def test_generate_answer_with_gemini_success(self, mock_genai):
        """Test successful answer generation with Gemini"""
        # Mock Gemini
        mock_model = Mock()
        mock_response = Mock()
        mock_response.text = "This is the answer"
        mock_model.generate_content.return_value = mock_response
        mock_genai.GenerativeModel.return_value = mock_model
        
        # Mock images
        mock_images = [Mock(), Mock()]
        
        answer = generate_answer_with_gemini("test query", mock_images)
        
        assert answer == "This is the answer"
        mock_model.generate_content.assert_called_once()
    
    def test_generate_answer_with_gemini_no_images(self):
        """Test answer generation with no images"""
        answer = generate_answer_with_gemini("test query", [])
        
        assert answer == "No relevant images found to answer your query."
    
    @patch('handler.genai')
    def test_generate_answer_with_gemini_error(self, mock_genai):
        """Test answer generation error handling"""
        # Make Gemini fail
        mock_genai.GenerativeModel.side_effect = Exception("Gemini error")
        
        answer = generate_answer_with_gemini("test query", [Mock()])
        
        # Should return fallback answer
        assert "I found 1 relevant images" in answer
        assert "unable to generate a detailed answer" in answer