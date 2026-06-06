import os
import glob

replacements = {
    "info@safevisionsurveillance.com": "shreesawariyacctv@gmail.com",
    "support@safevisionsurveillance.com": "shreesawariyacctv@gmail.com",
    "SafeVision Surveillance Technologies": "SafeVision Surveillance",
    "SafeVision<span> Surveillance Technologies</span>": "SafeVision<span> Surveillance</span>"
}

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content
    for old, new in replacements.items():
        new_content = new_content.replace(old, new)
        
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

def main():
    directory = "/Users/deadlinehub/Documents/GitHub/gb260001-vigilanteye-portal"
    for ext in ('**/*.html', '**/*.js', '**/*.css'):
        for filepath in glob.glob(os.path.join(directory, ext), recursive=True):
            process_file(filepath)
            
if __name__ == "__main__":
    main()
