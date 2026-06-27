import { BaseImageSourceProvider } from './BaseImageSourceProvider.js'
import sharp from 'sharp';
import axios from 'axios';

/**
 * GoogleMapsSource
 * Handles acquisition of Street View imagery.
 * Extends ImageSourceProvider to satisfy the agnostic framework contract.
 */
export class GoogleImageSource extends BaseImageSourceProvider {
    constructor(config, logger) {
        super();
        this.apiKey = (config.GOOGLE_MAPS_API_KEY || '').replace(/['";\s]/g, '');
        this.logger = logger || console;

        if (!this.apiKey) {
            this.logger.error('[ImageSource] Missing GOOGLE_MAPS_API_KEY in environment.');
        }
    }

    /**
     * Fetches 4 perspective images (N, E, S, W) from the Static API and 
     * stitches them horizontally to create a 360° cylindrical panorama.
     */
    async getImage(nodeId) {
        try {
            const headings = [0, 90, 180, 270];
            const size = 512;

            const requests = headings.map(heading => {
                const url = `https://maps.googleapis.com/maps/api/streetview?size=${size}x${size}&pano=${nodeId}&heading=${heading}&fov=90&pitch=0&key=${this.apiKey}`;
                return axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
            });

            const responses = await Promise.all(requests);

            const stitchedBuffer = await sharp({
                create: {
                    width: size * 4,
                    height: size,
                    channels: 3,
                    background: { r: 0, g: 0, b: 0 }
                }
            })
                .composite(responses.map((res, index) => ({
                    input: Buffer.from(res.data),
                    left: index * size,
                    top: 0
                })))
                .jpeg()
                .toBuffer();

            return await sharp(stitchedBuffer)
                .resize(1024, 512, { fit: 'fill' })
                .toBuffer();

        } catch (e) {
            this.logger.error(`[ImageSource Error] API failure for node ${nodeId}: ${e.message}`);
            throw e;
        }
    }
}