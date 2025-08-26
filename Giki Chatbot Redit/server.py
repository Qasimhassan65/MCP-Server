# server.py
import os
import shutil
import argparse
from mcp.server import FastMCP
from chatbot import GIKIbot  # imports your existing class
from pathlib import Path
import logging


# Ensure working directory is project root
os.chdir(os.path.dirname(__file__))


# --- Setup logging to file instead of STDIO ---
logging.basicConfig(
    filename="giki_mcp.log",
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)

# Where FAISS index is stored (same as your chatbot)
INDEX_PATH = "faiss_index"

# Create MCP server object
mcp = FastMCP(name="GIKI-RAG-MCP")

# Initialize your GIKIbot singleton (this will load FAISS / LLM once at startup)
# Note: removed prints to STDIO to avoid JSON errors
logging.info("Starting GIKI MCP server — initializing GIKIbot...")
bot = GIKIbot()
init_msg = bot.initialize_system()
logging.info(f"System initialized: {init_msg}")

# --- Tools exposed to the LLM client (Claude) ---

@mcp.tool()
def ask_giki(question: str) -> dict:
    """Ask a question against the GIKI docs."""
    if not question or not question.strip():
        return {"error": "empty question"}

    raw = bot.ask_question(question)  # returns text + "\n\nSources:\n..."
    # split out Sources block if present
    parts = raw.split("\n\nSources:\n", 1)
    answer_text = parts[0].strip()
    sources = []
    if len(parts) > 1:
        sources = [s.strip() for s in parts[1].splitlines() if s.strip()]

    return {"answer": answer_text, "sources": sources}


@mcp.tool()
def rebuild_index() -> str:
    """Admin tool: delete saved FAISS index and rebuild from files."""
    idx = Path(INDEX_PATH)
    if idx.exists():
        try:
            shutil.rmtree(idx)
        except Exception as e:
            logging.error(f"Error removing index: {e}")
            return f"Error removing index: {e}"

    return bot.initialize_system()


@mcp.tool()
def health() -> dict:
    """Simple health check for monitoring."""
    return {
        "status": "ok",
        "initialized": bool(bot.qa_chain),
        "faiss_exists": Path(INDEX_PATH).exists()
    }


# --- Runner: allow choosing transport via CLI args ---
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["stdio", "streamable-http", "fastapi"], default="stdio",
                        help="MCP transport mode (stdio for local Claude Desktop).")
    parser.add_argument("--host", default="127.0.0.1", help="host for HTTP transports")
    parser.add_argument("--port", default=8000, type=int, help="port for HTTP transports")
    args = parser.parse_args()

    # MCP startup messages should not print to STDIO
    logging.info(f"Starting MCP server in mode: {args.mode}")
    if args.mode == "stdio":
        mcp.run(transport="stdio")
    elif args.mode == "streamable-http":
        mcp.run(transport="streamable-http", host=args.host, port=args.port)
    else:  # fastapi
        mcp.run(transport="fastapi", host=args.host, port=args.port)
