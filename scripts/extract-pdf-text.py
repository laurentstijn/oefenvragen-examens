import sys
import json
try:
    import PyPDF2
    from io import BytesIO
    import base64
except ImportError:
    print(json.dumps({"error": "PyPDF2 not installed. Install with: pip install PyPDF2"}))
    sys.exit(1)

def extract_text_from_pdf(pdf_base64):
    """Extract text from a base64 encoded PDF"""
    try:
        # Decode base64 to bytes
        pdf_bytes = base64.b64decode(pdf_base64)
        
        # Create PDF reader
        pdf_file = BytesIO(pdf_bytes)
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        
        # Extract text from all pages
        text = ""
        for page_num in range(len(pdf_reader.pages)):
            page = pdf_reader.pages[page_num]
            text += page.extract_text() + "\n"
        
        return {"success": True, "text": text, "pages": len(pdf_reader.pages)}
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No PDF data provided"}))
        sys.exit(1)
    
    pdf_data = sys.argv[1]
    result = extract_text_from_pdf(pdf_data)
    print(json.dumps(result))
