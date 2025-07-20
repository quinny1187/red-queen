const THREE = require('three');
const { GLTFLoader } = require('three-stdlib');
const fs = require('fs');
const path = require('path');

function loadModel(modelPath, onLoad, onProgress, onError) {
    console.log('Loading GLB model from:', modelPath);
    
    try {
        // Check if file exists first
        if (!fs.existsSync(modelPath)) {
            console.error('Model file not found at:', modelPath);
            onError(new Error('Model file not found'));
            return;
        }
        
        console.log('File exists, creating GLTFLoader...');
        const loader = new GLTFLoader();
        
        // Read the file directly for Electron
        const data = fs.readFileSync(modelPath);
        const blob = new Blob([data]);
        const objectURL = URL.createObjectURL(blob);
        
        console.log('Loading from blob URL...');
        
        // Load the GLB file
        loader.load(
            objectURL,
            function (gltf) {
                console.log('GLB model loaded successfully!', gltf);
                URL.revokeObjectURL(objectURL); // Clean up
                onLoad(gltf);
            },
            function (xhr) {
                if (xhr.total > 0) {
                    const percent = (xhr.loaded / xhr.total * 100).toFixed(0);
                    console.log(`Loading: ${percent}%`);
                    if (onProgress) onProgress(xhr);
                }
            },
            function (error) {
                console.error('Error loading GLB:', error);
                URL.revokeObjectURL(objectURL); // Clean up
                onError(error);
            }
        );
        
    } catch (error) {
        console.error('Error in loadModel:', error);
        console.error('Stack trace:', error.stack);
        
        // Fallback to creating a simple placeholder
        console.log('Creating fallback model...');
        const group = new THREE.Group();
        
        // Simple placeholder cube
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshPhongMaterial({ color: 0xff0000 });
        const cube = new THREE.Mesh(geometry, material);
        group.add(cube);
        
        const gltf = {
            scene: group,
            scenes: [group],
            animations: []
        };
        
        onLoad(gltf);
    }
}

module.exports = { loadModel };