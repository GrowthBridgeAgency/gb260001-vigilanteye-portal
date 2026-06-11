import os
import glob

replacements = {
    "Vigilant<span>Eye</span>": "SafeVision<span> Surveillance Technologies</span>",
    "VigilantEye Surveillance Pvt Ltd.": "Shree Sawariya CCTV Security Services",
    "VigilantEye Surveillance Pvt Ltd": "Shree Sawariya CCTV Security Services",
    "VigilantEye Solutions": "SafeVision Surveillance Technologies",
    "VigilantEye": "SafeVision Surveillance Technologies",
    "info@vigilanteye.com": "info@safevisionsurveillance.com",
    "+91 98765 43210": "+91 9649645559",
    "+919876543210": "+919649645559",
    "+91 87654 32109": "+91 9649645559",
    "123 Security Avenue, Tech District, Mumbai, MH 400001": "In Front of Galav Library, Near MJD Restaurant Lane, Samridhi Nagar Special, Borkheda, Kota, Rajasthan, India"
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
