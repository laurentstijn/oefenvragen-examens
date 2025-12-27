import sys
import json
import re
from typing import List, Dict

def extract_text_from_pdf(pdf_path: str) -> str:
    """
    Extract text from PDF file
    For now, expects user to provide text extracted from PDF
    In production, this would use PyPDF2 or pdfplumber
    """
    # Since we can't install PyPDF2 without package.json in scripts,
    # we'll read from a text file that user creates
    try:
        with open(pdf_path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        print(f"Error reading file: {e}")
        return ""

def parse_questions_from_text(text: str) -> List[Dict]:
    """
    Parse questions from extracted PDF text
    Expected format:
    1. Question text here?
    A. Option A
    B. Option B  
    C. Option C
    Correct: A
    """
    questions = []
    
    # Split by question numbers
    question_blocks = re.split(r'\n(\d+)\.\s+', text)
    
    # Remove empty first element
    if question_blocks and not question_blocks[0].strip():
        question_blocks = question_blocks[1:]
    
    # Process pairs of (number, content)
    for i in range(0, len(question_blocks)-1, 2):
        question_num = question_blocks[i].strip()
        content = question_blocks[i+1].strip()
        
        # Extract question text (everything before first option)
        question_match = re.match(r'^(.*?)(?=\n[A-C]\.|\nA\)|\na\))', content, re.DOTALL)
        if not question_match:
            continue
            
        question_text = question_match.group(1).strip()
        
        # Extract options A, B, C
        option_a = re.search(r'[Aa][\.\)]\s*(.*?)(?=\n[Bb][\.\)]|\nCorrect|\nAntwoord|$)', content, re.DOTALL)
        option_b = re.search(r'[Bb][\.\)]\s*(.*?)(?=\n[Cc][\.\)]|\nCorrect|\nAntwoord|$)', content, re.DOTALL)
        option_c = re.search(r'[Cc][\.\)]\s*(.*?)(?=\nCorrect|\nAntwoord|\n\d+\.|$)', content, re.DOTALL)
        
        # Extract correct answer
        correct_match = re.search(r'(?:Correct|Antwoord|Answer):\s*([A-Ca-c])', content, re.IGNORECASE)
        
        if question_text and option_a and option_b and option_c and correct_match:
            questions.append({
                'id': int(question_num),
                'question': question_text,
                'options': {
                    'A': option_a.group(1).strip(),
                    'B': option_b.group(1).strip(),
                    'C': option_c.group(1).strip()
                },
                'correctAnswer': correct_match.group(1).upper()
            })
            
    return questions

def split_into_sets(questions: List[Dict], questions_per_set: int = 40) -> Dict[str, List[int]]:
    """
    Split questions into sets
    """
    question_sets = {}
    total_questions = len(questions)
    num_sets = (total_questions + questions_per_set - 1) // questions_per_set
    
    for i in range(num_sets):
        set_name = f"reeks-{i+1}"
        start_idx = i * questions_per_set
        end_idx = min((i + 1) * questions_per_set, total_questions)
        question_sets[set_name] = [q['id'] for q in questions[start_idx:end_idx]]
        
    return question_sets

def main():
    if len(sys.argv) < 2:
        print("Usage: python parse-pdf-questions.py <text_file_path> [questions_per_set]")
        print("\nExpected text format:")
        print("1. Question text?")
        print("A. Option A")
        print("B. Option B")
        print("C. Option C")
        print("Correct: A")
        sys.exit(1)
    
    text_file = sys.argv[1]
    questions_per_set = int(sys.argv[2]) if len(sys.argv) > 2 else 40
    
    print(f"Reading text from: {text_file}")
    text = extract_text_from_pdf(text_file)
    
    if not text:
        print("Error: Could not read text from file")
        sys.exit(1)
    
    print(f"Extracted {len(text)} characters")
    print("Parsing questions...")
    
    questions = parse_questions_from_text(text)
    
    print(f"\nFound {len(questions)} questions")
    
    if questions:
        print("\nFirst 3 questions:")
        for q in questions[:3]:
            print(f"\n{q['id']}. {q['question'][:60]}...")
            print(f"   A: {q['options']['A'][:40]}...")
            print(f"   B: {q['options']['B'][:40]}...")
            print(f"   C: {q['options']['C'][:40]}...")
            print(f"   Correct: {q['correctAnswer']}")
    
    # Create question sets
    question_sets = split_into_sets(questions, questions_per_set)
    
    print(f"\nCreated {len(question_sets)} sets:")
    for set_name, question_ids in question_sets.items():
        print(f"  {set_name}: {len(question_ids)} questions")
    
    # Output as JSON
    output = {
        'questions': questions,
        'questionSets': question_sets,
        'metadata': {
            'totalQuestions': len(questions),
            'questionsPerSet': questions_per_set,
            'numberOfSets': len(question_sets)
        }
    }
    
    output_file = text_file.replace('.txt', '_parsed.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"\nOutput saved to: {output_file}")
    print("\nYou can now copy this JSON to create a new category in the app!")

if __name__ == "__main__":
    main()
