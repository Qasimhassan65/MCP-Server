# attendance_mcp_server.py
import os
import sys
import logging
from mcp.server.fastmcp import FastMCP
from recog_utils import mark_attendance_from_image_path

# IMPORTANT: MCP servers must not print to STDOUT.
logging.basicConfig(stream=sys.stderr, level=logging.INFO)
logging.info("Attendance MCP server started")

mcp = FastMCP("attendance-mcp")

@mcp.tool()
def mark_attendance(image_path: str, write_csv: bool = True) -> dict:
    """
    Identify faces in a single image and (optionally) append to today's CSV.
    """
    logging.info(f"mark_attendance called with image_path={image_path}, write_csv={write_csv}")
    result = mark_attendance_from_image_path(image_path, write_csv=write_csv)
    return result

if __name__ == "__main__":
    # Run over stdio so Claude Desktop can talk to it
    mcp.run(transport="stdio")
