const THREE = require('three');
const fs = require('fs');
const path = require('path');

// Simple OBJ loader as alternative
function loadOBJ(objPath, onLoad, onError) {
    try {
        fs.readFile(objPath, 'utf8', (err, data) => {
            if (err) {
                onError(err);
                return;
            }

            const geometry = new THREE.BufferGeometry();
            const vertices = [];
            const normals = [];
            const uvs = [];
            
            // Basic OBJ parser
            const lines = data.split('\n');
            
            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                
                if (parts[0] === 'v') {
                    vertices.push(
                        parseFloat(parts[1]),
                        parseFloat(parts[2]),
                        parseFloat(parts[3])
                    );
                }
            }
            
            if (vertices.length > 0) {
                geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            }
            
            const material = new THREE.MeshPhongMaterial({ color: 0xff6666 });
            const mesh = new THREE.Mesh(geometry, material);
            
            onLoad({ scene: mesh });
        });
    } catch (error) {
        onError(error);
    }
}

// Convert GLB to OBJ format (simplified)
function convertGLBtoOBJ(glbPath, callback) {
    const objPath = glbPath.replace('.glb', '.obj');
    
    // Check if OBJ already exists
    if (fs.existsSync(objPath)) {
        callback(null, objPath);
        return;
    }
    
    // For now, just create a simple cube OBJ
    const objContent = `# Simple cube
v -0.5 -0.5 -0.5
v 0.5 -0.5 -0.5
v -0.5 0.5 -0.5
v 0.5 0.5 -0.5
v -0.5 -0.5 0.5
v 0.5 -0.5 0.5
v -0.5 0.5 0.5
v 0.5 0.5 0.5

f 1 2 4 3
f 5 6 8 7
f 1 5 7 3
f 2 6 8 4
f 3 7 8 4
f 1 5 6 2`;
    
    fs.writeFile(objPath, objContent, (err) => {
        if (err) {
            callback(err);
        } else {
            callback(null, objPath);
        }
    });
}

module.exports = { loadOBJ, convertGLBtoOBJ };