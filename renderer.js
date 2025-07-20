console.log('Renderer starting...');

const { ipcRenderer } = require('electron');
const THREE = require('three');
const path = require('path');

console.log('Modules loaded:', { ipcRenderer: !!ipcRenderer, THREE: !!THREE, path: !!path });

// Use our custom model loader
const { loadModel } = require('./load-model');

let scene, camera, renderer;
let model, mixer, clock;
let animations = {};
let currentAction;
let clickThrough = false;
let alwaysOnTop = true;
let showLogs = false;
let logMessages = [];

// Override console.log to capture messages
const originalLog = console.log;
const originalError = console.error;

console.log = function(...args) {
    originalLog(...args);
    addLog('[LOG] ' + args.join(' '));
};

console.error = function(...args) {
    originalError(...args);
    addLog('[ERROR] ' + args.join(' '), 'error');
};

function addLog(message, type = 'log') {
    const timestamp = new Date().toLocaleTimeString();
    logMessages.push(`[${timestamp}] ${message}`);
    
    // Keep only last 100 messages
    if (logMessages.length > 100) {
        logMessages.shift();
    }
    
    // Update logs display if visible
    if (showLogs) {
        updateLogsDisplay();
    }
}

function updateLogsDisplay() {
    const logsElement = document.getElementById('logs');
    if (logsElement) {
        logsElement.textContent = logMessages.join('\n');
        logsElement.scrollTop = logsElement.scrollHeight;
    }
}

// Initialize Three.js
function init() {
    console.log('Initializing Three.js...');
    const container = document.getElementById('canvas-container');
    console.log('Container:', container);
    
    // Scene
    scene = new THREE.Scene();
    console.log('Scene created:', scene);
    
    // Camera
    camera = new THREE.PerspectiveCamera(
        35,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 1, 4);
    camera.lookAt(0, 1, 0);  // Look at the same height as the camera
    console.log('Initial camera position set to:', camera.position);
    console.log('Camera looking at:', new THREE.Vector3(0, 1, 0));
    addLog(`[CAMERA] Initial position: (${camera.position.x}, ${camera.position.y}, ${camera.position.z})`);
    addLog(`[CAMERA] Looking at: (0, 1, 0)`);
    
    // Renderer with transparency
    try {
        renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: true 
        });
        console.log('Renderer created:', renderer);
        
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setClearColor(0x000000, 0); // Transparent background
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(renderer.domElement);
        console.log('Renderer added to DOM');
    } catch (error) {
        console.error('Error creating renderer:', error);
        updateStatus('WebGL Error: ' + error.message);
    }
    
    // Lights - make them brighter
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(2, 3, 2);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.5);
    fillLight.position.set(-2, 1, -1);
    scene.add(fillLight);
    
    // Add a point light from the front
    const frontLight = new THREE.PointLight(0xffffff, 0.5);
    frontLight.position.set(0, 2, 3);
    scene.add(frontLight);
    
    // Clock for animations
    clock = new THREE.Clock();
    
    // For now, let's create a simple avatar placeholder
    createPlaceholderAvatar();
    
    // Start animation loop
    animate();
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
}

function createPlaceholderAvatar() {
    // Create a simple avatar using basic shapes
    const group = new THREE.Group();
    
    // Body (cylinder)
    const bodyGeometry = new THREE.CylinderGeometry(0.3, 0.25, 0.8, 8);
    const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.4;
    group.add(body);
    
    // Head (sphere)
    const headGeometry = new THREE.SphereGeometry(0.25, 16, 16);
    const headMaterial = new THREE.MeshPhongMaterial({ color: 0xffdbac });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.0;
    group.add(head);
    
    // Hair (multiple small spheres)
    const hairMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
    for (let i = 0; i < 20; i++) {
        const hairGeometry = new THREE.SphereGeometry(0.05, 8, 8);
        const hair = new THREE.Mesh(hairGeometry, hairMaterial);
        const angle = (i / 20) * Math.PI * 2;
        hair.position.x = Math.cos(angle) * 0.2;
        hair.position.y = 1.1 + Math.sin(angle * 2) * 0.1;
        hair.position.z = Math.sin(angle) * 0.2;
        group.add(hair);
    }
    
    // Eyes
    const eyeGeometry = new THREE.SphereGeometry(0.03, 8, 8);
    const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.08, 1.0, 0.2);
    group.add(leftEye);
    
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.08, 1.0, 0.2);
    group.add(rightEye);
    
    // Red dress (cone)
    const dressGeometry = new THREE.ConeGeometry(0.4, 0.6, 8);
    const dressMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
    const dress = new THREE.Mesh(dressGeometry, dressMaterial);
    dress.position.y = 0.3;
    group.add(dress);
    
    model = group;
    scene.add(model);
    
    updateStatus('Placeholder avatar loaded');
    
    // Load actual model asynchronously
    loadGLTFModel();
}

function loadGLTFModel() {
    console.log('Loading model...');
    console.log('Using custom model loader');
    
    try {
        
        // Try multiple paths - __dirname in renderer points to dist folder
        const possiblePaths = [
            'C:\\repos\\red-queen-desktop\\red_queen.glb',  // Absolute path first
            path.join(__dirname, 'red_queen.glb'),         // Current directory
            path.join(__dirname, '..', 'red_queen.glb'),   // Go up from dist to root
            path.join(process.cwd(), 'red_queen.glb'),     // Current working directory
            './red_queen.glb',
            'red_queen.glb'
        ];
        
        console.log('Current directory:', __dirname);
        console.log('Process cwd:', process.cwd());
        console.log('Trying model paths:', possiblePaths);
        
        // Check if file exists
        const fs = require('fs');
        possiblePaths.forEach(p => {
            try {
                if (fs.existsSync(p)) {
                    console.log('File exists at:', p);
                } else {
                    console.log('File NOT found at:', p);
                }
            } catch (e) {
                console.log('Error checking path:', p, e.message);
            }
        });
        
        // Find the first existing path
        let modelPath = possiblePaths[0];
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                modelPath = p;
                console.log('Found model at:', modelPath);
                break;
            }
        }
        
        console.log('Loading model from:', modelPath);
        updateStatus('Loading Red Queen model...');
        
        loadModel(
        modelPath,
        function (gltf) {
            console.log('GLTF model loaded successfully!', gltf);
            
            // Remove placeholder
            if (model) {
                scene.remove(model);
            }
            
            // Add real model
            model = gltf.scene;
            model.scale.set(0.8, 0.8, 0.8);
            model.position.set(0, 0, 0);
            
            // Fix materials for transparency
            model.traverse((child) => {
                if (child.isMesh) {
                    console.log('Found mesh:', child.name, 'Material:', child.material?.name);
                    child.castShadow = true;
                    child.receiveShadow = true;
                    
                    if (child.material) {
                        // Log material properties
                        console.log(`Material ${child.material.name}:`, {
                            transparent: child.material.transparent,
                            opacity: child.material.opacity,
                            visible: child.material.visible,
                            side: child.material.side
                        });
                        
                        // Ensure all materials are visible
                        child.material.visible = true;
                        
                        // Handle transparency
                        if (child.material.map && child.material.map.format === THREE.RGBAFormat) {
                            child.material.transparent = true;
                        }
                        
                        // Log textures
                        if (child.material.map) {
                            console.log('Has diffuse map:', child.material.map);
                        }
                        if (child.material.alphaMap) {
                            console.log('Has alpha map:', child.material.alphaMap);
                        }
                        
                        // Fix transparency issues
                        const materialName = child.material.name || '';
                        
                        // For lambert materials, we need to handle transparency differently
                        if (materialName.toLowerCase().includes('lambert')) {
                            // Check if this material has alpha information
                            if (child.material.alphaMap || (child.material.map && child.material.map.format === THREE.RGBAFormat)) {
                                child.material.transparent = true;
                                child.material.alphaTest = 0.5; // Higher alpha test to cut off more transparent pixels
                                child.material.side = THREE.DoubleSide;
                                child.material.depthWrite = true; // Keep depth write on for better sorting
                                child.material.alphaHash = true; // Use alpha hash for better transparency
                            } else {
                                child.material.transparent = false;
                                child.material.opacity = 1.0;
                                child.material.side = THREE.FrontSide;
                            }
                            console.log('Fixed lambert material:', materialName);
                        }
                        
                        // Special handling for hair materials
                        if (materialName.toLowerCase().includes('hair')) {
                            child.material.transparent = true;
                            child.material.alphaTest = 0.5;
                            child.material.side = THREE.DoubleSide;
                            child.material.depthWrite = false;
                            console.log('Applied hair material settings to:', materialName);
                        }
                    }
                }
            });
            
            scene.add(model);
            
            // Log camera position after model is added
            console.log('Camera position after model load:', camera.position);
            addLog(`[CAMERA] After model load: (${camera.position.x}, ${camera.position.y}, ${camera.position.z})`);
            
            // Find bones and other animatable parts in the model
            const bones = {};
            const meshes = {};
            const joints = {};
            
            model.traverse((child) => {
                // Check for bones
                if (child.isBone || child.type === 'Bone') {
                    bones[child.name] = child;
                    console.log('Found bone:', child.name, 'Type:', child.type);
                    addLog(`[BONE] Found: ${child.name}`);
                }
                
                // Check for SkinnedMesh (rigged meshes)
                if (child.isSkinnedMesh || child.type === 'SkinnedMesh') {
                    console.log('Found SkinnedMesh:', child.name);
                    addLog(`[SKINNED MESH] Found: ${child.name}`);
                    
                    // Try to access the skeleton
                    if (child.skeleton) {
                        console.log('Skeleton bones:', child.skeleton.bones.length);
                        child.skeleton.bones.forEach((bone, index) => {
                            bones[bone.name || `bone_${index}`] = bone;
                            console.log('  - Bone from skeleton:', bone.name || `bone_${index}`);
                            addLog(`[SKELETON BONE] ${bone.name || `bone_${index}`}`);
                        });
                    }
                }
                
                // Log all objects to debug
                if (child.name) {
                    console.log(`Object: ${child.name}, Type: ${child.type}, isBone: ${child.isBone}`);
                }
                
                // Store meshes
                if (child.isMesh && child.name) {
                    meshes[child.name] = child;
                }
            });
            
            // Store everything globally for custom animations
            window.modelBones = bones;
            window.modelMeshes = meshes;
            window.modelJoints = joints;
            
            // Look for armature
            const armature = model.getObjectByName('Armature');
            if (armature) {
                console.log('Found armature:', armature);
                addLog('[ARMATURE] Found main armature');
                window.modelArmature = armature;
            }
            
            // Setup animations if available
            if (gltf.animations && gltf.animations.length > 0) {
                console.log('Found animations:', gltf.animations.length);
                mixer = new THREE.AnimationMixer(model);
                
                gltf.animations.forEach((clip) => {
                    const action = mixer.clipAction(clip);
                    animations[clip.name] = action;
                    console.log('Loaded animation:', clip.name);
                });
                
                // Play the available animation
                const animationNames = Object.keys(animations);
                if (animationNames.length > 0) {
                    const firstAnimation = animations[animationNames[0]];
                    firstAnimation.setLoop(THREE.LoopRepeat);
                    firstAnimation.play();
                    currentAction = firstAnimation;
                    console.log('Playing animation:', animationNames[0]);
                    addLog(`[ANIMATION] Auto-playing: ${animationNames[0]}`);
                }
            }
            
            updateStatus('Red Queen loaded!');
        },
        function (xhr) {
            const percent = (xhr.loaded / xhr.total * 100).toFixed(0);
            updateStatus(`Loading: ${percent}%`);
        },
        function (error) {
            console.error('Error loading GLTF:', error);
            updateStatus('Failed to load model - using placeholder');
        }
    );
    } catch (error) {
        console.error('Error in loadGLTFModel:', error);
        console.error('Stack trace:', error.stack);
        updateStatus('Error loading model - using placeholder');
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);
    
    // Update custom animations
    updateCustomAnimation(delta);
    
    // Only do manual animation if no animation is playing and no custom animation
    if (model && (!currentAction || !currentAction.isRunning()) && !window.customAnimation) {
        model.rotation.y = Math.sin(Date.now() * 0.0005) * 0.1;
        
        // Simple bounce animation
        model.position.y = Math.sin(Date.now() * 0.002) * 0.05;
    }
    
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Control functions  
function playAnimation(name) {
    updateStatus(`Animation: ${name}`);
    addLog(`[ANIMATION] Playing: ${name}`);
    
    // Try to play real animation first
    if (animations[name]) {
        if (currentAction) {
            currentAction.fadeOut(0.5);
        }
        
        currentAction = animations[name];
        currentAction.reset().fadeIn(0.5).play();
        currentAction.setLoop(THREE.LoopRepeat);  // Make sure it loops
        console.log('Animation playing:', currentAction.isRunning());
    } else {
        console.log('Animation not found:', name);
        addLog(`[ANIMATION] Not found: ${name}`);
    }
}

function stopAnimation() {
    if (currentAction) {
        currentAction.stop();
        updateStatus('Animation stopped');
        addLog('[ANIMATION] Stopped');
    }
    // Also stop any custom animations
    window.customAnimation = null;
}

// Custom animation functions
let customAnimationTime = 0;
window.customAnimation = null;

function animateWave() {
    window.customAnimation = 'wave';
    customAnimationTime = 0;
    updateStatus('Custom animation: Wave');
    addLog('[ANIMATION] Custom: Wave');
}

function animateNod() {
    window.customAnimation = 'nod';
    customAnimationTime = 0;
    updateStatus('Custom animation: Nod');
    addLog('[ANIMATION] Custom: Nod');
}

function animateLook() {
    window.customAnimation = 'look';
    customAnimationTime = 0;
    updateStatus('Custom animation: Look Around');
    addLog('[ANIMATION] Custom: Look Around');
}

// Update function for custom animations
function updateCustomAnimation(delta) {
    if (!window.customAnimation) return;
    
    customAnimationTime += delta;
    
    // If no bones found, animate the whole model
    if (!window.modelBones || Object.keys(window.modelBones).length === 0) {
        switch(window.customAnimation) {
            case 'wave':
                // Rotate the whole model side to side
                if (model) {
                    model.rotation.z = Math.sin(customAnimationTime * 3) * 0.1;
                    model.rotation.y = Math.sin(customAnimationTime * 2) * 0.2;
                }
                if (customAnimationTime > 3) {
                    if (model) model.rotation.set(0, 0, 0);
                    window.customAnimation = null;
                }
                break;
                
            case 'nod':
                // Tilt the whole model forward and back
                if (model) {
                    model.rotation.x = Math.sin(customAnimationTime * 3) * 0.2;
                }
                if (customAnimationTime > 2) {
                    if (model) model.rotation.x = 0;
                    window.customAnimation = null;
                }
                break;
                
            case 'look':
                // Rotate the whole model to look around
                if (model) {
                    model.rotation.y = Math.sin(customAnimationTime * 2) * 0.4;
                }
                if (customAnimationTime > 4) {
                    if (model) model.rotation.y = 0;
                    window.customAnimation = null;
                }
                break;
        }
        return;
    }
    
    // Original bone-based animations
    switch(window.customAnimation) {
        case 'wave':
            // Try to find arm bones - check common naming patterns
            const rightArm = window.modelBones['CC_Base_R_Upperarm'] || 
                           window.modelBones['R_Upperarm'] || 
                           window.modelBones['RightArm'] || 
                           window.modelBones['Right_Arm'] || 
                           window.modelBones['R_Arm'] ||
                           window.modelBones['CC_Base_R_Arm'];
            const rightForeArm = window.modelBones['CC_Base_R_Forearm'] || 
                               window.modelBones['R_Forearm'] || 
                               window.modelBones['RightForeArm'] || 
                               window.modelBones['Right_ForeArm'] || 
                               window.modelBones['R_ForeArm'];
            
            if (rightArm) {
                rightArm.rotation.z = Math.sin(customAnimationTime * 3) * 0.5 + 1.5;
                rightArm.rotation.x = Math.sin(customAnimationTime * 2) * 0.2;
            }
            if (rightForeArm) {
                rightForeArm.rotation.x = Math.sin(customAnimationTime * 4) * 0.3 + 0.3;
            }
            
            // Stop after 3 seconds
            if (customAnimationTime > 3) {
                if (rightArm) rightArm.rotation.set(0, 0, 0);
                if (rightForeArm) rightForeArm.rotation.set(0, 0, 0);
                window.customAnimation = null;
            }
            break;
            
        case 'nod':
            const head = window.modelBones['CC_Base_Head'] || 
                       window.modelBones['Head'] || 
                       window.modelBones['head'] ||
                       window.modelBones['CC_Base_FacialBone'];
            if (head) {
                head.rotation.x = Math.sin(customAnimationTime * 3) * 0.3;
            }
            
            // Stop after 2 seconds
            if (customAnimationTime > 2) {
                if (head) head.rotation.x = 0;
                window.customAnimation = null;
            }
            break;
            
        case 'look':
            const headLook = window.modelBones['CC_Base_Head'] || 
                           window.modelBones['Head'] || 
                           window.modelBones['head'] ||
                           window.modelBones['CC_Base_FacialBone'];
            const neck = window.modelBones['CC_Base_Neck'] || 
                        window.modelBones['Neck'] || 
                        window.modelBones['neck'] ||
                        window.modelBones['CC_Base_NeckTwist'];
            
            if (headLook) {
                headLook.rotation.y = Math.sin(customAnimationTime * 2) * 0.5;
                headLook.rotation.x = Math.sin(customAnimationTime * 1.5) * 0.2;
            }
            if (neck) {
                neck.rotation.y = Math.sin(customAnimationTime * 2) * 0.2;
            }
            
            // Stop after 4 seconds
            if (customAnimationTime > 4) {
                if (headLook) headLook.rotation.set(0, 0, 0);
                if (neck) neck.rotation.set(0, 0, 0);
                window.customAnimation = null;
            }
            break;
    }
}

function toggleClickThrough() {
    clickThrough = !clickThrough;
    ipcRenderer.invoke('set-click-through', clickThrough);
    updateStatus(`Click-through: ${clickThrough ? 'ON' : 'OFF'}`);
}

function toggleAlwaysOnTop() {
    alwaysOnTop = !alwaysOnTop;
    ipcRenderer.invoke('set-always-on-top', alwaysOnTop);
    updateStatus(`Always on top: ${alwaysOnTop ? 'ON' : 'OFF'}`);
}

function clearLogs() {
    logMessages = [];
    updateLogsDisplay();
    addLog('[LOG] Logs cleared');
}

function toggleLogs() {
    const logsElement = document.getElementById('logs');
    if (logsElement) {
        const isVisible = logsElement.style.display !== 'none';
        logsElement.style.display = isVisible ? 'none' : 'block';
        
        // If showing logs, update the display
        if (!isVisible) {
            updateLogsDisplay();
        }
        
        // Update button text
        const buttons = document.querySelectorAll('.control-btn');
        buttons.forEach(btn => {
            if (btn.textContent.includes('Logs')) {
                btn.textContent = isVisible ? 'Show Logs' : 'Hide Logs';
            }
        });
    }
}

function moveCameraUp() {
    if (camera) {
        camera.position.y += 1;
        const pos = camera.position;
        console.log(`Camera position: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})`);
        updateStatus(`Camera Y: ${pos.y.toFixed(1)}`);
        addLog(`[CAMERA] Position: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})`);
    }
}

function moveCameraDown() {
    if (camera) {
        camera.position.y -= 1;
        const pos = camera.position;
        console.log(`Camera position: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})`);
        updateStatus(`Camera Y: ${pos.y.toFixed(1)}`);
        addLog(`[CAMERA] Position: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})`);
    }
}

function updateStatus(message) {
    document.getElementById('status').textContent = message;
}

// Listen for avatar commands from main process
ipcRenderer.on('avatar-action', (event, command) => {
    switch(command.type) {
        case 'play':
            playAnimation(command.animation);
            break;
        case 'speak':
            updateStatus(`Speaking: ${command.text}`);
            // Add speech bubble or animation
            break;
        case 'move':
            ipcRenderer.invoke('move-avatar', command.x, command.y);
            break;
        case 'emotion':
            // Change expression/pose based on emotion
            updateStatus(`Emotion: ${command.emotion}`);
            break;
    }
});

// Make functions available to window object for onclick handlers
window.toggleClickThrough = toggleClickThrough;
window.toggleAlwaysOnTop = toggleAlwaysOnTop;
window.clearLogs = clearLogs;
window.toggleLogs = toggleLogs;
window.playAnimation = playAnimation;
window.stopAnimation = stopAnimation;
window.moveCameraUp = moveCameraUp;
window.moveCameraDown = moveCameraDown;
window.animateWave = animateWave;
window.animateNod = animateNod;
window.animateLook = animateLook;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Show logs from the start
        updateLogsDisplay();
        addLog('[LOG] Red Queen Desktop initializing...');
        init();
    } catch (error) {
        console.error('Error during initialization:', error);
        addLog('[CRITICAL ERROR] ' + error.message);
        updateStatus('Error: ' + error.message);
    }
});