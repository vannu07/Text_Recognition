// Global variables
let selectedFile = null;
let webcamStream = null;
let currentMethod = 'upload';
let startTime = null;

// Switch input method
function switchMethod(method, triggerBtn) {
    currentMethod = method;

    // Update buttons
    document.querySelectorAll('.method-btn').forEach(btn => {
        const isActive = btn === triggerBtn || btn.dataset.method === method;
        btn.classList.toggle('active', isActive);
    });

    // Update content panes
    document.querySelectorAll('.method-content').forEach(content => {
        content.classList.toggle('active', content.id === `${method}Method`);
    });

    // Stop webcam if switching away
    if (method !== 'webcam' && webcamStream) {
        stopWebcam();
    }
}

// Webcam functions
async function startWebcam() {
    try {
        webcamStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const video = document.getElementById('webcam');
        video.srcObject = webcamStream;
        video.style.display = 'block';
        
        document.getElementById('startWebcam').style.display = 'none';
        document.getElementById('captureBtn').style.display = 'inline-block';
        document.getElementById('stopWebcam').style.display = 'inline-block';
        
        showToast('Camera started successfully', 'success');
    } catch (error) {
        showToast('Camera access denied', 'error');
        console.error('Webcam error:', error);
    }
}

function stopWebcam() {
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        document.getElementById('webcam').style.display = 'none';
        document.getElementById('startWebcam').style.display = 'inline-block';
        document.getElementById('captureBtn').style.display = 'none';
        document.getElementById('stopWebcam').style.display = 'none';
        webcamStream = null;
    }
}

function captureImage() {
    const video = document.getElementById('webcam');
    const canvas = document.getElementById('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    canvas.toBlob(blob => {
        selectedFile = new File([blob], 'webcam-capture.jpg', { type: 'image/jpeg' });
        displayImagePreview(selectedFile);
        stopWebcam();
        showToast('Image captured successfully', 'success');
    }, 'image/jpeg');
}

// Load image from URL
async function loadFromUrl() {
    const url = document.getElementById('imageUrl').value.trim();
    if (!url) {
        showToast('Please enter a valid URL', 'error');
        return;
    }
    
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        selectedFile = new File([blob], 'url-image.jpg', { type: blob.type });
        displayImagePreview(selectedFile);
        showToast('Image loaded successfully', 'success');
    } catch (error) {
        showToast('Failed to load image from URL', 'error');
        console.error('URL load error:', error);
    }
}

// Image input change handler
document.addEventListener('DOMContentLoaded', function() {
    const imageInput = document.getElementById('imageInput');
    if (imageInput) {
        imageInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                selectedFile = file;
                displayImagePreview(file);
            }
        });
    }

    // Wire method buttons
    document.querySelectorAll('.method-btn[data-method]').forEach(btn => {
        btn.addEventListener('click', () => switchMethod(btn.dataset.method, btn));
    });

    // Drag and drop functionality
    const uploadZone = document.querySelector('.upload-drop-zone');
    
    if (uploadZone) {
        // Open file chooser on click
        uploadZone.addEventListener('click', () => {
            if (imageInput) {
                imageInput.click();
            }
        });

        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('drag-over');
        });

        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('drag-over');
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('drag-over');
            
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                selectedFile = file;
                displayImagePreview(file);
            } else {
                showToast('Please drop a valid image file', 'error');
            }
        });
    }
});

// Display image preview
function displayImagePreview(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const previewDiv = document.getElementById('imagePreview');
        const previewImg = document.getElementById('previewImg');
        
        previewImg.src = e.target.result;
        previewDiv.style.display = 'block';
        
        // Update image info
        const img = new Image();
        img.onload = function() {
            document.getElementById('imageDimensions').textContent = `Dimensions: ${this.width} × ${this.height}`;
        };
        img.src = e.target.result;
        
        document.getElementById('imageSize').textContent = `Size: ${(file.size / 1024).toFixed(2)} KB`;
        document.getElementById('extractBtn').disabled = false;
    };
    reader.readAsDataURL(file);
}

// Remove image
function removeImage() {
    selectedFile = null;
    document.getElementById('imageInput').value = '';
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('extractBtn').disabled = true;
    document.getElementById('resultSection').style.display = 'none';
}

// Extract text from image
async function extractText() {
    if (!selectedFile) {
        showToast('Please select an image first', 'error');
        return;
    }

    const extractBtn = document.getElementById('extractBtn');
    const btnText = extractBtn.querySelector('.btn-text');
    const loader = extractBtn.querySelector('.loader');
    const loadingOverlay = document.getElementById('loadingOverlay');

    // Show loading state
    extractBtn.disabled = true;
    btnText.textContent = 'Processing...';
    loader.style.display = 'inline-block';
    loadingOverlay.style.display = 'flex';
    startTime = Date.now();

    try {
        // Create form data
        const formData = new FormData();
        formData.append('file', selectedFile);

        // Send request to backend
        const response = await fetch('/predict', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            // Calculate processing time
            const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
            
            // Display result
            document.getElementById('resultText').value = data.text;
            document.getElementById('processingTime').textContent = `Processing time: ${processingTime}s`;
            updateTextStats(data.text);
            document.getElementById('resultSection').style.display = 'block';
            
            // Scroll to result
            document.getElementById('resultSection').scrollIntoView({ 
                behavior: 'smooth', 
                block: 'nearest' 
            });

            showToast('Text extracted successfully!', 'success');
        } else {
            showToast('Error: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Failed to connect to server', 'error');
    } finally {
        // Reset button state
        extractBtn.disabled = false;
        btnText.textContent = 'Extract Text';
        loader.style.display = 'none';
        loadingOverlay.style.display = 'none';
    }
}

// Update text statistics
function updateTextStats(text) {
    const chars = text.length;
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    const lines = text.split('\n').length;
    
    document.getElementById('charCount').textContent = `Characters: ${chars}`;
    document.getElementById('wordCount').textContent = `Words: ${words}`;
    document.getElementById('lineCount').textContent = `Lines: ${lines}`;
}

// Copy text to clipboard
function copyText() {
    const resultText = document.getElementById('resultText');
    resultText.select();
    navigator.clipboard.writeText(resultText.value).then(() => {
        showToast('Text copied to clipboard!', 'success');
    }).catch(() => {
        document.execCommand('copy');
        showToast('Text copied to clipboard!', 'success');
    });
}

// Download text
function downloadText() {
    const text = document.getElementById('resultText').value;
    if (!text) {
        showToast('No text to download', 'warning');
        return;
    }
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'extracted_text.txt';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Text downloaded successfully!', 'success');
}

// Speak text
function speakText() {
    const text = document.getElementById('resultText').value;
    if (!text) {
        showToast('No text to speak', 'warning');
        return;
    }
    
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(utterance);
        showToast('Speaking text...', 'info');
    } else {
        showToast('Text-to-speech not supported', 'error');
    }
}

// Clear results
function clearResults() {
    document.getElementById('resultText').value = '';
    document.getElementById('resultSection').style.display = 'none';
    updateTextStats('');
    showToast('Results cleared', 'info');
}

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show ' + type;
    
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}
