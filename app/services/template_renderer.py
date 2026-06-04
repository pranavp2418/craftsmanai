"""Template rendering service using Jinja2"""
import os
import logging
from jinja2 import Environment, FileSystemLoader, select_autoescape
from pathlib import Path

logger = logging.getLogger(__name__)

# Get the templates directory path
TEMPLATES_DIR = Path(__file__).parent.parent / "templates"

# Initialize Jinja2 environment
env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(['html', 'xml']),
    enable_async=True
)


def get_template_path(template_name: str) -> str:
    """
    Get the full path to a template file.
    
    Args:
        template_name: Name of the template folder (e.g., 'signup_otp')
    
    Returns:
        Path to the index.html file in the template folder
    """
    template_path = TEMPLATES_DIR / template_name / "index.html"
    if not template_path.exists():
        raise FileNotFoundError(f"Template not found: {template_path}")
    return str(template_path)


async def render_template(template_name: str, context: dict) -> str:
    """
    Render a Jinja2 template with the given context.
    
    Args:
        template_name: Name of the template folder (e.g., 'signup_otp')
        context: Dictionary of variables to pass to the template
    
    Returns:
        Rendered HTML string
    """
    try:
        template = env.get_template(f"{template_name}/index.html")
        rendered = await template.render_async(**context)
        logger.info(f"Successfully rendered template: {template_name}")
        return rendered
    except Exception as e:
        logger.error(f"Failed to render template {template_name}: {str(e)}")
        raise


def render_template_sync(template_name: str, context: dict) -> str:
    """
    Render a Jinja2 template synchronously with the given context.
    
    Args:
        template_name: Name of the template folder (e.g., 'signup_otp')
        context: Dictionary of variables to pass to the template
    
    Returns:
        Rendered HTML string
    """
    try:
        template = env.get_template(f"{template_name}/index.html")
        rendered = template.render(**context)
        logger.info(f"Successfully rendered template (sync): {template_name}")
        return rendered
    except Exception as e:
        logger.error(f"Failed to render template {template_name}: {str(e)}")
        raise
