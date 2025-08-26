import os
import json
from datetime import datetime
from openai import OpenAI
from dotenv import load_dotenv
from groq import Groq
from moviepy import VideoFileClip

# Load API keys from .env file
load_dotenv()

# OpenRouter client for summarization
client_openrouter = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY")
)

# Groq client for Whisper transcription
client_groq = Groq(api_key=os.getenv("GROQ_API_KEY"))

# ---------- STEP 1: Extract Audio from Video using MoviePy ----------
def extract_audio(input_file, output_file="output_audio.wav"):
    video = VideoFileClip(input_file)
    audio = video.audio
    audio.write_audiofile(
        output_file,
        fps=16000,       # sample rate (same as FFmpeg)
        nbytes=2,        # 16-bit audio
        codec="pcm_s16le"  # WAV format
    )
    return output_file

# ---------- STEP 2: Transcription using Groq Whisper API ----------
def transcribe_audio(audio_file):
    with open(audio_file, "rb") as f:
        transcription = client_groq.audio.transcriptions.create(
            file=(audio_file, f),
            model="whisper-large-v3-turbo",  # or "whisper-large-v3"
            response_format="json"
        )
    return transcription.text

# ---------- STEP 3: Summarization via OpenRouter (GPT-3.5) ----------
def summarize_transcript(transcript, filename=None):
    prompt = f"""
    You are an assistant that generates structured meeting minutes and notes from audio/video content.
    Input: Transcript of a meeting, presentation, or discussion.
    
    IMPORTANT: Return ONLY valid JSON without any markdown formatting, code blocks, or additional text.
    
    Output a valid JSON object with the following structure:
    {{
        "metadata": {{
            "filename": "{filename or 'unknown'}",
            "processing_timestamp": "auto-generated",
            "content_type": "meeting|presentation|discussion"
        }},
        "summary": "A concise 2-3 sentence summary of the main content",
        "key_topics": ["list", "of", "main", "topics", "discussed"],
        "decisions": ["list", "of", "decisions", "made", "if", "any"],
        "action_items": [
            {{
                "task": "description of the action item",
                "owner": "person responsible (if mentioned)",
                "deadline": "deadline if mentioned",
                "priority": "high|medium|low"
            }}
        ],
        "participants": ["list", "of", "people", "mentioned", "or", "speaking"],
        "important_quotes": ["notable", "quotes", "or", "statements"],
        "follow_up_questions": ["questions", "that", "need", "answers"]
    }}
    
    Rules:
    - Return ONLY the JSON object, no markdown formatting
    - If a field has no relevant data, use an empty array []
    - Keep summaries concise but informative
    - Extract action items even if not explicitly stated as such
    - Identify participants from the transcript (speakers, presenters, mentioned people)
    - Include any deadlines or timeframes mentioned
    - Use "Not specified" for missing optional fields like deadline or owner
    
    Transcript:
    {transcript}
    """

    response = client_openrouter.chat.completions.create(
        model="deepseek/deepseek-r1-0528-qwen3-8b:free",
        messages=[{"role": "user", "content": prompt}]
    )

    return response.choices[0].message.content

# ---------- STEP 4: Main ----------
if __name__ == "__main__":
    import sys
    
    # Get video file path from command line argument or use default
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    else:
        input_file = "meeting.mp4"   # Default fallback
    
    print(f"[INFO] Processing video file: {input_file}")
    
    try:
        audio_file = extract_audio(input_file)
        print("[INFO] Audio extracted.")

        transcript = transcribe_audio(audio_file)
        print("[INFO] Transcription completed.")

        minutes_json = summarize_transcript(transcript, filename=input_file)
        print("[INFO] Meeting Minutes Generated:\n")
        
        # Try to parse and pretty-print the JSON
        try:
            parsed_json = json.loads(minutes_json)
            # Add timestamp if not present
            if "metadata" in parsed_json and "processing_timestamp" in parsed_json["metadata"]:
                parsed_json["metadata"]["processing_timestamp"] = datetime.now().isoformat()
            print(json.dumps(parsed_json, indent=2))
        except json.JSONDecodeError:
            print("Raw output (JSON parsing failed):")
            print(minutes_json)
            
    except Exception as e:
        print(f"[ERROR] Failed to process video: {str(e)}")
        sys.exit(1)