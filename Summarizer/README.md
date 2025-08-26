# Video Summarizer MCP Server (Node.js)

This is a Node.js-based MCP (Model Context Protocol) server for video summarization, which uses a Python script to extract audio, transcribe it, and generate structured meeting minutes.

## Features

- Video to audio extraction using MoviePy
- Audio transcription using Groq Whisper API
- Structured meeting minutes generation using OpenRouter API
- MCP protocol support for Claude Desktop
- JSON output with metadata, summary, key topics, action items, and more

## Prerequisites

- Node.js (v16 or higher)
- Python (v3.8 or higher)
- Groq API key (for Whisper transcription)
- OpenRouter API key (for summarization)

## Setup

1. **Run the setup script:**
   ```bash
   setup-summarizer-mcp.bat
   ```

2. **Or manually:**
   ```bash
   cd Summarizer
   pip install -r requirements.txt
   npm install
   ```


## Usage

### Direct Usage
```bash
cd Summarizer
node server.js
```

### MCP Client Integration
Use the wrapper script in your MCP client configuration:

```json
{
  "mcpServers": {
    "video-summarizer": {
      "command": "cmd",
      "args": ["/c", "D:\\Qasim\\AI-ML Bootcamp\\Projects\\MCP-Servers\\summarizer-mcp-wrapper.bat"]
    }
  }
}
```

## Available Tools

- `summarize_video`: Process a video file and generate meeting minutes
- `health`: Check server health status

## Tool Parameters

### summarize_video
- `video_path` (required): Path to the video file to process

## Output Format

The tool returns structured JSON with:
- **metadata**: File info and processing timestamp
- **summary**: Concise 2-3 sentence summary
- **key_topics**: Main topics discussed
- **decisions**: Decisions made during the meeting
- **action_items**: Tasks with owners, deadlines, and priorities
- **participants**: People mentioned or speaking
- **important_quotes**: Notable statements
- **follow_up_questions**: Questions needing answers

## Architecture

- `server.js`: Main MCP server implementation
- `script.py`: Python script for video processing
- `package.json`: Node.js dependencies
- `requirements.txt`: Python dependencies
- `summarizer-mcp-wrapper.bat`: Windows wrapper
- `summarizer-mcp-wrapper.sh`: Bash wrapper
- `summarizer-mcp-wrapper.ps1`: PowerShell wrapper

## Example Usage in Claude

```
Can you use the summarize_video tool to process the meeting recording at "C:\Videos\team_meeting.mp4"?
```

## Troubleshooting

1. **Python not found**: Ensure Python is installed and in PATH
2. **Missing dependencies**: Run `pip install -r requirements.txt`
3. **API errors**: Check your API keys in `.env`
4. **Video format issues**: Ensure video file is supported by MoviePy
5. **Memory issues**: Large videos may require more RAM

## Logs

Server logs are written to `summarizer_mcp.log` in the Summarizer directory.

## Supported Video Formats

- MP4, AVI, MOV, MKV, and other formats supported by MoviePy
- Audio will be extracted as WAV format for transcription
