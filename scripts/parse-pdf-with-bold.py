import sys
import json
import re
from PyPDF2 import PdfReader

def is_bold_font(font_name):
    """Check if font name indicates bold text"""
    if not font_name:
        return False
    font_lower = font_name.lower()
    return any(keyword in font_lower for keyword in ['bold', 'heavy', 'black', 'demi'])

def extract_text_with_formatting(pdf_path):
    """Extract text from PDF with formatting information"""
    try:
        reader = PdfReader(pdf_path)
        full_text = ""
        
        for page in reader.pages:
            # Get text
            text = page.extract_text()
            full_text += text + "\n"
        
        return full_text
    except Exception as e:
        print(f"Error reading PDF: {str(e)}", file=sys.stderr)
        return None

def parse_questions(text):
    """Parse questions from extracted text"""
    questions = []
    
    # Split by question numbers (e.g., "1.", "2.", etc.)
    question_pattern = r'(\d+)\.\s+(.*?)(?=\d+\.\s+|$)'
    matches = re.finditer(question_pattern, text, re.DOTALL)
    
    for match in matches:
        question_num = match.group(1)
        question_text = match.group(2).strip()
        
        # Extract question and options
        lines = question_text.split('\n')
        question = lines[0].strip() if lines else ""
        
        # Find options (A-F)
        options = []
        option_pattern = r'^([A-F])[.\)]\s+(.+)$'
        
        for line in lines[1:]:
            line = line.strip()
            option_match = re.match(option_pattern, line)
            if option_match:
                label = option_match.group(1)
                text = option_match.group(2)
                options.append({"label": label, "text": text})
        
        if question and len(options) >= 2:
            questions.append({
                "question": question,
                "options": options,
                "correctAnswer": None  # Will be set manually
            })
    
    return questions

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python parse-pdf-with-bold.py <pdf_path>", file=sys.stderr)
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    
    # Extract text
    text = extract_text_with_formatting(pdf_path)
    
    if not text:
        print(json.dumps({"error": "Failed to extract text from PDF"}))
        sys.exit(1)
    
    # Parse questions
    questions = parse_questions(text)
    
    # Output as JSON
    print(json.dumps({
        "success": True,
        "questions": questions,
        "totalQuestions": len(questions)
    }))
