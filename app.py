import io
from flask import Flask, request, send_file, render_template
from PIL import Image, ImageOps, ImageDraw
import math

app = Flask(__name__)

# Constants for passport photo size (30mm x 35mm at 300 DPI)
DPI = 300
MM_TO_INCH = 1 / 25.4
PHOTO_WIDTH_MM = 30
PHOTO_HEIGHT_MM = 35

PHOTO_WIDTH_PX = int(PHOTO_WIDTH_MM * MM_TO_INCH * DPI)
PHOTO_HEIGHT_PX = int(PHOTO_HEIGHT_MM * MM_TO_INCH * DPI)

# Sheet configurations
SHEET_CONFIGS = {
    '4x6': {
        'width_inch': 4,
        'height_inch': 6,
        'cols': 2,
        'rows': 4,
        'count': 8
    },
    'A4': {
        'width_inch': 8.27,
        'height_inch': 11.69,
        'cols': 6,
        'rows': 7,
        'count': 42
    }
}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/generate', methods=['POST'])
def generate_sheet():
    files = request.files.getlist('image')
    counts = request.form.getlist('count')
    sheet_type = request.form.get('sheet_type', '4x6')
    orientation = request.form.get('orientation', 'portrait')
    add_margins = request.form.get('add_margins') == 'true'
    
    if not files:
        return 'No images uploaded', 400
    
    if sheet_type not in SHEET_CONFIGS:
        return 'Invalid sheet type', 400
    
    config = SHEET_CONFIGS[sheet_type].copy()
    
    if orientation == 'landscape':
        config['width_inch'], config['height_inch'] = config['height_inch'], config['width_inch']
        config['cols'], config['rows'] = config['rows'], config['cols']
    
    photo_list = []
    try:
        for i, file in enumerate(files):
            img = Image.open(file.stream)
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # 1. Resize to passport size
            passport_photo = ImageOps.fit(img, (PHOTO_WIDTH_PX, PHOTO_HEIGHT_PX), Image.Resampling.LANCZOS)
            
            # 2. Add cutting margin if requested
            if add_margins:
                # Draw a dark gray border (2px) to make it clearly visible
                draw = ImageDraw.Draw(passport_photo)
                margin_color = (150, 150, 150) # Darker gray
                draw.rectangle([0, 0, PHOTO_WIDTH_PX-1, PHOTO_HEIGHT_PX-1], outline=margin_color, width=2)
            
            count = int(counts[i]) if i < len(counts) else 1
            for _ in range(count):
                photo_list.append(passport_photo)
        
        # Create the sheet
        sheet_width_px = int(config['width_inch'] * DPI)
        sheet_height_px = int(config['height_inch'] * DPI)
        sheet = Image.new('RGB', (sheet_width_px, sheet_height_px), color='white')
        
        # Calculate spacing
        spacing_x = (sheet_width_px - (config['cols'] * PHOTO_WIDTH_PX)) // (config['cols'] + 1)
        spacing_y = (sheet_height_px - (config['rows'] * PHOTO_HEIGHT_PX)) // (config['rows'] + 1)
        
        # Paste photos onto the sheet until we fill the grid or run out of photos
        current_photo_idx = 0
        for row in range(config['rows']):
            for col in range(config['cols']):
                if current_photo_idx >= len(photo_list):
                    break # All photos placed
                
                x = spacing_x + col * (PHOTO_WIDTH_PX + spacing_x)
                y = spacing_y + row * (PHOTO_HEIGHT_PX + spacing_y)
                sheet.paste(photo_list[current_photo_idx], (x, y))
                current_photo_idx += 1
            
            if current_photo_idx >= len(photo_list):
                break
        
        # Return the result
        img_byte_arr = io.BytesIO()
        sheet.save(img_byte_arr, format='JPEG', dpi=(DPI, DPI), quality=95, subsampling=0)
        img_byte_arr.seek(0)
        
        return send_file(img_byte_arr, mimetype='image/jpeg', as_attachment=True, download_name=f'passport_sheet_{sheet_type}.jpg')
        
    except Exception as e:
        return str(e), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
