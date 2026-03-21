document.addEventListener('DOMContentLoaded', () => {
    const imageUpload = document.getElementById('imageUpload');
    const sheetType = document.getElementById('sheetType');
    const generateBtn = document.getElementById('generateBtn');
    const previewSection = document.getElementById('previewSection');
    const previewCanvas = document.getElementById('previewCanvas');
    const downloadBtn = document.getElementById('downloadBtn');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const dropZone = document.getElementById('dropZone');
    const dropZonePrompt = document.querySelector('.drop-zone__prompt');
    const croppingArea = document.getElementById('croppingArea');
    const croppingImage = document.getElementById('croppingImage');
    const resetCropBtn = document.getElementById('resetCropBtn');
    const addToGalleryBtn = document.getElementById('addToGalleryBtn');
    const photoGallerySection = document.getElementById('photoGallerySection');
    const photoList = document.getElementById('photoList');
    const capacityBadge = document.getElementById('capacityBadge');

    let selectedFile = null;
    let cropper = null;
    let galleryPhotos = []; // Array of { blob, url, count }

    const SHEET_CAPACITY = {
        '4x6': 8,
        'A4': 42
    };

    // Handle file selection
    imageUpload.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    // Handle drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--primary-color)';
        dropZone.style.backgroundColor = '#eff6ff';
    });

    ['dragleave', 'dragend'].forEach(type => {
        dropZone.addEventListener(type, () => {
            dropZone.style.borderColor = 'var(--border-color)';
            dropZone.style.backgroundColor = '#fdfdfd';
        });
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border-color)';
        dropZone.style.backgroundColor = '#fdfdfd';

        if (e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });

    function handleFileSelect(file) {
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file.');
            return;
        }

        selectedFile = file;
        
        // Load image for cropping
        const reader = new FileReader();
        reader.onload = (e) => {
            croppingImage.src = e.target.result;
            croppingArea.style.display = 'block';
            
            // Destroy existing cropper if any
            if (cropper) {
                cropper.destroy();
            }
            
            // Initialize new cropper
            cropper = new Cropper(croppingImage, {
                aspectRatio: 30 / 35, // Passport photo ratio
                viewMode: 1,
                autoCropArea: 0.6, // Smaller initial area to encourage adjustment
                responsive: true,
                restore: false,
                checkOrientation: false,
                guides: true,
                center: true,
                highlight: false,
                cropBoxMovable: true,
                cropBoxResizable: true,
                toggleDragModeOnDblclick: false,
            });
        };
        reader.readAsDataURL(file);

        dropZonePrompt.textContent = `Selected: ${file.name}`;
        
        // Visual feedback
        dropZone.style.borderColor = 'var(--success-color)';
        dropZone.style.backgroundColor = '#f0fdf4';
        
        // Hide preview if it was shown
        previewSection.style.display = 'none';
    }

    addToGalleryBtn.addEventListener('click', async () => {
        if (!cropper) return;

        // Get cropped canvas
        const croppedCanvas = cropper.getCroppedCanvas({
            width: 354, // PHOTO_WIDTH_PX at 300 DPI
            height: 413, // PHOTO_HEIGHT_PX at 300 DPI
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high',
        });

        // Convert to blob
        const blob = await new Promise(resolve => croppedCanvas.toBlob(resolve, 'image/jpeg', 0.95));
        const url = URL.createObjectURL(blob);

        // Add to gallery
        galleryPhotos.push({ blob, url, count: 1 });
        
        // Update UI
        renderGallery();
        
        // Clear cropper
        croppingArea.style.display = 'none';
        cropper.destroy();
        cropper = null;
        imageUpload.value = '';
        dropZonePrompt.textContent = 'Drop image here or click to upload';
        dropZone.style.borderColor = 'var(--border-color)';
        dropZone.style.backgroundColor = '#fdfdfd';
    });

    function renderGallery() {
        if (galleryPhotos.length > 0) {
            photoGallerySection.style.display = 'block';
            generateBtn.disabled = false;
        } else {
            photoGallerySection.style.display = 'none';
            generateBtn.disabled = true;
        }

        photoList.innerHTML = '';
        galleryPhotos.forEach((photo, index) => {
            const item = document.createElement('div');
            item.className = 'photo-item';
            item.innerHTML = `
                <img src="${photo.url}" alt="Passport photo ${index + 1}">
                <div class="photo-item-controls">
                    <div class="photo-item-qty">
                        <label>Qty:</label>
                        <input type="number" class="qty-input" value="${photo.count}" min="1" max="100" data-index="${index}">
                    </div>
                    <i class="fas fa-trash-alt remove-photo-btn" data-index="${index}"></i>
                </div>
            `;
            photoList.appendChild(item);
        });

        updateCapacity();
        
        // Add listeners for quantity change and remove
        document.querySelectorAll('.qty-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                galleryPhotos[idx].count = parseInt(e.target.value) || 1;
                updateCapacity();
            });
        });

        document.querySelectorAll('.remove-photo-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.index);
                URL.revokeObjectURL(galleryPhotos[idx].url);
                galleryPhotos.splice(idx, 1);
                renderGallery();
            });
        });
    }

    function updateCapacity() {
        const totalPhotos = galleryPhotos.reduce((sum, p) => sum + p.count, 0);
        const capacity = SHEET_CAPACITY[sheetType.value];
        const remaining = capacity - totalPhotos;
        
        if (remaining >= 0) {
            capacityBadge.textContent = `${totalPhotos} / ${capacity} filled (${remaining} left)`;
            capacityBadge.classList.remove('capacity-full');
            generateBtn.disabled = galleryPhotos.length === 0;
        } else {
            capacityBadge.textContent = `${totalPhotos} / ${capacity} filled (${Math.abs(remaining)} over limit!)`;
            capacityBadge.classList.add('capacity-full');
            generateBtn.disabled = true;
        }
    }

    sheetType.addEventListener('change', updateCapacity);

    resetCropBtn.addEventListener('click', () => {
        if (cropper) {
            cropper.reset();
        }
    });

    // Handle generate button click
    generateBtn.addEventListener('click', async () => {
        if (galleryPhotos.length === 0) return;

        showLoading(true);
        previewSection.style.display = 'none';

        try {
            const formData = new FormData();
            
            // Append all photos and their counts
            galleryPhotos.forEach((photo, index) => {
                formData.append('image', photo.blob, `photo_${index}.jpg`);
                formData.append('count', photo.count);
            });
            
            formData.append('sheet_type', sheetType.value);
            
            const orientation = document.querySelector('input[name="orientation"]:checked').value;
            formData.append('orientation', orientation);
            
            // Get extra options
            const addMargins = document.getElementById('addMargins').checked;
            formData.append('add_margins', addMargins);

            const response = await fetch('/generate', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to generate sheet');
            }

            const resultBlob = await response.blob();
            const imageUrl = URL.createObjectURL(resultBlob);

            displayPreview(imageUrl);
            downloadBtn.href = imageUrl;
            downloadBtn.download = `passport_sheet_${sheetType.value}.jpg`;
            
            previewSection.style.display = 'block';
            previewSection.scrollIntoView({ behavior: 'smooth' });

        } catch (error) {
            console.error('Error:', error);
            alert('Error generating sheet: ' + error.message);
        } finally {
            showLoading(false);
        }
    });

    function displayPreview(url) {
        const img = new Image();
        img.onload = () => {
            const ctx = previewCanvas.getContext('2d');
            
            // Set canvas size (proportional to image)
            // We want to show it clearly but not too big
            const maxWidth = 800;
            const scale = Math.min(1, maxWidth / img.width);
            
            previewCanvas.width = img.width * scale;
            previewCanvas.height = img.height * scale;
            
            ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
            ctx.drawImage(img, 0, 0, previewCanvas.width, previewCanvas.height);
        };
        img.src = url;
    }

    function showLoading(show) {
        loadingOverlay.style.display = show ? 'flex' : 'none';
        generateBtn.disabled = show;
    }
});
