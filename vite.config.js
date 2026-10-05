import { defineConfig } from 'vite';
import {playbackMotionPlugin} from './tools/playback-motion.mjs';
import {compressedModelsPlugin} from './tools/compressed-models.mjs';
import {compressedSceneryPlugin} from './tools/compress-scenery.mjs';
export default defineConfig({ base: './', plugins:[playbackMotionPlugin(),compressedModelsPlugin(),compressedSceneryPlugin()], build: { chunkSizeWarningLimit: 900 } });
