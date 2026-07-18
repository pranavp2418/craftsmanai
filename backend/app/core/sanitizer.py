"""
Input sanitization utilities for XSS prevention.
"""
import re
import html
from typing import Optional
from fastapi import HTTPException, status


class InputSanitizer:
    """Sanitize user inputs to prevent XSS attacks."""
    
    # Allowed HTML tags for rich text fields (if needed)
    ALLOWED_TAGS = {
        'p', 'br', 'b', 'i', 'u', 'em', 'strong', 'a', 'ul', 'ol', 'li',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div'
    }
    
    # Allowed attributes for specific tags
    ALLOWED_ATTRIBUTES = {
        'a': ['href', 'title', 'target'],
        'span': ['style'],
        'div': ['style'],
    }
    
    @staticmethod
    def sanitize_html(text: Optional[str]) -> str:
        """
        Sanitize HTML content by escaping dangerous characters.
        
        Args:
            text: Input text that may contain HTML
            
        Returns:
            Sanitized text with HTML escaped
        """
        if not text:
            return ""
        
        # Escape HTML entities
        escaped = html.escape(text, quote=True)
        
        return escaped
    
    @staticmethod
    def sanitize_plain_text(text: Optional[str], max_length: int = 1000) -> str:
        """
        Sanitize plain text input by removing all HTML and limiting length.
        
        Args:
            text: Input text
            max_length: Maximum allowed length
            
        Returns:
            Sanitized plain text
        """
        if not text:
            return ""
        
        # Remove all HTML tags
        text = re.sub(r'<[^>]*>', '', str(text))
        
        # Decode HTML entities
        text = html.unescape(text)
        
        # Remove control characters except newlines and tabs
        text = ''.join(char for char in text if char >= ' ' or char in '\n\t')
        
        # Limit length
        if len(text) > max_length:
            text = text[:max_length]
        
        return text.strip()
    
    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """
        Sanitize filename to prevent path traversal attacks.
        
        Args:
            filename: Original filename
            
        Returns:
            Safe filename
        """
        if not filename:
            return "unnamed"
        
        # Remove path components
        filename = os.path.basename(filename)
        
        # Remove special characters except alphanumeric, dot, dash, underscore
        filename = re.sub(r'[^a-zA-Z0-9._-]', '', filename)
        
        # Ensure filename doesn't start with a dot (hidden files)
        filename = filename.lstrip('.')
        
        # Limit length
        if len(filename) > 255:
            name, ext = os.path.splitext(filename)
            filename = name[:250] + ext
        
        return filename if filename else "unnamed"
    
    @staticmethod
    def sanitize_url(url: str) -> str:
        """
        Sanitize URL to prevent javascript: and data: schemes.
        
        Args:
            url: URL to sanitize
            
        Returns:
            Sanitized URL or empty string if dangerous
        """
        if not url:
            return ""
        
        url = url.strip()
        
        # Block dangerous protocols
        dangerous_protocols = ['javascript:', 'data:', 'vbscript:', 'file:']
        url_lower = url.lower()
        
        for protocol in dangerous_protocols:
            if url_lower.startswith(protocol):
                return ""
        
        # Only allow http, https, and relative URLs
        if not (url_lower.startswith('http://') or 
                url_lower.startswith('https://') or 
                url_lower.startswith('/') or
                url_lower.startswith('./')):
            return ""
        
        return url
    
    @staticmethod
    def sanitize_email(email: str) -> str:
        """
        Sanitize email address.
        
        Args:
            email: Email address to sanitize
            
        Returns:
            Sanitized email (lowercase, trimmed)
        """
        if not email:
            return ""
        
        # Convert to lowercase and strip whitespace
        email = email.lower().strip()
        
        # Remove any HTML/script tags
        email = re.sub(r'<[^>]*>', '', email)
        
        return email
    
    @staticmethod
    def sanitize_phone(phone: str) -> str:
        """
        Sanitize phone number.
        
        Args:
            phone: Phone number to sanitize
            
        Returns:
            Sanitized phone number (digits only, with + prefix)
        """
        if not phone:
            return ""
        
        # Keep only digits and + sign
        phone = re.sub(r'[^\d+]', '', phone)
        
        # Ensure it starts with + if it has digits
        if phone and phone[0].isdigit():
            phone = '+' + phone
        
        return phone


import os


def sanitize_user_input(text: Optional[str], field_type: str = "plain") -> str:
    """
    Convenience function to sanitize user input based on field type.
    
    Args:
        text: Input text to sanitize
        field_type: Type of field ('plain', 'html', 'email', 'phone', 'url', 'filename')
        
    Returns:
        Sanitized text
    """
    sanitizer = InputSanitizer()
    
    if field_type == "html":
        return sanitizer.sanitize_html(text)
    elif field_type == "email":
        return sanitizer.sanitize_email(text)
    elif field_type == "phone":
        return sanitizer.sanitize_phone(text)
    elif field_type == "url":
        return sanitizer.sanitize_url(text)
    elif field_type == "filename":
        return sanitizer.sanitize_filename(text)
    else:  # plain text
        return sanitizer.sanitize_plain_text(text)


# Common XSS patterns to detect and block
XSS_PATTERNS = [
    r'<script[^>]*>.*?</script>',
    r'javascript:',
    r'on\w+\s*=',  # onclick, onload, etc.
    r'<iframe',
    r'<object',
    r'<embed',
    r'<applet',
    r'<meta',
    r'<link',
    r'<style',
    r'expression\s*\(',
    r'url\s*\(',
    r'@import',
]


def detect_xss_attempt(text: str) -> bool:
    """
    Detect potential XSS attacks in input.
    
    Args:
        text: Text to check for XSS patterns
        
    Returns:
        True if XSS pattern detected, False otherwise
    """
    if not text:
        return False
    
    text_lower = text.lower()
    
    for pattern in XSS_PATTERNS:
        if re.search(pattern, text_lower, re.IGNORECASE):
            return True
    
    return False


def validate_and_sanitize(text: Optional[str], field_type: str = "plain", 
                         max_length: int = 1000, allow_html: bool = False) -> str:
    """
    Validate and sanitize user input with XSS detection.
    
    Args:
        text: Input text
        field_type: Type of field
        max_length: Maximum allowed length
        allow_html: Whether to allow HTML (will be sanitized)
        
    Returns:
        Sanitized text
        
    Raises:
        HTTPException: If XSS attack detected
    """
    if not text:
        return ""
    
    # Check for XSS patterns
    if detect_xss_attempt(text):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid input: potentially malicious content detected"
        )
    
    # Sanitize based on field type
    sanitized = sanitize_user_input(text, field_type)
    
    # Apply length limit
    if len(sanitized) > max_length:
        sanitized = sanitized[:max_length]
    
    return sanitized