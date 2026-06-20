import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp'; // You will need to add this to your server/package.json
import { ImageSourceProvider } from './ImageSourceProvider.js';

export class MarzipanoImageSource extends ImageSourceProvider {
    constructor(options, logger) {
        super();
        this.logger = logger || console;
        // The URL or local path where the pristine /tour folder is hosted
        this.tourPath = options.TOUR_PATH;
    }

    /**
     * Stitches the Marzipano tiles into a single Buffer for the Vision Engine.
     */
    async getImage(id) {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        this.logger.log(`[MarzipanoImageSource] Stitching tiles for scene: ${id}`);
        try {
            // Read the tour's data.js to find the tiling structure
            const absoluteFolderPath = path.resolve(__dirname, '..', this.tourPath);
            const dataRaw = await fs.readFile(path.join(absoluteFolderPath, 'data.js'), 'utf8');
            this.logger.log(`[MarzipanoImageSource] Read data.js from ${dataRaw}`);
            const data = JSON.parse(dataRaw.replace('var APP_DATA = ', '').trim().replace(/;$/, ''));
            const scene = data.scenes.find(s => s.id === id);

            if (!scene) throw new Error(`Scene ${id} not found in data.js`);

            // 2. Identify the highest resolution level (usually the last entry)
            const highestLevel = scene.levels[scene.levels.length - 1];
            const tileSize = highestLevel.tileSize;
            const gridSize = highestLevel.size / tileSize;

            // 3. Assemble tiles into an array for Sharp
            // Marzipano structure: tiles/{id}/{level}/{face}/{y}/{x}.jpg
            const composite = [];
            for (let y = 0; y < gridSize; y++) {
                for (let x = 0; x < gridSize; x++) {
                    const tilePath = path.join(absoluteFolderPath, 'tiles', id, String(scene.levels.length - 1), 'f', String(y), `${x}.jpg`);
                    composite.push({
                        input: await fs.readFile(tilePath),
                        top: y * tileSize,
                        left: x * tileSize
                    });
                }
            }

            // 4. Stitch back into one high-res equirectangular buffer
            return await sharp({
                create: {
                    width: highestLevel.size,
                    height: highestLevel.size,
                    channels: 3,
                    background: '#000'
                }
            })
                .composite(composite)
                .jpeg()
                .toBuffer();

        } catch (error) {
            this.logger.error(`[MarzipanoImageSource] Stitching failed for ${id}: ${error.message}`);
            throw error;
        }
    }
}