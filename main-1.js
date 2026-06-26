/* =====================================================
   TUBG TUNG RUN - Main Game Engine
   3D Endless Runner using Three.js
   ===================================================== */

// =====================================================
// ASSET MANAGER - Loads all 3D models from GLB files
// =====================================================
class AssetManager {
    constructor() {
        this.loader = new THREE.GLTFLoader();
        this.assets = {};
        this.loadingManager = new THREE.LoadingManager();
    }

    async loadModel(path, name) {
        return new Promise((resolve, reject) => {
            this.loader.load(
                path,
                (gltf) => {
                    this.assets[name] = gltf.scene;
                    resolve(gltf.scene);
                },
                undefined,
                (error) => {
                    console.warn(`Could not load model ${name} from ${path}. Using placeholder.`, error);
                    // Return a placeholder box if model fails to load
                    const geometry = new THREE.BoxGeometry(1, 2, 1);
                    const material = new THREE.MeshStandardMaterial({ color: 0xff00ff });
                    this.assets[name] = new THREE.Mesh(geometry, material);
                    resolve(this.assets[name]);
                }
            );
        });
    }

    async loadAllAssets() {
        // ==================================================
        // REPLACE THESE PATHS WITH YOUR OWN GLB FILES
        // ==================================================
        
        await Promise.all([
            // Player character
            this.loadModel('./models/player.glb', 'player')
                .catch(() => this.createPlaceholder('player', 0x00ff88)),
            
            // Track segments
            this.loadModel('./models/track.glb', 'track')
                .catch(() => this.createPlaceholder('track', 0x4a4a6a)),
            
            // Obstacles
            this.loadModel('./models/obstacle.glb', 'obstacle')
                .catch(() => this.createPlaceholder('obstacle', 0xff0000)),
            
            // Collectible coins
            this.loadModel('./models/coin.glb', 'coin')
                .catch(() => this.createPlaceholder('coin', 0xffff00)),
            
            // Power-up items
            this.loadModel('./models/powerup_jetpack.glb', 'jetpack')
                .catch(() => this.createPlaceholder('jetpack', 0xff00ff)),
            
            this.loadModel('./models/powerup_magnet.glb', 'magnet')
                .catch(() => this.createPlaceholder('magnet', 0xff0088)),
            
            this.loadModel('./models/powerup_sneakers.glb', 'sneakers')
                .catch(() => this.createPlaceholder('sneakers', 0xffaa00)),
            
            this.loadModel('./models/powerup_hoverboard.glb', 'hoverboard')
                .catch(() => this.createPlaceholder('hoverboard', 0x00ffff)),
        ]);

        console.log('✓ All assets loaded or placeholders created');
    }

    createPlaceholder(name, color) {
        const size = name === 'track' ? { w: 4, h: 0.5, d: 10 } : { w: 1, h: 1.5, d: 1 };
        const geometry = new THREE.BoxGeometry(size.w, size.h, size.d);
        const material = new THREE.MeshStandardMaterial({ 
            color: color,
            metalness: 0.3,
            roughness: 0.4
        });
        const mesh = new THREE.Mesh(geometry, material);
        this.assets[name] = mesh;
        return mesh;
    }

    getAsset(name) {
        return this.assets[name];
    }

    cloneAsset(name) {
        const original = this.assets[name];
        if (!original) return null;
        return original.clone();
    }
}

// =====================================================
// INPUT MANAGER - Handles keyboard and touch input
// =====================================================
class InputManager {
    constructor() {
        this.keys = {};
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.currentLane = 1; // 0=left, 1=center, 2=right
        this.inputCallbacks = {};

        this.setupKeyboardInput();
        this.setupTouchInput();
    }

    setupKeyboardInput() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;

            // Lane movement
            if (e.key === 'ArrowLeft' && this.currentLane > 0) {
                this.currentLane--;
                this.emit('laneChange', this.currentLane);
            }
            if (e.key === 'ArrowRight' && this.currentLane < 2) {
                this.currentLane++;
                this.emit('laneChange', this.currentLane);
            }

            // Jump
            if ((e.key === ' ' || e.key === 'w' || e.key === 'W') && !this.keys['jumpCooldown']) {
                this.emit('jump');
                this.keys['jumpCooldown'] = true;
                setTimeout(() => delete this.keys['jumpCooldown'], 300);
            }

            // Roll
            if ((e.key === 'Shift' || e.key === 'Control') && !this.keys['rollCooldown']) {
                this.emit('roll');
                this.keys['rollCooldown'] = true;
                setTimeout(() => delete this.keys['rollCooldown'], 300);
            }

            // Double space for hoverboard
            if (e.key === ' ' && this.keys['spacePressed'] && !this.keys['hoverboardCooldown']) {
                this.emit('hoverboard');
                this.keys['hoverboardCooldown'] = true;
                setTimeout(() => delete this.keys['hoverboardCooldown'], 300);
            }
            if (e.key === ' ') {
                this.keys['spacePressed'] = true;
                setTimeout(() => delete this.keys['spacePressed'], 200);
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });
    }

    setupTouchInput() {
        window.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            this.touchStartX = touch.clientX;
            this.touchStartY = touch.clientY;
        });

        window.addEventListener('touchend', (e) => {
            const touch = e.changedTouches[0];
            const deltaX = touch.clientX - this.touchStartX;
            const deltaY = touch.clientY - this.touchStartY;
            const threshold = 30;

            // Horizontal swipe for lane change
            if (Math.abs(deltaX) > threshold && Math.abs(deltaY) < threshold) {
                if (deltaX < 0 && this.currentLane < 2) {
                    this.currentLane++;
                    this.emit('laneChange', this.currentLane);
                } else if (deltaX > 0 && this.currentLane > 0) {
                    this.currentLane--;
                    this.emit('laneChange', this.currentLane);
                }
            }

            // Vertical swipe for jump
            if (deltaY < -threshold && Math.abs(deltaX) < threshold) {
                this.emit('jump');
            }

            // Vertical swipe down for roll
            if (deltaY > threshold && Math.abs(deltaX) < threshold) {
                this.emit('roll');
            }
        });
    }

    on(event, callback) {
        if (!this.inputCallbacks[event]) {
            this.inputCallbacks[event] = [];
        }
        this.inputCallbacks[event].push(callback);
    }

    emit(event, data) {
        if (this.inputCallbacks[event]) {
            this.inputCallbacks[event].forEach(callback => callback(data));
        }
    }

    getCurrentLane() {
        return this.currentLane;
    }
}

// =====================================================
// PLAYER - Player controller with jump/roll mechanics
// =====================================================
class Player {
    constructor(scene, assetManager) {
        this.scene = scene;
        this.assetManager = assetManager;
        this.group = new THREE.Group();
        
        // Player model
        this.model = assetManager.cloneAsset('player') || new THREE.Mesh(
            new THREE.CapsuleGeometry(0.4, 1.5, 4, 8),
            new THREE.MeshStandardMaterial({ color: 0x00ff88 })
        );
        this.group.add(this.model);
        scene.add(this.group);

        // Physics
        this.position = { x: 0, y: 0.75, z: 0 };
        this.velocity = { x: 0, y: 0, z: 0 };
        this.isJumping = false;
        this.isRolling = false;
        this.rollStartTime = 0;
        this.rollDuration = 400; // ms
        this.baseY = 0.75;
        this.jumpPower = 0.8;
        this.gravity = 0.02;

        // Lanes
        this.currentLane = 1;
        this.targetLane = 1;
        this.laneWidth = 1.3;
        this.lanePositions = [-1.3, 0, 1.3];

        // Collision bounding box
        this.boundingBox = {
            width: 0.8,
            height: 1.8,
            depth: 0.8
        };

        // Power-ups
        this.powerUps = {};
        this.maxY = 20; // Max jump height

        this.updatePosition();
    }

    setLane(lane) {
        this.targetLane = Math.max(0, Math.min(2, lane));
    }

    jump() {
        if (!this.isJumping && !this.isRolling) {
            this.isJumping = true;
            this.velocity.y = this.jumpPower;

            // Apply super sneakers multiplier
            if (this.powerUps['superSneakers']) {
                this.velocity.y *= 1.5;
            }
        }
    }

    roll() {
        if (!this.isRolling && !this.isJumping) {
            this.isRolling = true;
            this.rollStartTime = Date.now();
        }
    }

    activatePowerUp(type) {
        const duration = 10000; // 10 seconds
        this.powerUps[type] = true;
        
        setTimeout(() => {
            delete this.powerUps[type];
        }, duration);
    }

    update() {
        // Lane movement (smooth tweening)
        const targetX = this.lanePositions[this.targetLane];
        this.position.x += (targetX - this.position.x) * 0.15;

        // Jumping physics
        if (this.isJumping) {
            this.velocity.y -= this.gravity;
            this.position.y += this.velocity.y;

            if (this.position.y <= this.baseY) {
                this.position.y = this.baseY;
                this.isJumping = false;
                this.velocity.y = 0;
            }
        }

        // Rolling animation
        if (this.isRolling) {
            const elapsed = Date.now() - this.rollStartTime;
            if (elapsed > this.rollDuration) {
                this.isRolling = false;
            } else {
                // Slightly lower the player while rolling
                const rollProgress = elapsed / this.rollDuration;
                this.model.scale.y = 1 - (rollProgress < 0.5 ? rollProgress * 0.5 : (1 - rollProgress) * 0.5);
            }
        } else {
            this.model.scale.y = 1;
        }

        this.updatePosition();
    }

    updatePosition() {
        this.group.position.set(this.position.x, this.position.y, this.position.z);
    }

    getBoundingBox() {
        const box = this.boundingBox;
        
        // Reduce height when rolling
        let height = box.height;
        if (this.isRolling) {
            height *= 0.5;
        }

        return {
            min: {
                x: this.position.x - box.width / 2,
                y: this.position.y - height / 2,
                z: this.position.z - box.depth / 2
            },
            max: {
                x: this.position.x + box.width / 2,
                y: this.position.y + height / 2,
                z: this.position.z + box.depth / 2
            }
        };
    }

    getModel() {
        return this.group;
    }
}

// =====================================================
// WORLD - Track generation with object pooling
// =====================================================
class World {
    constructor(scene, assetManager) {
        this.scene = scene;
        this.assetManager = assetManager;
        this.tracks = [];
        this.obstacles = [];
        this.coins = [];
        this.powerUps = [];
        this.trackPool = [];
        this.obstaclePool = [];
        this.coinPool = [];

        // World constants
        this.trackLength = 10;
        this.trackWidth = 4;
        this.spawnDistance = 30;
        this.despawnDistance = -10;

        // Spawning probability
        this.obstacleChance = 0.3;
        this.coinChance = 0.7;
        this.powerUpChance = 0.05;

        this.createInitialTracks();
    }

    createInitialTracks() {
        for (let i = 0; i < 5; i++) {
            this.spawnTrack(i * this.trackLength);
        }
    }

    spawnTrack(zPosition) {
        let track = this.getOrCreateTrack();
        track.position.z = zPosition;
        this.tracks.push(track);
        this.scene.add(track);

        // Spawn objects on this track
        this.spawnObjectsOnTrack(zPosition);
    }

    spawnObjectsOnTrack(trackZ) {
        // Spawn obstacles
        if (Math.random() < this.obstacleChance) {
            const lane = Math.floor(Math.random() * 3);
            const laneX = [-1.3, 0, 1.3][lane];
            const obstacleZ = trackZ + Math.random() * this.trackLength;
            
            let obstacle = this.getOrCreateObstacle();
            obstacle.position.set(laneX, 1, obstacleZ);
            this.obstacles.push(obstacle);
            this.scene.add(obstacle);
        }

        // Spawn coins
        for (let i = 0; i < 3; i++) {
            if (Math.random() < this.coinChance) {
                const lane = Math.floor(Math.random() * 3);
                const laneX = [-1.3, 0, 1.3][lane];
                const coinZ = trackZ + (i + Math.random()) * (this.trackLength / 3);
                
                let coin = this.getOrCreateCoin();
                coin.position.set(laneX, 1, coinZ);
                coin.rotation.set(Math.random(), Math.random(), Math.random());
                this.coins.push(coin);
                this.scene.add(coin);
            }
        }

        // Spawn power-ups (rare)
        if (Math.random() < this.powerUpChance) {
            const lane = Math.floor(Math.random() * 3);
            const laneX = [-1.3, 0, 1.3][lane];
            const powerUpZ = trackZ + Math.random() * this.trackLength;
            const powerUpType = ['jetpack', 'magnet', 'sneakers', 'hoverboard'][
                Math.floor(Math.random() * 4)
            ];

            let powerUp = this.assetManager.cloneAsset(powerUpType);
            if (!powerUp) {
                powerUp = new THREE.Mesh(
                    new THREE.SphereGeometry(0.3, 8, 8),
                    new THREE.MeshStandardMaterial({ color: 0xff00ff, emissive: 0xff00ff })
                );
            }
            powerUp.position.set(laneX, 1.5, powerUpZ);
            powerUp.type = powerUpType;
            powerUp.collected = false;
            this.powerUps.push(powerUp);
            this.scene.add(powerUp);
        }
    }

    getOrCreateTrack() {
        if (this.trackPool.length > 0) {
            return this.trackPool.pop();
        }
        
        const track = this.assetManager.cloneAsset('track') || new THREE.Mesh(
            new THREE.BoxGeometry(this.trackWidth, 0.5, this.trackLength),
            new THREE.MeshStandardMaterial({ 
                color: 0x4a4a6a,
                metalness: 0.2,
                roughness: 0.8
            })
        );
        
        return track;
    }

    getOrCreateObstacle() {
        if (this.obstaclePool.length > 0) {
            return this.obstaclePool.pop();
        }

        const obstacle = this.assetManager.cloneAsset('obstacle') || new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 1.5, 0.8),
            new THREE.MeshStandardMaterial({ color: 0xff4444 })
        );

        return obstacle;
    }

    getOrCreateCoin() {
        if (this.coinPool.length > 0) {
            return this.coinPool.pop();
        }

        const coin = this.assetManager.cloneAsset('coin') || new THREE.Mesh(
            new THREE.CylinderGeometry(0.3, 0.3, 0.1, 32),
            new THREE.MeshStandardMaterial({ 
                color: 0xffff00,
                metalness: 0.8,
                roughness: 0.2,
                emissive: 0xffaa00
            })
        );

        return coin;
    }

    update(playerZ) {
        // Spawn new tracks
        const lastTrack = this.tracks[this.tracks.length - 1];
        if (lastTrack && playerZ + this.spawnDistance > lastTrack.position.z) {
            const newZ = lastTrack.position.z + this.trackLength;
            this.spawnTrack(newZ);
        }

        // Remove despawned objects
        this.removeIfDespawned();

        // Rotate coins
        this.coins.forEach(coin => {
            coin.rotation.y += 0.05;
            coin.position.y += Math.sin(Date.now() * 0.003 + coin.position.x) * 0.02;
        });

        // Animate power-ups
        this.powerUps.forEach(powerUp => {
            powerUp.rotation.y += 0.03;
            powerUp.position.y += Math.sin(Date.now() * 0.002) * 0.01;
        });
    }

    removeIfDespawned() {
        // Remove despawned tracks
        this.tracks = this.tracks.filter(track => {
            if (track.position.z < this.despawnDistance) {
                this.scene.remove(track);
                this.trackPool.push(track);
                return false;
            }
            return true;
        });

        // Remove despawned obstacles
        this.obstacles = this.obstacles.filter(obstacle => {
            if (obstacle.position.z < this.despawnDistance) {
                this.scene.remove(obstacle);
                this.obstaclePool.push(obstacle);
                return false;
            }
            return true;
        });

        // Remove despawned coins
        this.coins = this.coins.filter(coin => {
            if (coin.position.z < this.despawnDistance) {
                this.scene.remove(coin);
                this.coinPool.push(coin);
                return false;
            }
            return true;
        });

        // Remove despawned power-ups
        this.powerUps = this.powerUps.filter(powerUp => {
            if (powerUp.position.z < this.despawnDistance) {
                this.scene.remove(powerUp);
                return false;
            }
            return true;
        });
    }

    getObstacles() {
        return this.obstacles;
    }

    getCoins() {
        return this.coins;
    }

    getPowerUps() {
        return this.powerUps;
    }
}

// =====================================================
// COLLISION MANAGER - Bounding box collision detection
// =====================================================
class CollisionManager {
    static checkAABB(box1, box2) {
        return !(
            box1.max.x < box2.min.x || box1.min.x > box2.max.x ||
            box1.max.y < box2.min.y || box1.min.y > box2.max.y ||
            box1.max.z < box2.min.z || box1.min.z > box2.max.z
        );
    }

    static checkPlayerCollisions(player, world) {
        const playerBox = player.getBoundingBox();
        
        // Check obstacles
        for (const obstacle of world.getObstacles()) {
            const obstacleBox = {
                min: {
                    x: obstacle.position.x - 0.4,
                    y: obstacle.position.y - 0.75,
                    z: obstacle.position.z - 0.4
                },
                max: {
                    x: obstacle.position.x + 0.4,
                    y: obstacle.position.y + 0.75,
                    z: obstacle.position.z + 0.4
                }
            };

            if (this.checkAABB(playerBox, obstacleBox)) {
                return { type: 'obstacle', object: obstacle };
            }
        }

        return null;
    }

    static checkCoinCollection(player, world) {
        const playerPos = player.position;
        const collectRadius = 0.8;
        const collected = [];

        for (let i = world.getCoins().length - 1; i >= 0; i--) {
            const coin = world.getCoins()[i];
            const dx = coin.position.x - playerPos.x;
            const dy = coin.position.y - playerPos.y;
            const dz = coin.position.z - playerPos.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (distance < collectRadius) {
                collected.push(coin);
            }
        }

        return collected;
    }

    static checkPowerUpCollection(player, world) {
        const playerPos = player.position;
        const collectRadius = 1.0;

        for (let i = world.getPowerUps().length - 1; i >= 0; i--) {
            const powerUp = world.getPowerUps()[i];
            if (powerUp.collected) continue;

            const dx = powerUp.position.x - playerPos.x;
            const dy = powerUp.position.y - playerPos.y;
            const dz = powerUp.position.z - playerPos.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (distance < collectRadius) {
                powerUp.collected = true;
                return powerUp;
            }
        }

        return null;
    }
}

// =====================================================
// UI MANAGER - Manages all UI elements
// =====================================================
class UIManager {
    constructor() {
        this.score = 0;
        this.coins = 0;
        this.distance = 0;
        this.multiplier = 1;
        this.activePowerUps = [];

        this.setupUI();
    }

    setupUI() {
        this.scoreElement = document.getElementById('score');
        this.coinsElement = document.getElementById('coins');
        this.multiplierBadge = document.getElementById('multiplierBadge');
        this.powerUpDisplay = document.getElementById('powerUpDisplay');
        this.laneIndicators = document.querySelectorAll('.lane-indicator');
        this.startScreen = document.getElementById('startScreen');
        this.gameOverScreen = document.getElementById('gameOverScreen');
        this.startBtn = document.getElementById('startBtn');
        this.restartBtn = document.getElementById('restartBtn');
        this.notificationElement = document.getElementById('powerUpNotification');

        this.startBtn.addEventListener('click', () => {
            window.gameStarted = true;
            this.startScreen.style.display = 'none';
        });

        this.restartBtn.addEventListener('click', () => {
            window.location.reload();
        });
    }

    updateScore(points) {
        this.score += points * this.multiplier;
        this.scoreElement.textContent = Math.floor(this.score);
    }

    addCoin() {
        this.coins++;
        this.coinsElement.textContent = this.coins;
    }

    updateLaneIndicator(lane) {
        this.laneIndicators.forEach((indicator, index) => {
            if (index === lane) {
                indicator.classList.add('active');
            } else {
                indicator.classList.remove('active');
            }
        });
    }

    activateMultiplier() {
        this.multiplier = 2;
        this.multiplierBadge.style.display = 'block';

        setTimeout(() => {
            this.multiplier = 1;
            this.multiplierBadge.style.display = 'none';
        }, 10000);
    }

    showPowerUpNotification(powerUpName) {
        const nameMap = {
            'jetpack': '🚀 JETPACK ACTIVATED',
            'magnet': '🧲 COIN MAGNET ACTIVE',
            'sneakers': '👟 SUPER SNEAKERS',
            'hoverboard': '🛹 HOVERBOARD READY'
        };

        this.notificationElement.textContent = nameMap[powerUpName] || 'POWER-UP!';
        this.notificationElement.classList.remove('show');
        setTimeout(() => {
            this.notificationElement.classList.add('show');
        }, 10);
    }

    showGameOver(finalScore, coinsCollected, distance) {
        this.gameOverScreen.style.display = 'flex';
        document.getElementById('finalScore').textContent = Math.floor(finalScore);
        document.getElementById('finalCoins').textContent = coinsCollected;
        document.getElementById('finalDistance').textContent = Math.floor(distance);
    }
}

// =====================================================
// MAIN GAME CLASS
// =====================================================
class TubgTungRun {
    constructor() {
        // Scene setup
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x1a1a2e);
        this.renderer.shadowMap.enabled = true;
        document.getElementById('gameContainer').appendChild(this.renderer.domElement);

        // Lighting - Cartoon style
        this.setupLighting();

        // Game state
        this.gameRunning = false;
        this.gamePaused = false;
        this.distanceTraveled = 0;
        this.score = 0;
        this.coins = 0;
        this.hoverboardActive = false;

        // Camera offset
        this.cameraDistance = 6;
        this.cameraHeight = 3;

        // Load assets and initialize
        this.assetManager = new AssetManager();
        this.inputManager = new InputManager();
        this.uiManager = new UIManager();

        this.init();
    }

    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);

        // Directional light (sun)
        const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
        sunLight.position.set(10, 20, 10);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.far = 50;
        sunLight.shadow.camera.left = -20;
        sunLight.shadow.camera.right = 20;
        sunLight.shadow.camera.top = 20;
        sunLight.shadow.camera.bottom = -20;
        this.scene.add(sunLight);

        // Point lights for atmosphere
        const pointLight1 = new THREE.PointLight(0x00d4ff, 0.4, 50);
        pointLight1.position.set(-15, 10, 20);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0x00ff88, 0.3, 50);
        pointLight2.position.set(15, 10, 20);
        this.scene.add(pointLight2);

        // Background
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        // Gradient background
        const gradient = ctx.createLinearGradient(0, 0, 0, 256);
        gradient.addColorStop(0, '#0a0a1a');
        gradient.addColorStop(1, '#1a3a3a');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 256, 256);

        const texture = new THREE.CanvasTexture(canvas);
        this.scene.background = texture;
    }

    async init() {
        console.log('⏳ Loading assets...');
        await this.assetManager.loadAllAssets();

        // Initialize game objects
        this.player = new Player(this.scene, this.assetManager);
        this.world = new World(this.scene, this.assetManager);

        // Input handlers
        this.inputManager.on('laneChange', (lane) => {
            this.player.setLane(lane);
            this.uiManager.updateLaneIndicator(lane);
        });

        this.inputManager.on('jump', () => {
            if (this.gameRunning) {
                this.player.jump();
            }
        });

        this.inputManager.on('roll', () => {
            if (this.gameRunning) {
                this.player.roll();
            }
        });

        this.inputManager.on('hoverboard', () => {
            if (this.gameRunning && !this.hoverboardActive) {
                this.activateHoverboard();
            }
        });

        // Window resize handler
        window.addEventListener('resize', () => this.onWindowResize());

        // Start game loop
        this.gameLoop();

        console.log('✓ Game initialized. Click START GAME to begin.');
    }

    activateHoverboard() {
        this.hoverboardActive = true;
        this.player.activatePowerUp('hoverboard');
        this.uiManager.showPowerUpNotification('hoverboard');

        // The hoverboard absorbs one collision
        setTimeout(() => {
            this.hoverboardActive = false;
        }, 8000);
    }

    gameLoop() {
        requestAnimationFrame(() => this.gameLoop());

        if (window.gameStarted && !this.gameRunning) {
            this.gameRunning = true;
        }

        if (!this.gameRunning) {
            this.renderer.render(this.scene, this.camera);
            return;
        }

        // Update game
        this.update();
        this.render();
    }

    update() {
        // Player update
        this.player.update();

        // Increment distance
        this.distanceTraveled += 0.1;

        // World update
        this.world.update(this.player.position.z);

        // Collision detection
        const collision = CollisionManager.checkPlayerCollisions(this.player, this.world);
        if (collision && !this.hoverboardActive) {
            this.gameOver();
            return;
        } else if (collision && this.hoverboardActive) {
            // Hoverboard absorbs collision
            this.hoverboardActive = false;
            const idx = this.world.getObstacles().indexOf(collision.object);
            if (idx > -1) {
                this.scene.remove(collision.object);
                this.world.getObstacles().splice(idx, 1);
            }
            return;
        }

        // Coin collection
        const collectedCoins = CollisionManager.checkCoinCollection(this.player, this.world);
        collectedCoins.forEach(coin => {
            const idx = this.world.getCoins().indexOf(coin);
            if (idx > -1) {
                this.scene.remove(coin);
                this.world.getCoins().splice(idx, 1);
            }
            this.coins++;
            this.uiManager.addCoin();
            this.uiManager.updateScore(10);
        });

        // Power-up collection
        const powerUp = CollisionManager.checkPowerUpCollection(this.player, this.world);
        if (powerUp) {
            this.scene.remove(powerUp);
            const idx = this.world.getPowerUps().indexOf(powerUp);
            if (idx > -1) {
                this.world.getPowerUps().splice(idx, 1);
            }

            this.uiManager.showPowerUpNotification(powerUp.type);

            switch (powerUp.type) {
                case 'jetpack':
                    this.player.activatePowerUp('jetpack');
                    this.player.position.y = 5; // Levitate
                    break;
                case 'magnet':
                    this.player.activatePowerUp('magnet');
                    break;
                case 'sneakers':
                    this.player.activatePowerUp('superSneakers');
                    break;
                case 'hoverboard':
                    this.activateHoverboard();
                    break;
            }
        }

        // Jetpack mechanics
        if (this.player.powerUps['jetpack']) {
            this.player.position.y = Math.max(this.player.position.y, 5);
            this.player.velocity.y = 0;
        }

        // Coin magnet
        if (this.player.powerUps['magnet']) {
            this.world.getCoins().forEach(coin => {
                const dx = this.player.position.x - coin.position.x;
                const dy = this.player.position.y - coin.position.y;
                const dz = this.player.position.z - coin.position.z;
                
                coin.position.x += dx * 0.1;
                coin.position.y += dy * 0.1;
                coin.position.z += dz * 0.1;
            });
        }

        // Score from distance
        this.uiManager.updateScore(0.05);
    }

    gameOver() {
        this.gameRunning = false;
        this.uiManager.showGameOver(this.uiManager.score, this.coins, this.distanceTraveled);
    }

    render() {
        // Update camera to follow player
        const targetCameraX = this.player.position.x;
        const targetCameraY = this.player.position.y + this.cameraHeight;
        const targetCameraZ = this.player.position.z + this.cameraDistance;

        this.camera.position.x += (targetCameraX - this.camera.position.x) * 0.1;
        this.camera.position.y += (targetCameraY - this.camera.position.y) * 0.1;
        this.camera.position.z += (targetCameraZ - this.camera.position.z) * 0.1;

        this.camera.lookAt(
            this.player.position.x,
            this.player.position.y,
            this.player.position.z + 5
        );

        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
}

// =====================================================
// INITIALIZE GAME
// =====================================================
window.addEventListener('DOMContentLoaded', () => {
    window.gameStarted = false;
    window.game = new TubgTungRun();
});
