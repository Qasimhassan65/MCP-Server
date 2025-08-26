# simple_attendance_mcp_server.py
import os
import sys
import logging
import requests
from mcp.server.fastmcp import FastMCP

# IMPORTANT: MCP servers must not print to STDOUT.
logging.basicConfig(stream=sys.stderr, level=logging.INFO)
logging.info("Simple Attendance MCP server started")

mcp = FastMCP("attendance-mcp")

@mcp.tool()
def mark_attendance(image_path: str, write_csv: bool = True) -> dict:
    """
    Identify faces in a single image and (optionally) append to today's CSV.
    Supports both local file paths and Cloudinary URLs.
    """
    logging.info(f"mark_attendance called with image_path={image_path}, write_csv={write_csv}")
    
    # Check if it's a Cloudinary URL
    if image_path.startswith('http'):
        logging.info(f"Processing Cloudinary URL: {image_path}")
        try:
            # Download the image from Cloudinary
            response = requests.get(image_path)
            response.raise_for_status()
            
            # Save to temporary file
            temp_path = f"/tmp/cloudinary_image_{os.path.basename(image_path)}"
            with open(temp_path, 'wb') as f:
                f.write(response.content)
            
            image_path = temp_path
            logging.info(f"Downloaded image to: {temp_path}")
        except Exception as e:
            logging.error(f"Failed to download image: {e}")
            return {
                "ok": False,
                "error": f"Failed to download image from {image_path}: {str(e)}"
            }
    
    # For now, just return a mock response
    return {
        "ok": True,
        "image": image_path,
        "recognized": [
            {
                "label": "Test Person",
                "box": {"x": 100, "y": 100, "w": 200, "h": 200}
            }
        ],
        "csv_path": "/tmp/attendance.csv" if write_csv else None,
        "message": f"Mock attendance marked successfully from {image_path}"
    }

if __name__ == "__main__":
    # Run over stdio so Claude Desktop can talk to it
    mcp.run(transport="stdio")
